const pool = require('../database/connection');
const path = require('path');
const fs = require('fs').promises;

class DownloadController {
  // Serve download file using token
  async serveDownload(req, res) {
    try {
      const { token } = req.params;

      // Get download record
      const downloadQuery = `
        SELECT
          da.*,
          l.license_key,
          t.activation_code,
          se.name as edition_name,
          se.version as edition_version,
          c.first_name,
          c.last_name,
          c.email
        FROM downloads_activations da
        LEFT JOIN software_licenses l ON da.license_id = l.id
        LEFT JOIN trials t ON da.trial_id = t.id
        JOIN contacts c ON da.contact_id = c.id
        JOIN software_editions se ON (l.software_edition_id = se.id OR t.software_edition_id = se.id)
        WHERE da.download_token = $1
      `;

      const downloadResult = await pool.query(downloadQuery, [token]);

      if (downloadResult.rows.length === 0) {
        return res.status(404).json({ message: 'Download link not found' });
      }

      const download = downloadResult.rows[0];

      // Check if download has expired
      if (new Date() > new Date(download.download_expires_at)) {
        return res.status(410).json({ message: 'Download link has expired' });
      }

      // Update download tracking
      const updateQuery = `
        UPDATE downloads_activations
        SET download_count = download_count + 1,
            last_download = CURRENT_TIMESTAMP,
            download_ip = $2,
            user_agent = $3,
            status = CASE WHEN download_count = 0 THEN 'downloaded' ELSE status END
        WHERE id = $1
      `;

      await pool.query(updateQuery, [
        download.id,
        req.ip,
        req.get('User-Agent')
      ]);

      // For demo purposes, we'll serve a placeholder file
      // In production, this would serve the actual software file
      const downloadInfo = {
        edition: download.edition_name,
        version: download.edition_version,
        license_key: download.license_key,
        activation_code: download.activation_code,
        customer: `${download.first_name} ${download.last_name}`,
        email: download.email,
        download_date: new Date().toISOString(),
        installation_instructions: `
1. Run the installer as administrator
2. Enter your license key: ${download.license_key || download.activation_code}
3. Follow the installation wizard
4. Activate using your account credentials

For support, contact: support@uppalcrm.com
        `.trim()
      };

      // Set download headers
      res.set({
        'Content-Disposition': `attachment; filename="${download.edition_name}_v${download.edition_version}_Setup.txt"`,
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      // Send the file content
      res.send(JSON.stringify(downloadInfo, null, 2));

    } catch (error) {
      console.error('Error serving download:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Track activation
  async trackActivation(req, res) {
    try {
      const { token } = req.params;
      const { device_info = {} } = req.body;

      // Get download record
      const downloadResult = await pool.query(
        'SELECT * FROM downloads_activations WHERE download_token = $1',
        [token]
      );

      if (downloadResult.rows.length === 0) {
        return res.status(404).json({ message: 'Download token not found' });
      }

      const download = downloadResult.rows[0];

      // Update activation tracking
      const updateQuery = `
        UPDATE downloads_activations
        SET activation_count = activation_count + 1,
            last_activation = CURRENT_TIMESTAMP,
            activation_device_info = $2,
            status = 'activated'
        WHERE id = $1
      `;

      await pool.query(updateQuery, [download.id, device_info]);

      // Update license/trial activation
      if (download.license_id) {
        await pool.query(`
          UPDATE software_licenses
          SET activation_count = activation_count + 1,
              last_activation = CURRENT_TIMESTAMP,
              activation_date = COALESCE(activation_date, CURRENT_TIMESTAMP)
          WHERE id = $1
        `, [download.license_id]);
      }

      if (download.trial_id) {
        await pool.query(`
          UPDATE trials
          SET first_activation = COALESCE(first_activation, CURRENT_TIMESTAMP),
              last_activity = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [download.trial_id]);
      }

      res.json({ message: 'Activation tracked successfully' });
    } catch (error) {
      console.error('Error tracking activation:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get download statistics
  async getDownloadStats(req, res) {
    try {
      const { license_id, trial_id, contact_id } = req.query;

      let whereConditions = ['da.organization_id = $1'];
      let queryParams = [req.user.organization_id];
      let paramCount = 1;

      if (license_id) {
        paramCount++;
        whereConditions.push(`da.license_id = $${paramCount}`);
        queryParams.push(license_id);
      }

      if (trial_id) {
        paramCount++;
        whereConditions.push(`da.trial_id = $${paramCount}`);
        queryParams.push(trial_id);
      }

      if (contact_id) {
        paramCount++;
        whereConditions.push(`da.contact_id = $${paramCount}`);
        queryParams.push(contact_id);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          COUNT(*) as total_downloads,
          COUNT(CASE WHEN da.download_count > 0 THEN 1 END) as completed_downloads,
          COUNT(CASE WHEN da.activation_count > 0 THEN 1 END) as activated_downloads,
          COUNT(CASE WHEN da.download_expires_at < NOW() THEN 1 END) as expired_downloads,
          COALESCE(SUM(da.download_count), 0) as total_download_count,
          COALESCE(SUM(da.activation_count), 0) as total_activation_count,
          COALESCE(AVG(da.download_count), 0) as avg_downloads_per_link
        FROM downloads_activations da
        WHERE ${whereClause}
      `;

      const result = await pool.query(query, queryParams);

      res.json({ stats: result.rows[0] });
    } catch (error) {
      console.error('Error fetching download stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get download history
  async getDownloadHistory(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        license_id,
        trial_id,
        contact_id,
        status,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = ['da.organization_id = $1'];
      let queryParams = [req.user.organization_id];
      let paramCount = 1;

      // Add filters
      if (license_id) {
        paramCount++;
        whereConditions.push(`da.license_id = $${paramCount}`);
        queryParams.push(license_id);
      }

      if (trial_id) {
        paramCount++;
        whereConditions.push(`da.trial_id = $${paramCount}`);
        queryParams.push(trial_id);
      }

      if (contact_id) {
        paramCount++;
        whereConditions.push(`da.contact_id = $${paramCount}`);
        queryParams.push(contact_id);
      }

      if (status) {
        paramCount++;
        whereConditions.push(`da.status = $${paramCount}`);
        queryParams.push(status);
      }

      const whereClause = whereConditions.join(' AND ');

      // Main query
      const query = `
        SELECT
          da.*,
          c.first_name,
          c.last_name,
          c.email,
          l.license_key,
          t.activation_code,
          se.name as edition_name,
          se.version as edition_version,
          CASE
            WHEN da.download_expires_at < NOW() THEN 'expired'
            ELSE da.status
          END as computed_status
        FROM downloads_activations da
        JOIN contacts c ON da.contact_id = c.id
        LEFT JOIN software_licenses l ON da.license_id = l.id
        LEFT JOIN trials t ON da.trial_id = t.id
        LEFT JOIN software_editions se ON (l.software_edition_id = se.id OR t.software_edition_id = se.id)
        WHERE ${whereClause}
        ORDER BY da.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM downloads_activations da
        WHERE ${whereClause}
      `;

      const [downloadsResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2))
      ]);

      const downloads = downloadsResult.rows;
      const total = parseInt(countResult.rows[0].total);

      res.json({
        downloads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching download history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new DownloadController();