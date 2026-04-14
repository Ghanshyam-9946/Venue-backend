// Using Brevo (HTTP API) to bypass Render's SMTP Port blocking
// Make sure to add BREVO_API_KEY to your .env file or Render environment

const transporter = {
  sendMail: async (mailOptions) => {
    // The "to" might be an array or string. In this app, it's mostly string, but could be comma-separated for admins
    const toEmails = mailOptions.to.split(',').map(e => ({ email: e.trim() }));
    
    const payload = {
      sender: {
        name: "Venue Booking Automated systems",
        email: process.env.SMTP_USER // Kept SMTP_USER to avoid breaking existing setup. Ensure this is verified on Brevo.
      },
      to: toEmails,
      subject: mailOptions.subject,
      htmlContent: mailOptions.html
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Brevo API Error (${response.status}): ${errorData}`);
    }

    const data = await response.json();
    return { messageId: data.messageId };
  }
};

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

    console.log(" Registration Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error(" Registration Email error:", err.message);
    return false;
  }
}

//Login Email Controller
async function sendLoginEmail(email, name) {
  try {
    console.log(" Sending login email to:", email);

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

    console.log("Login Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error(" Login Email error:", err.message);
    return false;
  }
}

//Forgot password 

async function sendForgotPasswordEmail(email, resetUrl) {
  try {

    console.log("Sending Forgot Password email to:", email);

    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Here is the link to fogot your password",
      html: `
      <h2>Password Reset</h2>
      <p>To reset your password, please copy and paste the following full link into your browser address bar:</p>
      <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; word-break: break-all; margin: 20px 0; border: 1px solid #e4e4e7;">${resetUrl}</div>
      <p>This link will expire in 10 minutes.</p>
      <br>
      <i>Note: Please do not click any 'Unsubscribe' link below to avoid unsubscribing from key alerts.</i>
      `
    });

    console.log(" Email sent:", info.messageId);

  } catch (err) {

    console.log(" Email error:", err);

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

    console.log(" Status update Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error(" Status Email error:", err.message);
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

    console.log("Admin Notification Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error(" Admin Email error:", err.message);
    return false;
  }
}

// OTP Email
async function sendOTPEmail(email, otp) {
  try {
    console.log("📨 Sending OTP email to:", email);
    const info = await transporter.sendMail({
      from: `"Venue Booking Automated systems" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your Registration OTP - Venue Booking System",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Account Verification</h2>
          <p>Please use the following 6-digit OTP to verify your email address and complete registration:</p>
          <h1 style="font-size: 32px; letter-spacing: 4px; color: #1e3a8a;">${otp}</h1>
          <p>This code will expire in 5 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `
    });
    console.log(" OTP Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error(" OTP Email error:", err.message);
    return false;
  }
}

module.exports = {
  sendRegistrationEmail,
  sendLoginEmail,
  sendForgotPasswordEmail,
  sendStatusUpdateEmail,
  sendNewBookingAdminNotification,
  sendOTPEmail
}