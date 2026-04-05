const nodemailer = require("nodemailer");

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

//Register Email Controller
async function sendRegistrationEmail(email, name) {
  try {

    console.log("Sending registration email to:", email);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Welcome to Venue Booking Automated systems",
      html: `
        <h2>Hello ${name}</h2>
        <p>Your account is created successfully.</p>
      `
    });

    console.log("✅ Email sent:", info.messageId);

  } catch (err) {

    console.log("❌ Email error:", err);

  }
}

//Login Email Controller
async function sendLoginEmail(email,name) {
  try {

    console.log("Sending login email to:", email);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Welcome back to Venue Booking Automated systems",
      html: `
        <h2>Hello ${name}</h2>
        <p>You are logged in succesfully</p>
      `
    });

    console.log("✅ Email sent:", info.messageId);

  } catch (err) {

    console.log("❌ Email error:", err);

  }
}

//Forgot password 

async function sendForgotPasswordEmail(email,resetUrl) {
  try {

    console.log("Sending Forgot Password email to:", email);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Here is the link to fogot your password",
      html: `
      <h2>Password Reset</h2>
      <p>Click below link to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 10 minutes.</p>
      `
    });

    console.log("✅ Email sent:", info.messageId);

  } catch (err) {

    console.log("❌ Email error:", err);

  }
}

// Status Update Email
async function sendStatusUpdateEmail(email, name, status, reason, venueName, date, timeSlot) {
  try {
    console.log("Sending status update email to:", email);
    let htmlContent = `<h2>Hello ${name}</h2>
      <p>Your venue booking request for <strong>${venueName}</strong> on <strong>${date}</strong> (${timeSlot}) has been <strong>${status}</strong>.</p>`;
    
    if (reason && (status === 'rejected' || status === 'revoked')) {
      htmlContent += `<p><strong>Reason:</strong> ${reason}</p>`;
    }

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Venue Booking Status Update: ${status.toUpperCase()}`,
      html: htmlContent
    });

    console.log("✅ Status update Email sent:", info.messageId);
  } catch (err) {
    console.log("❌ Email error:", err);
  }
}

// New Booking Notification to Admins
async function sendNewBookingAdminNotification(adminEmails, facultyName, venueName, date, timeSlot) {
  try {
    if (!adminEmails || adminEmails.length === 0) return;
    console.log("Sending new booking admin notification to:", adminEmails);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: adminEmails.join(','),
      subject: "New Venue Booking Request",
      html: `
        <h2>New Booking Request</h2>
        <p>Faculty <strong>${facultyName}</strong> has requested the venue <strong>${venueName}</strong>.</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time Slot:</strong> ${timeSlot}</p>
        <p>Please log in to the admin panel to approve or reject this request.</p>
      `
    });

    console.log("✅ Admin Notification Email sent:", info.messageId);
  } catch (err) {
    console.log("❌ Email error:", err);
  }
}

module.exports = {
    sendRegistrationEmail,
    sendLoginEmail,
    sendForgotPasswordEmail,
    sendStatusUpdateEmail,
    sendNewBookingAdminNotification
}