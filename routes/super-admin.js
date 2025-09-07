const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../database/connection');
const router = express.Router();

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

    const result = await query(
      'SELECT * FROM super_admin_users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query('UPDATE super_admin_users SET last_login = NOW() WHERE id = $1', [admin.id]);

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

// DASHBOARD
router.get('/dashboard', authenticateSuperAdmin, async (req, res) => {
  try {
    await query('SELECT calculate_daily_metrics()');

    const overview = await query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations WHERE trial_status = 'active') as active_trials,
        (SELECT COUNT(*) FROM organizations WHERE trial_status = 'expired') as expired_trials,
        (SELECT COUNT(*) FROM organizations WHERE payment_status = 'active') as paid_customers,
        (SELECT COUNT(*) FROM organizations WHERE DATE(created_at) = CURRENT_DATE) as new_signups_today,
        (SELECT COUNT(*) FROM organizations WHERE DATE(trial_started_at) = CURRENT_DATE) as new_trials_today,
        (SELECT COUNT(*) FROM get_expiring_trials(7)) as expiring_next_7_days,
        (SELECT COUNT(*) FROM get_expiring_trials(1)) as expiring_tomorrow,
        (SELECT AVG(engagement_score) FROM trial_overview WHERE trial_status = 'active') as avg_engagement_score
    `);

    const recentMetrics = await query(`
      SELECT date, new_business_leads, new_trials_started, trials_converted, trials_expired
      FROM platform_metrics 
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY date DESC
    `);

    const topTrials = await query(`
      SELECT organization_name, admin_name, admin_email, days_remaining, engagement_score, recent_logins
      FROM trial_overview 
      WHERE trial_status = 'active'
      ORDER BY engagement_score DESC LIMIT 10
    `);

    const atRiskTrials = await query(`
      SELECT * FROM get_expiring_trials(7) 
      WHERE risk_level IN ('Critical', 'High') LIMIT 10
    `);

    res.json({
      overview: overview.rows[0],
      recent_metrics: recentMetrics.rows,
      top_trials: topTrials.rows,
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
      whereClause += ` AND trial_status = $${params.length + 1}`;
      params.push(status);
    }

    if (search) {
      whereClause += ` AND (organization_name ILIKE $${params.length + 1} OR admin_email ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    const organizations = await query(`
      SELECT * FROM trial_overview ${whereClause}
      ORDER BY trial_created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const totalResult = await query(`
      SELECT COUNT(*) as total FROM trial_overview ${whereClause}
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

// EXPIRING TRIALS
router.get('/expiring-trials', authenticateSuperAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const expiringTrials = await query(`
      SELECT * FROM get_expiring_trials($1)
      ORDER BY days_remaining ASC, engagement_score ASC
    `, [days]);

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

module.exports = router;