// Quick test script to verify nodemailer works
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing nodemailer v' + require('nodemailer/package.json').version);

try {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  console.log('✅ Transporter created successfully!');

  transporter.sendMail({
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: 'uppalsolutions@gmail.com',
    subject: 'Test Email from UppalCRM',
    text: 'This is a test email to verify nodemailer is working correctly.',
    html: '<p>This is a test email to verify nodemailer is working correctly.</p>'
  }).then(info => {
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
  }).catch(error => {
    console.error('❌ Error sending email:', error.message);
  });

} catch (error) {
  console.error('❌ Error creating transporter:', error.message);
  console.error('This means nodemailer is not working correctly.');
}
