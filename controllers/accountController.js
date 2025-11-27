const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class AccountController {
  // Get all account subscriptions with filtering and pagination
  async getAccountSubscriptions(req, res) {
    const client = await db.pool.connect();

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

      // Set RLS context for organization isolation
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_organization_id',
        req.user.organization_id
      ]);

      const offset = (page - 1) * limit;
      let whereConditions = ['a.organization_id = $1'];
      let queryParams = [req.user.organization_id];
      let paramCount = 1;

      // Add filters
      if (status) {
        paramCount++;
        whereConditions.push(`a.license_status = $${paramCount}`);
        queryParams.push(status);
      }

      if (contact_id) {
        paramCount++;
        whereConditions.push(`a.contact_id = $${paramCount}`);
        queryParams.push(contact_id);
      }

      if (software_edition_id) {
        paramCount++;
        whereConditions.push(`a.product_id = $${paramCount}`);
        queryParams.push(software_edition_id);
      }

      if (device_id) {
        paramCount++;
        whereConditions.push(`a.id = $${paramCount}`);
        queryParams.push(device_id);
      }

      if (billing_cycle) {
        paramCount++;
        whereConditions.push(`a.billing_cycle = $${paramCount}`);
        queryParams.push(billing_cycle);
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(
          a.account_name ILIKE $${paramCount} OR
          a.mac_address ILIKE $${paramCount} OR
          c.first_name ILIKE $${paramCount} OR
          c.last_name ILIKE $${paramCount} OR
          c.email ILIKE $${paramCount} OR
          a.edition ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Main query - Query from 'accounts' table (where lead conversions create records)
      const query = `
        SELECT
          a.*,
          c.first_name,
          c.last_name,
          CONCAT(c.first_name, ' ', c.last_name) as contact_name,
          c.email,
          c.email as contact_email,
          c.company,
          a.edition as edition_name,
          a.mac_address,
          a.device_name,
          -- Calculate monthly cost based on billing cycle
          CASE
            WHEN a.billing_cycle = 'monthly' THEN a.price
            WHEN a.billing_cycle = 'quarterly' THEN a.price / 3
            WHEN a.billing_cycle = 'semi-annual' THEN a.price / 6
            WHEN a.billing_cycle = 'annual' THEN a.price / 12
            ELSE a.price
          END as monthly_cost,
          -- Add next renewal date (trial_end_date for trials, otherwise calculate from created_at)
          CASE
            WHEN a.is_trial = true THEN a.trial_end_date
            WHEN a.billing_cycle = 'monthly' THEN a.created_at + INTERVAL '1 month'
            WHEN a.billing_cycle = 'quarterly' THEN a.created_at + INTERVAL '3 months'
            WHEN a.billing_cycle = 'semi-annual' THEN a.created_at + INTERVAL '6 months'
            WHEN a.billing_cycle = 'annual' THEN a.created_at + INTERVAL '12 months'
          END as next_renewal_date,
          -- Calculate days until expiry
          CASE
            WHEN a.is_trial = true THEN EXTRACT(DAY FROM (a.trial_end_date - NOW()))
            WHEN a.billing_cycle = 'monthly' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '1 month') - NOW()))
            WHEN a.billing_cycle = 'quarterly' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '3 months') - NOW()))
            WHEN a.billing_cycle = 'semi-annual' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '6 months') - NOW()))
            WHEN a.billing_cycle = 'annual' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '12 months') - NOW()))
          END as days_until_expiry,
          -- Computed status
          a.account_type as computed_status,
          a.license_status as status
        FROM accounts a
        JOIN contacts c ON a.contact_id = c.id
        WHERE ${whereClause}
        ORDER BY a.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM accounts a
        JOIN contacts c ON a.contact_id = c.id
        WHERE ${whereClause}
      `;

      const [subscriptionsResult, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, queryParams.slice(0, -2))
      ]);

      const subscriptions = subscriptionsResult.rows;
      const total = parseInt(countResult.rows[0].total);

      res.json({
        subscriptions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching account subscriptions:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  // Get single account subscription by ID
  async getAccountSubscription(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          s.*,
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
          ar.auto_renew,
          ar.next_renewal_date,
          ar.renewal_price,
          CASE
            WHEN s.end_date < NOW() THEN 'expired'
            WHEN s.end_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE s.status
          END as computed_status,
          (s.end_date - NOW()) as time_remaining
        FROM account_subscriptions s
        JOIN contacts c ON s.contact_id = c.id
        JOIN software_editions se ON s.software_edition_id = se.id
        JOIN device_registrations dr ON s.device_registration_id = dr.id
        LEFT JOIN trials t ON s.converted_from_trial_id = t.id
        LEFT JOIN account_renewals ar ON s.id = ar.account_subscription_id
        WHERE s.id = $1 AND s.organization_id = $2
      `;

      const result = await pool.query(query, [id, req.user.organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Account subscription not found' });
      }

      const subscription = result.rows[0];

      // Get transfer history
      const transferQuery = `
        SELECT
          at.*,
          from_device.mac_address as from_mac_address,
          from_device.device_name as from_device_name,
          to_device.mac_address as to_mac_address,
          to_device.device_name as to_device_name,
          u.first_name as processed_by_first_name,
          u.last_name as processed_by_last_name
        FROM account_transfers at
        LEFT JOIN device_registrations from_device ON at.from_device_id = from_device.id
        LEFT JOIN device_registrations to_device ON at.to_device_id = to_device.id
        LEFT JOIN users u ON at.processed_by = u.id
        WHERE at.account_subscription_id = $1
        ORDER BY at.transfer_date DESC
      `;

      const transferResult = await pool.query(transferQuery, [id]);
      subscription.transfer_history = transferResult.rows;

      // Get download/activation history
      const downloadQuery = `
        SELECT
          ada.*
        FROM account_downloads_activations ada
        WHERE ada.account_subscription_id = $1
        ORDER BY ada.created_at DESC
      `;

      const downloadResult = await pool.query(downloadQuery, [id]);
      subscription.download_history = downloadResult.rows;

      // Get payment history
      const paymentQuery = `
        SELECT
          abp.*
        FROM account_billing_payments abp
        WHERE abp.account_subscription_id = $1
        ORDER BY abp.created_at DESC
      `;

      const paymentResult = await pool.query(paymentQuery, [id]);
      subscription.payment_history = paymentResult.rows;

      res.json({ subscription });
    } catch (error) {
      console.error('Error fetching account subscription:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Create new account subscription
  async createAccountSubscription(req, res) {
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

      // Check if device already has an active subscription
      const existingSubscriptionQuery = `
        SELECT id FROM account_subscriptions
        WHERE device_registration_id = $1
        AND status IN ('active', 'trial')
        AND end_date > NOW()
        AND organization_id = $2
      `;

      const existingResult = await client.query(existingSubscriptionQuery, [device_registration_id, req.user.organization_id]);

      if (existingResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Device already has an active subscription'
        });
      }

      // Generate unique subscription key
      let subscriptionKey;
      let keyExists = true;
      let attempts = 0;

      while (keyExists && attempts < 10) {
        subscriptionKey = this.generateSubscriptionKey();
        const keyCheckResult = await client.query(
          'SELECT id FROM account_subscriptions WHERE subscription_key = $1',
          [subscriptionKey]
        );
        keyExists = keyCheckResult.rows.length > 0;
        attempts++;
      }

      if (keyExists) {
        await client.query('ROLLBACK');
        return res.status(500).json({ message: 'Unable to generate unique subscription key' });
      }

      // Calculate end date based on billing cycle
      const endDate = this.calculateEndDate(new Date(start_date), billing_cycle);

      // Create subscription
      const subscriptionQuery = `
        INSERT INTO account_subscriptions (
          organization_id, contact_id, software_edition_id, device_registration_id,
          subscription_key, billing_cycle, purchase_price, start_date, end_date,
          is_auto_renew, converted_from_trial_id, created_by, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const subscriptionResult = await client.query(subscriptionQuery, [
        req.user.organization_id,
        contact_id,
        software_edition_id,
        device_registration_id,
        subscriptionKey,
        billing_cycle,
        purchase_price,
        start_date,
        endDate,
        auto_renew,
        converted_from_trial_id,
        req.user.id,
        notes
      ]);

      const subscription = subscriptionResult.rows[0];

      // Create renewal record if auto-renew is enabled
      if (auto_renew) {
        const renewalQuery = `
          INSERT INTO account_renewals (
            organization_id, contact_id, account_subscription_id,
            current_period_start, current_period_end, next_renewal_date,
            billing_cycle, renewal_price, auto_renew
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        await client.query(renewalQuery, [
          req.user.organization_id,
          contact_id,
          subscription.id,
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
          INSERT INTO account_billing_payments (
            organization_id, contact_id, account_subscription_id,
            payment_reference, payment_method, amount, total_amount,
            billing_period_start, billing_period_end, billing_cycle,
            status, payment_date, processed_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;

        await client.query(paymentQuery, [
          req.user.organization_id,
          contact_id,
          subscription.id,
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
          'UPDATE trials SET status = $1, converted_to_subscription_id = $2, conversion_date = $3 WHERE id = $4',
          ['converted', subscription.id, new Date(), converted_from_trial_id]
        );
      }

      // Schedule renewal alerts
      await this.scheduleRenewalAlerts(client, subscription.id, contact_id, endDate, req.user.organization_id);

      await client.query('COMMIT');

      // Fetch complete subscription data
      const completeQuery = `
        SELECT
          s.*,
          c.first_name,
          c.last_name,
          c.email,
          se.name as edition_name,
          dr.mac_address,
          dr.device_name
        FROM account_subscriptions s
        JOIN contacts c ON s.contact_id = c.id
        JOIN software_editions se ON s.software_edition_id = se.id
        JOIN device_registrations dr ON s.device_registration_id = dr.id
        WHERE s.id = $1
      `;

      const completeResult = await pool.query(completeQuery, [subscription.id]);

      res.status(201).json({
        message: 'Account subscription created successfully',
        subscription: completeResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating account subscription:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  // Update account subscription
  async updateAccountSubscription(req, res) {
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

      // Check if subscription exists
      const existingResult = await pool.query(
        'SELECT * FROM account_subscriptions WHERE id = $1 AND organization_id = $2',
        [id, req.user.organization_id]
      );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({ message: 'Account subscription not found' });
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
        UPDATE account_subscriptions
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
        RETURNING *
      `;

      const result = await pool.query(query, updateValues);

      res.json({
        message: 'Account subscription updated successfully',
        subscription: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating account subscription:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Transfer account subscription to different device
  async transferAccountSubscription(req, res) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { to_device_id, reason, transfer_type = 'customer_request' } = req.body;

      if (!to_device_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Target device ID is required' });
      }

      // Get current subscription
      const subscriptionResult = await client.query(
        'SELECT * FROM account_subscriptions WHERE id = $1 AND organization_id = $2',
        [id, req.user.organization_id]
      );

      if (subscriptionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Account subscription not found' });
      }

      const subscription = subscriptionResult.rows[0];

      // Check if subscription is active
      if (subscription.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Only active subscriptions can be transferred' });
      }

      // Check if target device belongs to same contact
      const deviceResult = await client.query(
        'SELECT * FROM device_registrations WHERE id = $1 AND contact_id = $2 AND organization_id = $3',
        [to_device_id, subscription.contact_id, req.user.organization_id]
      );

      if (deviceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Target device not found or belongs to different contact' });
      }

      // Check if target device already has an active subscription
      const existingSubscriptionResult = await client.query(
        'SELECT id FROM account_subscriptions WHERE device_registration_id = $1 AND status = $2 AND end_date > NOW()',
        [to_device_id, 'active']
      );

      if (existingSubscriptionResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Target device already has an active subscription' });
      }

      // Calculate time loss (customer loses some days when transferring)
      const currentDate = new Date();
      const originalEndDate = new Date(subscription.end_date);
      const remainingDays = Math.ceil((originalEndDate - currentDate) / (1000 * 60 * 60 * 24));
      const daysLost = Math.min(Math.ceil(remainingDays * 0.1), 7); // Lose 10% of remaining time, max 7 days
      const newEndDate = new Date(originalEndDate.getTime() - (daysLost * 24 * 60 * 60 * 1000));

      // Create transfer record
      const transferResult = await client.query(`
        INSERT INTO account_transfers (
          organization_id, account_subscription_id, contact_id,
          from_device_id, to_device_id, old_end_date, new_end_date,
          days_lost, reason, transfer_type, processed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        req.user.organization_id,
        subscription.id,
        subscription.contact_id,
        subscription.device_registration_id,
        to_device_id,
        originalEndDate,
        newEndDate,
        daysLost,
        reason,
        transfer_type,
        req.user.id
      ]);

      // Update subscription with new device and end date
      await client.query(`
        UPDATE account_subscriptions
        SET device_registration_id = $1,
            end_date = $2,
            transfer_count = transfer_count + 1,
            last_transfer_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [to_device_id, newEndDate, subscription.id]);

      // Update renewal record end date
      await client.query(`
        UPDATE account_renewals
        SET current_period_end = $1, next_renewal_date = $2
        WHERE account_subscription_id = $3
      `, [newEndDate, newEndDate, subscription.id]);

      await client.query('COMMIT');

      res.json({
        message: 'Account subscription transferred successfully',
        transfer: transferResult.rows[0],
        days_lost: daysLost,
        new_end_date: newEndDate
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error transferring account subscription:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  // Generate download link
  async generateDownload(req, res) {
    try {
      const { id } = req.params;

      // Get subscription details
      const subscriptionResult = await pool.query(`
        SELECT s.*, se.name as edition_name
        FROM account_subscriptions s
        JOIN software_editions se ON s.software_edition_id = se.id
        WHERE s.id = $1 AND s.organization_id = $2
      `, [id, req.user.organization_id]);

      if (subscriptionResult.rows.length === 0) {
        return res.status(404).json({ message: 'Account subscription not found' });
      }

      const subscription = subscriptionResult.rows[0];

      // Generate download token
      const downloadToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create download record
      const downloadResult = await pool.query(`
        INSERT INTO account_downloads_activations (
          organization_id, account_subscription_id, contact_id,
          download_token, download_expires_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        req.user.organization_id,
        subscription.id,
        subscription.contact_id,
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

  // Get account subscriptions for a specific contact
  async getContactAccountSubscriptions(req, res) {
    try {
      const { contactId } = req.params;
      const { status } = req.query;

      let whereClause = 'WHERE s.contact_id = $1 AND s.organization_id = $2';
      let queryParams = [contactId, req.user.organization_id];

      if (status) {
        whereClause += ' AND s.status = $3';
        queryParams.push(status);
      }

      const query = `
        SELECT
          s.*,
          se.name as edition_name,
          se.version as edition_version,
          dr.mac_address,
          dr.device_name,
          dr.device_type,
          CASE
            WHEN s.end_date < NOW() THEN 'expired'
            WHEN s.end_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE s.status
          END as computed_status,
          (s.end_date - NOW()) as time_remaining
        FROM account_subscriptions s
        JOIN software_editions se ON s.software_edition_id = se.id
        JOIN device_registrations dr ON s.device_registration_id = dr.id
        ${whereClause}
        ORDER BY s.created_at DESC
      `;

      const result = await pool.query(query, queryParams);

      res.json({ subscriptions: result.rows });
    } catch (error) {
      console.error('Error fetching contact account subscriptions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Deactivate account subscription
  async deactivateAccountSubscription(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE account_subscriptions
        SET status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP,
            notes = COALESCE(notes, '') || '\nDeactivated: ' || $3
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `, [id, req.user.organization_id, reason || 'Manual deactivation']);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Account subscription not found' });
      }

      // Cancel auto-renewal
      await pool.query(
        'UPDATE account_renewals SET status = $1 WHERE account_subscription_id = $2',
        ['cancelled', id]
      );

      res.json({
        message: 'Account subscription deactivated successfully',
        subscription: result.rows[0]
      });
    } catch (error) {
      console.error('Error deactivating account subscription:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Helper methods
  generateSubscriptionKey() {
    const prefix = 'UPPAL-';
    const randomPart = crypto.randomBytes(10).toString('hex').toUpperCase();
    return prefix + randomPart;
  }

  // Legacy method for backward compatibility
  generateLicenseKey() {
    return this.generateSubscriptionKey();
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

  async scheduleRenewalAlerts(client, subscriptionId, contactId, endDate, organizationId) {
    const alertDays = [30, 14, 7, 1];

    for (const days of alertDays) {
      const scheduledDate = new Date(endDate);
      scheduledDate.setDate(scheduledDate.getDate() - days);

      if (scheduledDate > new Date()) {
        await client.query(`
          INSERT INTO account_alerts (
            organization_id, account_subscription_id, contact_id,
            alert_type, days_before_expiry, scheduled_date
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          organizationId,
          subscriptionId,
          contactId,
          'expiry_warning',
          days,
          scheduledDate
        ]);
      }
    }
  }

  // Middleware to check if organization has reached subscription limit
  async checkSubscriptionLimit(req, res, next) {
    try {
      // For now, we'll allow unlimited users
      // This can be updated later to check organization subscription limits
      return next();
    } catch (error) {
      console.error('Error checking subscription limit:', error);
      return next(); // Allow the request to continue even if check fails
    }
  }
}

module.exports = new AccountController();