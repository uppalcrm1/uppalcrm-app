const pool = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

class SoftwareEditionController {
  // Get all software editions
  async getSoftwareEditions(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        is_trial_available,
        search,
        sort_by = 'name',
        sort_order = 'asc'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = ['organization_id = $1'];
      let queryParams = [req.user.organization_id];
      let paramCount = 1;

      // Add filters
      if (is_active !== undefined) {
        paramCount++;
        whereConditions.push(`is_active = $${paramCount}`);
        queryParams.push(is_active === 'true');
      }

      if (is_trial_available !== undefined) {
        paramCount++;
        whereConditions.push(`is_trial_available = $${paramCount}`);
        queryParams.push(is_trial_available === 'true');
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Main query
      const query = `
        SELECT
          se.*,
          COUNT(l.id) as license_count,
          COUNT(CASE WHEN l.status = 'active' AND l.end_date > NOW() THEN 1 END) as active_license_count,
          COUNT(t.id) as trial_count,
          COUNT(CASE WHEN t.status = 'active' AND t.trial_end > NOW() THEN 1 END) as active_trial_count,
          COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.purchase_price END), 0) as total_revenue
        FROM software_editions se
        LEFT JOIN software_licenses l ON se.id = l.software_edition_id
        LEFT JOIN trials t ON se.id = t.software_edition_id
        WHERE ${whereClause}
        GROUP BY se.id
        ORDER BY se.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM software_editions
        WHERE ${whereClause}
      `;

      const [editionsResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2))
      ]);

      const editions = editionsResult.rows;
      const total = parseInt(countResult.rows[0].total);

      res.json({
        editions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching software editions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get single software edition
  async getSoftwareEdition(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          se.*,
          COUNT(l.id) as license_count,
          COUNT(CASE WHEN l.status = 'active' AND l.end_date > NOW() THEN 1 END) as active_license_count,
          COUNT(t.id) as trial_count,
          COUNT(CASE WHEN t.status = 'active' AND t.trial_end > NOW() THEN 1 END) as active_trial_count,
          COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.purchase_price END), 0) as total_revenue
        FROM software_editions se
        LEFT JOIN software_licenses l ON se.id = l.software_edition_id
        LEFT JOIN trials t ON se.id = t.software_edition_id
        WHERE se.id = $1 AND se.organization_id = $2
        GROUP BY se.id
      `;

      const result = await pool.query(query, [id, req.user.organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Software edition not found' });
      }

      const edition = result.rows[0];

      // Get recent licenses
      const recentLicensesQuery = `
        SELECT
          l.*,
          c.first_name,
          c.last_name,
          c.email,
          dr.device_name,
          dr.mac_address
        FROM software_licenses l
        JOIN contacts c ON l.contact_id = c.id
        JOIN device_registrations dr ON l.device_registration_id = dr.id
        WHERE l.software_edition_id = $1
        ORDER BY l.created_at DESC
        LIMIT 10
      `;

      const recentLicensesResult = await pool.query(recentLicensesQuery, [id]);
      edition.recent_licenses = recentLicensesResult.rows;

      // Get recent trials
      const recentTrialsQuery = `
        SELECT
          t.*,
          c.first_name,
          c.last_name,
          c.email,
          dr.device_name,
          dr.mac_address
        FROM trials t
        JOIN contacts c ON t.contact_id = c.id
        LEFT JOIN device_registrations dr ON t.device_registration_id = dr.id
        WHERE t.software_edition_id = $1
        ORDER BY t.trial_start DESC
        LIMIT 10
      `;

      const recentTrialsResult = await pool.query(recentTrialsQuery, [id]);
      edition.recent_trials = recentTrialsResult.rows;

      res.json({ edition });
    } catch (error) {
      console.error('Error fetching software edition:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Create new software edition
  async createSoftwareEdition(req, res) {
    try {
      const {
        name,
        description,
        version,
        monthly_price,
        quarterly_price,
        semi_annual_price,
        annual_price,
        features = {},
        max_devices = 1,
        is_active = true,
        is_trial_available = true,
        trial_duration_hours = 24
      } = req.body;

      // Validate required fields
      if (!name || monthly_price === undefined) {
        return res.status(400).json({
          message: 'Missing required fields: name, monthly_price'
        });
      }

      // Check if edition name already exists for this organization
      const existingResult = await pool.query(
        'SELECT id FROM software_editions WHERE name = $1 AND organization_id = $2',
        [name, req.user.organization_id]
      );

      if (existingResult.rows.length > 0) {
        return res.status(409).json({
          message: 'Software edition with this name already exists'
        });
      }

      // Create software edition
      const editionResult = await pool.query(`
        INSERT INTO software_editions (
          organization_id, name, description, version,
          monthly_price, quarterly_price, semi_annual_price, annual_price,
          features, max_devices, is_active, is_trial_available, trial_duration_hours,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        req.user.organization_id,
        name,
        description,
        version,
        monthly_price,
        quarterly_price || Math.floor(monthly_price * 3 * 0.95), // 5% discount for quarterly
        semi_annual_price || Math.floor(monthly_price * 6 * 0.9), // 10% discount for semi-annual
        annual_price || Math.floor(monthly_price * 12 * 0.85), // 15% discount for annual
        features,
        max_devices,
        is_active,
        is_trial_available,
        trial_duration_hours,
        req.user.id
      ]);

      res.status(201).json({
        message: 'Software edition created successfully',
        edition: editionResult.rows[0]
      });
    } catch (error) {
      console.error('Error creating software edition:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Update software edition
  async updateSoftwareEdition(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        version,
        monthly_price,
        quarterly_price,
        semi_annual_price,
        annual_price,
        features,
        max_devices,
        is_active,
        is_trial_available,
        trial_duration_hours
      } = req.body;

      // Check if edition exists
      const existingResult = await pool.query(
        'SELECT * FROM software_editions WHERE id = $1 AND organization_id = $2',
        [id, req.user.organization_id]
      );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({ message: 'Software edition not found' });
      }

      // If updating name, check for conflicts
      if (name) {
        const nameConflictResult = await pool.query(
          'SELECT id FROM software_editions WHERE name = $1 AND organization_id = $2 AND id != $3',
          [name, req.user.organization_id, id]
        );

        if (nameConflictResult.rows.length > 0) {
          return res.status(409).json({
            message: 'Software edition with this name already exists'
          });
        }
      }

      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      if (name !== undefined) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        updateValues.push(name);
      }

      if (description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        updateValues.push(description);
      }

      if (version !== undefined) {
        paramCount++;
        updateFields.push(`version = $${paramCount}`);
        updateValues.push(version);
      }

      if (monthly_price !== undefined) {
        paramCount++;
        updateFields.push(`monthly_price = $${paramCount}`);
        updateValues.push(monthly_price);
      }

      if (quarterly_price !== undefined) {
        paramCount++;
        updateFields.push(`quarterly_price = $${paramCount}`);
        updateValues.push(quarterly_price);
      }

      if (semi_annual_price !== undefined) {
        paramCount++;
        updateFields.push(`semi_annual_price = $${paramCount}`);
        updateValues.push(semi_annual_price);
      }

      if (annual_price !== undefined) {
        paramCount++;
        updateFields.push(`annual_price = $${paramCount}`);
        updateValues.push(annual_price);
      }

      if (features !== undefined) {
        paramCount++;
        updateFields.push(`features = $${paramCount}`);
        updateValues.push(features);
      }

      if (max_devices !== undefined) {
        paramCount++;
        updateFields.push(`max_devices = $${paramCount}`);
        updateValues.push(max_devices);
      }

      if (is_active !== undefined) {
        paramCount++;
        updateFields.push(`is_active = $${paramCount}`);
        updateValues.push(is_active);
      }

      if (is_trial_available !== undefined) {
        paramCount++;
        updateFields.push(`is_trial_available = $${paramCount}`);
        updateValues.push(is_trial_available);
      }

      if (trial_duration_hours !== undefined) {
        paramCount++;
        updateFields.push(`trial_duration_hours = $${paramCount}`);
        updateValues.push(trial_duration_hours);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id, req.user.organization_id);

      const query = `
        UPDATE software_editions
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
        RETURNING *
      `;

      const result = await pool.query(query, updateValues);

      res.json({
        message: 'Software edition updated successfully',
        edition: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating software edition:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Delete software edition
  async deleteSoftwareEdition(req, res) {
    try {
      const { id } = req.params;

      // Check if edition has active licenses or trials
      const usageResult = await pool.query(`
        SELECT
          COUNT(l.id) as license_count,
          COUNT(t.id) as trial_count
        FROM software_editions se
        LEFT JOIN software_licenses l ON se.id = l.software_edition_id AND l.status = 'active'
        LEFT JOIN trials t ON se.id = t.software_edition_id AND t.status = 'active'
        WHERE se.id = $1 AND se.organization_id = $2
        GROUP BY se.id
      `, [id, req.user.organization_id]);

      if (usageResult.rows.length === 0) {
        return res.status(404).json({ message: 'Software edition not found' });
      }

      const usage = usageResult.rows[0];
      const licenseCount = parseInt(usage.license_count) || 0;
      const trialCount = parseInt(usage.trial_count) || 0;

      if (licenseCount > 0 || trialCount > 0) {
        return res.status(400).json({
          message: `Cannot delete software edition with ${licenseCount} active license(s) and ${trialCount} active trial(s)`
        });
      }

      // Soft delete by setting is_active to false
      const result = await pool.query(`
        UPDATE software_editions
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `, [id, req.user.organization_id]);

      res.json({
        message: 'Software edition deactivated successfully',
        edition: result.rows[0]
      });
    } catch (error) {
      console.error('Error deleting software edition:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get pricing for billing cycle
  async getPricing(req, res) {
    try {
      const { id } = req.params;
      const { billing_cycle = 'monthly' } = req.query;

      const query = `
        SELECT
          id, name, version,
          monthly_price, quarterly_price, semi_annual_price, annual_price,
          features, max_devices, trial_duration_hours
        FROM software_editions
        WHERE id = $1 AND organization_id = $2 AND is_active = true
      `;

      const result = await pool.query(query, [id, req.user.organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Software edition not found or inactive' });
      }

      const edition = result.rows[0];
      let price;

      switch (billing_cycle) {
        case 'monthly':
          price = edition.monthly_price;
          break;
        case 'quarterly':
          price = edition.quarterly_price;
          break;
        case 'semi_annual':
          price = edition.semi_annual_price;
          break;
        case 'annual':
          price = edition.annual_price;
          break;
        default:
          price = edition.monthly_price;
      }

      // Calculate savings compared to monthly
      const monthlyCost = edition.monthly_price;
      let periodsInCycle;

      switch (billing_cycle) {
        case 'quarterly': periodsInCycle = 3; break;
        case 'semi_annual': periodsInCycle = 6; break;
        case 'annual': periodsInCycle = 12; break;
        default: periodsInCycle = 1;
      }

      const monthlyTotal = monthlyCost * periodsInCycle;
      const savings = monthlyTotal - price;
      const savingsPercentage = periodsInCycle > 1 ? ((savings / monthlyTotal) * 100).toFixed(1) : 0;

      res.json({
        edition: {
          id: edition.id,
          name: edition.name,
          version: edition.version,
          features: edition.features,
          max_devices: edition.max_devices,
          trial_duration_hours: edition.trial_duration_hours
        },
        pricing: {
          billing_cycle,
          price,
          monthly_equivalent: Math.ceil(price / periodsInCycle),
          savings,
          savings_percentage: savingsPercentage,
          currency: 'USD'
        }
      });
    } catch (error) {
      console.error('Error fetching pricing:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get software edition statistics
  async getEditionStats(req, res) {
    try {
      const query = `
        SELECT
          COUNT(*) as total_editions,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_editions,
          COUNT(CASE WHEN is_trial_available = true THEN 1 END) as trial_enabled_editions,
          COALESCE(AVG(monthly_price), 0) as avg_monthly_price,
          COALESCE(MIN(monthly_price), 0) as min_monthly_price,
          COALESCE(MAX(monthly_price), 0) as max_monthly_price
        FROM software_editions
        WHERE organization_id = $1
      `;

      const statsResult = await pool.query(query, [req.user.organization_id]);

      // Get edition usage stats
      const usageQuery = `
        SELECT
          se.name,
          se.monthly_price,
          COUNT(l.id) as total_licenses,
          COUNT(CASE WHEN l.status = 'active' AND l.end_date > NOW() THEN 1 END) as active_licenses,
          COUNT(t.id) as total_trials,
          COUNT(CASE WHEN t.status = 'active' AND t.trial_end > NOW() THEN 1 END) as active_trials,
          COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.purchase_price END), 0) as total_revenue
        FROM software_editions se
        LEFT JOIN software_licenses l ON se.id = l.software_edition_id
        LEFT JOIN trials t ON se.id = t.software_edition_id
        WHERE se.organization_id = $1 AND se.is_active = true
        GROUP BY se.id, se.name, se.monthly_price
        ORDER BY total_revenue DESC
      `;

      const usageResult = await pool.query(usageQuery, [req.user.organization_id]);

      res.json({
        stats: statsResult.rows[0],
        edition_usage: usageResult.rows
      });
    } catch (error) {
      console.error('Error fetching edition stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new SoftwareEditionController();