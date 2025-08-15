const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, inquiryType, message } = req.body;

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  const msg = {
    to: process.env.YOUR_EMAIL || 'me@minorkeith.com',
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@minorkeith.com',
    subject: `[Contact Form] ${inquiryType || 'General Inquiry'} from ${name}`,
    text: `
Name: ${name}
Email: ${email}
Inquiry Type: ${inquiryType || 'Not specified'}

Message:
${message}
    `,
    html: `
<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Inquiry Type:</strong> ${inquiryType || 'Not specified'}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br>')}</p>
    `,
    reply_to: email
  };

  try {
    await sgMail.send(msg);
    
    // Send auto-reply to user
    const autoReply = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@minorkeith.com',
      subject: 'Thanks for reaching out!',
      text: `Hi ${name},

Thanks for getting in touch! I've received your message and will get back to you within 48 hours.

Best,
Minor Keith`,
      html: `
<p>Hi ${name},</p>
<p>Thanks for getting in touch! I've received your message and will get back to you within 48 hours.</p>
<p>Best,<br>Minor Keith</p>
      `
    };
    
    await sgMail.send(autoReply);
    
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('SendGrid error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// Waitlist signup endpoint
app.post('/api/waitlist', async (req, res) => {
  const { email, product } = req.body;

  // Validation
  if (!email || !product) {
    return res.status(400).json({ error: 'Email and product are required' });
  }

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Send notification to you
  const notificationMsg = {
    to: process.env.YOUR_EMAIL || 'me@minorkeith.com',
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@minorkeith.com',
    subject: `[Waitlist] New signup for ${product}`,
    text: `New waitlist signup!\n\nProduct: ${product}\nEmail: ${email}`,
    html: `
<h3>New Waitlist Signup</h3>
<p><strong>Product:</strong> ${product}</p>
<p><strong>Email:</strong> ${email}</p>
    `
  };

  // Send confirmation to user
  const confirmationMsg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@minorkeith.com',
    subject: `You're on the ${product} waitlist!`,
    text: `Thanks for your interest in ${product}!

You're now on the waitlist. I'll email you as soon as it's ready for launch.

Expected launch: Q1 2025

In the meantime, feel free to check out PortCleaner if you haven't already!

Best,
Minor Keith`,
    html: `
<p>Thanks for your interest in ${product}!</p>
<p>You're now on the waitlist. I'll email you as soon as it's ready for launch.</p>
<p><strong>Expected launch:</strong> Q1 2025</p>
<p>In the meantime, feel free to check out PortCleaner if you haven't already!</p>
<p>Best,<br>Minor Keith</p>
    `
  };

  try {
    // Send both emails
    await Promise.all([
      sgMail.send(notificationMsg),
      sgMail.send(confirmationMsg)
    ]);

    // In production, you'd also save to a database here
    // For now, we'll just send the emails

    res.json({ success: true, message: 'Successfully joined waitlist!' });
  } catch (error) {
    console.error('SendGrid error:', error);
    res.status(500).json({ error: 'Failed to join waitlist. Please try again.' });
  }
});

// Purchase notification (for when payment is processed)
app.post('/api/purchase-notification', async (req, res) => {
  const { customerEmail, customerName, product, amount, licenseKey } = req.body;

  // Send license key to customer
  const customerMsg = {
    to: customerEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@minorkeith.com',
    subject: `Your ${product} License Key`,
    text: `Hi ${customerName},

Thank you for purchasing ${product}!

Your license key: ${licenseKey}

Installation instructions:
1. Download ${product} from: [download link]
2. Enter your license key when prompted
3. Enjoy!

If you have any issues, just reply to this email.

Best,
Minor Keith`,
    html: `
<p>Hi ${customerName},</p>
<p>Thank you for purchasing ${product}!</p>
<p><strong>Your license key:</strong> <code>${licenseKey}</code></p>
<h3>Installation instructions:</h3>
<ol>
  <li>Download ${product} from: [download link]</li>
  <li>Enter your license key when prompted</li>
  <li>Enjoy!</li>
</ol>
<p>If you have any issues, just reply to this email.</p>
<p>Best,<br>Minor Keith</p>
    `
  };

  // Notification to you
  const notificationMsg = {
    to: process.env.YOUR_EMAIL || 'me@minorkeith.com',
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@minorkeith.com',
    subject: `[Sale] ${product} purchased for $${amount}`,
    text: `New sale!\n\nProduct: ${product}\nCustomer: ${customerName} (${customerEmail})\nAmount: $${amount}\nLicense: ${licenseKey}`,
  };

  try {
    await Promise.all([
      sgMail.send(customerMsg),
      sgMail.send(notificationMsg)
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('SendGrid error:', error);
    res.status(500).json({ error: 'Failed to send purchase confirmation' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});