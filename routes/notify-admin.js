const express = require('express');
const EmailService = require('../services/emailService');

const router = express.Router();

/**
 * POST /api/notify-admin
 * Endpoint for sending admin notifications
 * Used by marketing site to notify about new signups
 */
router.post('/', async (req, res) => {
  try {
    console.log('📧 Admin notification request received:', req.body);
    
    const { subject, message, adminEmail } = req.body;
    
    // Validate request
    if (!subject || !message || !adminEmail) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'subject, message, and adminEmail are required'
      });
    }
    
    // Initialize email service
    const emailService = new EmailService();
    await emailService.initialize();
    
    if (!emailService.isAvailable()) {
      console.log('📧 Email service not available');
      return res.status(503).json({
        error: 'Email service unavailable',
        message: 'Email service is not configured'
      });
    }
    
    // Send simple notification email
    try {
      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM Marketing',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: adminEmail,
        subject: subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #0ea5e9; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">${subject}</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; margin: 0;">${message}</pre>
            </div>
            <div style="background: #6b7280; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">© 2024 UppalCRM. Notification sent at ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `,
        headers: {
          'X-Entity-Ref-ID': `admin-notification-${Date.now()}`,
          'X-Priority': '2' // High priority
        }
      };
      
      const result = await emailService.transporter.sendMail(mailOptions);
      console.log('✅ Admin notification sent successfully:', result.messageId);
      
      res.json({
        success: true,
        message: 'Notification sent successfully',
        messageId: result.messageId
      });
      
    } catch (emailError) {
      console.error('❌ Failed to send admin notification:', emailError);
      res.status(500).json({
        error: 'Failed to send email',
        message: emailError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Admin notification endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;