require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testMail() {
  try {
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection is verified!');

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER, // send to self
      subject: "SMTP Test Email",
      text: "If you receive this, your SMTP configuration is working correctly.",
    });
    console.log('✅ Test email sent:', info.messageId);
  } catch (error) {
    console.error('❌ SMTP Error:', error);
  }
}

testMail();
