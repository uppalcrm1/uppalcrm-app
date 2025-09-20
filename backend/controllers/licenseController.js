const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class LicenseController {
  // Get all licenses with filtering and pagination
  async getLicenses(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        contact_id,
        software_edition_id,
        device_id,
        billing_cycle,
        search,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = ['l.organization_id = $1'];
      let queryParams = [req.user.organization_id];
      let paramCount = 1;

      // Add filters
      if (status) {
        paramCount++;
        whereConditions.push(`l.status = $${paramCount}`);
        queryParams.push(status);
      }

      if (contact_id) {
        paramCount++;
        whereConditions.push(`l.contact_id = $${paramCount}`);
        queryParams.push(contact_id);
      }

      if (software_edition_id) {
        paramCount++;
        whereConditions.push(`l.software_edition_id = $${paramCount}`);
        queryParams.push(software_edition_id);
      }

      if (device_id) {
        paramCount++;
        whereConditions.push(`l.device_registration_id = $${paramCount}`);
        queryParams.push(device_id);
      }

      if (billing_cycle) {
        paramCount++;
        whereConditions.push(`l.billing_cycle = $${paramCount}`);
        queryParams.push(billing_cycle);
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(
          l.license_key ILIKE $${paramCount} OR
          c.first_name ILIKE $${paramCount} OR
          c.last_name ILIKE $${paramCount} OR
          c.email ILIKE $${paramCount} OR
          se.name ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Main query
      const query = `
        SELECT
          l.*,
          c.first_name,
          c.last_name,
          c.email,
          c.company,
          se.name as edition_name,
          se.version as edition_version,
          dr.mac_address,
          dr.device_name,
          dr.device_type,
          CASE
            WHEN l.end_date < NOW() THEN 'expired'
            WHEN l.end_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE l.status
          END as computed_status,
          (l.end_date - NOW()) as time_remaining
        FROM software_licenses l
        JOIN contacts c ON l.contact_id = c.id
        JOIN software_editions se ON l.software_edition_id = se.id
        JOIN device_registrations dr ON l.device_registration_id = dr.id
        WHERE ${whereClause}
        ORDER BY l.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM software_licenses l
        JOIN contacts c ON l.contact_id = c.id
        JOIN software_editions se ON l.software_edition_id = se.id
        JOIN device_registrations dr ON l.device_registration_id = dr.id
        WHERE ${whereClause}
      `;

      const [licensesResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2))
      ]);

      const licenses = licensesResult.rows;
      const total = parseInt(countResult.rows[0].total);

      res.json({
        licenses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching licenses:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get single license by ID
  async getLicense(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          l.*,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company,
          se.name as edition_name,
          se.description as edition_description,
          se.version as edition_version,
          se.features as edition_features,
          dr.mac_address,
          dr.device_name,
          dr.device_type,
          dr.hardware_hash,
          dr.os_info,
          dr.device_specs,
          dr.last_seen as device_last_seen,
          t.id as trial_id,
          t.trial_start,
          t.trial_end,
          rs.auto_renew,
          rs.next_renewal_date,
          rs.renewal_price,
          CASE
            WHEN l.end_date < NOW() THEN 'expired'
            WHEN l.end_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE l.status
          END as computed_status,
          (l.end_date - NOW()) as time_remaining
        FROM software_licenses l
        JOIN contacts c ON l.contact_id = c.id
        JOIN software_editions se ON l.software_edition_id = se.id
        JOIN device_registrations dr ON l.device_registration_id = dr.id
        LEFT JOIN trials t ON l.converted_from_trial_id = t.id
        LEFT JOIN renewals_subscriptions rs ON l.id = rs.license_id
        WHERE l.id = $1 AND l.organization_id = $2
      `;

      const result = await pool.query(query, [id, req.user.organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'License not found' });
      }

      const license = result.rows[0];

      // Get transfer history
      const transferQuery = `
        SELECT
          lt.*,
          from_device.mac_address as from_mac_address,
          from_device.device_name as from_device_name,
          to_device.mac_address as to_mac_address,
          to_device.device_name as to_device_name,
          u.first_name as processed_by_first_name,
          u.last_name as processed_by_last_name
        FROM license_transfers lt
        LEFT JOIN device_registrations from_device ON lt.from_device_id = from_device.id
        LEFT JOIN device_registrations to_device ON lt.to_device_id = to_device.id
        LEFT JOIN users u ON lt.processed_by = u.id
        WHERE lt.license_id = $1
        ORDER BY lt.transfer_date DESC
      `;

      const transferResult = await pool.query(transferQuery, [id]);
      license.transfer_history = transferResult.rows;

      // Get download/activation history
      const downloadQuery = `
        SELECT
          da.*
        FROM downloads_activations da
        WHERE da.license_id = $1
        ORDER BY da.created_at DESC
      `;

      const downloadResult = await pool.query(downloadQuery, [id]);
      license.download_history = downloadResult.rows;

      // Get payment history
      const paymentQuery = `
        SELECT
          bp.*
        FROM billing_payments bp
        WHERE bp.license_id = $1
        ORDER BY bp.created_at DESC
      `;

      const paymentResult = await pool.query(paymentQuery, [id]);
      license.payment_history = paymentResult.rows;

      res.json({ license });
    } catch (error) {
      console.error('Error fetching license:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Create new license
  async createLicense(req, res) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        contact_id,
        software_edition_id,
        device_registration_id,
        billing_cycle,
        purchase_price,
        start_date = new Date(),
        auto_renew = true,
        payment_method,
        payment_reference,
        converted_from_trial_id,
        notes
      } = req.body;

      // Validate required fields
      if (!contact_id || !software_edition_id || !device_registration_id || !billing_cycle || purchase_price === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Missing required fields: contact_id, software_edition_id, device_registration_id, billing_cycle, purchase_price'
        });
      }

      // Check if device already has an active license
      const existingLicenseQuery = `
        SELECT id FROM software_licenses
        WHERE device_registration_id = $1
        AND status IN ('active', 'trial')
        AND end_date > NOW()
        AND organization_id = $2
      `;

      const existingResult = await client.query(existingLicenseQuery, [device_registration_id, req.user.organization_id]);

      if (existingResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Device already has an active license'
        });
      }

      // Generate unique license key
      let licenseKey;
      let keyExists = true;
      let attempts = 0;

      while (keyExists && attempts < 10) {
        licenseKey = this.generateLicenseKey();
        const keyCheckResult = await client.query(
          'SELECT id FROM software_licenses WHERE license_key = $1',
          [licenseKey]
        );
        keyExists = keyCheckResult.rows.length > 0;
        attempts++;
      }

      if (keyExists) {
        await client.query('ROLLBACK');
        return res.status(500).json({ message: 'Unable to generate unique license key' });
      }

      // Calculate end date based on billing cycle
      const endDate = this.calculateEndDate(new Date(start_date), billing_cycle);

      // Create license
      const licenseQuery = `
        INSERT INTO software_licenses (
          organization_id, contact_id, software_edition_id, device_registration_id,
          license_key, billing_cycle, purchase_price, start_date, end_date,
          is_auto_renew, converted_from_trial_id, created_by, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const licenseResult = await client.query(licenseQuery, [
        req.user.organization_id,
        contact_id,
        software_edition_id,
        device_registration_id,
        licenseKey,
        billing_cycle,
        purchase_price,
        start_date,
        endDate,
        auto_renew,
        converted_from_trial_id,
        req.user.id,
        notes
      ]);

      const license = licenseResult.rows[0];

      // Create renewal subscription if auto-renew is enabled
      if (auto_renew) {
        const renewalQuery = `
          INSERT INTO renewals_subscriptions (
            organization_id, contact_id, license_id,
            current_period_start, current_period_end, next_renewal_date,
            billing_cycle, renewal_price, auto_renew
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        await client.query(renewalQuery, [
          req.user.organization_id,
          contact_id,
          license.id,
          start_date,
          endDate,
          endDate,
          billing_cycle,
          purchase_price,
          true
        ]);
      }

      // Create payment record if payment info provided
      if (payment_reference) {
        const paymentQuery = `
          INSERT INTO billing_payments (
            organization_id, contact_id, license_id,
            payment_reference, payment_method, amount, total_amount,
            billing_period_start, billing_period_end, billing_cycle,
            status, payment_date, processed_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;

        await client.query(paymentQuery, [
          req.user.organization_id,
          contact_id,
          license.id,
          payment_reference,
          payment_method || 'manual',
          purchase_price,
          purchase_price,
          start_date,
          endDate,
          billing_cycle,
          'completed',
          new Date(),
          req.user.id
        ]);
      }

      // Update trial status if converted from trial
      if (converted_from_trial_id) {
        await client.query(
          'UPDATE trials SET status = $1, converted_to_license_id = $2, conversion_date = $3 WHERE id = $4',
          ['converted', license.id, new Date(), converted_from_trial_id]
        );
      }

      // Schedule renewal alerts
      await this.scheduleRenewalAlerts(client, license.id, contact_id, endDate, req.user.organization_id);

      await client.query('COMMIT');

      // Fetch complete license data
      const completeQuery = `
        SELECT
          l.*,
          c.first_name,
          c.last_name,
          c.email,
          se.name as edition_name,
          dr.mac_address,
          dr.device_name
        FROM software_licenses l
        JOIN contacts c ON l.contact_id = c.id
        JOIN software_editions se ON l.software_edition_id = se.id
        JOIN device_registrations dr ON l.device_registration_id = dr.id
        WHERE l.id = $1
      `;

      const completeResult = await pool.query(completeQuery, [license.id]);

      res.status(201).json({
        message: 'License created successfully',
        license: completeResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating license:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  // Update license
  async updateLicense(req, res) {
    try {
      const { id } = req.params;
      const {
        status,
        end_date,
        is_auto_renew,
        notes,
        billing_cycle,
        renewal_price
      } = req.body;

      // Check if license exists
      const existingResult = await pool.query(
        'SELECT * FROM software_licenses WHERE id = $1 AND organization_id = $2',
        [id, req.user.organization_id]
      );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({ message: 'License not found' });
      }

      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        updateValues.push(status);
      }

      if (end_date) {
        paramCount++;
        updateFields.push(`end_date = $${paramCount}`);
        updateValues.push(end_date);
      }

      if (is_auto_renew !== undefined) {
        paramCount++;
        updateFields.push(`is_auto_renew = $${paramCount}`);
        updateValues.push(is_auto_renew);
      }

      if (notes !== undefined) {
        paramCount++;
        updateFields.push(`notes = $${paramCount}`);
        updateValues.push(notes);
      }

      if (billing_cycle) {
        paramCount++;
        updateFields.push(`billing_cycle = $${paramCount}`);
        updateValues.push(billing_cycle);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id, req.user.organization_id);

      const query = `
        UPDATE software_licenses
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
        RETURNING *
      `;

      const result = await pool.query(query, updateValues);

      res.json({
        message: 'License updated successfully',
        license: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating license:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Transfer license to different device
  async transferLicense(req, res) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { to_device_id, reason, transfer_type = 'customer_request' } = req.body;

      if (!to_device_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Target device ID is required' });
      }

      // Get current license
      const licenseResult = await client.query(
        'SELECT * FROM software_licenses WHERE id = $1 AND organization_id = $2',
        [id, req.user.organization_id]
      );

      if (licenseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'License not found' });
      }

      const license = licenseResult.rows[0];

      // Check if license is active
      if (license.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Only active licenses can be transferred' });
      }

      // Check if target device belongs to same contact
      const deviceResult = await client.query(
        'SELECT * FROM device_registrations WHERE id = $1 AND contact_id = $2 AND organization_id = $3',
        [to_device_id, license.contact_id, req.user.organization_id]
      );

      if (deviceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Target device not found or belongs to different contact' });
      }

      // Check if target device already has an active license
      const existingLicenseResult = await client.query(
        'SELECT id FROM software_licenses WHERE device_registration_id = $1 AND status = $2 AND end_date > NOW()',
        [to_device_id, 'active']
      );

      if (existingLicenseResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Target device already has an active license' });
      }

      // Calculate time loss (customer loses some days when transferring)
      const currentDate = new Date();
      const originalEndDate = new Date(license.end_date);
      const remainingDays = Math.ceil((originalEndDate - currentDate) / (1000 * 60 * 60 * 24));
      const daysLost = Math.min(Math.ceil(remainingDays * 0.1), 7); // Lose 10% of remaining time, max 7 days
      const newEndDate = new Date(originalEndDate.getTime() - (daysLost * 24 * 60 * 60 * 1000));

      // Create transfer record
      const transferResult = await client.query(`
        INSERT INTO license_transfers (
          organization_id, license_id, contact_id,
          from_device_id, to_device_id, old_end_date, new_end_date,
          days_lost, reason, transfer_type, processed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        req.user.organization_id,
        license.id,
        license.contact_id,
        license.device_registration_id,
        to_device_id,
        originalEndDate,
        newEndDate,
        daysLost,
        reason,
        transfer_type,
        req.user.id
      ]);

      // Update license with new device and end date
      await client.query(`
        UPDATE software_licenses
        SET device_registration_id = $1,
            end_date = $2,
            transfer_count = transfer_count + 1,
            last_transfer_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [to_device_id, newEndDate, license.id]);

      // Update renewal subscription end date
      await client.query(`
        UPDATE renewals_subscriptions
        SET current_period_end = $1, next_renewal_date = $2
        WHERE license_id = $3
      `, [newEndDate, newEndDate, license.id]);

      await client.query('COMMIT');

      res.json({
        message: 'License transferred successfully',
        transfer: transferResult.rows[0],
        days_lost: daysLost,
        new_end_date: newEndDate
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error transferring license:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  // Generate download link
  async generateDownload(req, res) {
    try {
      const { id } = req.params;

      // Get license details
      const licenseResult = await pool.query(`
        SELECT l.*, se.name as edition_name
        FROM software_licenses l
        JOIN software_editions se ON l.software_edition_id = se.id
        WHERE l.id = $1 AND l.organization_id = $2
      `, [id, req.user.organization_id]);

      if (licenseResult.rows.length === 0) {
        return res.status(404).json({ message: 'License not found' });
      }

      const license = licenseResult.rows[0];

      // Generate download token
      const downloadToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create download record
      const downloadResult = await pool.query(`
        INSERT INTO downloads_activations (
          organization_id, license_id, contact_id,
          download_token, download_expires_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        req.user.organization_id,
        license.id,
        license.contact_id,
        downloadToken,
        expiresAt,
        'pending'
      ]);

      const downloadUrl = `${process.env.BASE_URL || 'http://localhost:3004'}/api/downloads/${downloadToken}`;

      res.json({
        message: 'Download link generated successfully',
        download_url: downloadUrl,
        expires_at: expiresAt,
        download_id: downloadResult.rows[0].id
      });
    } catch (error) {
      console.error('Error generating download:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get licenses for a specific contact
  async getContactLicenses(req, res) {
    try {
      const { contactId } = req.params;
      const { status } = req.query;

      let whereClause = 'WHERE l.contact_id = $1 AND l.organization_id = $2';
      let queryParams = [contactId, req.user.organization_id];

      if (status) {
        whereClause += ' AND l.status = $3';
        queryParams.push(status);
      }

      const query = `
        SELECT
          l.*,
          se.name as edition_name,
          se.version as edition_version,
          dr.mac_address,
          dr.device_name,
          dr.device_type,
          CASE
            WHEN l.end_date < NOW() THEN 'expired'
            WHEN l.end_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE l.status
          END as computed_status,
          (l.end_date - NOW()) as time_remaining
        FROM software_licenses l
        JOIN software_editions se ON l.software_edition_id = se.id
        JOIN device_registrations dr ON l.device_registration_id = dr.id
        ${whereClause}
        ORDER BY l.created_at DESC
      `;

      const result = await pool.query(query, queryParams);

      res.json({ licenses: result.rows });
    } catch (error) {
      console.error('Error fetching contact licenses:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Deactivate license
  async deactivateLicense(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE software_licenses
        SET status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP,
            notes = COALESCE(notes, '') || '\nDeactivated: ' || $3
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `, [id, req.user.organization_id, reason || 'Manual deactivation']);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'License not found' });
      }

      // Cancel auto-renewal
      await pool.query(
        'UPDATE renewals_subscriptions SET status = $1 WHERE license_id = $2',
        ['cancelled', id]
      );

      res.json({
        message: 'License deactivated successfully',
        license: result.rows[0]
      });
    } catch (error) {
      console.error('Error deactivating license:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Helper methods
  generateLicenseKey() {
    const prefix = 'UPPAL-';
    const randomPart = crypto.randomBytes(10).toString('hex').toUpperCase();
    return prefix + randomPart;
  }

  calculateEndDate(startDate, billingCycle) {
    const start = new Date(startDate);

    switch (billingCycle) {
      case 'monthly':
        return new Date(start.setMonth(start.getMonth() + 1));
      case 'quarterly':
        return new Date(start.setMonth(start.getMonth() + 3));
      case 'semi_annual':
        return new Date(start.setMonth(start.getMonth() + 6));
      case 'annual':
        return new Date(start.setFullYear(start.getFullYear() + 1));
      default:
        return new Date(start.setMonth(start.getMonth() + 1));
    }
  }

  async scheduleRenewalAlerts(client, licenseId, contactId, endDate, organizationId) {
    const alertDays = [30, 14, 7, 1];

    for (const days of alertDays) {
      const scheduledDate = new Date(endDate);
      scheduledDate.setDate(scheduledDate.getDate() - days);

      if (scheduledDate > new Date()) {
        await client.query(`
          INSERT INTO renewal_alerts (
            organization_id, license_id, contact_id,
            alert_type, days_before_expiry, scheduled_date
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          organizationId,
          licenseId,
          contactId,
          'expiry_warning',
          days,
          scheduledDate
        ]);
      }
    }
  }
}

module.exports = new LicenseController();