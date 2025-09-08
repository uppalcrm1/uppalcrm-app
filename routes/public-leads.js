const express = require('express');
const Lead = require('../models/Lead');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const { query } = require('../database/connection');

const router = express.Router();

// Helper function to extract domain from email
function extractDomainFromEmail(email) {
  if (!email) return null;
  const match = email.match(/@([^.]+\..+)$/);
  return match ? match[1] : null;
}

// Public lead submission schema (simpler than internal lead schema)
const publicLeadSchema = {
  body: Joi.object({
    // Required fields
    first_name: Joi.string().min(1).max(100).required(),
    last_name: Joi.string().min(1).max(100).required(),
    email: Joi.string().email().required(),
    
    // Optional fields
    phone: Joi.string().max(50).optional(),
    company: Joi.string().max(255).optional(),
    title: Joi.string().max(100).optional(),
    message: Joi.string().max(1000).optional(),
    source: Joi.string().valid('website', 'landing-page', 'social', 'advertisement', 'referral', 'other').default('website'),
    
    // Marketing fields
    utm_source: Joi.string().max(100).optional(),
    utm_medium: Joi.string().max(100).optional(),
    utm_campaign: Joi.string().max(100).optional(),
    referrer_url: Joi.string().uri().optional(),
    
    // Organization context (if known)
    organization_domain: Joi.string().max(255).optional()
  })
};

/**
 * POST /api/public/leads
 * Public endpoint for marketing site lead submissions
 * No authentication required
 */
router.post('/', 
  validate(publicLeadSchema),
  async (req, res) => {
    try {
      console.log('🎯 Public lead submission received:', {
        name: `${req.body.first_name} ${req.body.last_name}`,
        email: req.body.email,
        company: req.body.company,
        source: req.body.source
      });

      // For public submissions, create a new organization with trial setup for each lead
      const companyName = req.body.company || `${req.body.first_name} ${req.body.last_name}'s Company`;
      const domain = extractDomainFromEmail(req.body.email);
      
      console.log(`📋 Creating new organization: ${companyName} for lead`);
      
      // Calculate trial dates (14-day trial)
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      
      // Create new organization with trial setup
      const orgResult = await query(`
        INSERT INTO organizations (
          name, 
          domain,
          trial_status,
          trial_started_at,
          trial_ends_at,
          payment_status,
          subscription_plan,
          max_users,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, 'active', $3, $4, 'trial', 'trial', 50, true, NOW(), NOW()
        ) RETURNING id, name
      `, [companyName, domain, trialStartDate, trialEndDate]);
      
      const newOrg = orgResult.rows[0];
      console.log(`✅ Created organization: ${newOrg.name} (${newOrg.id}) with 14-day trial`);
      
      // Create admin user for this organization
      const adminResult = await query(`
        INSERT INTO users (
          organization_id,
          email,
          first_name,
          last_name,
          role,
          is_active,
          email_verified,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, 'admin', true, false, NOW(), NOW()
        ) RETURNING id, email
      `, [newOrg.id, req.body.email, req.body.first_name, req.body.last_name]);
      
      const adminUser = adminResult.rows[0];
      console.log(`✅ Created admin user: ${adminUser.email} for organization`);
      
      // Prepare lead data
      const leadData = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email,
        phone: req.body.phone || null,
        company: companyName,
        title: req.body.title || null,
        source: req.body.source || 'website',
        status: 'new',
        priority: 'high', // Marketing leads get high priority
        value: 0,
        notes: req.body.message ? 
          `Marketing submission: ${req.body.message}` + 
          (req.body.utm_source ? `\n\nUTM Source: ${req.body.utm_source}` : '') +
          (req.body.utm_medium ? `\nUTM Medium: ${req.body.utm_medium}` : '') +
          (req.body.utm_campaign ? `\nUTM Campaign: ${req.body.utm_campaign}` : '') +
          (req.body.referrer_url ? `\nReferrer: ${req.body.referrer_url}` : '')
          : 'Marketing website submission - New trial organization created'
      };
      
      // Create the lead in the new organization
      const lead = await Lead.create(leadData, newOrg.id, null);
      
      console.log(`✅ Lead created successfully: ${lead.id}`);
      
      res.status(201).json({
        message: 'Thank you for your interest! We will be in touch soon.',
        lead_id: lead.id,
        status: 'received'
      });
      
    } catch (error) {
      console.error('❌ Public lead submission error:', error);
      
      // Don't expose internal errors to public
      res.status(500).json({
        error: 'Unable to process submission',
        message: 'Please try again later or contact us directly.'
      });
    }
  }
);

/**
 * GET /api/public/leads/test
 * Test endpoint to verify the public leads API is working
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'Public leads API is working',
    timestamp: new Date().toISOString(),
    endpoints: {
      submit_lead: 'POST /api/public/leads',
      test: 'GET /api/public/leads/test'
    }
  });
});

module.exports = router;