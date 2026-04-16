require('dotenv').config();

async function testMail() {
  try {
    console.log('Testing Brevo API connection...');
    
    // The "to" might be an array or string.
    const toEmails = [{ email: process.env.SMTP_USER }]; // sending to self
    
    const payload = {
      sender: {
        name: "Sistec Event Organizer",
        email: process.env.SMTP_USER 
      },
      to: toEmails,
      subject: "Brevo API Test Email",
      htmlContent: "<p>If you receive this, your Brevo HTTP API configuration is working correctly and bypassing Render SMTP blocks!</p>"
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
    console.log('✅ Test email sent via Brevo:', data.messageId);
  } catch (error) {
    console.error('❌ Brevo Error:', error.message);
  }
}

testMail();
