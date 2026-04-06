const nodemailer = require("nodemailer");

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // use SSL/TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

//Register Email Controller
async function sendRegistrationEmail(email, name) {
  try {
    console.log("📨 Sending registration email to:", email);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Welcome to Venue Booking Automated systems",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Hello ${name}</h2>
          <p>Welcome to <strong>Venue Booking Automated systems</strong>!</p>
          <p>Your account has been created successfully. You can now log in and start booking venues.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">This is an automated message. Please do not reply.</p>
        </div>
      `
    });

    console.log("✅ Registration Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Registration Email error:", err.message);
    return false;
  }
}

//Login Email Controller
async function sendLoginEmail(email,name) {
  try {
    console.log("📨 Sending login email to:", email);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Welcome back to Venue Booking Automated systems",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Hello ${name}</h2>
          <p>A new login was detected for your account.</p>
          <p>If this wasn't you, please reset your password immediately.</p>
        </div>
      `
    });

    console.log("✅ Login Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Login Email error:", err.message);
    return false;
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
    console.log("📨 Sending status update email to:", email);
    
    let color = "#2563eb"; // Blue for pending/approved
    if (status === 'rejected' || status === 'revoked') color = "#dc2626"; // Red
    
    let htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: ${color}; text-transform: uppercase;">Booking ${status}</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your venue booking request for <strong>${venueName}</strong> on <strong>${date}</strong> (${timeSlot}) has been <strong>${status}</strong>.</p>`;
    
    if (reason && (status === 'rejected' || status === 'revoked')) {
      htmlContent += `<div style="background: #fff5f5; padding: 10px; border-left: 4px solid #dc2626; margin: 10px 0;">
        <strong>Reason:</strong> ${reason}
      </div>`;
    }

    htmlContent += `</div>`;

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Venue Booking Status: ${status.toUpperCase()}`,
      html: htmlContent
    });

    console.log("✅ Status update Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Status Email error:", err.message);
    return false;
  }
}

// New Booking Notification to Admins
async function sendNewBookingAdminNotification(adminEmails, facultyName, venueNames, date, timeSlot) {
  try {
    if (!adminEmails || adminEmails.length === 0) return;
    
    // venueNames can be a string or array
    const venues = Array.isArray(venueNames) ? venueNames.join(', ') : venueNames;
    
    console.log("📨 Sending new booking admin notification for:", venues);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: adminEmails.join(','),
      subject: "New Venue Booking Request",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">New Booking Request</h2>
          <p>Faculty <strong>${facultyName}</strong> has requested the following:</p>
          <p><strong>Venues:</strong> ${venues}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time Slot(s):</strong> ${timeSlot}</p>
          <p style="margin-top: 20px;">Please log in to the admin panel to review these requests.</p>
        </div>
      `
    });

    console.log("✅ Admin Notification Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Admin Email error:", err.message);
    return false;
  }
}

module.exports = {
    sendRegistrationEmail,
    sendLoginEmail,
    sendForgotPasswordEmail,
    sendStatusUpdateEmail,
    sendNewBookingAdminNotification
}