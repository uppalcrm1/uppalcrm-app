const express = require('express');
const bcrypt = require('bcrypt');
const { platformAuth } = require('../middleware/platformAuth');
const PlatformAdmin = require('../models/PlatformAdmin');
const TrialSignup = require('../models/TrialSignup');
const Organization = require('../models/Organization');

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// POST /api/platform/trial-signup - Public trial signup form
router.post('/trial-signup', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      company,
      website,
      phone,
      industry,
      team_size,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_term,
      utm_content
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !email || !company) {
      return res.status(400).json({
        error: 'First name, last name, email, and company are required'
      });
    }

    // Check if email already exists
    const existingSignup = await TrialSignup.findByEmail(email);
    if (existingSignup) {
      return res.status(409).json({
        error: 'A trial signup with this email already exists'
      });
    }

    // Generate secure password and unique slug
    const { generateSecurePassword, generateSlug, generateUniqueSlug } = require('../utils/passwordGenerator');
    const generatedPassword = generateSecurePassword(16);
    const baseSlug = generateSlug(company);

    // Ensure slug is unique
    const organizationSlug = await generateUniqueSlug(baseSlug, async (slug) => {
      const existing = await Organization.findBySlug(slug);
      return existing !== null;
    });

    console.log(`🆕 Creating organization for trial signup: ${email}`);
    console.log(`   Company: ${company}`);
    console.log(`   Slug: ${organizationSlug}`);

    // Create organization and admin user together
    const { organization, admin_user_id } = await Organization.create(
      {
        name: company,
        slug: organizationSlug,
        domain: website
      },
      {
        email,
        password: generatedPassword,
        first_name,
        last_name
      }
    );

    console.log(`✅ Organization created: ${organization.id}`);
    console.log(`✅ Admin user created: ${admin_user_id}`);

    // Set trial dates (30 days from now)
    const { query: dbQuery } = require('../database/connection');
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + (30 * 24 * 60 * 60 * 1000));

    await dbQuery(`
      UPDATE organizations
      SET
        is_trial = true,
        trial_status = 'active',
        trial_expires_at = $1
      WHERE id = $2
    `, [trialEndDate, organization.id]);

    console.log(`✅ Trial period set: expires ${trialEndDate.toISOString()}`);

    // Create trial signup record with credentials and trial dates

    const result = await dbQuery(`
      INSERT INTO trial_signups (
        first_name, last_name, email, company, website, phone,
        industry, team_size, utm_source, utm_campaign, utm_medium,
        utm_term, utm_content, status, converted_organization_id,
        organization_slug, generated_password, converted_at, credentials_sent_at,
        trial_start_date, trial_end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), $18, $19)
      RETURNING *
    `, [
      first_name,
      last_name,
      email.toLowerCase(),
      company,
      website,
      phone,
      industry,
      team_size,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_term,
      utm_content,
      'converted', // Status is now 'converted' since org is created
      organization.id,
      organizationSlug,
      generatedPassword,
      trialStartDate,
      trialEndDate
    ]);

    const trialSignup = new TrialSignup(result.rows[0]);
    console.log(`✅ Trial signup record created: ${trialSignup.id}`);

    // Send credentials email to customer
    const emailService = require('../services/emailService');
    await emailService.initialize();

    try {
      await emailService.sendTrialCredentials({
        customerName: trialSignup.fullName,
        customerEmail: trialSignup.email,
        company: trialSignup.company,
        loginUrl: 'https://uppalcrm-frontend.onrender.com/login',
        username: email,
        password: generatedPassword,
        organizationSlug
      });
      console.log(`✅ Trial credentials email sent to ${trialSignup.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send trial credentials email:', emailError);
      // Don't fail the signup if email fails - credentials are still accessible via super admin
    }

    res.status(201).json({
      message: 'Trial signup created successfully. Login credentials have been sent to your email.',
      signup: {
        id: trialSignup.id,
        full_name: trialSignup.fullName,
        email: trialSignup.email,
        company: trialSignup.company,
        organization_slug: organizationSlug,
        status: trialSignup.status
      }
    });

  } catch (error) {
    console.error('❌ Error creating trial signup:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================
// PLATFORM ADMIN AUTHENTICATION ROUTES
// ============================================

// POST /api/platform/auth/login - Platform admin login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find platform admin
    const platformAdmin = await PlatformAdmin.findByEmail(email);
    if (!platformAdmin) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Validate password
    const isValidPassword = await platformAdmin.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Update last login
    await platformAdmin.updateLastLogin();

    // Generate token
    const token = platformAdmin.generateToken();

    res.json({
      message: 'Login successful',
      token,
      admin: platformAdmin.toJSON()
    });

  } catch (error) {
    console.error('Error during platform admin login:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// ============================================
// PROTECTED PLATFORM ADMIN ROUTES
// ============================================

// GET /api/platform/dashboard - Platform admin dashboard data
router.get('/dashboard', platformAuth, async (req, res) => {
  try {
    const [
      trialStats,
      organizations,
      recentSignups
    ] = await Promise.all([
      TrialSignup.getStats(),
      Organization.getAll(),
      TrialSignup.getAll({
        sort_by: 'created_at',
        sort_order: 'desc',
        limit: 10
      })
    ]);

    const orgStats = {
      total: organizations.length,
      active: organizations.filter(org => org.is_active).length,
      trial: organizations.filter(org => org.trial_status === 'active').length,
      paid: organizations.filter(org => org.subscription_status === 'active').length
    };

    res.json({
      trial_stats: trialStats,
      organization_stats: orgStats,
      recent_signups: recentSignups.map(signup => ({
        id: signup.id,
        full_name: signup.fullName,
        email: signup.email,
        company: signup.company,
        status: signup.status,
        created_at: signup.created_at,
        is_recent: signup.isRecent
      }))
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/platform/trial-signups - Get all trial signups with filtering
router.get('/trial-signups', platformAuth, async (req, res) => {
  try {
    const {
      status,
      utm_source,
      utm_campaign,
      industry,
      team_size,
      search,
      date_from,
      date_to,
      sort_by,
      sort_order,
      page = 1,
      limit = 50
    } = req.query;

    const filters = {
      status,
      utm_source,
      utm_campaign,
      industry,
      team_size,
      search,
      date_from,
      date_to,
      sort_by,
      sort_order,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    const [signups, totalCount] = await Promise.all([
      TrialSignup.getAll(filters),
      TrialSignup.getCount(filters)
    ]);

    res.json({
      signups: signups.map(signup => ({
        id: signup.id,
        full_name: signup.fullName,
        email: signup.email,
        company: signup.company,
        website: signup.website,
        phone: signup.phone,
        industry: signup.industry,
        team_size: signup.team_size,
        status: signup.status,
        utm_source: signup.utm_source,
        utm_campaign: signup.utm_campaign,
        utm_medium: signup.utm_medium,
        notes: signup.notes,
        converted_organization_id: signup.converted_organization_id,
        converted_at: signup.converted_at,
        trial_start_date: signup.trial_start_date,
        trial_end_date: signup.trial_end_date,
        trial_extended: signup.trial_extended,
        trial_extension_count: signup.trial_extension_count,
        days_remaining: signup.daysRemaining,
        is_expired: signup.isExpired,
        trial_urgency_color: signup.trialUrgencyColor,
        can_extend: signup.canExtend,
        created_at: signup.created_at,
        is_recent: signup.isRecent,
        status_color: signup.statusColor
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching trial signups:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/platform/trial-signups/:id - Get specific trial signup
router.get('/trial-signups/:id', platformAuth, async (req, res) => {
  try {
    const signup = await TrialSignup.findById(req.params.id);

    if (!signup) {
      return res.status(404).json({
        error: 'Trial signup not found'
      });
    }

    res.json({
      signup: {
        ...signup,
        full_name: signup.fullName,
        is_recent: signup.isRecent,
        status_color: signup.statusColor
      }
    });

  } catch (error) {
    console.error('Error fetching trial signup:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// PUT /api/platform/trial-signups/:id/status - Update trial signup status
router.put('/trial-signups/:id/status', platformAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Status is required'
      });
    }

    const signup = await TrialSignup.findById(req.params.id);
    if (!signup) {
      return res.status(404).json({
        error: 'Trial signup not found'
      });
    }

    await signup.updateStatus(status, notes);

    res.json({
      message: 'Status updated successfully',
      signup: {
        id: signup.id,
        status: signup.status,
        notes: signup.notes
      }
    });

  } catch (error) {
    console.error('Error updating trial signup status:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// PUT /api/platform/trial-signups/:id/notes - Add notes to trial signup
router.put('/trial-signups/:id/notes', platformAuth, async (req, res) => {
  try {
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({
        error: 'Notes are required'
      });
    }

    const signup = await TrialSignup.findById(req.params.id);
    if (!signup) {
      return res.status(404).json({
        error: 'Trial signup not found'
      });
    }

    await signup.addNotes(notes);

    res.json({
      message: 'Notes added successfully',
      signup: {
        id: signup.id,
        notes: signup.notes
      }
    });

  } catch (error) {
    console.error('Error adding notes to trial signup:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// PUT /api/platform/trial-signups/:id/extend - Extend trial period
router.put('/trial-signups/:id/extend', platformAuth, async (req, res) => {
  try {
    const { extension_days = 30 } = req.body;
    const signupId = req.params.id;

    // Check if signup exists
    const signup = await TrialSignup.findById(signupId);
    if (!signup) {
      return res.status(404).json({
        error: 'Trial signup not found'
      });
    }

    // Use the database function to extend trial
    const { query: dbQuery } = require('../database/connection');
    const result = await dbQuery(
      'SELECT * FROM extend_trial($1, $2)',
      [signupId, extension_days]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to extend trial');
    }

    const { new_end_date, total_extensions } = result.rows[0];

    res.json({
      message: `Trial extended by ${extension_days} days`,
      trial: {
        id: signupId,
        new_end_date,
        total_extensions,
        extension_days
      }
    });

  } catch (error) {
    console.error('Error extending trial:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /api/platform/trial-signups/:id/archive - Archive expired trial
router.post('/trial-signups/:id/archive', platformAuth, async (req, res) => {
  try {
    const signupId = req.params.id;

    // Check if signup exists
    const signup = await TrialSignup.findById(signupId);
    if (!signup) {
      return res.status(404).json({
        error: 'Trial signup not found'
      });
    }

    // Use the database function to archive trial
    const { query: dbQuery } = require('../database/connection');
    await dbQuery('SELECT archive_expired_trial($1)', [signupId]);

    res.json({
      message: 'Trial archived successfully',
      archived: {
        id: signupId,
        email: signup.email,
        company: signup.company
      }
    });

  } catch (error) {
    console.error('Error archiving trial:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// DELETE /api/platform/trial-signups/:id - Delete trial signup
router.delete('/trial-signups/:id', platformAuth, async (req, res) => {
  try {
    const signupId = req.params.id;

    // Check if signup exists
    const signup = await TrialSignup.findById(signupId);
    if (!signup) {
      return res.status(404).json({
        error: 'Trial signup not found'
      });
    }

    // Delete the trial signup
    await TrialSignup.delete(signupId);

    res.json({
      message: 'Trial signup deleted successfully',
      deleted: {
        id: signupId,
        email: signup.email,
        company: signup.company
      }
    });

  } catch (error) {
    console.error('Error deleting trial signup:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// POST /api/platform/trial-signups/:id/convert - Convert trial signup to organization
router.post('/trial-signups/:id/convert', platformAuth, async (req, res) => {
  try {
    const { organization_name, domain, admin_password } = req.body;

    if (!organization_name || !domain || !admin_password) {
      return res.status(400).json({
        error: 'Organization name, domain, and admin password are required'
      });
    }

    const signup = await TrialSignup.findById(req.params.id);
    if (!signup) {
      return res.status(404).json({
        error: 'Trial signup not found'
      });
    }

    if (signup.status === 'converted') {
      return res.status(400).json({
        error: 'Trial signup is already converted'
      });
    }

    // Create new organization
    const organization = await Organization.create({
      organization_name,
      domain,
      admin_email: signup.email,
      contact_name: signup.fullName,
      contact_phone: signup.phone,
      industry: signup.industry,
      company_size: signup.team_size,
      trial_status: 'active'
    });

    // Create admin user for the organization
    const User = require('../models/User');
    await User.create({
      name: signup.fullName,
      email: signup.email,
      password: admin_password,
      role: 'admin',
      organization_id: organization.id
    });

    // Mark trial signup as converted
    await signup.markAsConverted(organization.id);

    res.json({
      message: 'Trial signup converted successfully',
      organization: {
        id: organization.id,
        organization_name: organization.organization_name,
        domain: organization.domain
      }
    });

  } catch (error) {
    console.error('Error converting trial signup:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/platform/stats - Get platform statistics
router.get('/stats', platformAuth, async (req, res) => {
  try {
    const [trialStats, organizations] = await Promise.all([
      TrialSignup.getStats(),
      Organization.getAll()
    ]);

    const orgStats = {
      total: organizations.length,
      active: organizations.filter(org => org.is_active).length,
      trial: organizations.filter(org => org.trial_status === 'active').length,
      paid: organizations.filter(org => org.subscription_status === 'active').length
    };

    res.json({
      trial_signups: trialStats,
      organizations: orgStats
    });

  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/platform/profile - Get platform admin profile
router.get('/profile', platformAuth, async (req, res) => {
  try {
    res.json({
      admin: req.platformAdmin.toJSON()
    });
  } catch (error) {
    console.error('Error fetching platform admin profile:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// PUT /api/platform/profile - Update platform admin profile
router.put('/profile', platformAuth, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({
        error: 'At least one field (name or email) is required'
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;

    await req.platformAdmin.updateProfile(updates);

    res.json({
      message: 'Profile updated successfully',
      admin: req.platformAdmin.toJSON()
    });

  } catch (error) {
    console.error('Error updating platform admin profile:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// PUT /api/platform/password - Change platform admin password
router.put('/password', platformAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    // Validate current password
    const isValidPassword = await req.platformAdmin.validatePassword(current_password);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      });
    }

    // Change password
    await req.platformAdmin.changePassword(new_password);

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error changing platform admin password:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// ============================================
// ORGANIZATION MANAGEMENT ROUTES
// ============================================

// POST /api/platform/fix-trial-data - Quick fix to add trial data to existing orgs
router.post('/fix-trial-data', platformAuth, async (req, res) => {
  try {
    console.log('🔧 Fixing trial data for existing organizations...');

    // Mark all current organizations as active trials expiring in 30 days
    const { query: dbQuery } = require('../database/connection');
    const result = await dbQuery(`
      UPDATE organizations
      SET
        is_trial = true,
        trial_status = 'active',
        trial_expires_at = NOW() + INTERVAL '30 days'
      WHERE is_trial IS NULL OR is_trial = false
      RETURNING id, name, trial_expires_at
    `);

    console.log(`✅ Updated ${result.rows.length} organizations`);

    res.json({
      message: 'Trial data updated successfully',
      updated_count: result.rows.length,
      organizations: result.rows
    });

  } catch (error) {
    console.error('❌ Error fixing trial data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/platform/organizations - Get all organizations
router.get('/organizations', platformAuth, async (req, res) => {
  try {
    console.log('📋 Platform Admin: Fetching all organizations...');

    // Check if Organization model has getAll method
    if (typeof Organization.getAll !== 'function') {
      throw new Error('Organization.getAll is not a function');
    }

    const organizations = await Organization.getAll();
    console.log(`✅ Found ${organizations.length} organizations`);

    const formattedOrgs = organizations.map(org => {
      // Calculate days remaining for trials
      let daysRemaining = null;
      let urgencyColor = null;

      if (org.is_trial && org.trial_expires_at) {
        const now = new Date();
        const expiresAt = new Date(org.trial_expires_at);
        const diffTime = expiresAt - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, diffDays);

        // Set urgency color
        if (daysRemaining === 0 || expiresAt < now) {
          urgencyColor = 'gray';
        } else if (daysRemaining <= 7) {
          urgencyColor = 'red';
        } else if (daysRemaining <= 15) {
          urgencyColor = 'yellow';
        } else {
          urgencyColor = 'green';
        }
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        domain: org.domain,
        subscription_plan: org.subscription_plan || 'free',
        max_users: org.max_users || 10,
        is_active: org.is_active,
        is_trial: org.is_trial || false,
        trial_status: org.trial_status,
        trial_expires_at: org.trial_expires_at,
        days_remaining: daysRemaining,
        urgency_color: urgencyColor,
        created_at: org.created_at,
        updated_at: org.updated_at,
        user_count: parseInt(org.user_count) || 0,
        active_user_count: parseInt(org.active_user_count) || 0
      };
    });

    res.json({
      organizations: formattedOrgs,
      total: organizations.length
    });

  } catch (error) {
    console.error('❌ Error fetching organizations:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// DELETE /api/platform/organizations/:id - Delete organization
router.delete('/organizations/:id', platformAuth, async (req, res) => {
  try {
    const organizationId = req.params.id;
    console.log(`🗑️  Attempting to delete organization: ${organizationId}`);

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      console.log(`❌ Organization not found: ${organizationId}`);
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    console.log(`✅ Found organization: ${organization.name} (${organization.slug})`);
    console.log(`🔄 Starting cascade delete...`);

    // Delete the organization and all related data
    await Organization.delete(organizationId);

    console.log(`✅ Organization deleted successfully: ${organization.name}`);

    res.json({
      message: 'Organization deleted successfully',
      deleted: {
        id: organizationId,
        name: organization.name,
        slug: organization.slug
      }
    });

  } catch (error) {
    console.error('❌ Error deleting organization:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.detail : undefined
    });
  }
});

// POST /api/platform/organizations/:id/convert-to-paid - Convert trial to paid
router.post('/organizations/:id/convert-to-paid', platformAuth, async (req, res) => {
  try {
    const { query: dbQuery } = require('../database/connection');
    const organizationId = req.params.id;
    console.log(`💰 Converting trial to paid: ${organizationId}`);

    // Get organization details
    const org = await Organization.findById(organizationId);
    if (!org) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    console.log(`📋 Organization: ${org.name}, Trial: ${org.is_trial}, Status: ${org.trial_status}`);

    // Update organization to paid status
    const orgResult = await dbQuery(`
      UPDATE organizations
      SET
        is_trial = false,
        trial_status = 'converted',
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, is_trial, trial_status, subscription_plan
    `, [organizationId]);

    if (orgResult.rows.length === 0) {
      throw new Error('Failed to update organization');
    }

    console.log(`✅ Organization updated to paid status`);

    // Update linked trial signup if exists
    const trialSignupResult = await dbQuery(`
      UPDATE trial_signups
      SET
        status = 'converted',
        converted_at = COALESCE(converted_at, NOW())
      WHERE converted_organization_id = $1
      RETURNING id, email, company
    `, [organizationId]);

    if (trialSignupResult.rows.length > 0) {
      console.log(`✅ Trial signup updated: ${trialSignupResult.rows[0].email}`);
    }

    // Get admin user email for notification
    const adminResult = await dbQuery(`
      SELECT email, first_name, last_name
      FROM users
      WHERE organization_id = $1 AND role = 'admin' AND is_active = true
      LIMIT 1
    `, [organizationId]);

    // Send confirmation email
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      const emailService = require('../services/emailService');

      try {
        await emailService.sendEmail({
          to: admin.email,
          subject: 'Your Trial Has Been Converted to a Paid Account',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">Welcome to Your Paid Account!</h2>
              <p>Hi ${admin.first_name},</p>
              <p>Great news! Your trial account for <strong>${org.name}</strong> has been successfully converted to a paid account.</p>

              <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #059669;">What's Next?</h3>
                <ul style="line-height: 1.6;">
                  <li>Your account now has full access to all features</li>
                  <li>No trial restrictions or limitations</li>
                  <li>Continue managing your leads, contacts, and accounts</li>
                  <li>Access to priority support</li>
                </ul>
              </div>

              <p>Thank you for choosing our platform. We're excited to support your business growth!</p>

              <p style="margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'https://uppalcrm.com'}/dashboard"
                   style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Go to Dashboard
                </a>
              </p>

              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

              <p style="color: #6B7280; font-size: 14px;">
                Need help? Contact our support team at support@uppalcrm.com
              </p>
            </div>
          `
        });
        console.log(`✅ Confirmation email sent to ${admin.email}`);
      } catch (emailError) {
        console.error('⚠️  Failed to send confirmation email:', emailError);
        // Don't fail the conversion if email fails
      }
    }

    const updatedOrg = orgResult.rows[0];
    res.json({
      message: 'Organization successfully converted to paid',
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        is_trial: updatedOrg.is_trial,
        trial_status: updatedOrg.trial_status,
        subscription_plan: updatedOrg.subscription_plan
      },
      trial_signup: trialSignupResult.rows[0] || null
    });

  } catch (error) {
    console.error('❌ Error converting trial to paid:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;