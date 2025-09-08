const express = require('express');
const Lead = require('../models/Lead');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const { query } = require('../database/connection');

const router = express.Router();

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

      // For public submissions, we need to determine which organization to assign the lead to
      // Option 1: Default to a specific organization (e.g., main company org)
      // Option 2: Create leads in a central pool for later assignment
      // Option 3: Route based on domain or other criteria
      
      // Let's use Option 1 for now - assign to first active organization
      const orgResult = await query(`
        SELECT id, name FROM organizations 
        WHERE is_active = true 
        ORDER BY created_at ASC 
        LIMIT 1
      `);
      
      if (orgResult.rows.length === 0) {
        console.error('No active organizations found for lead assignment');
        return res.status(500).json({
          error: 'Service temporarily unavailable',
          message: 'Unable to process lead submission at this time'
        });
      }
      
      const targetOrg = orgResult.rows[0];
      console.log(`📋 Assigning lead to organization: ${targetOrg.name} (${targetOrg.id})`);
      
      // Prepare lead data
      const leadData = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email,
        phone: req.body.phone || null,
        company: req.body.company || null,
        title: req.body.title || null,
        source: req.body.source || 'website',
        status: 'new',
        priority: 'medium',
        value: 0,
        notes: req.body.message ? 
          `Marketing submission: ${req.body.message}` + 
          (req.body.utm_source ? `\n\nUTM Source: ${req.body.utm_source}` : '') +
          (req.body.utm_medium ? `\nUTM Medium: ${req.body.utm_medium}` : '') +
          (req.body.utm_campaign ? `\nUTM Campaign: ${req.body.utm_campaign}` : '') +
          (req.body.referrer_url ? `\nReferrer: ${req.body.referrer_url}` : '')
          : 'Marketing website submission'
      };
      
      // Create the lead (no user ID since it's a public submission)
      const lead = await Lead.create(leadData, targetOrg.id, null);
      
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