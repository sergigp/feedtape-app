# Backend OAuth Setup for Mobile App

## Problem
The mobile app opens the OAuth flow in a browser, but after successful authentication, the browser window doesn't close automatically because the backend is displaying the tokens instead of redirecting back to the app.

## Solution
The backend needs to redirect to the mobile app's deep link URL after successful GitHub OAuth.

## Required Backend Changes

### Option 1: Direct Redirect (Recommended)

Modify the `/auth/callback/github` endpoint to detect mobile requests and redirect accordingly:

```javascript
// In your GitHub callback handler
app.get('/auth/callback/github', async (req, res) => {
  // ... existing OAuth code to get tokens ...

  const { token, refresh_token, expires_in } = tokenResponse;

  // Check if this is a mobile app request
  // You can detect this via User-Agent or a query parameter
  const isMobile = req.headers['user-agent']?.includes('Expo') ||
                   req.query.mobile === 'true';

  if (isMobile) {
    // Redirect to mobile app deep link
    const deepLink = `feedtape://auth/callback?token=${encodeURIComponent(token)}&refresh_token=${encodeURIComponent(refresh_token)}&expires_in=${expires_in}`;
    return res.redirect(deepLink);
  }

  // Existing web response
  return res.json({ token, refresh_token, expires_in });
});
```

### Option 2: HTML Page with Auto-Redirect (Alternative)

If you can't detect mobile requests, create an HTML page that automatically triggers the deep link:

```javascript
app.get('/auth/callback/github', async (req, res) => {
  // ... existing OAuth code to get tokens ...

  const { token, refresh_token, expires_in } = tokenResponse;

  // Return HTML that auto-redirects
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Successful</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .success {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #333;
          margin-bottom: 0.5rem;
        }
        p {
          color: #666;
        }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #333;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 1rem auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success">✓</div>
        <h1>Authentication Successful!</h1>
        <p>Redirecting you back to the app...</p>
        <div class="spinner"></div>
      </div>

      <script>
        // Try to redirect to the app
        const deepLink = 'feedtape://auth/callback?' +
          'token=${encodeURIComponent(token)}' +
          '&refresh_token=${encodeURIComponent(refresh_token)}' +
          '&expires_in=${expires_in}';

        // Attempt redirect
        window.location.href = deepLink;

        // Fallback: show manual close instruction after 2 seconds
        setTimeout(() => {
          const container = document.querySelector('.container');
          container.innerHTML = \`
            <div class="success">✓</div>
            <h1>Authentication Complete</h1>
            <p>You can now close this window and return to the app.</p>
          \`;
        }, 2000);
      </script>
    </body>
    </html>
  `);
});
```

### Option 3: Query Parameter for Mobile Detection

Add a query parameter when initiating OAuth from mobile:

**Frontend change** (if you want to use this approach):
```typescript
const authUrl = `${API_BASE_URL}/auth/oauth/github?mobile=true`;
```

**Backend change**:
```javascript
// Preserve the mobile parameter through the OAuth flow
app.get('/auth/oauth/github', (req, res) => {
  const state = req.query.mobile === 'true' ? 'mobile' : 'web';
  // Include state in OAuth redirect to GitHub
  // ... GitHub OAuth setup with state parameter
});

app.get('/auth/callback/github', async (req, res) => {
  const isMobile = req.query.state === 'mobile';
  // ... handle as in Option 1
});
```

## Testing

1. Start the mobile app: `npm start`
2. Click "Continue with GitHub"
3. Authenticate with GitHub
4. The browser should automatically close and return you to the app
5. The app should show the FeedList screen

## Deep Link Format

The mobile app expects this format:
```
feedtape://auth/callback?token=<JWT_TOKEN>&refresh_token=<REFRESH_TOKEN>&expires_in=<SECONDS>
```

All parameters must be URL-encoded.

## Troubleshooting

- **Browser doesn't close**: The backend isn't redirecting to the deep link
- **App doesn't receive tokens**: Check the deep link URL format
- **"No tokens received" error**: Tokens are missing from the deep link URL
- **Deep link doesn't work on iOS**: Ensure `scheme: "feedtape"` is in app.json
- **Deep link doesn't work on Android**: May need to rebuild the app after adding the scheme

## Current Backend Endpoint

According to your OpenAPI spec:
```yaml
/auth/callback/github:
  get:
    responses:
      '200':
        description: Authentication successful, user logged in
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TokenResponse'
```

This needs to be modified to support mobile redirects as described above.
