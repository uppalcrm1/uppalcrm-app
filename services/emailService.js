const nodemailer = require('nodemailer');

/**
 * Email Service using Brevo SMTP
 * 
 * Required Environment Variables:
 * - SMTP_HOST: Brevo SMTP server (default: smtp-relay.brevo.com)
 * - SMTP_PORT: SMTP port (default: 587)
 * - SMTP_USER: Your Brevo login email
 * - SMTP_PASS: Your Brevo SMTP key (not your login password!)
 * - FROM_EMAIL: Email address to send from
 * - FROM_NAME: Display name for emails (default: UppalCRM Team)
 * 
 * Brevo SMTP Limits:
 * - 300 emails per day (free plan)
 * - 14 emails per second rate limit
 * - Requires verified sender domain/email
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize email transporter with Brevo SMTP configuration
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Configure Brevo SMTP transporter
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // Use STARTTLS (TLS on port 587)
        auth: {
          user: process.env.SMTP_USER, // Your Brevo login email
          pass: process.env.SMTP_PASS  // Your Brevo SMTP key (not login password!)
        },
        // Brevo-specific TLS configuration
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        },
        // Connection settings optimized for Brevo
        pool: true,
        maxConnections: 3, // Conservative for Brevo
        maxMessages: 50,   // Conservative batch size
        rateLimit: 10,     // Conservative rate limit (Brevo allows 14/sec)
        // Add connection timeout settings
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,   // 30 seconds
        socketTimeout: 60000      // 60 seconds
      });

      // Verify SMTP connection
      if (process.env.NODE_ENV !== 'test') {
        await this.transporter.verify();
        console.log('✅ Email service initialized successfully');
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      // Don't throw error to prevent app from crashing
      // Email functionality will be disabled but app will continue to work
    }
  }

  /**
   * Check if email service is available
   * @returns {boolean} Whether email service is ready
   */
  isAvailable() {
    return this.initialized && this.transporter;
  }

  /**
   * Send welcome email to new organization admin
   * @param {Object} options - Email options
   * @param {string} options.organizationName - Organization name
   * @param {string} options.adminEmail - Admin email address
   * @param {string} options.adminName - Admin full name
   * @param {string} options.loginUrl - Direct login URL
   * @param {string} options.temporaryPassword - Temporary password
   * @param {string} options.organizationSlug - Organization slug
   */
  /**
   * Send admin notification when a new lead signs up
   */
  async sendLeadNotification({ leadName, leadEmail, leadCompany, leadPhone, leadMessage, organizationName, utmSource, utmMedium, utmCampaign }) {
    if (!this.isAvailable()) {
      console.log('📧 Email service not available, skipping lead notification');
      return null;
    }

    const subject = `🎯 New Trial Signup: ${leadName} from ${leadCompany}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
          .lead-info { background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #5a67d8; }
          .utm-info { background: #fff5f5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e53e3e; }
          .footer { background: #f7f7f7; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
          .btn { display: inline-block; background: #5a67d8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎯 New Trial Signup!</h1>
          <p>A new lead has signed up through your marketing site</p>
        </div>
        
        <div class="content">
          <div class="lead-info">
            <h2>Lead Information</h2>
            <div class="detail-row"><span class="label">Name:</span> ${leadName}</div>
            <div class="detail-row"><span class="label">Email:</span> ${leadEmail}</div>
            <div class="detail-row"><span class="label">Company:</span> ${leadCompany}</div>
            ${leadPhone ? `<div class="detail-row"><span class="label">Phone:</span> ${leadPhone}</div>` : ''}
            <div class="detail-row"><span class="label">Organization Created:</span> ${organizationName}</div>
            <div class="detail-row"><span class="label">Trial Period:</span> 14 days (expires ${new Date(Date.now() + 14*24*60*60*1000).toLocaleDateString()})</div>
          </div>

          ${leadMessage ? `
          <div class="lead-info">
            <h3>Message</h3>
            <p>${leadMessage}</p>
          </div>
          ` : ''}

          ${utmSource || utmMedium || utmCampaign ? `
          <div class="utm-info">
            <h3>Marketing Attribution</h3>
            ${utmSource ? `<div class="detail-row"><span class="label">Source:</span> ${utmSource}</div>` : ''}
            ${utmMedium ? `<div class="detail-row"><span class="label">Medium:</span> ${utmMedium}</div>` : ''}
            ${utmCampaign ? `<div class="detail-row"><span class="label">Campaign:</span> ${utmCampaign}</div>` : ''}
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://uppalcrm-frontend.onrender.com/super-admin" class="btn">View in Super Admin Dashboard</a>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Contact the lead within 24 hours for best conversion rates</li>
            <li>Review their trial usage in the super admin dashboard</li>
            <li>Set up onboarding and demo if needed</li>
          </ul>
        </div>

        <div class="footer">
          <p>This notification was sent automatically from your UppalCRM marketing integration.</p>
          <p>Lead signed up at: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
New Trial Signup Alert!

Lead Information:
- Name: ${leadName}
- Email: ${leadEmail}  
- Company: ${leadCompany}
${leadPhone ? `- Phone: ${leadPhone}` : ''}
- Organization: ${organizationName}
- Trial Period: 14 days

${leadMessage ? `Message: ${leadMessage}` : ''}

${utmSource || utmMedium || utmCampaign ? `
Marketing Attribution:
${utmSource ? `- Source: ${utmSource}` : ''}
${utmMedium ? `- Medium: ${utmMedium}` : ''}
${utmCampaign ? `- Campaign: ${utmCampaign}` : ''}
` : ''}

View in dashboard: https://uppalcrm-frontend.onrender.com/super-admin

Signed up at: ${new Date().toLocaleString()}
    `;

    try {
      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM Marketing',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: 'uppalcrm1@gmail.com',
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Entity-Ref-ID': `lead-signup-${Date.now()}`,
          'X-Priority': '2' // High priority
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Lead notification sent to uppalcrm1@gmail.com:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send lead notification:', error);
      return null;
    }
  }

  async sendWelcomeEmail({ organizationName, adminEmail, adminName, loginUrl, temporaryPassword, organizationSlug }) {
    if (!this.isAvailable()) {
      console.log('📧 Email service not available, skipping welcome email');
      return false;
    }

    try {
      const subject = `Welcome to UppalCRM - Your ${organizationName} account is ready!`;
      
      const htmlContent = this.generateWelcomeEmailHTML({
        organizationName,
        adminName,
        loginUrl,
        temporaryPassword,
        adminEmail,
        organizationSlug
      });

      const textContent = this.generateWelcomeEmailText({
        organizationName,
        adminName,
        loginUrl,
        temporaryPassword,
        adminEmail,
        organizationSlug
      });

      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM Team',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: {
          name: adminName,
          address: adminEmail
        },
        subject: subject,
        text: textContent,
        html: htmlContent,
        // Add headers for better deliverability with Brevo
        headers: {
          'X-Mailer': 'UppalCRM via Brevo',
          'X-Priority': '3',
          'List-Unsubscribe': '<mailto:unsubscribe@uppalcrm.com>'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent successfully to ${adminEmail}`, result.messageId);
      return true;

    } catch (error) {
      console.error('❌ Failed to send welcome email:', error.message);
      return false;
    }
  }

  /**
   * Send password reset email
   * @param {Object} options - Email options
   * @param {string} options.email - User email
   * @param {string} options.name - User name
   * @param {string} options.resetToken - Password reset token
   * @param {string} options.resetUrl - Password reset URL
   * @param {string} options.organizationName - Organization name
   */
  async sendPasswordResetEmail({ email, name, resetToken, resetUrl, organizationName }) {
    if (!this.isAvailable()) {
      console.log('📧 Email service not available, skipping password reset email');
      return false;
    }

    try {
      const subject = `Reset your UppalCRM password - ${organizationName}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0ea5e9; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">UppalCRM</h1>
            <h2 style="margin: 10px 0 0 0;">Password Reset Request</h2>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hello ${name},</p>
            
            <p>We received a request to reset your password for your ${organizationName} CRM account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="background: #e5e7eb; padding: 10px; border-radius: 5px; word-break: break-all;">
              ${resetUrl}
            </p>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This link will expire in 1 hour for security reasons</li>
              <li>If you didn't request this reset, you can safely ignore this email</li>
              <li>Your password won't change until you create a new one</li>
            </ul>
            
            <p>Need help? Reply to this email or contact our support team.</p>
            
            <p>Best regards,<br>
            The UppalCRM Team</p>
          </div>
          
          <div style="background: #6b7280; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p>© 2024 UppalCRM. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      `;

      const textContent = `
UppalCRM - Password Reset Request

Hello ${name},

We received a request to reset your password for your ${organizationName} CRM account.

Reset your password by visiting this link:
${resetUrl}

Important:
- This link will expire in 1 hour for security reasons
- If you didn't request this reset, you can safely ignore this email
- Your password won't change until you create a new one

Need help? Reply to this email or contact our support team.

Best regards,
The UppalCRM Team

© 2024 UppalCRM. All rights reserved.
This is an automated message, please do not reply.
      `.trim();

      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM Team',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: {
          name: name,
          address: email
        },
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Mailer': 'UppalCRM via Brevo',
          'List-Unsubscribe': '<mailto:unsubscribe@uppalcrm.com>'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent successfully to ${email}`, result.messageId);
      return true;

    } catch (error) {
      console.error('❌ Failed to send password reset email:', error.message);
      return false;
    }
  }

  /**
   * Generate HTML content for welcome email
   */
  generateWelcomeEmailHTML({ organizationName, adminName, loginUrl, temporaryPassword, adminEmail, organizationSlug }) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0ea5e9; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🎉 Welcome to UppalCRM!</h1>
          <h2 style="margin: 10px 0 0 0;">Your CRM is Ready to Use</h2>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p>Hello ${adminName},</p>
          
          <p>Congratulations! Your <strong>${organizationName}</strong> CRM account has been successfully created and is ready to use.</p>
          
          <div style="background: white; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0ea5e9;">Your Login Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; font-weight: bold;">Organization:</td>
                <td style="padding: 8px 0;">${organizationName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; font-weight: bold;">Login URL:</td>
                <td style="padding: 8px 0;"><a href="${loginUrl}" style="color: #0ea5e9;">${loginUrl}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0;">${adminEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Temporary Password:</td>
                <td style="padding: 8px 0;">
                  <code style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-weight: bold;">
                    ${temporaryPassword}
                  </code>
                </td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Access Your CRM Now
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">🔐 Important Security Notice</h4>
            <p style="margin: 0; font-size: 14px; color: #856404;">
              Please change your temporary password immediately after logging in for security purposes.
            </p>
          </div>
          
          <div style="margin: 30px 0;">
            <h3 style="color: #0ea5e9;">Next Steps:</h3>
            <ol style="line-height: 1.6;">
              <li>Click the "Access Your CRM Now" button above</li>
              <li>Log in using your email and temporary password</li>
              <li><strong>Change your password</strong> in Account Settings</li>
              <li>Complete your organization profile</li>
              <li>Add your team members</li>
              <li>Start importing or creating your leads</li>
              <li>Explore the dashboard and features</li>
            </ol>
          </div>
          
          <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">💡 Pro Tips:</h4>
            <ul style="margin: 0; line-height: 1.6;">
              <li>Bookmark your login URL for easy access</li>
              <li>Set up your lead sources and statuses first</li>
              <li>Invite team members to collaborate</li>
              <li>Check out our getting started guide in the Help section</li>
            </ul>
          </div>
          
          <p>Need help getting started? Reply to this email or visit our support center. We're here to help you succeed!</p>
          
          <p>Welcome aboard!<br>
          <strong>The UppalCRM Team</strong></p>
        </div>
        
        <div style="background: #6b7280; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px;">© 2024 UppalCRM. All rights reserved.</p>
          <p style="margin: 0; font-size: 12px;">
            This email was sent to ${adminEmail} because you signed up for a UppalCRM account.
          </p>
          <p style="margin: 10px 0 0 0; font-size: 11px;">
            Organization Slug: ${organizationSlug}
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate text content for welcome email
   */
  generateWelcomeEmailText({ organizationName, adminName, loginUrl, temporaryPassword, adminEmail, organizationSlug }) {
    return `
🎉 Welcome to UppalCRM!

Hello ${adminName},

Congratulations! Your ${organizationName} CRM account has been successfully created and is ready to use.

YOUR LOGIN DETAILS:
==================
Organization: ${organizationName}
Login URL: ${loginUrl}
Email: ${adminEmail}
Temporary Password: ${temporaryPassword}

🔐 IMPORTANT SECURITY NOTICE:
Please change your temporary password immediately after logging in for security purposes.

NEXT STEPS:
===========
1. Visit your login URL: ${loginUrl}
2. Log in using your email and temporary password
3. Change your password in Account Settings
4. Complete your organization profile
5. Add your team members
6. Start importing or creating your leads
7. Explore the dashboard and features

💡 PRO TIPS:
- Bookmark your login URL for easy access
- Set up your lead sources and statuses first
- Invite team members to collaborate
- Check out our getting started guide in the Help section

Need help getting started? Reply to this email or visit our support center. We're here to help you succeed!

Welcome aboard!
The UppalCRM Team

© 2024 UppalCRM. All rights reserved.
This email was sent to ${adminEmail} because you signed up for a UppalCRM account.
Organization Slug: ${organizationSlug}
    `.trim();
  }

  /**
   * Send test email to verify configuration
   * @param {string} testEmail - Email address to send test to
   */
  async sendTestEmail(testEmail) {
    if (!this.isAvailable()) {
      throw new Error('Email service not available');
    }

    try {
      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM Team',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: testEmail,
        subject: 'UppalCRM Email Service Test - Brevo SMTP',
        text: 'This is a test email from UppalCRM using Brevo SMTP. If you received this, email service is working correctly!',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ Email Service Test</h2>
            <p>This is a test email from UppalCRM using <strong>Brevo SMTP</strong>.</p>
            <p>If you received this, email service is working correctly!</p>
            <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
            <p><strong>SMTP Provider:</strong> Brevo</p>
          </div>
        `,
        headers: {
          'X-Mailer': 'UppalCRM via Brevo',
          'X-Priority': '1' // High priority for test emails
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Test email sent successfully to ${testEmail}`, result.messageId);
      return true;

    } catch (error) {
      console.error('❌ Failed to send test email:', error.message);
      throw error;
    }
  }

  /**
   * Send team member invitation email
   * @param {Object} options - Email options
   * @param {string} options.memberName - Name of the team member
   * @param {string} options.memberEmail - Email of the team member
   * @param {string} options.organizationName - Name of the organization
   * @param {string} options.invitedBy - Name of the person who invited them
   * @param {string} options.loginUrl - URL to login
   * @param {string} options.temporaryPassword - Temporary password
   */
  async sendTeamMemberInvitation({ memberName, memberEmail, organizationName, invitedBy, loginUrl, temporaryPassword }) {
    try {
      if (!this.initialized) {
        console.log('📧 Email service not available, skipping team member invitation email');
        return false;
      }

      const subject = `You've been invited to join ${organizationName} CRM`;

      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM Team',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: memberEmail,
        subject,
        text: this.generateTeamInvitationEmailText({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }),
        html: this.generateTeamInvitationEmailHTML({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }),
        headers: {
          'X-Mailer': 'UppalCRM via Brevo',
          'X-Priority': '3'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Team invitation email sent to ${memberEmail} (${memberName})`, result.messageId);
      return true;

    } catch (error) {
      console.error('❌ Failed to send team invitation email:', error.message);
      return false;
    }
  }

  /**
   * Generate HTML content for team member invitation email
   */
  generateTeamInvitationEmailHTML({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #0ea5e9, #3b82f6); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">UppalCRM</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Team Member Invitation</p>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p>Hello ${memberName},</p>
          
          <p><strong>${invitedBy}</strong> has invited you to join the <strong>${organizationName}</strong> CRM team!</p>
          
          <div style="background: white; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0ea5e9;">Your Login Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; font-weight: bold;">Organization:</td>
                <td style="padding: 8px 0;">${organizationName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; font-weight: bold;">Login URL:</td>
                <td style="padding: 8px 0;"><a href="${loginUrl}" style="color: #0ea5e9;">${loginUrl}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0;">${memberEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Temporary Password:</td>
                <td style="padding: 8px 0;">
                  <code style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-weight: bold;">
                    ${temporaryPassword}
                  </code>
                </td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Join Your Team Now
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">🔐 Important Security Notice</h4>
            <p style="margin: 0; font-size: 14px; color: #856404;">
              Please change your temporary password immediately after logging in for security purposes.
            </p>
          </div>
          
          <div style="margin: 30px 0;">
            <h3 style="color: #0ea5e9;">Getting Started:</h3>
            <ol style="line-height: 1.6;">
              <li>Click the "Join Your Team Now" button above</li>
              <li>Log in using your email and temporary password</li>
              <li><strong>Change your password</strong> in Account Settings</li>
              <li>Complete your profile information</li>
              <li>Explore the dashboard and start collaborating!</li>
            </ol>
          </div>
          
          <p>Welcome to the team! If you have any questions, feel free to reach out to ${invitedBy} or our support team.</p>
          
          <p>Best regards,<br>
          <strong>The UppalCRM Team</strong></p>
        </div>
        
        <div style="background: #6b7280; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px;">© 2024 UppalCRM. All rights reserved.</p>
          <p style="margin: 0; font-size: 12px;">
            This email was sent to ${memberEmail} because you were invited to join ${organizationName}.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate text content for team member invitation email
   */
  generateTeamInvitationEmailText({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }) {
    return `
🎉 You've been invited to join ${organizationName} CRM!

Hello ${memberName},

${invitedBy} has invited you to join the ${organizationName} CRM team!

YOUR LOGIN DETAILS:
-------------------
Organization: ${organizationName}
Login URL: ${loginUrl}
Email: ${memberEmail}
Temporary Password: ${temporaryPassword}

🔐 IMPORTANT SECURITY NOTICE:
Please change your temporary password immediately after logging in for security purposes.

GETTING STARTED:
1. Visit the login URL above
2. Log in using your email and temporary password
3. Change your password in Account Settings
4. Complete your profile information
5. Explore the dashboard and start collaborating!

Welcome to the team! If you have any questions, feel free to reach out to ${invitedBy} or our support team.

Best regards,
The UppalCRM Team

---
This email was sent to ${memberEmail} because you were invited to join ${organizationName}.
© 2024 UppalCRM. All rights reserved.
    `;
  }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;