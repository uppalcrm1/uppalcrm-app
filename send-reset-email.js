const emailService = require('./services/emailService');

async function sendResetEmail() {
  try {
    console.log('🚀 Initializing email service...\n');
    
    // Check environment
    console.log('Email Config Check:');
    console.log('SMTP_USER:', process.env.SMTP_USER ? '✅ Set' : '❌ Not set');
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✅ Set' : '❌ Not set');
    console.log('SMTP_HOST:', process.env.SMTP_HOST || 'Default (brevo)');
    console.log('FROM_EMAIL:', process.env.FROM_EMAIL ? '✅ Set' : '❌ Not set');
    console.log('FROM_NAME:', process.env.FROM_NAME || 'UppalCRM Team\n');

    // Initialize email service
    await emailService.initialize();
    
    if (!emailService.isAvailable()) {
      console.log('❌ Email service not available. Check SMTP credentials.');
      process.exit(1);
    }

    console.log('📧 Sending password reset email to Ayush...\n');
    
    // Generate reset token for reference
    const resetToken = 'a30cf5c43c002bf87fa1d67f8b33ebfa2be1d941bd244e8f6c802a723a6f6295';
    const resetUrl = `https://uppalcrm-frontend.onrender.com/reset-password/${resetToken}`;
    
    // Send password reset email
    const result = await emailService.sendPasswordResetEmail({
      email: 'ayushhuppaltv@gmail.com',
      name: 'Ayush Chauhan',
      resetToken: resetToken,
      resetUrl: resetUrl,
      organizationName: 'Uppal CRM'
    });

    if (result) {
      console.log('✅ Password reset email sent successfully!');
      console.log('To:', 'ayushhuppaltv@gmail.com');
      console.log('Reset Link:', resetUrl);
      console.log('\nAyush should receive the email shortly.');
    } else {
      console.log('❌ Failed to send email');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

sendResetEmail();
