const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class TrialController {
  // Start new trial
  async startTrial(req, res) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        contact_id,
        software_edition_id,
        device_registration_id,
        duration_hours = 24
      } = req.body;

      // Validate required fields
      if (!contact_id || !software_edition_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Missing required fields: contact_id, software_edition_id'
        });
      }

      // Check if software edition allows trials
      const editionResult = await client.query(`
        SELECT * FROM software_editions
        WHERE id = $1 AND organization_id = $2 AND is_trial_available = true AND is_active = true
      `, [software_edition_id, req.user.organization_id]);

      if (editionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Software edition not found or trial not available'
        });
      }

      const edition = editionResult.rows[0];
      const trialDuration = duration_hours || edition.trial_duration_hours || 24;

      // If device is specified, check if it already has an active trial/license for this edition
      if (device_registration_id) {
        const existingTrialResult = await client.query(`
          SELECT id FROM trials
          WHERE device_registration_id = $1
          AND software_edition_id = $2
          AND status = 'active'
          AND trial_end > NOW()
        `, [device_registration_id, software_edition_id]);

        const existingLicenseResult = await client.query(`
          SELECT id FROM software_licenses
          WHERE device_registration_id = $1
          AND software_edition_id = $2
          AND status = 'active'
          AND end_date > NOW()
        `, [device_registration_id, software_edition_id]);

        if (existingTrialResult.rows.length > 0 || existingLicenseResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            message: 'Device already has an active trial or license for this edition'
          });
        }
      }

      // Generate activation code
      let activationCode;
      let codeExists = true;
      let attempts = 0;

      while (codeExists && attempts < 10) {
        activationCode = this.generateActivationCode();
        const codeCheckResult = await client.query(
          'SELECT id FROM trials WHERE activation_code = $1',
          [activationCode]
        );
        codeExists = codeCheckResult.rows.length > 0;
        attempts++;
      }

      if (codeExists) {
        await client.query('ROLLBACK');
        return res.status(500).json({ message: 'Unable to generate unique activation code' });
      }

      // Calculate trial end date
      const trialStart = new Date();
      const trialEnd = new Date(trialStart.getTime() + (trialDuration * 60 * 60 * 1000));

      // Create trial
      const trialResult = await client.query(`
        INSERT INTO trials (
          organization_id, contact_id, software_edition_id, device_registration_id,
          trial_start, trial_end, duration_hours, activation_code, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        req.user.organization_id,
        contact_id,
        software_edition_id,
        device_registration_id,
        trialStart,
        trialEnd,
        trialDuration,
        activationCode,
        'active'
      ]);

      const trial = trialResult.rows[0];

      // Create download/activation record
      const downloadToken = crypto.randomBytes(32).toString('hex');
      const downloadExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const downloadResult = await client.query(`
        INSERT INTO downloads_activations (
          organization_id, trial_id, contact_id,
          download_token, download_expires_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        req.user.organization_id,
        trial.id,
        contact_id,
        downloadToken,
        downloadExpiresAt,
        'pending'
      ]);

      await client.query('COMMIT');

      // Fetch complete trial data
      const completeQuery = `
        SELECT
          t.*,
          c.first_name,
          c.last_name,
          c.email,
          se.name as edition_name,
          se.description as edition_description,
          dr.mac_address,
          dr.device_name,
          (t.trial_end - NOW()) as time_remaining
        FROM trials t
        JOIN contacts c ON t.contact_id = c.id
        JOIN software_editions se ON t.software_edition_id = se.id
        LEFT JOIN device_registrations dr ON t.device_registration_id = dr.id
        WHERE t.id = $1
      `;

      const completeResult = await pool.query(completeQuery, [trial.id]);
      const completeTrial = completeResult.rows[0];

      const downloadUrl = `${process.env.BASE_URL || 'http://localhost:3004'}/api/downloads/${downloadToken}`;

      res.status(201).json({
        message: 'Trial started successfully',
        trial: completeTrial,
        download_url: downloadUrl,
        download_expires_at: downloadExpiresAt
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error starting trial:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  // Get all trials with filtering
  async getTrials(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        contact_id,
        software_edition_id,
        search,
        sort_by = 'trial_start',
        sort_order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = ['t.organization_id = $1'];
      let queryParams = [req.user.organization_id];
      let paramCount = 1;

      // Add filters
      if (status) {
        paramCount++;
        whereConditions.push(`t.status = $${paramCount}`);
        queryParams.push(status);
      }

      if (contact_id) {
        paramCount++;
        whereConditions.push(`t.contact_id = $${paramCount}`);
        queryParams.push(contact_id);
      }

      if (software_edition_id) {
        paramCount++;
        whereConditions.push(`t.software_edition_id = $${paramCount}`);
        queryParams.push(software_edition_id);
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(
          t.activation_code ILIKE $${paramCount} OR
          c.first_name ILIKE $${paramCount} OR
          c.last_name ILIKE $${paramCount} OR
          c.email ILIKE $${paramCount} OR
          se.name ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Update expired trials
      await pool.query(`
        UPDATE trials
        SET status = 'expired'
        WHERE status = 'active' AND trial_end < NOW()
        AND organization_id = $1
      `, [req.user.organization_id]);

      // Main query
      const query = `
        SELECT
          t.*,
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
            WHEN t.trial_end < NOW() AND t.status = 'active' THEN 'expired'
            ELSE t.status
          END as computed_status,
          (t.trial_end - NOW()) as time_remaining,
          l.id as converted_license_id
        FROM trials t
        JOIN contacts c ON t.contact_id = c.id
        JOIN software_editions se ON t.software_edition_id = se.id
        LEFT JOIN device_registrations dr ON t.device_registration_id = dr.id
        LEFT JOIN software_licenses l ON t.converted_to_license_id = l.id
        WHERE ${whereClause}
        ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM trials t
        JOIN contacts c ON t.contact_id = c.id
        JOIN software_editions se ON t.software_edition_id = se.id
        LEFT JOIN device_registrations dr ON t.device_registration_id = dr.id
        WHERE ${whereClause}
      `;

      const [trialsResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2))
      ]);

      const trials = trialsResult.rows;
      const total = parseInt(countResult.rows[0].total);

      res.json({
        trials,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching trials:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get single trial
  async getTrial(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          t.*,
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
          l.id as converted_license_id,
          l.license_key as converted_license_key,
          CASE
            WHEN t.trial_end < NOW() AND t.status = 'active' THEN 'expired'
            ELSE t.status
          END as computed_status,
          (t.trial_end - NOW()) as time_remaining
        FROM trials t
        JOIN contacts c ON t.contact_id = c.id
        JOIN software_editions se ON t.software_edition_id = se.id
        LEFT JOIN device_registrations dr ON t.device_registration_id = dr.id
        LEFT JOIN software_licenses l ON t.converted_to_license_id = l.id
        WHERE t.id = $1 AND t.organization_id = $2
      `;

      const result = await pool.query(query, [id, req.user.organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Trial not found' });
      }

      const trial = result.rows[0];

      // Get download/activation history
      const downloadQuery = `
        SELECT da.*
        FROM downloads_activations da
        WHERE da.trial_id = $1
        ORDER BY da.created_at DESC
      `;

      const downloadResult = await pool.query(downloadQuery, [id]);
      trial.download_history = downloadResult.rows;

      res.json({ trial });
    } catch (error) {
      console.error('Error fetching trial:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Convert trial to license
  async convertTrial(req, res) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const {
        billing_cycle,
        purchase_price,
        payment_method,
        payment_reference,
        auto_renew = true
      } = req.body;

      // Validate required fields
      if (!billing_cycle || purchase_price === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Missing required fields: billing_cycle, purchase_price'
        });
      }

      // Get trial details
      const trialResult = await client.query(`
        SELECT t.*, se.name as edition_name
        FROM trials t
        JOIN software_editions se ON t.software_edition_id = se.id
        WHERE t.id = $1 AND t.organization_id = $2
      `, [id, req.user.organization_id]);

      if (trialResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Trial not found' });
      }

      const trial = trialResult.rows[0];

      // Check if trial is already converted
      if (trial.status === 'converted') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Trial is already converted' });
      }

      // Check if trial is expired (allow conversion of expired trials)
      // if (trial.status === 'expired' || new Date(trial.trial_end) < new Date()) {
      //   await client.query('ROLLBACK');
      //   return res.status(400).json({ message: 'Cannot convert expired trial' });
      // }

      // If trial has a device, check if device already has a license
      if (trial.device_registration_id) {
        const existingLicenseResult = await client.query(`
          SELECT id FROM software_licenses
          WHERE device_registration_id = $1
          AND status = 'active'
          AND end_date > NOW()
        `, [trial.device_registration_id]);

        if (existingLicenseResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            message: 'Device already has an active license'
          });
        }
      }

      // Generate license key
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

      // Calculate license dates
      const startDate = new Date();
      const endDate = this.calculateEndDate(startDate, billing_cycle);

      // Create license
      const licenseResult = await client.query(`
        INSERT INTO software_licenses (
          organization_id, contact_id, software_edition_id, device_registration_id,
          license_key, billing_cycle, purchase_price, start_date, end_date,
          is_auto_renew, converted_from_trial_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        req.user.organization_id,
        trial.contact_id,
        trial.software_edition_id,
        trial.device_registration_id,
        licenseKey,
        billing_cycle,
        purchase_price,
        startDate,
        endDate,
        auto_renew,
        trial.id,
        req.user.id
      ]);

      const license = licenseResult.rows[0];

      // Update trial status
      await client.query(`
        UPDATE trials
        SET status = 'converted',
            converted_to_license_id = $1,
            conversion_date = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [license.id, trial.id]);

      // Create renewal subscription if auto-renew is enabled
      if (auto_renew) {
        await client.query(`
          INSERT INTO renewals_subscriptions (
            organization_id, contact_id, license_id,
            current_period_start, current_period_end, next_renewal_date,
            billing_cycle, renewal_price, auto_renew
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          req.user.organization_id,
          trial.contact_id,
          license.id,
          startDate,
          endDate,
          endDate,
          billing_cycle,
          purchase_price,
          true
        ]);
      }

      // Create payment record if payment info provided
      if (payment_reference) {
        await client.query(`
          INSERT INTO billing_payments (
            organization_id, contact_id, license_id,
            payment_reference, payment_method, amount, total_amount,
            billing_period_start, billing_period_end, billing_cycle,
            status, payment_date, processed_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          req.user.organization_id,
          trial.contact_id,
          license.id,
          payment_reference,
          payment_method || 'manual',
          purchase_price,
          purchase_price,
          startDate,
          endDate,
          billing_cycle,
          'completed',
          new Date(),
          req.user.id
        ]);
      }

      await client.query('COMMIT');

      res.json({
        message: 'Trial converted to license successfully',
        license,
        trial_id: trial.id
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error converting trial:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  // Get trials for a specific contact
  async getContactTrials(req, res) {
    try {
      const { contactId } = req.params;
      const { status } = req.query;

      let whereClause = 'WHERE t.contact_id = $1 AND t.organization_id = $2';
      let queryParams = [contactId, req.user.organization_id];

      if (status) {
        whereClause += ' AND t.status = $3';
        queryParams.push(status);
      }

      // Update expired trials first
      await pool.query(`
        UPDATE trials
        SET status = 'expired'
        WHERE status = 'active' AND trial_end < NOW()
        AND organization_id = $1
      `, [req.user.organization_id]);

      const query = `
        SELECT
          t.*,
          se.name as edition_name,
          se.version as edition_version,
          dr.mac_address,
          dr.device_name,
          dr.device_type,
          CASE
            WHEN t.trial_end < NOW() AND t.status = 'active' THEN 'expired'
            ELSE t.status
          END as computed_status,
          (t.trial_end - NOW()) as time_remaining,
          l.id as converted_license_id,
          l.license_key as converted_license_key
        FROM trials t
        JOIN software_editions se ON t.software_edition_id = se.id
        LEFT JOIN device_registrations dr ON t.device_registration_id = dr.id
        LEFT JOIN software_licenses l ON t.converted_to_license_id = l.id
        ${whereClause}
        ORDER BY t.trial_start DESC
      `;

      const result = await pool.query(query, queryParams);

      res.json({ trials: result.rows });
    } catch (error) {
      console.error('Error fetching contact trials:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Cancel trial
  async cancelTrial(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE trials
        SET status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP,
            notes = COALESCE(notes, '') || '\nCancelled: ' || $3
        WHERE id = $1 AND organization_id = $2 AND status = 'active'
        RETURNING *
      `, [id, req.user.organization_id, reason || 'Manual cancellation']);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Active trial not found' });
      }

      res.json({
        message: 'Trial cancelled successfully',
        trial: result.rows[0]
      });
    } catch (error) {
      console.error('Error cancelling trial:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Helper methods
  generateActivationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

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
}

module.exports = new TrialController();