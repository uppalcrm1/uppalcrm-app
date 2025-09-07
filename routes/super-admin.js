const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../database/connection');
const router = express.Router();

// Debug endpoint to test if routes are loading
router.get('/test', (req, res) => {
  res.json({
    message: 'Super Admin routes are working!',
    timestamp: new Date().toISOString(),
    jwt_secret_exists: !!process.env.JWT_SECRET,
    environment: process.env.NODE_ENV || 'development',
    version: '2.0 - Updated dashboard queries'
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

    // Simple overview using production database structure (no trial columns exist)
    const overview = await query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations WHERE is_active = true) as active_organizations,
        (SELECT COUNT(*) FROM organizations WHERE is_active = false) as inactive_organizations,
        (SELECT COUNT(*) FROM organizations WHERE DATE(created_at) = CURRENT_DATE) as new_signups_today,
        (SELECT COUNT(*) FROM organizations WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days') as new_signups_week,
        (SELECT COUNT(*) FROM organizations WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days') as new_signups_month,
        (SELECT COUNT(*) FROM organizations) as total_organizations
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
        o.created_at
      FROM organizations o
      WHERE o.is_active = true
      ORDER BY o.created_at DESC 
      LIMIT 10
    `);

    // Recent organizations (since no trial data exists)
    const recentOrganizations = await query(`
      SELECT 
        o.id,
        o.name as organization_name,
        o.domain,
        o.subscription_plan,
        o.created_at
      FROM organizations o
      WHERE o.is_active = true
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    res.json({
      overview: overview.rows[0],
      recent_metrics: recentMetrics.rows,
      top_organizations: topOrganizations.rows,
      recent_organizations: recentOrganizations.rows,
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
        o.created_at
      FROM organizations o
      ${whereClause}
      ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

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
      SELECT 
        o.id,
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
        END as risk_level
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
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

module.exports = router;