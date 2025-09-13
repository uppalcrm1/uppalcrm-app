const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create transporter
const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials not configured. Email sending will be simulated.');
    return null;
  }

  return nodemailer.createTransporter(emailConfig);
};

// Email templates
const emailTemplates = {
  'user-welcome': {
    subject: 'Welcome to {{organizationName}} CRM - Your Account Details',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to {{organizationName}} CRM</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .credentials { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; }
          .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to {{organizationName}} CRM!</h1>
          <p>Your account has been created by {{createdBy}}</p>
        </div>
        
        <div class="content">
          <h2>Hello {{name}},</h2>
          
          <p>Your account has been successfully created for {{organizationName}} CRM system. Below are your login credentials:</p>
          
          <div class="credentials">
            <h3>Your Login Details:</h3>
            <p><strong>Email:</strong> {{email}}</p>
            <p><strong>Temporary Password:</strong> <code>{{password}}</code></p>
            <p><strong>Login URL:</strong> <a href="{{loginUrl}}">{{loginUrl}}</a></p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important Security Notice:</strong>
            <ul>
              <li>This is a temporary password that must be changed on your first login</li>
              <li>Please log in within the next 7 days</li>
              <li>Keep your credentials secure and do not share them</li>
              <li>Contact your administrator if you have any issues</li>
            </ul>
          </div>
          
          <p>To get started:</p>
          <ol>
            <li>Click the login button below or visit the login URL</li>
            <li>Enter your email and temporary password</li>
            <li>Follow the prompts to set up your new password</li>
            <li>Complete your profile setup</li>
          </ol>
          
          <a href="{{loginUrl}}" class="button">Login to Your Account</a>
          
          <p>If you have any questions or need assistance, please contact your system administrator or reply to this email.</p>
          
          <p>Best regards,<br>The {{organizationName}} Team</p>
        </div>
        
        <div class="footer">
          <p>This email was sent automatically. Please do not reply to this email address.</p>
          <p>If you did not expect this email, please contact your system administrator immediately.</p>
        </div>
      </body>
      </html>
    `
  },

  'password-reset': {
    subject: 'Password Reset - {{organizationName}} CRM',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - {{organizationName}} CRM</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .credentials { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; }
          .button { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔐 Password Reset</h1>
          <p>Your password has been reset</p>
        </div>
        
        <div class="content">
          <h2>Hello {{name}},</h2>
          
          <p>Your password for {{organizationName}} CRM has been reset by {{resetBy}}. Below are your new login credentials:</p>
          
          <div class="credentials">
            <h3>Your New Login Details:</h3>
            <p><strong>Email:</strong> {{email}}</p>
            <p><strong>New Password:</strong> <code>{{password}}</code></p>
            <p><strong>Login URL:</strong> <a href="{{loginUrl}}">{{loginUrl}}</a></p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important Security Notice:</strong>
            <ul>
              <li>This is a temporary password that must be changed immediately</li>
              <li>You will be required to set a new password on login</li>
              <li>If you did not request this reset, contact your administrator immediately</li>
              <li>This password will expire in 24 hours if not used</li>
            </ul>
          </div>
          
          <a href="{{loginUrl}}" class="button">Login & Change Password</a>
          
          <p>For your security, please change this password immediately after logging in.</p>
          
          <p>If you have any concerns about this password reset or suspect unauthorized access, please contact your system administrator immediately.</p>
          
          <p>Best regards,<br>The {{organizationName}} Team</p>
        </div>
        
        <div class="footer">
          <p>This password reset was performed by: {{resetBy}}</p>
          <p>If you did not expect this email, please contact your system administrator immediately.</p>
        </div>
      </body>
      </html>
    `
  },

  'bulk-operation': {
    subject: 'Account Status Update - {{organizationName}} CRM',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Update - {{organizationName}} CRM</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0891b2; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .info { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; }
          .button { background: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Account Status Update</h1>
        </div>
        
        <div class="content">
          <h2>Hello {{name}},</h2>
          
          <p>Your account status for {{organizationName}} CRM has been updated by {{updatedBy}}.</p>
          
          <div class="info">
            <h3>Update Details:</h3>
            <p><strong>Action:</strong> {{action}}</p>
            <p><strong>New Status:</strong> {{newStatus}}</p>
            <p><strong>Updated By:</strong> {{updatedBy}}</p>
            <p><strong>Date:</strong> {{date}}</p>
          </div>
          
          {{#if loginUrl}}
          <a href="{{loginUrl}}" class="button">Access Your Account</a>
          {{/if}}
          
          <p>If you have any questions about this change, please contact your system administrator.</p>
          
          <p>Best regards,<br>The {{organizationName}} Team</p>
        </div>
        
        <div class="footer">
          <p>This email was sent automatically following an account status change.</p>
        </div>
      </body>
      </html>
    `
  }
};

// Template rendering function
const renderTemplate = (templateName, data) => {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template '${templateName}' not found`);
  }

  let html = template.html;
  let subject = template.subject;

  // Simple template replacement (you could use a more sophisticated template engine)
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, data[key] || '');
    subject = subject.replace(regex, data[key] || '');
  });

  // Clean up any remaining template variables
  html = html.replace(/{{[^}]+}}/g, '');
  subject = subject.replace(/{{[^}]+}}/g, '');

  return { html, subject };
};

/**
 * Send email using configured transporter
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject (optional if using template)
 * @param {string} options.html - Email HTML content (optional if using template)
 * @param {string} options.template - Template name to use
 * @param {Object} options.data - Data to render in template
 * @returns {Object} Send result
 */
const sendEmail = async (options) => {
  try {
    const { to, subject, html, template, data = {} } = options;
    
    const transporter = createTransporter();
    
    // If no transporter (missing config), simulate sending
    if (!transporter) {
      console.log('📧 [SIMULATED] Email would be sent to:', to);
      console.log('📧 [SIMULATED] Subject:', subject || `Template: ${template}`);
      if (template) {
        const rendered = renderTemplate(template, data);
        console.log('📧 [SIMULATED] Rendered subject:', rendered.subject);
      }
      return {
        success: true,
        messageId: `simulated-${Date.now()}`,
        simulated: true
      };
    }

    let emailContent = { subject, html };
    
    // Use template if specified
    if (template) {
      emailContent = renderTemplate(template, data);
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Uppal CRM'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject: emailContent.subject,
      html: emailContent.html,
    };

    console.log('📧 Sending email to:', to);
    const result = await transporter.sendMail(mailOptions);
    
    console.log('📧 Email sent successfully:', result.messageId);
    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };

  } catch (error) {
    console.error('📧 Email send error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send welcome email to new user
 * @param {Object} userData - User data
 * @param {string} password - Generated password
 * @param {string} createdBy - Name of user who created the account
 * @returns {Object} Send result
 */
const sendWelcomeEmail = async (userData, password, createdBy) => {
  return sendEmail({
    to: userData.email,
    template: 'user-welcome',
    data: {
      name: userData.name,
      email: userData.email,
      password,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      organizationName: process.env.ORGANIZATION_NAME || 'Your Organization',
      createdBy
    }
  });
};

/**
 * Send password reset email
 * @param {Object} userData - User data
 * @param {string} newPassword - New password
 * @param {string} resetBy - Name of user who reset the password
 * @returns {Object} Send result
 */
const sendPasswordResetEmail = async (userData, newPassword, resetBy) => {
  return sendEmail({
    to: userData.email,
    template: 'password-reset',
    data: {
      name: userData.name,
      email: userData.email,
      password: newPassword,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      organizationName: process.env.ORGANIZATION_NAME || 'Your Organization',
      resetBy
    }
  });
};

/**
 * Send bulk operation notification email
 * @param {Object} userData - User data
 * @param {string} action - Action performed
 * @param {string} updatedBy - Name of user who performed the action
 * @returns {Object} Send result
 */
const sendBulkOperationEmail = async (userData, action, updatedBy) => {
  const actionLabels = {
    activate: 'Account Activated',
    deactivate: 'Account Deactivated',
    delete: 'Account Removed',
    reset_password: 'Password Reset'
  };

  return sendEmail({
    to: userData.email,
    template: 'bulk-operation',
    data: {
      name: userData.name,
      action: actionLabels[action] || action,
      newStatus: action === 'activate' ? 'Active' : action === 'deactivate' ? 'Inactive' : 'Updated',
      updatedBy,
      date: new Date().toLocaleDateString(),
      loginUrl: ['activate'].includes(action) ? (process.env.FRONTEND_URL || 'http://localhost:3000') : null,
      organizationName: process.env.ORGANIZATION_NAME || 'Your Organization'
    }
  });
};

/**
 * Test email configuration
 * @returns {Object} Test result
 */
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return {
        success: false,
        message: 'SMTP configuration missing'
      };
    }

    await transporter.verify();
    return {
      success: true,
      message: 'Email configuration is valid'
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBulkOperationEmail,
  testEmailConfig,
  renderTemplate
};