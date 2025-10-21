const nodemailer = require('nodemailer');

/**
 * =============================================================================
 * Email Service using Brevo SMTP
 * =============================================================================
 *
 * CRITICAL: TWO DISTINCT EMAIL CONTEXTS - DO NOT MIX!
 *
 * ========================================================================
 * EMAIL CONTEXT 1: PLATFORM-LEVEL EMAILS
 * ========================================================================
 * Purpose: UppalCRM (the SaaS platform) sending emails to organizations
 * Use Cases:
 *   - Trial signup confirmations (sendTrialConfirmation)
 *   - Trial credentials (sendTrialCredentials)
 *   - Admin notifications for new signups (sendLeadNotification)
 *   - Subscription/billing notifications
 *   - Platform announcements
 *
 * Sender Configuration:
 *   - FROM_EMAIL: uppalcrm1@gmail.com
 *   - FROM_NAME: "UppalCRM" or "UppalCRM Team"
 *   - Recipient: Organization admins/owners
 *
 * Functions:
 *   - sendTrialConfirmation()
 *   - sendTrialCredentials()
 *   - sendLeadNotification()
 *   - sendWelcomeEmail()
 *   - sendTrialExpirationWarning()
 *
 * ========================================================================
 * EMAIL CONTEXT 2: ORGANIZATION-LEVEL EMAILS
 * ========================================================================
 * Purpose: Organizations sending emails to their team members
 * Use Cases:
 *   - User invitation emails (sendTeamMemberInvitation)
 *   - Password reset emails for team members
 *   - Internal team notifications
 *
 * Sender Configuration:
 *   - FROM_EMAIL: uppalcrm1@gmail.com (shared platform email - Option A)
 *   - FROM_NAME: "UppalCRM - [Organization Name]" (dynamically set per org)
 *   - Recipient: Team members within that organization
 *   - TODO: Future Option B - Allow orgs to configure custom SMTP
 *
 * Functions:
 *   - sendTeamMemberInvitation()
 *   - sendPasswordResetEmail() (when used for team members)
 *
 * ========================================================================
 *
 * Required Environment Variables:
 * - SMTP_HOST: Brevo SMTP server (default: smtp-relay.brevo.com)
 * - SMTP_PORT: SMTP port (default: 587)
 * - SMTP_USER: Your Brevo login email
 * - SMTP_PASS: Your Brevo SMTP key (not your login password!)
 * - FROM_EMAIL: Email address to send from (uppalcrm1@gmail.com)
 * - FROM_NAME: Default display name (UppalCRM Team)
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
   * ========================================================================
   * PLATFORM-LEVEL EMAIL (Context 1)
   * ========================================================================
   * Send trial confirmation email to customer
   *
   * This is a PLATFORM-LEVEL email from UppalCRM to an organization admin,
   * NOT an organization-to-team-member email.
   *
   * Sender Context:
   * - FROM_NAME: "UppalCRM" (platform-level)
   * - FROM_EMAIL: uppalcrm1@gmail.com
   * - Recipient: Organization admin/owner signing up for trial
   *
   * @param {Object} options - Email options
   * @param {string} options.customerName - Customer's full name
   * @param {string} options.customerEmail - Customer's email address
   * @param {string} options.company - Company name
   */
  async sendTrialConfirmation({ customerName, customerEmail, company }) {
    if (!this.isAvailable()) {
      console.log('📧 Email service not available, skipping trial confirmation email');
      return null;
    }

    const subject = `Welcome to UppalCRM - Your Trial Request is Being Reviewed`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; background: #f5f5f5; }
          .container { background: #ffffff; margin: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; }
          .content { padding: 30px; }
          .highlight-box { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .steps { background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .steps ol { margin: 10px 0; padding-left: 20px; }
          .steps li { margin: 10px 0; }
          .footer { background: #f7f7f7; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Thank You for Your Interest!</h1>
            <p>Your trial request has been received</p>
          </div>

          <div class="content">
            <p>Hello ${customerName},</p>

            <p>Thank you for your interest in UppalCRM! We've successfully received your trial request and are excited to help transform the way you manage customer relationships.</p>

            <div class="highlight-box">
              <h3 style="margin-top: 0; color: #667eea;">✅ Request Confirmed</h3>
              <div class="info-row"><span class="label">Email:</span> ${customerEmail}</div>
              <div class="info-row"><span class="label">Company:</span> ${company}</div>
              <div class="info-row"><span class="label">Submitted:</span> ${new Date().toLocaleString()}</div>
            </div>

            <div class="steps">
              <h3 style="margin-top: 0; color: #667eea;">What Happens Next?</h3>
              <ol>
                <li><strong>Review (within 24 hours):</strong> Our team will review your trial request</li>
                <li><strong>Account Setup:</strong> We'll create your personalized CRM account</li>
                <li><strong>Credentials Email:</strong> You'll receive your login credentials via email</li>
                <li><strong>14-Day Trial:</strong> Start exploring all UppalCRM features for free</li>
              </ol>
            </div>

            <p><strong>💡 In the meantime:</strong></p>
            <ul>
              <li>Check your inbox (and spam folder) for our welcome email with login credentials</li>
              <li>Think about your CRM goals and what you'd like to achieve</li>
              <li>Prepare any existing customer data you'd like to import</li>
            </ul>

            <p><strong>Why UppalCRM?</strong></p>
            <ul>
              <li>✨ Intuitive and easy-to-use interface</li>
              <li>📊 Powerful contact and lead management</li>
              <li>🔄 Seamless workflow automation</li>
              <li>📈 Advanced analytics and reporting</li>
              <li>🤝 Excellent customer support</li>
            </ul>

            <p>Questions? Just reply to this email - we're here to help!</p>

            <p>Best regards,<br>
            <strong>The UppalCRM Team</strong><br>
            <a href="mailto:support@uppalcrm.com" style="color: #667eea;">support@uppalcrm.com</a></p>
          </div>

          <div class="footer">
            <p><strong>UppalCRM</strong> - Transform Your Customer Relationships</p>
            <p>© ${new Date().getFullYear()} UppalCRM. All rights reserved.</p>
            <p style="margin-top: 10px;">
              This email was sent to ${customerEmail} because you requested a trial at uppalcrm.com
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Welcome to UppalCRM - Your Trial Request is Being Reviewed

Hello ${customerName},

Thank you for your interest in UppalCRM! We've successfully received your trial request and are excited to help transform the way you manage customer relationships.

✅ REQUEST CONFIRMED
Email: ${customerEmail}
Company: ${company}
Submitted: ${new Date().toLocaleString()}

WHAT HAPPENS NEXT?

1. Review (within 24 hours): Our team will review your trial request
2. Account Setup: We'll create your personalized CRM account
3. Credentials Email: You'll receive your login credentials via email
4. 14-Day Trial: Start exploring all UppalCRM features for free

💡 IN THE MEANTIME:
- Check your inbox (and spam folder) for our welcome email with login credentials
- Think about your CRM goals and what you'd like to achieve
- Prepare any existing customer data you'd like to import

WHY UPPALCRM?
✨ Intuitive and easy-to-use interface
📊 Powerful contact and lead management
🔄 Seamless workflow automation
📈 Advanced analytics and reporting
🤝 Excellent customer support

Questions? Just reply to this email - we're here to help!

Best regards,
The UppalCRM Team
support@uppalcrm.com

---
UppalCRM - Transform Your Customer Relationships
© ${new Date().getFullYear()} UppalCRM. All rights reserved.

This email was sent to ${customerEmail} because you requested a trial at uppalcrm.com
    `;

    try {
      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: customerEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Entity-Ref-ID': `trial-confirmation-${Date.now()}`,
          'X-Priority': '3'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Trial confirmation sent to ${customerEmail}:`, result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send trial confirmation:', error);
      return null;
    }
  }

  /**
   * ========================================================================
   * PLATFORM-LEVEL EMAIL (Context 1)
   * ========================================================================
   * Send trial credentials email to customer with instant login access
   *
   * This is a PLATFORM-LEVEL email from UppalCRM to an organization admin.
   *
   * Sender Context:
   * - FROM_NAME: "UppalCRM" (platform-level)
   * - FROM_EMAIL: uppalcrm1@gmail.com
   * - Recipient: Organization admin/owner who signed up
   *
   * @param {Object} options - Email options
   * @param {string} options.customerName - Customer's full name
   * @param {string} options.customerEmail - Customer's email address
   * @param {string} options.company - Company name
   * @param {string} options.loginUrl - Login URL
   * @param {string} options.username - Username (email)
   * @param {string} options.password - Generated password
   * @param {string} options.organizationSlug - Organization slug
   */
  async sendTrialCredentials({ customerName, customerEmail, company, loginUrl, username, password, organizationSlug }) {
    if (!this.isAvailable()) {
      console.log('📧 Email service not available, skipping trial credentials email');
      return null;
    }

    const subject = `🎉 Your ${company} CRM is Ready! Login credentials inside`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; background: #f5f5f5; }
          .container { background: #ffffff; margin: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; }
          .content { padding: 30px; }
          .credentials-box { background: #f0f7ff; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea; }
          .credentials-box h3 { margin-top: 0; color: #667eea; }
          .credential-row { margin: 15px 0; padding: 12px; background: white; border-radius: 5px; }
          .credential-label { font-weight: bold; color: #555; display: block; margin-bottom: 5px; font-size: 13px; }
          .credential-value { font-family: 'Courier New', monospace; font-size: 16px; color: #1a202c; word-break: break-all; background: #f8f9fa; padding: 8px 12px; border-radius: 4px; }
          .cta-button { display: inline-block; background: #667eea; color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; font-size: 16px; }
          .cta-button:hover { background: #5568d3; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .warning-box h4 { margin-top: 0; color: #856404; }
          .steps { background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .steps ol { margin: 10px 0; padding-left: 20px; }
          .steps li { margin: 10px 0; }
          .footer { background: #f7f7f7; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to UppalCRM!</h1>
            <p>Your CRM account is ready to use</p>
          </div>

          <div class="content">
            <p>Hello ${customerName},</p>

            <p>Great news! Your <strong>${company}</strong> CRM account has been automatically created and is ready to use right now. No waiting required!</p>

            <div class="credentials-box">
              <h3>🔑 Your Login Credentials</h3>
              <p style="margin-bottom: 15px; color: #555;">Save these details in a secure place:</p>

              <div class="credential-row">
                <span class="credential-label">Login URL</span>
                <div class="credential-value">${loginUrl}</div>
              </div>

              <div class="credential-row">
                <span class="credential-label">Username (Email)</span>
                <div class="credential-value">${username}</div>
              </div>

              <div class="credential-row">
                <span class="credential-label">Password</span>
                <div class="credential-value">${password}</div>
              </div>

              <div class="credential-row">
                <span class="credential-label">Organization</span>
                <div class="credential-value">${organizationSlug}</div>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="cta-button">
                🚀 Login to Your CRM Now
              </a>
            </div>

            <div class="warning-box">
              <h4>🔐 Important Security Notice</h4>
              <p style="margin: 0;">For your security, please change your password immediately after your first login. Go to Settings → Account → Change Password.</p>
            </div>

            <div class="steps">
              <h3 style="margin-top: 0; color: #667eea;">Quick Start Guide</h3>
              <ol>
                <li><strong>Login:</strong> Click the button above or visit the login URL</li>
                <li><strong>Change Password:</strong> Update to a password you'll remember</li>
                <li><strong>Complete Profile:</strong> Add your company details</li>
                <li><strong>Import Data:</strong> Upload your existing contacts/leads (optional)</li>
                <li><strong>Invite Team:</strong> Add team members to collaborate</li>
                <li><strong>Explore:</strong> Start managing your customer relationships!</li>
              </ol>
            </div>

            <p><strong>💡 Pro Tips:</strong></p>
            <ul>
              <li>Bookmark your login URL for quick access</li>
              <li>Set up custom fields for your specific business needs</li>
              <li>Enable email notifications to stay updated</li>
              <li>Check out our Help Center for video tutorials</li>
            </ul>

            <p><strong>📊 What You Get:</strong></p>
            <ul>
              <li>✨ Unlimited contacts and leads</li>
              <li>📈 Advanced analytics dashboard</li>
              <li>🔄 Workflow automation</li>
              <li>📧 Email integration</li>
              <li>👥 Team collaboration tools</li>
              <li>📱 Mobile-responsive interface</li>
              <li>🛟 Priority customer support</li>
            </ul>

            <p>Need help getting started? Just reply to this email - our team is here to help you succeed!</p>

            <p>Welcome aboard!<br>
            <strong>The UppalCRM Team</strong><br>
            <a href="mailto:support@uppalcrm.com" style="color: #667eea;">support@uppalcrm.com</a></p>
          </div>

          <div class="footer">
            <p><strong>UppalCRM</strong> - Transform Your Customer Relationships</p>
            <p>© ${new Date().getFullYear()} UppalCRM. All rights reserved.</p>
            <p style="margin-top: 10px;">
              This email was sent to ${customerEmail} with your CRM login credentials.<br>
              If you didn't sign up for UppalCRM, please ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
🎉 Welcome to UppalCRM - Your CRM is Ready!

Hello ${customerName},

Great news! Your ${company} CRM account has been automatically created and is ready to use right now. No waiting required!

🔑 YOUR LOGIN CREDENTIALS
Save these details in a secure place:

Login URL: ${loginUrl}
Username: ${username}
Password: ${password}
Organization: ${organizationSlug}

🔐 IMPORTANT SECURITY NOTICE
For your security, please change your password immediately after your first login.
Go to Settings → Account → Change Password.

QUICK START GUIDE
1. Login: Visit ${loginUrl}
2. Change Password: Update to a password you'll remember
3. Complete Profile: Add your company details
4. Import Data: Upload your existing contacts/leads (optional)
5. Invite Team: Add team members to collaborate
6. Explore: Start managing your customer relationships!

💡 PRO TIPS
- Bookmark your login URL for quick access
- Set up custom fields for your specific business needs
- Enable email notifications to stay updated
- Check out our Help Center for video tutorials

📊 WHAT YOU GET
✨ Unlimited contacts and leads
📈 Advanced analytics dashboard
🔄 Workflow automation
📧 Email integration
👥 Team collaboration tools
📱 Mobile-responsive interface
🛟 Priority customer support

Need help getting started? Just reply to this email - our team is here to help you succeed!

Welcome aboard!
The UppalCRM Team
support@uppalcrm.com

---
UppalCRM - Transform Your Customer Relationships
© ${new Date().getFullYear()} UppalCRM. All rights reserved.

This email was sent to ${customerEmail} with your CRM login credentials.
If you didn't sign up for UppalCRM, please ignore this email.
    `;

    try {
      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'UppalCRM',
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: customerEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Entity-Ref-ID': `trial-credentials-${Date.now()}`,
          'X-Priority': '2' // High priority - contains login credentials
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Trial credentials sent to ${customerEmail}:`, result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send trial credentials:', error);
      return null;
    }
  }

  /**
   * ========================================================================
   * PLATFORM-LEVEL EMAIL (Context 1)
   * ========================================================================
   * Send admin notification when a new lead signs up
   *
   * This is a PLATFORM-LEVEL email from UppalCRM to platform admins.
   *
   * Sender Context:
   * - FROM_NAME: "UppalCRM Marketing" (platform-level)
   * - FROM_EMAIL: uppalcrm1@gmail.com
   * - Recipient: Platform admins (uppalcrm1@gmail.com)
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
   * ========================================================================
   * ORGANIZATION-LEVEL EMAIL (Context 2)
   * ========================================================================
   * Send team member invitation email
   *
   * This is an ORGANIZATION-LEVEL email sent from the organization to their
   * team member, NOT a platform-level email from UppalCRM.
   *
   * Sender Context:
   * - FROM_NAME: "UppalCRM - [Organization Name]" (organization-specific)
   * - FROM_EMAIL: uppalcrm1@gmail.com (platform email for now)
   * - TODO: Future Option B - Allow organizations to configure custom SMTP
   *
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

      // ORGANIZATION-LEVEL: From name includes organization name
      const fromName = `UppalCRM - ${organizationName}`;
      const subject = `You've been invited to join ${organizationName} CRM`;

      const mailOptions = {
        from: {
          name: fromName, // Organization-specific sender name
          address: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        to: memberEmail,
        subject,
        text: this.generateTeamInvitationEmailText({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }),
        html: this.generateTeamInvitationEmailHTML({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }),
        headers: {
          'X-Mailer': 'UppalCRM via Brevo',
          'X-Priority': '3',
          'X-Email-Context': 'organization-level', // Document context in headers
          'X-Organization': organizationName
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ [ORG-LEVEL] Team invitation email sent to ${memberEmail} (${memberName}) from ${organizationName}`, result.messageId);
      return true;

    } catch (error) {
      console.error('❌ Failed to send team invitation email:', error.message);
      return false;
    }
  }

  /**
   * ORGANIZATION-LEVEL EMAIL TEMPLATE
   * Generate HTML content for team member invitation email
   * This template is specifically for organization-to-team-member communication
   */
  generateTeamInvitationEmailHTML({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #0ea5e9, #3b82f6); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${organizationName}</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">powered by UppalCRM</p>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Team Member Invitation</p>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p>Hello ${memberName},</p>

          <p><strong>${invitedBy}</strong> from <strong>${organizationName}</strong> has invited you to join their team on UppalCRM!</p>
          
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
   * ORGANIZATION-LEVEL EMAIL TEMPLATE (Plain Text)
   * Generate text content for team member invitation email
   * This template is specifically for organization-to-team-member communication
   */
  generateTeamInvitationEmailText({ memberName, organizationName, invitedBy, loginUrl, temporaryPassword, memberEmail }) {
    return `
🎉 You've been invited to join ${organizationName}!

Hello ${memberName},

${invitedBy} from ${organizationName} has invited you to join their team on UppalCRM!

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

  /**
   * Send trial expiration warning email
   */
  async sendTrialExpirationWarning(organizationData, daysLeft) {
    if (!this.isAvailable()) {
      console.log('📧 Email service not available, skipping trial expiration warning');
      return false;
    }

    try {
      const subject = `⚠️ Your ${organizationData.organization_name} trial expires in ${daysLeft} days`;
      const html = this.generateTrialExpirationHTML(organizationData, daysLeft);
      const text = this.generateTrialExpirationText(organizationData, daysLeft);

      const mailOptions = {
        from: `${process.env.FROM_NAME || 'UppalCRM Team'} <${process.env.FROM_EMAIL}>`,
        to: organizationData.admin_email,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Trial expiration warning sent to:', organizationData.admin_email);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send trial expiration warning:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate trial expiration warning HTML
   */
  generateTrialExpirationHTML(organizationData, daysLeft) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Trial Expiration Warning</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; }
        .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .warning-box h3 { margin-top: 0; color: #856404; }
        .cta-button { display: inline-block; background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .features-list { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Trial Expiring Soon</h1>
        </div>

        <div class="content">
            <p>Hello ${organizationData.admin_first_name || 'there'},</p>

            <div class="warning-box">
                <h3>Your ${organizationData.organization_name} trial expires in ${daysLeft} days!</h3>
                <p>Don't lose access to your CRM data and features. Upgrade now to continue without interruption.</p>
            </div>

            <p>Your trial has been helping you manage your customer relationships effectively. To keep your momentum going, upgrade to a paid plan before your trial expires.</p>

            <div class="features-list">
                <h4>🚫 What happens when your trial expires?</h4>
                <ul>
                    <li>Your account will be moved to a 7-day grace period</li>
                    <li>Access to advanced features will be limited</li>
                    <li>After the grace period, your account will be suspended</li>
                    <li>You may lose access to your valuable CRM data</li>
                </ul>
            </div>

            <div style="text-align: center;">
                <a href="${process.env.APP_URL || 'http://localhost:3003'}/subscription" class="cta-button">
                    🚀 Upgrade Now & Save Your Data
                </a>
            </div>

            <p>Choose from our flexible plans starting at just $29/month. All plans include:</p>
            <ul>
                <li>✅ Unlimited contacts and leads</li>
                <li>✅ Advanced reporting and analytics</li>
                <li>✅ Email integration and automation</li>
                <li>✅ Priority customer support</li>
                <li>✅ Data export and backup features</li>
            </ul>

            <p>Questions? Our support team is here to help you choose the right plan for your business.</p>

            <p>Best regards,<br><strong>The UppalCRM Team</strong></p>
        </div>

        <div class="footer">
            <p>© 2024 UppalCRM. All rights reserved.</p>
            <p>You're receiving this email because your trial is expiring soon.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate trial expiration warning text
   */
  generateTrialExpirationText(organizationData, daysLeft) {
    return `
Hello ${organizationData.admin_first_name || 'there'},

Your ${organizationData.organization_name} trial expires in ${daysLeft} days!

Don't lose access to your CRM data and features. Upgrade now to continue without interruption.

What happens when your trial expires?
- Your account will be moved to a 7-day grace period
- Access to advanced features will be limited
- After the grace period, your account will be suspended
- You may lose access to your valuable CRM data

Choose from our flexible plans starting at just $29/month.

All plans include:
✅ Unlimited contacts and leads
✅ Advanced reporting and analytics
✅ Email integration and automation
✅ Priority customer support
✅ Data export and backup features

Upgrade now: ${process.env.APP_URL || 'http://localhost:3003'}/subscription

Questions? Our support team is here to help you choose the right plan for your business.

Best regards,
The UppalCRM Team

© 2024 UppalCRM. All rights reserved.
You're receiving this email because your trial is expiring soon.
`;
  }

  /**
   * Send notifications for expiring trials
   */
  async sendTrialExpirationNotifications() {
    const { query } = require('../database/connection');
    console.log('📧 Checking for trials that need expiration notifications...');

    try {
      // Find trials expiring in 3 days, 1 day
      const expiringTrials = await query(`
        SELECT
          os.id,
          os.organization_id,
          os.trial_ends_at,
          o.name as organization_name,
          u.email as admin_email,
          u.first_name as admin_first_name,
          u.last_name as admin_last_name,
          CASE
            WHEN os.trial_ends_at > NOW() THEN EXTRACT(days FROM os.trial_ends_at - NOW())::int
            ELSE 0
          END as days_left
        FROM organization_subscriptions os
        JOIN organizations o ON o.id = os.organization_id
        LEFT JOIN users u ON u.organization_id = os.organization_id
          AND u.role = 'admin'
          AND u.is_active = true
        WHERE os.status = 'trial'
        AND (
          os.trial_ends_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '4 days' OR  -- 3 days warning
          os.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '2 days'  -- 1 day warning
        )
        AND u.email IS NOT NULL
      `);

      console.log(`Found ${expiringTrials.rows.length} trials requiring notifications`);

      let sentCount = 0;
      for (const trial of expiringTrials.rows) {
        try {
          const result = await this.sendTrialExpirationWarning(trial, trial.days_left);
          if (result.success) {
            sentCount++;
            console.log(`✅ Sent expiration warning to ${trial.admin_email} (${trial.days_left} days left)`);
          }
        } catch (error) {
          console.error(`❌ Failed to send notification to ${trial.admin_email}:`, error.message);
        }
      }

      return sentCount;
    } catch (error) {
      console.error('❌ Failed to send trial expiration notifications:', error);
      throw error;
    }
  }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;