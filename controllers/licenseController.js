const { query, transaction } = require('../database/connection');

// Get organization license information
const getLicenseInfo = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await query(`
      SELECT 
        o.id,
        o.name,
        o.purchased_licenses,
        o.license_price_per_user,
        o.billing_cycle,
        o.next_billing_date,
        o.payment_status,
        ol.quantity as current_licenses,
        ol.status as license_status,
        ol.next_billing_date as license_next_billing,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) as active_users,
        (COALESCE(ol.quantity, o.purchased_licenses) * COALESCE(ol.price_per_license, o.license_price_per_user)) as monthly_cost,
        (COALESCE(ol.quantity, o.purchased_licenses) - (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true)) as available_seats
      FROM organizations o
      LEFT JOIN organization_licenses ol ON o.id = ol.organization_id AND ol.status = 'active'
      WHERE o.id = $1
    `, [organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const licenseInfo = result.rows[0];

    // Get recent license history
    const historyResult = await query(`
      SELECT 
        luh.*,
        u.first_name || ' ' || u.last_name as performed_by_name
      FROM license_usage_history luh
      LEFT JOIN users u ON luh.performed_by = u.id
      WHERE luh.organization_id = $1 
      ORDER BY luh.performed_at DESC 
      LIMIT 10
    `, [organizationId]);

    res.json({
      organization: {
        id: licenseInfo.id,
        name: licenseInfo.name,
        payment_status: licenseInfo.payment_status
      },
      licensing: {
        purchased_licenses: licenseInfo.current_licenses || licenseInfo.purchased_licenses,
        price_per_user: licenseInfo.license_price_per_user,
        billing_cycle: licenseInfo.billing_cycle,
        next_billing_date: licenseInfo.license_next_billing || licenseInfo.next_billing_date,
        monthly_cost: licenseInfo.monthly_cost,
        license_status: licenseInfo.license_status || 'active'
      },
      usage: {
        active_users: parseInt(licenseInfo.active_users),
        available_seats: parseInt(licenseInfo.available_seats),
        utilization_percentage: Math.round((licenseInfo.active_users / (licenseInfo.current_licenses || licenseInfo.purchased_licenses)) * 100)
      },
      recent_changes: historyResult.rows
    });

  } catch (error) {
    console.error('Get license info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update organization licenses (Super Admin only)
const updateLicenses = async (req, res) => {
  try {
    console.log('🔧 UPDATE LICENSES: Starting license update process');
    console.log('🔧 Request params:', req.params);
    console.log('🔧 Request body:', req.body);
    console.log('🔧 Super Admin user:', req.superAdmin?.id);
    
    const { organizationId } = req.params;
    const { newLicenseCount, reason, effectiveDate } = req.body;

    if (!newLicenseCount || newLicenseCount < 1) {
      return res.status(400).json({ error: 'License count must be at least 1' });
    }

    // Get current license info
    const currentResult = await query(`
      SELECT 
        COALESCE(ol.quantity, o.purchased_licenses, 5) as current_count,
        COALESCE(ol.price_per_license, o.license_price_per_user, 15.00) as price_per_license,
        o.name
      FROM organizations o
      LEFT JOIN organization_licenses ol ON ol.organization_id = o.id AND ol.status = 'active'
      WHERE o.id = $1
    `, [organizationId]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const currentLicense = currentResult.rows[0];
    const previousCount = parseInt(currentLicense.current_count);
    const pricePerLicense = parseFloat(currentLicense.price_per_license);
    const orgName = currentLicense.name;

    // Check if organization has too many active users for the new license count
    const userCountResult = await query(`
      SELECT COUNT(*) as active_users 
      FROM users 
      WHERE organization_id = $1 AND is_active = true
    `, [organizationId]);

    const activeUsers = parseInt(userCountResult.rows[0].active_users);

    if (newLicenseCount < activeUsers) {
      return res.status(400).json({ 
        error: `Cannot reduce licenses below active user count. Active users: ${activeUsers}, Requested licenses: ${newLicenseCount}`,
        activeUsers,
        requestedLicenses: newLicenseCount
      });
    }

    // Update organizations table (core functionality)
    console.log('🔧 Updating organizations table...');
    await query(`
      UPDATE organizations 
      SET purchased_licenses = $1, max_users = $1, updated_at = NOW()
      WHERE id = $2
    `, [newLicenseCount, organizationId]);
    
    // Try to update advanced tables if they exist, but don't fail if they don't
    try {
      console.log('🔧 Attempting to update organization_licenses table...');
      await query(`
        INSERT INTO organization_licenses 
        (organization_id, quantity, price_per_license, billing_cycle, status, updated_at, notes)
        VALUES ($1, $2, $3, 'monthly', 'active', NOW(), $4)
        ON CONFLICT (organization_id) 
        DO UPDATE SET 
          quantity = $2,
          updated_at = NOW(),
          notes = COALESCE(organization_licenses.notes, '') || CASE WHEN organization_licenses.notes IS NOT NULL THEN '; ' ELSE '' END || $4
      `, [organizationId, newLicenseCount, pricePerLicense, reason || 'Manual license update']);
      console.log('✅ organization_licenses table updated successfully');
    } catch (licenseTableError) {
      console.warn('⚠️ organization_licenses table update failed (table may not exist):', licenseTableError.message);
    }

    // Try to record history if table exists
    try {
      console.log('🔧 Attempting to record license history...');
      await query(`
        INSERT INTO license_usage_history 
        (organization_id, action, previous_count, new_count, price_change, reason, performed_by, effective_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        organizationId,
        newLicenseCount > previousCount ? 'added' : 'removed',
        previousCount,
        newLicenseCount,
        (newLicenseCount - previousCount) * pricePerLicense,
        reason || 'Manual license adjustment',
        req.superAdmin?.id,
        effectiveDate || new Date()
      ]);
      console.log('✅ License history recorded successfully');
    } catch (historyError) {
      console.warn('⚠️ License history recording failed (table may not exist):', historyError.message);
    }

    // Try to create billing event if table exists
    try {
      console.log('🔧 Attempting to create billing event...');
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      await query(`
        INSERT INTO billing_events 
        (organization_id, billing_period_start, billing_period_end, licenses_count, price_per_license, total_amount, billing_status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
      `, [
        organizationId,
        new Date(),
        nextMonth,
        newLicenseCount,
        pricePerLicense,
        newLicenseCount * pricePerLicense,
        `License count changed from ${previousCount} to ${newLicenseCount}. ${reason || ''}`
      ]);
      console.log('✅ Billing event created successfully');
    } catch (billingError) {
      console.warn('⚠️ Billing event creation failed (table may not exist):', billingError.message);
    }

    res.json({
      success: true,
      message: `Successfully updated ${orgName} from ${previousCount} to ${newLicenseCount} licenses`,
      changes: {
        previous_licenses: previousCount,
        new_licenses: newLicenseCount,
        license_change: newLicenseCount - previousCount,
        new_monthly_cost: newLicenseCount * pricePerLicense,
        cost_change: (newLicenseCount - previousCount) * pricePerLicense
      }
    });

  } catch (error) {
    console.error('❌ UPDATE LICENSES ERROR:', error.message);
    console.error('❌ Full error:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check license limits before adding users
const checkLicenseLimit = async (req, res, next) => {
  try {
    const organizationId = req.user?.organizationId || req.organizationId;

    const result = await query(`
      SELECT 
        COALESCE(ol.quantity, o.purchased_licenses, 5) as purchased_licenses,
        (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) as active_users
      FROM organizations o
      LEFT JOIN organization_licenses ol ON ol.organization_id = o.id AND ol.status = 'active'
      WHERE o.id = $1
    `, [organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { purchased_licenses, active_users } = result.rows[0];

    if (active_users >= purchased_licenses) {
      return res.status(403).json({
        error: 'License limit reached',
        message: `You have ${active_users} active users and ${purchased_licenses} licenses. Please purchase more licenses to add users.`,
        active_users: parseInt(active_users),
        purchased_licenses: parseInt(purchased_licenses),
        available_seats: parseInt(purchased_licenses) - parseInt(active_users)
      });
    }

    // Add license info to request for use in next middleware
    req.licenseInfo = {
      purchased_licenses: parseInt(purchased_licenses),
      active_users: parseInt(active_users),
      available_seats: parseInt(purchased_licenses) - parseInt(active_users)
    };

    next();

  } catch (error) {
    console.error('License limit check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all organizations with license info (Super Admin only)
const getAllOrganizationsLicenses = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        o.id,
        o.name,
        o.payment_status,
        COALESCE(ol.quantity, o.purchased_licenses, 5) as purchased_licenses,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) as active_users,
        ol.status as license_status,
        ol.next_billing_date,
        COALESCE(ol.price_per_license, o.license_price_per_user, 15.00) as price_per_user
      FROM organizations o
      LEFT JOIN organization_licenses ol ON o.id = ol.organization_id AND ol.status = 'active'
      WHERE o.is_active = true
      ORDER BY o.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get organizations licenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getLicenseInfo,
  updateLicenses,
  checkLicenseLimit,
  getAllOrganizationsLicenses
};