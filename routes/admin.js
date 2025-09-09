const express = require('express');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * POST /api/admin/send-lead-notification
 * Send lead notification email using the proven email service
 */
router.post('/send-lead-notification', async (req, res) => {
  try {
    console.log('📧 Lead notification request from marketing site:', req.body);
    
    const { leadName, leadEmail, leadCompany, leadPhone, leadMessage, organizationName, utmSource, utmMedium, utmCampaign, loginUrl } = req.body;
    
    // Validate required fields
    if (!leadName || !leadEmail || !leadCompany || !organizationName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'leadName, leadEmail, leadCompany, and organizationName are required'
      });
    }
    
    // Initialize email service (should already be initialized, but ensure it)
    await emailService.initialize();
    
    if (!emailService.isAvailable()) {
      console.log('📧 Email service not available');
      return res.status(503).json({
        error: 'Email service unavailable',
        message: 'Email service is not configured'
      });
    }
    
    // Send lead notification using the proven method
    try {
      const result = await emailService.sendLeadNotification({
        leadName,
        leadEmail,
        leadCompany,
        leadPhone,
        leadMessage: leadMessage + (loginUrl ? `\n\nLogin URL: ${loginUrl}` : ''),
        organizationName,
        utmSource,
        utmMedium,
        utmCampaign
      });
      
      if (result) {
        console.log('✅ Lead notification sent successfully:', result.messageId);
        res.json({
          success: true,
          message: 'Lead notification sent successfully',
          messageId: result.messageId
        });
      } else {
        console.error('❌ Lead notification returned null');
        res.status(500).json({
          error: 'Email sending failed',
          message: 'Email service returned null result'
        });
      }
      
    } catch (emailError) {
      console.error('❌ Failed to send lead notification:', emailError);
      res.status(500).json({
        error: 'Failed to send email',
        message: emailError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Admin lead notification endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;