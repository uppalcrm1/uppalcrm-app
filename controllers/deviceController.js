const pool = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

class DeviceController {
  // Register new device
  async registerDevice(req, res) {
    try {
      const {
        contact_id,
        mac_address,
        device_name,
        device_type = 'Desktop',
        hardware_hash,
        os_info = {},
        device_specs = {}
      } = req.body;

      // Validate required fields
      if (!contact_id || !mac_address) {
        return res.status(400).json({
          message: 'Missing required fields: contact_id, mac_address'
        });
      }

      // Validate MAC address format
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(mac_address)) {
        return res.status(400).json({
          message: 'Invalid MAC address format. Expected format: XX:XX:XX:XX:XX:XX'
        });
      }

      // Normalize MAC address to uppercase with colons
      const normalizedMac = mac_address.toUpperCase().replace(/[-]/g, ':');

      // Check if contact exists and belongs to the organization
      const contactResult = await pool.query(
        'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
        [contact_id, req.user.organization_id]
      );

      if (contactResult.rows.length === 0) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      // Check if MAC address already exists for this organization
      const existingDeviceResult = await pool.query(
        'SELECT id, contact_id, is_active FROM device_registrations WHERE mac_address = $1 AND organization_id = $2',
        [normalizedMac, req.user.organization_id]
      );

      if (existingDeviceResult.rows.length > 0) {
        const existingDevice = existingDeviceResult.rows[0];

        // If device exists but is inactive, reactivate it
        if (!existingDevice.is_active) {
          const reactivatedResult = await pool.query(`
            UPDATE device_registrations
            SET is_active = true,
                contact_id = $1,
                device_name = $2,
                device_type = $3,
                hardware_hash = $4,
                os_info = $5,
                device_specs = $6,
                last_seen = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
          `, [
            contact_id,
            device_name,
            device_type,
            hardware_hash,
            os_info,
            device_specs,
            existingDevice.id
          ]);

          return res.json({
            message: 'Device reactivated successfully',
            device: reactivatedResult.rows[0]
          });
        }

        // If device belongs to different contact, return error
        if (existingDevice.contact_id !== contact_id) {
          return res.status(409).json({
            message: 'MAC address already registered to a different contact'
          });
        }

        // If device belongs to same contact, update device info
        const updatedResult = await pool.query(`
          UPDATE device_registrations
          SET device_name = $1,
              device_type = $2,
              hardware_hash = $3,
              os_info = $4,
              device_specs = $5,
              last_seen = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING *
        `, [
          device_name,
          device_type,
          hardware_hash,
          os_info,
          device_specs,
          existingDevice.id
        ]);

        return res.json({
          message: 'Device information updated successfully',
          device: updatedResult.rows[0]
        });
      }

      // Register new device
      const deviceResult = await pool.query(`
        INSERT INTO device_registrations (
          organization_id, contact_id, mac_address, device_name, device_type,
          hardware_hash, os_info, device_specs, registration_ip, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        req.user.organization_id,
        contact_id,
        normalizedMac,
        device_name,
        device_type,
        hardware_hash,
        os_info,
        device_specs,
        req.ip,
        req.get('User-Agent')
      ]);

      res.status(201).json({
        message: 'Device registered successfully',
        device: deviceResult.rows[0]
      });
    } catch (error) {
      console.error('Error registering device:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get all devices with filtering
  async getDevices(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        contact_id,
        device_type,
        is_active,
        search,
        sort_by = 'registration_date',
        sort_order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = ['dr.organization_id = $1'];
      let queryParams = [req.user.organization_id];
      let paramCount = 1;

      // Add filters
      if (contact_id) {
        paramCount++;
        whereConditions.push(`dr.contact_id = $${paramCount}`);
        queryParams.push(contact_id);
      }

      if (device_type) {
        paramCount++;
        whereConditions.push(`dr.device_type = $${paramCount}`);
        queryParams.push(device_type);
      }

      if (is_active !== undefined) {
        paramCount++;
        whereConditions.push(`dr.is_active = $${paramCount}`);
        queryParams.push(is_active === 'true');
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(
          dr.mac_address ILIKE $${paramCount} OR
          dr.device_name ILIKE $${paramCount} OR
          dr.device_type ILIKE $${paramCount} OR
          c.first_name ILIKE $${paramCount} OR
          c.last_name ILIKE $${paramCount} OR
          c.email ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Main query
      const query = `
        SELECT
          dr.*,
          c.first_name,
          c.last_name,
          c.email,
          c.company,
          COUNT(l.id) as license_count,
          COUNT(CASE WHEN l.status = 'active' AND l.end_date > NOW() THEN 1 END) as active_license_count,
          COUNT(t.id) as trial_count,
          COUNT(CASE WHEN t.status = 'active' AND t.trial_end > NOW() THEN 1 END) as active_trial_count
        FROM device_registrations dr
        JOIN contacts c ON dr.contact_id = c.id
        LEFT JOIN software_licenses l ON dr.id = l.device_registration_id
        LEFT JOIN trials t ON dr.id = t.device_registration_id
        WHERE ${whereClause}
        GROUP BY dr.id, c.id
        ORDER BY dr.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      // Count query
      const countQuery = `
        SELECT COUNT(DISTINCT dr.id) as total
        FROM device_registrations dr
        JOIN contacts c ON dr.contact_id = c.id
        WHERE ${whereClause}
      `;

      const [devicesResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2))
      ]);

      const devices = devicesResult.rows;
      const total = parseInt(countResult.rows[0].total);

      res.json({
        devices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching devices:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get single device
  async getDevice(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          dr.*,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company
        FROM device_registrations dr
        JOIN contacts c ON dr.contact_id = c.id
        WHERE dr.id = $1 AND dr.organization_id = $2
      `;

      const result = await pool.query(query, [id, req.user.organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Device not found' });
      }

      const device = result.rows[0];

      // Get device licenses
      const licensesQuery = `
        SELECT
          l.*,
          se.name as edition_name,
          se.version as edition_version,
          CASE
            WHEN l.end_date < NOW() THEN 'expired'
            WHEN l.end_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE l.status
          END as computed_status
        FROM software_licenses l
        JOIN software_editions se ON l.software_edition_id = se.id
        WHERE l.device_registration_id = $1
        ORDER BY l.created_at DESC
      `;

      const licensesResult = await pool.query(licensesQuery, [id]);
      device.licenses = licensesResult.rows;

      // Get device trials
      const trialsQuery = `
        SELECT
          t.*,
          se.name as edition_name,
          se.version as edition_version,
          CASE
            WHEN t.trial_end < NOW() AND t.status = 'active' THEN 'expired'
            ELSE t.status
          END as computed_status
        FROM trials t
        JOIN software_editions se ON t.software_edition_id = se.id
        WHERE t.device_registration_id = $1
        ORDER BY t.trial_start DESC
      `;

      const trialsResult = await pool.query(trialsQuery, [id]);
      device.trials = trialsResult.rows;

      res.json({ device });
    } catch (error) {
      console.error('Error fetching device:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get licenses for specific MAC address
  async getDeviceLicenses(req, res) {
    try {
      const { macAddress } = req.params;

      // Normalize MAC address
      const normalizedMac = macAddress.toUpperCase().replace(/[-]/g, ':');

      // Get device
      const deviceResult = await pool.query(
        'SELECT * FROM device_registrations WHERE mac_address = $1 AND organization_id = $2',
        [normalizedMac, req.user.organization_id]
      );

      if (deviceResult.rows.length === 0) {
        return res.status(404).json({ message: 'Device not found' });
      }

      const device = deviceResult.rows[0];

      // Update last seen
      await pool.query(
        'UPDATE device_registrations SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [device.id]
      );

      // Get active licenses
      const licensesQuery = `
        SELECT
          l.*,
          se.name as edition_name,
          se.version as edition_version,
          se.features as edition_features,
          c.first_name,
          c.last_name,
          c.email,
          CASE
            WHEN l.end_date < NOW() THEN 'expired'
            WHEN l.end_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE l.status
          END as computed_status,
          (l.end_date - NOW()) as time_remaining
        FROM software_licenses l
        JOIN software_editions se ON l.software_edition_id = se.id
        JOIN contacts c ON l.contact_id = c.id
        WHERE l.device_registration_id = $1
        AND l.status IN ('active', 'trial')
        ORDER BY l.end_date DESC
      `;

      const licensesResult = await pool.query(licensesQuery, [device.id]);

      // Get active trials
      const trialsQuery = `
        SELECT
          t.*,
          se.name as edition_name,
          se.version as edition_version,
          se.features as edition_features,
          CASE
            WHEN t.trial_end < NOW() AND t.status = 'active' THEN 'expired'
            ELSE t.status
          END as computed_status,
          (t.trial_end - NOW()) as time_remaining
        FROM trials t
        JOIN software_editions se ON t.software_edition_id = se.id
        WHERE t.device_registration_id = $1
        AND t.status = 'active'
        ORDER BY t.trial_end DESC
      `;

      const trialsResult = await pool.query(trialsQuery, [device.id]);

      res.json({
        device: {
          id: device.id,
          mac_address: device.mac_address,
          device_name: device.device_name,
          device_type: device.device_type,
          last_seen: device.last_seen
        },
        licenses: licensesResult.rows,
        trials: trialsResult.rows
      });
    } catch (error) {
      console.error('Error fetching device licenses:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Update device information
  async updateDevice(req, res) {
    try {
      const { id } = req.params;
      const {
        device_name,
        device_type,
        hardware_hash,
        os_info,
        device_specs,
        is_active
      } = req.body;

      // Check if device exists
      const existingResult = await pool.query(
        'SELECT * FROM device_registrations WHERE id = $1 AND organization_id = $2',
        [id, req.user.organization_id]
      );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({ message: 'Device not found' });
      }

      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      if (device_name !== undefined) {
        paramCount++;
        updateFields.push(`device_name = $${paramCount}`);
        updateValues.push(device_name);
      }

      if (device_type !== undefined) {
        paramCount++;
        updateFields.push(`device_type = $${paramCount}`);
        updateValues.push(device_type);
      }

      if (hardware_hash !== undefined) {
        paramCount++;
        updateFields.push(`hardware_hash = $${paramCount}`);
        updateValues.push(hardware_hash);
      }

      if (os_info !== undefined) {
        paramCount++;
        updateFields.push(`os_info = $${paramCount}`);
        updateValues.push(os_info);
      }

      if (device_specs !== undefined) {
        paramCount++;
        updateFields.push(`device_specs = $${paramCount}`);
        updateValues.push(device_specs);
      }

      if (is_active !== undefined) {
        paramCount++;
        updateFields.push(`is_active = $${paramCount}`);
        updateValues.push(is_active);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }

      updateFields.push('last_seen = CURRENT_TIMESTAMP', 'updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id, req.user.organization_id);

      const query = `
        UPDATE device_registrations
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
        RETURNING *
      `;

      const result = await pool.query(query, updateValues);

      res.json({
        message: 'Device updated successfully',
        device: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating device:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Deactivate device
  async deactivateDevice(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Check if device has active licenses
      const activeLicensesResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM software_licenses
        WHERE device_registration_id = $1 AND status = 'active' AND end_date > NOW()
      `, [id]);

      const activeLicenseCount = parseInt(activeLicensesResult.rows[0].count);

      if (activeLicenseCount > 0) {
        return res.status(400).json({
          message: `Cannot deactivate device with ${activeLicenseCount} active license(s). Transfer or cancel licenses first.`
        });
      }

      const result = await pool.query(`
        UPDATE device_registrations
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `, [id, req.user.organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Device not found' });
      }

      res.json({
        message: 'Device deactivated successfully',
        device: result.rows[0]
      });
    } catch (error) {
      console.error('Error deactivating device:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get devices for a specific contact
  async getContactDevices(req, res) {
    try {
      const { contactId } = req.params;
      const { is_active } = req.query;

      let whereClause = 'WHERE dr.contact_id = $1 AND dr.organization_id = $2';
      let queryParams = [contactId, req.user.organization_id];

      if (is_active !== undefined) {
        whereClause += ' AND dr.is_active = $3';
        queryParams.push(is_active === 'true');
      }

      const query = `
        SELECT
          dr.*,
          COUNT(l.id) as license_count,
          COUNT(CASE WHEN l.status = 'active' AND l.end_date > NOW() THEN 1 END) as active_license_count,
          COUNT(t.id) as trial_count,
          COUNT(CASE WHEN t.status = 'active' AND t.trial_end > NOW() THEN 1 END) as active_trial_count
        FROM device_registrations dr
        LEFT JOIN software_licenses l ON dr.id = l.device_registration_id
        LEFT JOIN trials t ON dr.id = t.device_registration_id
        ${whereClause}
        GROUP BY dr.id
        ORDER BY dr.registration_date DESC
      `;

      const result = await pool.query(query, queryParams);

      res.json({ devices: result.rows });
    } catch (error) {
      console.error('Error fetching contact devices:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Device statistics
  async getDeviceStats(req, res) {
    try {
      const { contact_id } = req.query;

      let whereClause = 'WHERE dr.organization_id = $1';
      let queryParams = [req.user.organization_id];

      if (contact_id) {
        whereClause += ' AND dr.contact_id = $2';
        queryParams.push(contact_id);
      }

      const query = `
        SELECT
          COUNT(*) as total_devices,
          COUNT(CASE WHEN dr.is_active = true THEN 1 END) as active_devices,
          COUNT(CASE WHEN dr.is_active = false THEN 1 END) as inactive_devices,
          COUNT(CASE WHEN dr.last_seen > NOW() - INTERVAL '30 days' THEN 1 END) as recently_active,
          COUNT(DISTINCT dr.device_type) as device_types,
          COUNT(DISTINCT dr.contact_id) as unique_contacts
        FROM device_registrations dr
        ${whereClause}
      `;

      const result = await pool.query(query, queryParams);

      // Get device type breakdown
      const typeQuery = `
        SELECT
          dr.device_type,
          COUNT(*) as count
        FROM device_registrations dr
        ${whereClause}
        GROUP BY dr.device_type
        ORDER BY count DESC
      `;

      const typeResult = await pool.query(typeQuery, queryParams);

      res.json({
        stats: result.rows[0],
        device_types: typeResult.rows
      });
    } catch (error) {
      console.error('Error fetching device stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new DeviceController();