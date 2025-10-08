# Backend Mobile Authentication Specification

## Objective
Modify the GitHub OAuth callback endpoint to support mobile app authentication by redirecting to a deep link instead of returning JSON.

## Context
- The mobile app uses deep linking with the scheme `feedtape://`
- Currently, the `/auth/callback/github` endpoint returns a JSON response
- The mobile app needs the backend to redirect to `feedtape://auth/callback` with tokens in the query string
- This allows the browser to close automatically and return control to the mobile app

## Required Changes

### 1. Modify GitHub OAuth Callback Endpoint

**Endpoint:** `GET /auth/callback/github`

**Current Behavior:**
Returns JSON:
```json
{
  "token": "eyJhbGc...",
  "refresh_token": "550e8400...",
  "expires_in": 3600
}
```

**New Behavior:**
Detect if the request is from a mobile app and redirect to deep link instead of returning JSON.

### 2. Implementation Requirements

#### Detection Strategy
Implement ONE of these detection methods (in order of preference):

**Option A: User-Agent Detection (Recommended)**
```javascript
const isMobile = req.headers['user-agent']?.toLowerCase().includes('expo') ||
                 req.headers['user-agent']?.toLowerCase().includes('react native');
```

**Option B: Query Parameter**
- Frontend passes `?mobile=true` when initiating OAuth
- Preserve this through the OAuth state parameter
- Check in callback: `const isMobile = req.query.mobile === 'true' || req.query.state?.includes('mobile');`

**Option C: Accept Header**
```javascript
const isMobile = req.headers['accept']?.includes('application/x-expo');
```

#### Response Logic

After successful GitHub OAuth (when you have the tokens):

```javascript
// Assuming you have these variables from your OAuth flow:
const token = /* JWT access token */;
const refresh_token = /* Refresh token */;
const expires_in = /* Expiry in seconds, typically 3600 */;

// Check if mobile
const isMobile = /* use detection strategy above */;

if (isMobile) {
  // Build deep link URL
  const deepLinkUrl = `feedtape://auth/callback?` +
    `token=${encodeURIComponent(token)}` +
    `&refresh_token=${encodeURIComponent(refresh_token)}` +
    `&expires_in=${expires_in}`;

  // Redirect to deep link
  return res.redirect(302, deepLinkUrl);
}

// Existing web behavior - return JSON
return res.status(200).json({
  token,
  refresh_token,
  expires_in
});
```

### 3. Complete Implementation Example

Here's a complete example of what the callback handler should look like:

```javascript
router.get('/auth/callback/github', async (req, res) => {
  try {
    // 1. Extract code from query params
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ message: 'Missing authorization code' });
    }

    // 2. Exchange code for GitHub access token
    // [Your existing GitHub OAuth exchange code here]
    const githubToken = /* ... */;

    // 3. Get user info from GitHub
    // [Your existing GitHub user fetch code here]
    const githubUser = /* ... */;

    // 4. Create or update user in your database
    // [Your existing user creation/update code here]
    const user = /* ... */;

    // 5. Generate JWT and refresh token
    // [Your existing token generation code here]
    const token = /* JWT token */;
    const refresh_token = /* Refresh token */;
    const expires_in = 3600;

    // 6. Check if mobile request
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = userAgent.toLowerCase().includes('expo') ||
                     userAgent.toLowerCase().includes('react native') ||
                     state === 'mobile';

    // 7. Return appropriate response
    if (isMobile) {
      // Mobile: redirect to deep link
      const deepLinkUrl = `feedtape://auth/callback?` +
        `token=${encodeURIComponent(token)}` +
        `&refresh_token=${encodeURIComponent(refresh_token)}` +
        `&expires_in=${expires_in}`;

      return res.redirect(302, deepLinkUrl);
    }

    // Web: return JSON
    return res.status(200).json({
      token,
      refresh_token,
      expires_in
    });

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);

    // Check if mobile for error handling
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = userAgent.toLowerCase().includes('expo') ||
                     userAgent.toLowerCase().includes('react native');

    if (isMobile) {
      // Redirect to deep link with error
      const errorUrl = `feedtape://auth/callback?error=${encodeURIComponent(error.message || 'Authentication failed')}`;
      return res.redirect(302, errorUrl);
    }

    return res.status(401).json({ message: 'OAuth authentication failed' });
  }
});
```

### 4. Error Handling

If authentication fails for mobile requests, redirect to:
```
feedtape://auth/callback?error=<URL_ENCODED_ERROR_MESSAGE>
```

The mobile app will handle this by showing an error alert.

### 5. Testing

#### Test Cases

**Test 1: Mobile OAuth Flow**
```bash
# Simulate mobile request
curl -i -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Expo/1.0" \
  "https://your-backend.railway.app/auth/callback/github?code=test_code_123"

# Expected: 302 redirect to feedtape://auth/callback?token=...&refresh_token=...&expires_in=3600
```

**Test 2: Web OAuth Flow**
```bash
# Simulate web browser request
curl -i -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  "https://your-backend.railway.app/auth/callback/github?code=test_code_123"

# Expected: 200 JSON response with tokens
```

**Test 3: Mobile Error Handling**
```bash
# Invalid code with mobile user agent
curl -i -H "User-Agent: Expo" \
  "https://your-backend.railway.app/auth/callback/github?code=invalid"

# Expected: 302 redirect to feedtape://auth/callback?error=...
```

#### Integration Testing with Mobile App

1. Start mobile app in development
2. Click "Continue with GitHub" button
3. Complete GitHub authentication
4. Verify browser closes automatically
5. Verify app shows FeedList screen (logged in)
6. Check console for successful authentication logs

### 6. Verification Checklist

After implementation, verify:

- [ ] Mobile requests (User-Agent contains "expo" or "React Native") redirect to deep link
- [ ] Web requests still return JSON as before
- [ ] Tokens in deep link are properly URL-encoded
- [ ] All three parameters (token, refresh_token, expires_in) are present in deep link
- [ ] Error cases redirect to deep link with error parameter for mobile
- [ ] Web functionality is not broken
- [ ] Redirect uses 302 status code
- [ ] Deep link format is exactly: `feedtape://auth/callback?token=...&refresh_token=...&expires_in=...`

### 7. File Locations

Based on typical backend structures, you'll likely need to modify:

- `/routes/auth.js` or `/routes/auth.ts` - OAuth routes
- `/controllers/authController.js` or `/controllers/authController.ts` - Auth logic
- `/middleware/oauth.js` or similar - OAuth handling

**Find the exact file by searching for:**
- `"/auth/callback/github"`
- `"/auth/oauth/github"`
- `"callback/github"`

### 8. No Breaking Changes

These changes should be **additive only**:
- Existing web OAuth flow must continue to work
- API responses for web remain unchanged
- Only add mobile redirect behavior
- No database schema changes required
- No new dependencies required

### 9. Expected Timeline

This should be a small change:
- **Code changes:** 10-15 lines
- **Testing:** 15-20 minutes
- **Total time:** ~30-45 minutes

### 10. Deep Link Format Specification

The mobile app expects EXACTLY this format:

```
feedtape://auth/callback?token=<JWT_TOKEN>&refresh_token=<REFRESH_TOKEN>&expires_in=<SECONDS>
```

**Parameters:**
- `token` (required): JWT access token (URL-encoded)
- `refresh_token` (required): Refresh token (URL-encoded)
- `expires_in` (required): Expiry in seconds (integer)
- `error` (optional): Error message if auth failed (URL-encoded)

**Example:**
```
feedtape://auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c&refresh_token=550e8400-e29b-41d4-a716-446655440000&expires_in=3600
```

### 11. Questions?

If anything is unclear:
1. Check the OpenAPI spec at `/openapi.yaml` in the mobile app repo
2. The current behavior returns JSON with `TokenResponse` schema
3. Mobile app code is in `/src/services/authService.ts`
4. Contact for clarifications before implementing

## Success Criteria

Implementation is complete when:
1. Mobile app OAuth flow completes successfully
2. Browser closes automatically after GitHub auth
3. Mobile app receives tokens and shows logged-in state
4. Web OAuth flow continues to work as before
5. All test cases pass
