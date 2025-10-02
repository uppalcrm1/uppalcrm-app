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

    // Create new trial signup
    const trialSignup = await TrialSignup.create({
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
    });

    // Send confirmation email to customer
    const emailService = require('../services/emailService');
    await emailService.initialize();

    try {
      await emailService.sendTrialConfirmation({
        customerName: trialSignup.fullName,
        customerEmail: trialSignup.email,
        company: trialSignup.company
      });
      console.log(`✅ Trial confirmation email sent to ${trialSignup.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send trial confirmation email:', emailError);
      // Don't fail the signup if email fails - just log the error
    }

    res.status(201).json({
      message: 'Trial signup created successfully',
      signup: {
        id: trialSignup.id,
        full_name: trialSignup.fullName,
        email: trialSignup.email,
        company: trialSignup.company,
        status: trialSignup.status
      }
    });

  } catch (error) {
    console.error('Error creating trial signup:', error);
    res.status(500).json({
      error: 'Internal server error'
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

// GET /api/platform/organizations - Get all organizations
router.get('/organizations', platformAuth, async (req, res) => {
  try {
    const organizations = await Organization.getAll();

    const enhancedOrgs = await Promise.all(
      organizations.map(async (org) => {
        const User = require('../models/User');
        const userCount = await User.getCountByOrganization(org.id);

        return {
          ...org,
          user_count: userCount,
          status_display: org.is_active ?
            (org.subscription_status === 'active' ? 'Paid' :
             org.trial_status === 'active' ? 'Trial' : 'Active') : 'Inactive'
        };
      })
    );

    res.json({
      organizations: enhancedOrgs
    });

  } catch (error) {
    console.error('Error fetching organizations:', error);
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

// GET /api/platform/organizations - Get all organizations
router.get('/organizations', platformAuth, async (req, res) => {
  try {
    console.log('📋 Platform Admin: Fetching all organizations...');
    const organizations = await Organization.getAll();
    console.log(`✅ Found ${organizations.length} organizations`);

    res.json({
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        domain: org.domain,
        subscription_plan: org.subscription_plan || 'free',
        max_users: org.max_users || 10,
        is_active: org.is_active,
        created_at: org.created_at,
        updated_at: org.updated_at,
        user_count: parseInt(org.user_count) || 0,
        active_user_count: parseInt(org.active_user_count) || 0
      })),
      total: organizations.length
    });

  } catch (error) {
    console.error('❌ Error fetching organizations:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// DELETE /api/platform/organizations/:id - Delete organization
router.delete('/organizations/:id', platformAuth, async (req, res) => {
  try {
    const organizationId = req.params.id;

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    // Delete the organization and all related data
    await Organization.delete(organizationId);

    res.json({
      message: 'Organization deleted successfully',
      deleted: {
        id: organizationId,
        name: organization.name,
        slug: organization.slug
      }
    });

  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;