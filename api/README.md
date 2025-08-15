# SendGrid Email API Setup

This API handles email functionality for the Minor Keith site using SendGrid.

## Features
- Contact form submissions
- Waitlist signups with confirmation emails
- Purchase notifications (for future integration)

## Setup Instructions

### 1. Install Dependencies
```bash
cd api
npm install
```

### 2. Configure SendGrid

1. Get your SendGrid API key from: https://app.sendgrid.com/settings/api_keys
2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
3. Add your SendGrid API key and email settings to `.env`:
```
SENDGRID_API_KEY=SG.your_actual_api_key_here
SENDGRID_FROM_EMAIL=noreply@minorkeith.com
YOUR_EMAIL=me@minorkeith.com
```

### 3. Verify SendGrid Sender

**Important:** You must verify the sender email address in SendGrid:
1. Go to https://app.sendgrid.com/settings/sender_auth
2. Add and verify `noreply@minorkeith.com` (or your chosen FROM email)
3. Complete domain authentication for better deliverability

## Deployment Options

### Option 1: Deploy to Vercel (Easiest)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Add environment variables in Vercel dashboard:
   - Go to your project settings
   - Add the same variables from your `.env` file

4. Update the frontend `script.js` with your API URL:
```javascript
const API_URL = 'https://your-api.vercel.app';
```

### Option 2: Deploy to Netlify Functions

1. Move `server.js` content to `netlify/functions/api.js`
2. Deploy with Netlify CLI
3. API will be available at `/.netlify/functions/api`

### Option 3: Deploy to Your Own Server

1. Upload the api folder to your server
2. Install dependencies: `npm install`
3. Set up environment variables
4. Use PM2 or similar to keep it running:
```bash
npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup
```

## Testing Locally

1. Start the API server:
```bash
npm run dev
```

2. The API will run on `http://localhost:3001`

3. Test endpoints:
- Health check: GET `http://localhost:3001/health`
- Contact form: POST `http://localhost:3001/api/contact`
- Waitlist: POST `http://localhost:3001/api/waitlist`

## API Endpoints

### POST /api/contact
Handles contact form submissions.

Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "inquiryType": "custom",
  "message": "I need help with..."
}
```

### POST /api/waitlist
Handles waitlist signups.

Request body:
```json
{
  "email": "user@example.com",
  "product": "DockerVac"
}
```

### POST /api/purchase-notification
Sends license keys after purchase (integrate with payment processor).

Request body:
```json
{
  "customerEmail": "customer@example.com",
  "customerName": "Jane Doe",
  "product": "PortCleaner",
  "amount": 12.00,
  "licenseKey": "PC-XXXXX-XXXXX-XXXXX"
}
```

## Frontend Integration

The frontend is already configured to use these endpoints. Just update the `API_URL` in `script.js`:

```javascript
// Change this to your deployed API URL
const API_URL = 'https://your-api-url.vercel.app';
```

## Security Notes

- Never commit your `.env` file
- Use environment variables in production
- Consider rate limiting for production
- Add CORS restrictions for your domain only

## Troubleshooting

### Emails not sending?
1. Check SendGrid API key is correct
2. Verify sender email is authenticated
3. Check SendGrid activity feed for errors

### CORS errors?
Update the cors configuration in `server.js` to specify your domain:
```javascript
app.use(cors({
  origin: 'https://minorkeith.com'
}));
```

### Need help?
Email me@minorkeith.com for assistance.