// Using Brevo (HTTP API) to bypass Render's SMTP Port blocking
// Make sure to add BREVO_API_KEY to your .env file or Render environment

const transporter = {
  sendMail: async (mailOptions) => {
    // The "to" might be an array or string. In this app, it's mostly string, but could be comma-separated for admins
    const toEmails = mailOptions.to.split(',').map(e => ({ email: e.trim() }));
    
    const payload = {
      sender: {
        name: "Sistec Event Organizer",
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
      from: `"Sistec Event Organizer" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "🎉 Welcome to Sistec Event Organizer — You're Registered!",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #10b981; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
          
          <!-- HEADER -->
          <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 30px 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
              🎉 Congratulations!
            </h1>
            <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px; font-weight: 500;">
              You are now part of the Sistec Event Organizer
            </p>
          </div>

          <!-- BODY -->
          <div style="padding: 32px 28px; background: white;">
            <p style="color: #1f2937; font-size: 17px; font-weight: 600; margin: 0 0 8px 0;">
              Hello ${name}, 👋
            </p>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
              Your registration was <strong style="color: #059669;">successful</strong>! You now have access to the 
              <strong>Sistec Venue Booking System</strong> — your one-stop platform to discover, reserve, 
              and manage college venues and resources with ease.
            </p>

            <!-- SUCCESS BOX -->
            <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border-left: 5px solid #10b981; margin: 20px 0;">
              <p style="margin: 0 0 6px 0; color: #065f46; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.08em;">
                ✅ Account Activated
              </p>
              <p style="color: #1f2937; font-size: 15px; margin: 0; line-height: 1.6;">
                You can now <strong>log in</strong>, browse available venues, submit booking requests, 
                and track your booking status — all in one place.
              </p>
            </div>

            <!-- WHAT YOU CAN DO -->
            <p style="color: #374151; font-size: 14px; font-weight: 700; margin: 24px 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em;">
              What You Can Do:
            </p>
            <ul style="color: #4b5563; font-size: 14px; line-height: 2; padding-left: 20px; margin: 0 0 24px 0;">
              <li>📅 Browse and book available venues</li>
              <li>⏰ Select time slots that suit your schedule</li>
              <li>📋 Track your booking status in real time</li>
              <li>🔔 Get email alerts for approvals and updates</li>
            </ul>

            <p style="color: #6b7280; font-size: 13px; font-style: italic; margin: 20px 0 0 0;">
              If you did not register for this account, please contact the administration immediately.
            </p>
          </div>

          <!-- FOOTER -->
          <div style="background: #f8fafc; padding: 16px 28px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="font-size: 14px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0;">
              Sistec Event Organizer
            </p>
            <p style="font-size: 11px; color: #9ca3af; margin: 0;">
              This is an automated message. Please do not reply.
            </p>
          </div>

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
async function sendLoginEmail(email, name) {
  try {
    console.log(" Sending login email to:", email);

    const info = await transporter.sendMail({
      from: `"Sistec Event Organizer" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Welcome back to Sistec Event Organizer",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Hello ${name}</h2>
          <p>A new login was detected for your account.</p>
          <p>If this wasn't you, please reset your password immediately.</p>
          <p>Regards,<br><strong>Sistec event organizer</strong></p>
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
      <p>Regards,<br><strong>Sistec event organizer</strong></p>
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

    let htmlContent = "";

    if (status === 'revoked') {
       htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ef4444; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background: #fef2f2; padding: 20px; border-bottom: 2px solid #fee2e2;">
            <h2 style="color: #991b1b; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">
              🚨 BOOKING REVOKED
            </h2>
          </div>
          <div style="padding: 24px; background: white;">
            <p style="color: #1f2937; font-size: 16px; font-weight: 500;">Hello ${name},</p>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              Please be advised that your booking for <strong>${venueName}</strong> on <strong>${date}</strong> (${timeSlot}) has been <strong>REVOKED</strong> by the higher authority/HOD to accommodate an urgent priority event.
            </p>
            
            <div style="background: #fff5f5; padding: 20px; border-radius: 8px; border-left: 5px solid #ef4444; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 11px; text-transform: uppercase; font-weight: bold;">Official Reason</p>
              <p style="color: #1f2937; font-size: 15px; margin: 0; font-style: italic;">"${reason || "Reason not specified by authority"}"</p>
            </div>

            <p style="color: #6b7280; font-size: 13px; font-style: italic; margin-top: 20px;">
              We apologize for any inconvenience caused. Please check for alternative venues or slots.
            </p>

            <div style="margin-top: 30px; border-top: 1px solid #f3f4f6; pt: 20px; text-align: center;">
              <p style="font-size: 14px; font-weight: bold; color: #1e3a8a; margin: 0;">Sistec Event Organizer</p>
            </div>
          </div>
        </div>
      `;
    } else if (status === 'approved') {
       htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #10b981; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background: #ecfdf5; padding: 20px; border-bottom: 2px solid #d1fae5;">
            <h2 style="color: #065f46; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">
              🎉 BOOKING APPROVED
            </h2>
          </div>
          <div style="padding: 24px; background: white;">
            <p style="color: #1f2937; font-size: 16px; font-weight: 500;">Hello ${name},</p>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              We are pleased to inform you that your booking request for <strong>${venueName}</strong> on <strong>${date}</strong> (${timeSlot}) has been <strong>APPROVED</strong>.
            </p>
            
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 5px solid #10b981; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #065f46; font-size: 11px; text-transform: uppercase; font-weight: bold;">Confirmation Note</p>
              <p style="color: #1f2937; font-size: 15px; margin: 0; font-style: italic;">"${reason || "Your resource is reserved and ready for use."}"</p>
            </div>

            <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
              Please ensure to follow the venue guidelines and arrive on time.
            </p>

            <div style="margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 20px; text-align: center;">
              <p style="font-size: 14px; font-weight: bold; color: #1e3a8a; margin: 0;">Sistec Event Organizer</p>
            </div>
          </div>
        </div>
      `;
    } else {
       // Rejected or other
       const isRejected = status === 'rejected';
       const color = isRejected ? "#dc2626" : "#2563eb";
       const bgColor = isRejected ? "#fef2f2" : "#eff6ff";
       const borderColor = isRejected ? "#fee2e2" : "#dbeafe";
       const textColor = isRejected ? "#991b1b" : "#1e40af";

       htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid ${color}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background: ${bgColor}; padding: 20px; border-bottom: 2px solid ${borderColor};">
            <h2 style="color: ${textColor}; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">
              BOOKING ${status.toUpperCase()}
            </h2>
          </div>
          <div style="padding: 24px; background: white;">
            <p style="color: #1f2937; font-size: 16px; font-weight: 500;">Hello ${name},</p>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              Your venue booking request for <strong>${venueName}</strong> on <strong>${date}</strong> (${timeSlot}) has been <strong>${status.toUpperCase()}</strong>.
            </p>
            
            ${reason ? `
            <div style="background: ${isRejected ? '#fff5f5' : '#f8fafc'}; padding: 20px; border-radius: 8px; border-left: 5px solid ${color}; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: ${textColor}; font-size: 11px; text-transform: uppercase; font-weight: bold;">Admin Remarks</p>
              <p style="color: #1f2937; font-size: 15px; margin: 0; font-style: italic;">"${reason}"</p>
            </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
              ${isRejected ? "Please check for other available slots or contact the administration for further assistance." : ""}
            </p>

            <div style="margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 20px; text-align: center;">
              <p style="font-size: 14px; font-weight: bold; color: #1e3a8a; margin: 0;">Sistec Event Organizer</p>
            </div>
          </div>
        </div>
      `;
    }

    const info = await transporter.sendMail({
      from: `"Sistec Event Organizer" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Resource Booking Status: ${status.toUpperCase()}`,
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
async function sendNewBookingAdminNotification(adminEmails, facultyName, venueNames, date, timeSlot, requirements) {
  try {
    if (!adminEmails || adminEmails.length === 0) return;

    // venueNames can be a string or array
    const venues = Array.isArray(venueNames) ? venueNames.join(', ') : venueNames;

    console.log("📨 Sending new booking admin notification for:", venues);

    const info = await transporter.sendMail({
      from: `"Sistec Event Organizer" <${process.env.SMTP_USER}>`,
      to: adminEmails.join(','),
      subject: "New Resource Booking Request",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">New Booking Request</h2>
          <p>Faculty <strong>${facultyName}</strong> has requested the following:</p>
          <p><strong>Venues:</strong> ${venues}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time Slot(s):</strong> ${timeSlot}</p>
          ${requirements ? `<p><strong>Requirements/Specific Needs:</strong> ${requirements}</p>` : ''}
          <p style="margin-top: 20px;">Please log in to the admin panel to review these requests.</p>
          <p>Regards,<br><strong>Sistec event organizer</strong></p>
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

// Specialized Revoke/Priority Request Notification
async function sendPriorityBookingAdminNotification(adminEmails, facultyName, previousFacultyName, venueNames, date, timeSlot, priorityReason) {
  try {
    if (!adminEmails || adminEmails.length === 0) return;

    const venues = Array.isArray(venueNames) ? venueNames.join(', ') : venueNames;
    console.log("📨 Sending priority/revoke request notification for:", venues);

    const info = await transporter.sendMail({
      from: `"Sistec Event Organizer" <${process.env.SMTP_USER}>`,
      to: adminEmails.join(','),
      subject: `[URGENT] Priority Request for ${venues}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fde68a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background: #fef3c7; padding: 20px; border-bottom: 2px solid #fde68a;">
            <h2 style="color: #92400e; margin: 0; display: flex; align-items: center; gap: 10px;">
              ⚠️ URGENT PRIORITY REQUEST
            </h2>
          </div>
          <div style="padding: 24px; background: white;">
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              A high-priority venue request has been submitted by <strong>${facultyName}</strong> for a slot that is <strong>already booked</strong>.
            </p>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 5px solid #eab308; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #71717a; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Priority Justification</p>
              <p style="font-style: italic; color: #1e293b; font-size: 15px; margin: 0;">"${priorityReason || "No reason provided"}"</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Event Details:</td>
                <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 600;">${venues} | ${date} (${timeSlot})</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Current Holder:</td>
                <td style="padding: 10px 0; color: #dc2626; font-size: 14px; font-weight: 600;">${previousFacultyName}</td>
              </tr>
            </table>

            <div style="margin-top: 30px; text-align: center;">
              <p style="font-size: 13px; color: #6b7280; margin-bottom: 15px;">If this event takes precedence, please log in as Admin to approve/revoke.</p>
              <p style="font-size: 14px; font-weight: bold; color: #1e40af;">Sistec Event Organizer Team</p>
            </div>
          </div>
        </div>
      `
    });

    console.log("Priority Notification Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error(" Priority Admin Email error:", err.message);
    return false;
  }
}

// OTP Email
async function sendOTPEmail(email, otp) {
  try {
    console.log("📨 Sending OTP email to:", email);
    const info = await transporter.sendMail({
      from: `"Sistec Event Organizer" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your Registration OTP - Sistec Event Organizer",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Account Verification</h2>
          <p>Please use the following 6-digit OTP to verify your email address and complete registration:</p>
          <h1 style="font-size: 32px; letter-spacing: 4px; color: #1e3a8a;">${otp}</h1>
          <p>This code will expire in 5 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Regards,<br><strong>Sistec event organizer</strong></p>
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
  sendPriorityBookingAdminNotification,
  sendOTPEmail
}