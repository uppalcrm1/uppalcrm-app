const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../database/connection');
const { getLicenseInfo, updateLicenses, getAllOrganizationsLicenses } = require('../controllers/licenseController');
const router = express.Router();

// Debug endpoint to test if routes are loading
router.get('/test', (req, res) => {
  res.json({
    message: 'Super Admin routes are working!',
    timestamp: new Date().toISOString(),
    jwt_secret_exists: !!process.env.JWT_SECRET,
    environment: process.env.NODE_ENV || 'development',
    version: '3.0 - Enhanced with comprehensive data'
  });
});

// Debug login endpoint
router.post('/debug-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 DEBUG login attempt for:', email);
    
    res.json({
      message: 'Debug endpoint working',
      received_email: email,
      received_password: password ? 'provided' : 'missing',
      jwt_secret_exists: !!process.env.JWT_SECRET,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Debug login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Super Admin Authentication Middleware
const authenticateSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.is_super_admin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const result = await query(
      'SELECT * FROM super_admin_users WHERE id = $1 AND is_active = true',
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid super admin user' });
    }

    req.superAdmin = result.rows[0];
    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Super Admin login attempt for:', email);

    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET not found in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const result = await query(
      'SELECT * FROM super_admin_users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    console.log('📊 Database query result:', result.rows.length, 'users found');

    if (result.rows.length === 0) {
      console.log('❌ No active super admin found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];
    console.log('👤 Found admin:', admin.email, 'ID:', admin.id);
    
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    console.log('🔒 Password validation result:', validPassword);
    
    if (!validPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query('UPDATE super_admin_users SET last_login = NOW() WHERE id = $1', [admin.id]);
    console.log('✅ Updated last_login for admin:', admin.id);

    const token = jwt.sign(
      { user_id: admin.id, email: admin.email, is_super_admin: true },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        first_name: admin.first_name,
        last_name: admin.last_name,
        role: admin.role,
        permissions: admin.permissions
      }
    });

  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test enhanced query
router.get('/test-enhanced', authenticateSuperAdmin, async (req, res) => {
  try {
    const sampleOrg = await query(`
      SELECT 
        o.id,
        o.name as organization_name,
        o.domain,
        o.subscription_plan,
        o.created_at,
        
        -- Admin contact info
        u.email as admin_email,
        u.first_name || ' ' || u.last_name as admin_name,
        u.role as admin_role,
        
        -- User count
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) as active_user_count,
        
        -- Trial data if available  
        COALESCE(tv.trial_status, 'no_trial') as trial_status,
        tv.days_remaining,
        
        -- Trial history
        (SELECT COUNT(*) FROM organization_trial_history WHERE organization_id = o.id) as total_trials
        
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
      LEFT JOIN trial_overview tv ON tv.organization_id = o.id
      WHERE o.is_active = true
      ORDER BY o.created_at DESC 
      LIMIT 2
    `);

    res.json({
      message: 'Enhanced query test',
      sample_organizations: sampleOrg.rows,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Enhanced query test error:', error);
    res.status(500).json({ 
      error: 'Enhanced query failed', 
      message: error.message,
      stack: error.stack 
    });
  }
});

// Check production database schema and trial data
router.get('/schema-check', authenticateSuperAdmin, async (req, res) => {
  try {
    const orgColumns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      ORDER BY ordinal_position
    `);

    const orgCount = await query('SELECT COUNT(*) FROM organizations');

    // Check trial history data
    let trialHistoryData = [];
    try {
      const trialHistory = await query('SELECT * FROM organization_trial_history LIMIT 5');
      trialHistoryData = trialHistory.rows;
    } catch (trialError) {
      console.log('Trial history not available:', trialError.message);
    }

    // Check trial overview
    let trialOverviewData = [];
    try {
      const trialOverview = await query('SELECT * FROM trial_overview LIMIT 3');
      trialOverviewData = trialOverview.rows;
    } catch (overviewError) {
      console.log('Trial overview not available:', overviewError.message);
    }

    // Sample organization with users
    const sampleOrg = await query(`
      SELECT 
        o.*,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count,
        (SELECT json_agg(json_build_object('email', email, 'first_name', first_name, 'last_name', last_name, 'role', role)) 
         FROM users WHERE organization_id = o.id LIMIT 3) as users
      FROM organizations o 
      ORDER BY o.created_at DESC
      LIMIT 1
    `);
    
    res.json({
      organizations_columns: orgColumns.rows,
      organizations_count: orgCount.rows[0].count,
      trial_history_sample: trialHistoryData,
      trial_overview_sample: trialOverviewData,
      sample_organization: sampleOrg.rows[0] || null,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Schema check error:', error);
    res.status(500).json({ 
      error: 'Schema check failed', 
      message: error.message 
    });
  }
});

// DASHBOARD
router.get('/dashboard', authenticateSuperAdmin, async (req, res) => {
  try {
    console.log('🔍 Super Admin dashboard request');

    // Overview using actual trial columns from organizations table
    const overview = await query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations WHERE trial_status = 'active') as active_trials,
        (SELECT COUNT(*) FROM organizations WHERE trial_status = 'expired') as expired_trials,
        (SELECT COUNT(*) FROM organizations WHERE payment_status = 'paid') as paid_customers,
        (SELECT COUNT(*) FROM organizations WHERE DATE(created_at) = CURRENT_DATE) as new_signups_today,
        (SELECT COUNT(*) FROM organizations WHERE trial_started_at IS NOT NULL AND DATE(trial_started_at) = CURRENT_DATE) as new_trials_today,
        (SELECT COUNT(*) FROM organizations WHERE trial_ends_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as expiring_next_7_days,
        (SELECT COUNT(*) FROM organizations WHERE trial_ends_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day') as expiring_tomorrow,
        (SELECT COUNT(*) FROM organizations) as total_organizations,
        (SELECT COUNT(*) FROM organizations WHERE is_active = true) as active_organizations,
        (SELECT COUNT(*) FROM organizations WHERE is_active = false) as inactive_organizations,
        (SELECT COUNT(*) FROM organizations WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days') as new_signups_week,
        (SELECT COUNT(*) FROM organizations WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days') as new_signups_month
    `);

    console.log('📊 Dashboard overview query result:', overview.rows[0]);

    // Check if platform_metrics table exists, if not return empty array
    let recentMetrics = { rows: [] };
    try {
      recentMetrics = await query(`
        SELECT date, new_organizations as new_signups, trials_converted as trial_conversions, churned_organizations as churn_count 
        FROM platform_metrics 
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY date DESC
        LIMIT 7
      `);
    } catch (metricsError) {
      console.log('Platform metrics table not available, skipping metrics query');
    }

    const topOrganizations = await query(`
      SELECT 
        o.id,
        o.name as organization_name,
        o.domain,
        o.subscription_plan,
        o.max_users,
        o.is_active,
        o.created_at,
        
        -- Admin contact info
        u.email as admin_email,
        u.first_name || ' ' || u.last_name as admin_name,
        u.last_login as admin_last_login,
        
        -- Actual trial data from organizations table
        o.trial_status,
        o.trial_started_at,
        o.trial_ends_at,
        o.payment_status,
        CASE 
          WHEN o.trial_ends_at IS NOT NULL THEN 
            EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE)
          ELSE NULL 
        END as days_remaining,
        
        -- Mock engagement score based on user activity (can be enhanced later)
        CASE 
          WHEN (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) >= 5 THEN 85
          WHEN (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) >= 3 THEN 65
          WHEN (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) >= 1 THEN 45
          ELSE 25
        END as engagement_score,
        
        -- User count
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) as active_users
        
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
      WHERE o.is_active = true
      ORDER BY o.created_at DESC 
      LIMIT 10
    `);

    // Recent organizations with full data
    const recentOrganizations = await query(`
      SELECT 
        o.id,
        o.name as organization_name,
        o.domain,
        o.subscription_plan,
        o.created_at,
        
        -- Admin contact
        u.email as admin_email,
        u.first_name || ' ' || u.last_name as admin_name,
        
        -- Actual trial data from organizations table
        o.trial_status,
        o.trial_started_at,
        o.trial_ends_at,
        CASE 
          WHEN o.trial_ends_at IS NOT NULL THEN 
            EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE)
          ELSE NULL 
        END as days_remaining,
        
        -- Activity metrics  
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) as active_users,
        0 as total_trials -- No trial history table exists yet
        
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
      WHERE o.is_active = true
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    // At risk trials
    const atRiskTrials = await query(`
      SELECT 
        o.id as organization_id,
        o.name as organization_name,
        u.first_name || ' ' || u.last_name as admin_name,
        u.email as admin_email,
        o.trial_ends_at,
        EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE) as days_remaining,
        CASE 
          WHEN EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE) <= 1 THEN 'Critical'
          WHEN EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE) <= 3 THEN 'High' 
          ELSE 'Medium'
        END as risk_level
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
      WHERE o.trial_status = 'active' 
        AND o.trial_ends_at IS NOT NULL
        AND o.trial_ends_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ORDER BY o.trial_ends_at ASC
      LIMIT 10
    `);

    res.json({
      overview: overview.rows[0],
      recent_metrics: recentMetrics.rows,
      top_organizations: topOrganizations.rows,
      recent_organizations: recentOrganizations.rows,
      at_risk_trials: atRiskTrials.rows,
      last_updated: new Date()
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET ORGANIZATIONS
router.get('/organizations', authenticateSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status !== 'all') {
      if (status === 'active') {
        whereClause += ` AND o.is_active = true`;
      } else if (status === 'inactive') {
        whereClause += ` AND o.is_active = false`;
      }
    }

    if (search) {
      whereClause += ` AND (o.name ILIKE $${params.length + 1} OR o.domain ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    const organizations = await query(`
      SELECT 
        o.id,
        o.name as organization_name,
        o.domain,
        o.subscription_plan,
        o.max_users,
        o.is_active,
        o.created_at,
        o.updated_at
      FROM organizations o
      ${whereClause}
      ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Enhance each organization with contact and trial info
    for (let org of organizations.rows) {
      try {
        // Get admin user info
        const adminUser = await query(`
          SELECT email, first_name, last_name, role, last_login 
          FROM users 
          WHERE organization_id = $1 AND role = 'admin' 
          LIMIT 1
        `, [org.id]);
        
        if (adminUser.rows.length > 0) {
          const admin = adminUser.rows[0];
          org.admin_email = admin.email;
          org.admin_name = `${admin.first_name} ${admin.last_name}`;
          org.admin_last_login = admin.last_login;
        }

        // Get user count
        const userCount = await query(`
          SELECT COUNT(*) as count FROM users WHERE organization_id = $1 AND is_active = true
        `, [org.id]);
        org.active_user_count = userCount.rows[0].count;

        // Get trial info directly from organizations table
        const orgDetails = await query(`
          SELECT trial_status, trial_started_at, trial_ends_at, payment_status,
          CASE 
            WHEN trial_ends_at IS NOT NULL THEN 
              EXTRACT(days FROM trial_ends_at - CURRENT_DATE)
            ELSE NULL 
          END as days_remaining
          FROM organizations WHERE id = $1
        `, [org.id]);
        
        if (orgDetails.rows.length > 0) {
          const details = orgDetails.rows[0];
          org.trial_status = details.trial_status || 'no_trial';
          org.trial_started_at = details.trial_started_at;
          org.trial_ends_at = details.trial_ends_at;
          org.days_remaining = details.days_remaining;
          org.payment_status = details.payment_status;
          
          // Calculate engagement score based on user activity
          org.engagement_score = org.active_user_count >= 5 ? 85 : 
                                org.active_user_count >= 3 ? 65 : 
                                org.active_user_count >= 1 ? 45 : 25;
        } else {
          org.trial_status = 'no_trial';
          org.engagement_score = 0;
        }

        // Set trial history count (table doesn't exist yet)
        org.total_trials = 0;

      } catch (enhanceError) {
        console.log(`Failed to enhance org ${org.id}:`, enhanceError.message);
      }
    }

    const totalResult = await query(`
      SELECT COUNT(*) as total 
      FROM organizations o
      ${whereClause}
    `, params);

    const total = parseInt(totalResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      organizations: organizations.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_records: total,
        total_pages: totalPages
      }
    });

  } catch (error) {
    console.error('Organizations list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// EXTEND TRIAL
router.put('/organizations/:id/trial', authenticateSuperAdmin, async (req, res) => {
  try {
    const organizationId = req.params.id;
    const { action, days = 0, reason } = req.body;

    await transaction(async (client) => {
      if (action === 'extend') {
        await client.query(`
          UPDATE organizations 
          SET trial_ends_at = trial_ends_at + make_interval(days => $2), updated_at = NOW()
          WHERE id = $1
        `, [organizationId, days]);

        await client.query(`
          INSERT INTO organization_notes (organization_id, admin_user_id, title, content, note_type)
          VALUES ($1, $2, 'Trial Extended', $3, 'support')
        `, [organizationId, req.superAdmin.id, `Trial extended by ${days} days. ${reason || ''}`]);
      }
    });

    res.json({ message: `Trial ${action} completed successfully` });

  } catch (error) {
    console.error('Trial management error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CONVERT TRIAL TO PAID WITH LICENSE SUPPORT
router.put('/organizations/:id/convert-to-paid', authenticateSuperAdmin, async (req, res) => {
  try {
    const organizationId = req.params.id;
    console.log('🔄 Trial conversion started for organization:', organizationId);
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      subscriptionPlan, 
      licenseCount, 
      paymentAmount, 
      billingCycle, 
      billingNotes 
    } = req.body;

    // Backward compatibility: Support both old and new formats
    const finalSubscriptionPlan = subscriptionPlan || 'standard';
    const finalLicenseCount = licenseCount || 1;
    const finalPaymentAmount = paymentAmount || (finalLicenseCount * 15);
    const finalBillingCycle = billingCycle || 'monthly';

    console.log('📊 Processed parameters:', {
      subscriptionPlan: finalSubscriptionPlan,
      licenseCount: finalLicenseCount,
      paymentAmount: finalPaymentAmount,
      billingCycle: finalBillingCycle
    });

    // Validate inputs
    if (!finalSubscriptionPlan || finalLicenseCount < 1 || !finalPaymentAmount) {
      console.log('❌ Validation failed:', { subscriptionPlan: finalSubscriptionPlan, licenseCount: finalLicenseCount, paymentAmount: finalPaymentAmount });
      return res.status(400).json({ 
        error: 'Subscription plan, license count, and payment amount are required' 
      });
    }

    // Get current organization to verify it's in trial status
    console.log('🔍 Checking organization status...');
    const orgCheck = await query(
      'SELECT trial_status, payment_status, name FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgCheck.rows.length === 0) {
      console.log('❌ Organization not found:', organizationId);
      return res.status(404).json({ error: 'Organization not found' });
    }

    const currentOrg = orgCheck.rows[0];
    console.log('📋 Current organization status:', currentOrg);

    if (currentOrg.trial_status !== 'active') {
      console.log('❌ Invalid trial status:', currentOrg.trial_status);
      return res.status(400).json({ 
        error: `Organization is not in active trial status. Current status: ${currentOrg.trial_status}` 
      });
    }

    // Begin transaction
    console.log('🔄 Starting database transaction...');
    await transaction(async (client) => {
      
      // Check if license columns exist in organizations table
      console.log('🔍 Checking database schema...');
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name IN ('purchased_licenses', 'billing_cycle', 'converted_at', 'billing_notes')
      `);
      
      const existingColumns = columnCheck.rows.map(row => row.column_name);
      console.log('📊 Available license columns:', existingColumns);

      // Build dynamic update query based on available columns
      let updateFields = [
        'trial_status = $1',
        'payment_status = $2', 
        'subscription_plan = $3',
        'updated_at = NOW()'
      ];
      let updateParams = ['converted', 'paid', finalSubscriptionPlan];
      let paramIndex = 4;

      if (existingColumns.includes('purchased_licenses')) {
        updateFields.push(`purchased_licenses = $${paramIndex++}`);
        updateParams.push(finalLicenseCount);
      }
      
      if (existingColumns.includes('billing_cycle')) {
        updateFields.push(`billing_cycle = $${paramIndex++}`);
        updateParams.push(finalBillingCycle);
      }
      
      if (existingColumns.includes('converted_at')) {
        updateFields.push(`converted_at = NOW()`);
      }
      
      if (existingColumns.includes('billing_notes') && billingNotes) {
        updateFields.push(`billing_notes = $${paramIndex++}`);
        updateParams.push(billingNotes);
      }

      updateParams.push(organizationId); // WHERE clause parameter
      
      const updateQuery = `
        UPDATE organizations 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND trial_status = 'active'
      `;
      
      console.log('📝 Update query:', updateQuery);
      console.log('📝 Update params:', updateParams);
      
      const updateResult = await client.query(updateQuery, updateParams);
      console.log('✅ Update query executed');
      console.log('📊 Rows affected:', updateResult.rowCount);
      console.log('📊 Update result:', updateResult);
      
      if (updateResult.rowCount === 0) {
        console.log('❌ CRITICAL: No rows were updated! Investigating...');
        
        // Check if organization exists
        const orgExists = await client.query('SELECT id, trial_status, payment_status FROM organizations WHERE id = $1', [organizationId]);
        console.log('📋 Organization exists check:', orgExists.rows);
        
        if (orgExists.rows.length === 0) {
          throw new Error(`Organization with ID ${organizationId} not found`);
        }
        
        const currentStatus = orgExists.rows[0];
        console.log('📊 Current organization status:', currentStatus);
        
        if (currentStatus.trial_status !== 'active') {
          throw new Error(`Cannot convert organization with trial_status: ${currentStatus.trial_status}. Must be 'active'.`);
        }
        
        // Try a simpler update to see if there are permission or other issues
        console.log('🔄 Attempting simple test update...');
        const testUpdate = await client.query(
          'UPDATE organizations SET updated_at = NOW() WHERE id = $1',
          [organizationId]
        );
        console.log('📊 Test update result:', testUpdate.rowCount);
        
        if (testUpdate.rowCount === 0) {
          throw new Error('Unable to update organization table - possible permission or constraint issue');
        }
      }

      // Try to create organization license record (if table exists)
      try {
        console.log('🔄 Creating organization license record...');
        await client.query(`
          INSERT INTO organization_licenses 
          (organization_id, quantity, price_per_license, billing_cycle, status, purchased_date)
          VALUES ($1, $2, $3, $4, 'active', NOW())
          ON CONFLICT (organization_id) 
          DO UPDATE SET 
            quantity = $2,
            price_per_license = $3,
            billing_cycle = $4,
            status = 'active',
            updated_at = NOW()
        `, [organizationId, finalLicenseCount, 15.00, finalBillingCycle]);
        console.log('✅ Created/updated organization license record');
      } catch (licenseError) {
        console.log('⚠️  License table operation failed (table may not exist):', licenseError.message);
      }

      // Try to create billing event (if table exists)
      try {
        console.log('🔄 Creating billing event...');
        const nextBillingDate = new Date();
        if (finalBillingCycle === 'quarterly') {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
        } else if (finalBillingCycle === 'annual') {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        await client.query(`
          INSERT INTO billing_events 
          (organization_id, billing_period_start, billing_period_end, licenses_count, price_per_license, total_amount, billing_status, payment_reference, notes)
          VALUES ($1, NOW(), $2, $3, $4, $5, 'paid', $6, $7)
        `, [
          organizationId,
          nextBillingDate,
          finalLicenseCount,
          15.00,
          parseFloat(finalPaymentAmount),
          'Initial conversion payment',
          billingNotes || ''
        ]);
        console.log('✅ Created billing event');
      } catch (billingError) {
        console.log('⚠️  Billing event creation failed (table may not exist):', billingError.message);
      }

      // Try to create license history entry (if table exists)
      try {
        console.log('🔄 Creating license history entry...');
        await client.query(`
          INSERT INTO license_usage_history 
          (organization_id, action, previous_count, new_count, price_change, reason, performed_by)
          VALUES ($1, 'added', 0, $2, $3, 'Initial trial conversion', $4)
        `, [
          organizationId,
          finalLicenseCount,
          parseFloat(finalPaymentAmount),
          req.superAdmin?.id
        ]);
        console.log('✅ Created license history entry');
      } catch (historyError) {
        console.log('⚠️  License history creation failed (table may not exist):', historyError.message);
      }

      // Try to update trial history (if table exists)
      try {
        console.log('🔄 Updating trial history...');
        await client.query(`
          UPDATE organization_trial_history 
          SET 
            trial_outcome = 'converted',
            converted_at = NOW()
          WHERE organization_id = $1 AND trial_outcome = 'active'
        `, [organizationId]);
        console.log('✅ Updated trial history');
      } catch (trialHistoryError) {
        console.log('⚠️  Trial history update failed (table may not exist):', trialHistoryError.message);
      }

      // Try to create audit log entry (if table exists)
      try {
        console.log('🔄 Creating audit log entry...');
        await client.query(`
          INSERT INTO audit_logs (organization_id, action, details, performed_by, performed_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [
          organizationId,
          'trial_converted_to_paid_with_licenses',
          JSON.stringify({
            subscriptionPlan: finalSubscriptionPlan,
            licenseCount: finalLicenseCount,
            paymentAmount: parseFloat(finalPaymentAmount),
            billingCycle: finalBillingCycle,
            billingNotes,
            convertedBy: req.superAdmin?.email || 'super_admin',
            previousStatus: currentOrg.trial_status,
            previousPaymentStatus: currentOrg.payment_status
          }),
          req.superAdmin?.email || 'super_admin'
        ]);
        console.log('✅ Created audit log entry');
      } catch (auditError) {
        console.log('⚠️  Audit log creation failed (table may not exist):', auditError.message);
      }
    });

    console.log('🎉 Trial conversion completed successfully');
    
    // Verify the update worked by querying the organization again
    console.log('🔍 Verifying conversion results...');
    const verificationQuery = await query(
      'SELECT trial_status, payment_status, subscription_plan FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    if (verificationQuery.rows.length > 0) {
      const finalStatus = verificationQuery.rows[0];
      console.log('📊 Final organization status after conversion:', finalStatus);
      
      if (finalStatus.trial_status !== 'converted' || finalStatus.payment_status !== 'paid') {
        console.log('⚠️  WARNING: Conversion may not have completed properly!');
        console.log('Expected: trial_status=converted, payment_status=paid');
        console.log('Actual:', finalStatus);
      }
    }

    const response = {
      success: true,
      message: `Successfully converted ${currentOrg.name} to paid with ${finalLicenseCount} licenses`,
      organization: {
        id: organizationId,
        name: currentOrg.name,
        trial_status: 'converted',
        payment_status: 'paid',
        subscription_plan: finalSubscriptionPlan,
        licenses: finalLicenseCount,
        monthly_cost: finalLicenseCount * 15,
        billing_cycle: finalBillingCycle,
        converted_at: new Date().toISOString()
      }
    };

    console.log('📤 Sending response:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('❌ Trial conversion error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error during conversion',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// BUSINESS LEADS
router.get('/business-leads', authenticateSuperAdmin, async (req, res) => {
  try {
    const { days = 30, temperature = 'all' } = req.query;

    let whereClause = `WHERE lead_date >= NOW() - INTERVAL '${days} days'`;
    if (temperature !== 'all') {
      whereClause += ` AND lead_temperature = '${temperature}'`;
    }

    const leads = await query(`
      SELECT * FROM business_leads ${whereClause}
      ORDER BY lead_date DESC LIMIT 50
    `);

    const summary = await query(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE lead_temperature = 'Hot') as hot_leads,
        COUNT(*) FILTER (WHERE lead_temperature = 'Warm') as warm_leads,
        COUNT(*) FILTER (WHERE lead_temperature = 'Cold') as cold_leads,
        AVG(engagement_score) as avg_engagement
      FROM business_leads ${whereClause}
    `);

    res.json({
      leads: leads.rows,
      summary: summary.rows[0]
    });

  } catch (error) {
    console.error('Business leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DIAGNOSTIC - Check what orgs exist (temporary endpoint)
router.get('/debug-organizations', authenticateSuperAdmin, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Checking organizations in production database');
    
    const orgs = await query(`
      SELECT 
        id,
        name,
        domain,
        trial_status,
        is_active,
        created_at
      FROM organizations 
      ORDER BY created_at DESC
    `);
    
    res.json({
      message: 'Production database organizations',
      total_count: orgs.rows.length,
      organizations: orgs.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('DEBUG organizations error:', error);
    res.status(500).json({ error: 'Debug failed', details: error.message });
  }
});

// DELETE ORGANIZATION
router.delete('/organizations/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const organizationId = req.params.id;
    console.log(`🗑️ Super Admin deletion request for organization: ${organizationId}`);

    // Get organization details first for logging
    const orgDetails = await query(
      'SELECT name, trial_status, created_at FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgDetails.rows.length === 0) {
      console.log(`❌ Organization ${organizationId} not found in database`);
      return res.status(404).json({ error: 'Organization not found' });
    }

    const org = orgDetails.rows[0];
    console.log(`📋 Deleting organization: "${org.name}" (${org.trial_status})`);

    // Pre-check which tables exist to avoid transaction errors
    console.log('🔍 Checking which tables exist in production...');
    const tableChecks = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user_sessions', 'organization_trial_history', 'organization_engagement', 'organization_subscriptions')
    `);
    
    const existingTables = new Set(tableChecks.rows.map(row => row.table_name));
    console.log('📋 Existing tables:', Array.from(existingTables));

    await transaction(async (client) => {
      // Delete in safe order to handle foreign key constraints
      console.log('🔄 Deleting related data...');

      // 1. Update contacts to remove user references
      await client.query(`
        UPDATE contacts 
        SET created_by = NULL, assigned_to = NULL 
        WHERE organization_id = $1
      `, [organizationId]);

      // 2. Delete user sessions (only if table exists)
      let sessionsDeleted = { rowCount: 0 };
      if (existingTables.has('user_sessions')) {
        sessionsDeleted = await client.query(`
          DELETE FROM user_sessions WHERE organization_id = $1
        `, [organizationId]);
        console.log(`✅ Deleted ${sessionsDeleted.rowCount} user sessions`);
      } else {
        console.log('⚠️ user_sessions table does not exist, skipping');
      }

      // 3. Delete organization trial history (only if table exists)
      let trialHistoryDeleted = { rowCount: 0 };
      if (existingTables.has('organization_trial_history')) {
        trialHistoryDeleted = await client.query(`
          DELETE FROM organization_trial_history WHERE organization_id = $1
        `, [organizationId]);
        console.log(`✅ Deleted ${trialHistoryDeleted.rowCount} trial history records`);
      } else {
        console.log('⚠️ organization_trial_history table does not exist, skipping');
      }

      // 4. Delete organization engagement records (only if table exists)
      let engagementDeleted = { rowCount: 0 };
      if (existingTables.has('organization_engagement')) {
        engagementDeleted = await client.query(`
          DELETE FROM organization_engagement WHERE organization_id = $1
        `, [organizationId]);
        console.log(`✅ Deleted ${engagementDeleted.rowCount} engagement records`);
      } else {
        console.log('⚠️ organization_engagement table does not exist, skipping');
      }

      // 5. Delete organization subscriptions (only if table exists)
      let subscriptionsDeleted = { rowCount: 0 };
      if (existingTables.has('organization_subscriptions')) {
        subscriptionsDeleted = await client.query(`
          DELETE FROM organization_subscriptions WHERE organization_id = $1
        `, [organizationId]);
        console.log(`✅ Deleted ${subscriptionsDeleted.rowCount} subscriptions`);
      } else {
        console.log('⚠️ organization_subscriptions table does not exist, skipping');
      }

      // 6. Delete contacts
      const contactsDeleted = await client.query(`
        DELETE FROM contacts WHERE organization_id = $1
      `, [organizationId]);

      // 7. Delete users
      const usersDeleted = await client.query(`
        DELETE FROM users WHERE organization_id = $1
      `, [organizationId]);

      // 8. Delete organization notes
      const notesDeleted = await client.query(`
        DELETE FROM organization_notes WHERE organization_id = $1
      `, [organizationId]);

      // 9. Delete the organization itself
      const orgDeleted = await client.query(`
        DELETE FROM organizations WHERE id = $1 RETURNING name
      `, [organizationId]);

      console.log(`✅ Deleted organization "${org.name}": ${usersDeleted.rowCount} users, ${contactsDeleted.rowCount} contacts, ${sessionsDeleted.rowCount} sessions, ${trialHistoryDeleted.rowCount} trial history, ${notesDeleted.rowCount} notes`);

      // Log the deletion for audit purposes (skip if schema doesn't match)
      try {
        // Check organization_notes table schema
        const notesSchema = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'organization_notes' 
            AND column_name IN ('admin_user_id', 'user_id', 'created_by')
        `);
        
        const hasAdminUserId = notesSchema.rows.some(row => row.column_name === 'admin_user_id');
        const hasUserId = notesSchema.rows.some(row => row.column_name === 'user_id');
        const hasCreatedBy = notesSchema.rows.some(row => row.column_name === 'created_by');
        
        if (hasAdminUserId) {
          await client.query(`
            INSERT INTO organization_notes (organization_id, admin_user_id, title, content, note_type)
            VALUES ($1, $2, 'Organization Deleted', $3, 'audit')
          `, [null, req.superAdmin.id, `Organization "${org.name}" deleted by super admin.`]);
        } else if (hasUserId) {
          await client.query(`
            INSERT INTO organization_notes (organization_id, user_id, title, content, note_type)
            VALUES ($1, $2, 'Organization Deleted', $3, 'audit')
          `, [null, req.superAdmin.id, `Organization "${org.name}" deleted by super admin.`]);
        } else if (hasCreatedBy) {
          await client.query(`
            INSERT INTO organization_notes (organization_id, created_by, title, content, note_type)
            VALUES ($1, $2, 'Organization Deleted', $3, 'audit')
          `, [null, req.superAdmin.id, `Organization "${org.name}" deleted by super admin.`]);
        } else {
          console.log('⚠️ organization_notes table schema incompatible for audit logging, skipping');
        }
      } catch (auditError) {
        console.log('⚠️ Failed to log audit entry:', auditError.message);
      }
    });

    res.json({
      message: 'Organization deleted successfully',
      organization: org.name,
      deleted_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Delete organization error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint,
      table: error.table,
      column: error.column
    });
    res.status(500).json({ 
      error: 'Failed to delete organization',
      debug: {
        message: error.message,
        code: error.code,
        constraint: error.constraint
      }
    });
  }
});

// EXPIRING TRIALS
router.get('/expiring-trials', authenticateSuperAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const expiringTrials = await query(`
      SELECT 
        o.id as organization_id,
        o.name as organization_name,
        u.first_name || ' ' || u.last_name as admin_name,
        u.email as admin_email,
        o.trial_ends_at,
        EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE) as days_remaining,
        o.trial_status,
        o.payment_status,
        CASE 
          WHEN EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE) <= 1 THEN 'High'
          WHEN EXTRACT(days FROM o.trial_ends_at - CURRENT_DATE) <= 3 THEN 'Medium' 
          ELSE 'Low'
        END as risk_level,
        -- Mock engagement score based on user activity
        CASE 
          WHEN (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) >= 5 THEN 85
          WHEN (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) >= 3 THEN 65
          WHEN (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) >= 1 THEN 45
          ELSE 25
        END as engagement_score
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
      WHERE o.trial_status = 'active' 
        AND o.trial_ends_at IS NOT NULL
        AND o.trial_ends_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
      ORDER BY o.trial_ends_at ASC
    `);

    const grouped = expiringTrials.rows.reduce((acc, trial) => {
      if (!acc[trial.risk_level]) acc[trial.risk_level] = [];
      acc[trial.risk_level].push(trial);
      return acc;
    }, {});

    res.json({
      expiring_trials: expiringTrials.rows,
      grouped_by_risk: grouped,
      total_expiring: expiringTrials.rows.length
    });

  } catch (error) {
    console.error('Expiring trials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DEBUG ENDPOINT - Check organization status after conversion
router.get('/debug/organization/:name', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`🔍 DEBUG: Checking organization status for: ${name}`);

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    // Query organization with ILIKE for case-insensitive search
    const result = await query(`
      SELECT 
        id,
        name,
        subscription_plan,
        trial_status,
        payment_status,
        is_active,
        created_at,
        updated_at,
        domain,
        max_users
      FROM organizations 
      WHERE name ILIKE $1
      ORDER BY created_at DESC
    `, [`%${name}%`]);

    if (result.rows.length === 0) {
      console.log(`❌ No organization found matching: ${name}`);
      return res.status(404).json({ 
        error: 'No organization found', 
        searched_name: name 
      });
    }

    console.log(`✅ Found ${result.rows.length} organization(s) matching: ${name}`);
    
    res.json({
      message: 'Organization status check',
      searched_name: name,
      organizations: result.rows,
      total_found: result.rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug organization check error:', error);
    res.status(500).json({ 
      error: 'Internal server error during organization check',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===============================
// LICENSE MANAGEMENT ROUTES
// ===============================

// Get all organizations with license information
router.get('/organizations/licenses', authenticateSuperAdmin, getAllOrganizationsLicenses);

// Get detailed license info for specific organization
router.get('/organizations/:organizationId/license-info', authenticateSuperAdmin, getLicenseInfo);

// Update licenses for organization
router.put('/organizations/:organizationId/licenses', authenticateSuperAdmin, updateLicenses);

module.exports = router;