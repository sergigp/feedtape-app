# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FeedTape is a React Native/Expo mobile app that converts RSS feeds to high-quality audio using a backend TTS (text-to-speech) service. Users authenticate with GitHub OAuth, manage their RSS feed subscriptions, and listen to articles as audio with background playback support via AirPods/AirPlay.

**Tech Stack:**
- Frontend: React Native (0.81.4), Expo (~54.0), TypeScript
- Audio: `react-native-track-player` for background playback, `expo-av` as fallback
- Backend Integration: REST API at `https://delightful-freedom-production.up.railway.app` (prod) or `http://localhost:8080` (dev)
- Authentication: GitHub OAuth via expo-web-browser, JWT tokens stored in expo-secure-store
- State Management: React Context (AuthContext)

## Development Commands

### Running the App
```bash
# Standard development (uses production API)
npm start

# iOS development with local backend
npm run ios:dev

# Android development with local backend
npm run android:dev

# Development with custom backend URL
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8080 npm start
```

### Platform-Specific Commands
```bash
# iOS
npm run ios              # Production backend
npm run ios:dev          # Local backend

# Android
npm run android          # Production backend
npm run android:dev      # Local backend

# Web (limited support)
npm run web
```

### Environment Variables
- `EXPO_PUBLIC_API_URL`: Override the API base URL (defaults to production)
  - Production: `https://delightful-freedom-production.up.railway.app`
  - Local dev: `http://localhost:8080`

## Architecture

### Service Layer Architecture
The app uses a **singleton service pattern** for all major features:

1. **Authentication Flow** (`authService.ts` → `AuthContext.tsx`)
   - `authService.loginWithGitHub()`: Opens OAuth flow via WebBrowser, receives tokens in callback URL
   - Tokens stored in SecureStore, automatically added to API requests via `ApiClient`
   - `AuthContext` manages auth state globally, provides `useAuth()` hook
   - Token refresh handled automatically by `ApiClient` on 401 responses

2. **Audio Playback** (`trackPlayerService.ts` is primary, `ttsService.ts` is legacy)
   - **Primary**: `trackPlayerService` - Uses `react-native-track-player` for background audio, lock screen controls, AirPods support
   - **Legacy**: `ttsService` - Uses `expo-av`, kept for reference but NOT actively used
   - Audio workflow:
     1. Call `/api/tts/synthesize` with article text + link
     2. Backend returns MP3 audio (binary)
     3. Convert blob → base64 → save to local cache using `react-native-fs`
     4. Play via TrackPlayer with file:// URI
     5. Track progress with interval timer, update UI callback
     6. Clean up cached file after playback stops

3. **Feed Management** (`feedService.ts`)
   - `getFeeds()`: Fetch user's saved feed URLs from backend
   - `addFeed(id, url, title)`: Add new feed (client generates UUID)
   - RSS content fetched directly from feed URLs (not proxied through backend)
   - Parsed locally using `rssParser.ts`

4. **API Communication** (`apiClient.ts`)
   - Centralized HTTP client with automatic JWT token injection
   - Auto-refresh tokens on 401 (calls `/auth/refresh` with refresh token)
   - Triggers logout if refresh fails (calls `onAuthError` callback)

### Component Hierarchy
```
App.tsx (AuthProvider wrapper)
  └─ AppContent (main navigation logic)
      ├─ LoginScreen (GitHub OAuth button)
      ├─ SplashScreen (3-second startup)
      ├─ FeedList (user's RSS feeds)
      │   └─ FeedListItem (individual feed)
      └─ TrackList (articles from selected feed)
          ├─ TrackItem (individual article)
          └─ MinimalPlayer (playback controls, progress bar)
```

### Navigation Pattern
Navigation is **state-based** (not using React Navigation):
- State: `currentScreen: 'splash' | 'feedList' | 'trackList'`
- Flow: Splash (3s) → FeedList → (select feed) → TrackList → (back button) → FeedList
- Playback stops automatically when navigating back to FeedList

### Data Flow

**Authentication:**
1. User taps "Login with GitHub" → `authService.loginWithGitHub()`
2. Opens WebBrowser to `${API_BASE_URL}/auth/oauth/github?mobile=true`
3. Backend redirects to GitHub, user authorizes
4. Callback redirects to `feedtape://auth/callback?token=...&refresh_token=...`
5. Parse tokens, store in SecureStore, set in ApiClient
6. Fetch user data from `/api/me`, update AuthContext

**Feed Selection & Playback:**
1. User selects feed → `handleFeedSelect(feed)`
2. Fetch RSS XML from feed.url → parse with `parseRSSFeed()`
3. Display articles in TrackList
4. User selects article → `selectArticle(index)`
5. User taps play → `handlePlayPause()`
6. Call `trackPlayerService.speak(article.plainText, article.link, { onProgressUpdate })`
7. Backend TTS generates audio → save to cache → play via TrackPlayer
8. Progress updates via callback, update UI every 100ms

## API Integration (OpenAPI Spec)

Backend API spec is defined in `openapi.yaml`. Key endpoints:

- **Auth:**
  - `GET /auth/oauth/github?mobile=true` - Start OAuth flow
  - `GET /auth/callback/github?code=...` - OAuth callback (returns tokens)
  - `POST /auth/refresh` - Refresh access token
  - `POST /auth/logout` - Invalidate refresh token

- **User:**
  - `GET /api/me` - Get user info, settings, subscription (usage limits)
  - `PATCH /api/me` - Update user settings

- **Feeds:**
  - `GET /api/feeds` - List user's feeds
  - `POST /api/feeds` - Add feed (requires client-generated UUID)
  - `PUT /api/feeds/{feedId}` - Update feed title
  - `DELETE /api/feeds/{feedId}` - Delete feed

- **TTS:**
  - `POST /api/tts/synthesize` - Convert text to audio (returns MP3 binary)
    - Body: `{ text: string, link: string, language?: 'auto' | 'es' | 'en' | ... }`
    - Response: `audio/mpeg` with headers `X-Duration-Seconds`, `X-Character-Count`

All protected endpoints require `Authorization: Bearer <token>` header (handled by ApiClient).

## Important Implementation Details

### Token Management
- Access tokens expire after 1 hour (default)
- Refresh tokens are long-lived
- `ApiClient` automatically refreshes on 401
- Tokens stored in `expo-secure-store` (encrypted on-device storage)
- Token refresh updates SecureStore via callback

### Audio Playback Gotchas
- **MUST use file:// URIs** - TrackPlayer on iOS doesn't support data URIs, must save to cache
- **Clean up cache** - Old audio files left in `RNFS.CachesDirectoryPath`, delete on stop
- **Progress tracking** - TrackPlayer doesn't auto-update, must poll position every 100ms
- **Background audio** - TrackPlayer handles lock screen controls automatically via capabilities config

### RSS Parsing
- RSS fetched directly from feed URLs (not proxied)
- Parser extracts: `title`, `link`, `contentSnippet` (plain text), `isoDate`
- HTML stripped from content for TTS input

### Development Workflow
- Backend runs separately (not in this repo)
- For local backend testing, use `npm run ios:dev` or set `EXPO_PUBLIC_API_URL`
- OAuth callback URL must match backend config (`feedtape://auth/callback`)

## Testing Notes

No automated tests currently configured. To manually test:

1. **Authentication:** Login with GitHub account, verify tokens stored
2. **Feed Management:** Add/remove feeds, verify persistence across app restarts
3. **Playback:** Test with various article lengths, verify background playback works with screen locked
4. **Token Refresh:** Wait >1 hour, verify token auto-refresh on API call
5. **Offline Behavior:** Test with no network (should gracefully handle TTS errors)

## Common Development Tasks

### Adding a New TTS Voice/Language
1. Backend must support the language in TTS service
2. Update `language` type in `src/types/index.ts` (`TtsRequest`)
3. Pass language in `trackPlayerService.speak()` options

### Debugging Audio Issues
- Check console logs: `[TrackPlayer]` prefix
- Verify file saved: `console.log` fileUri in `trackPlayerService.ts:221`
- Test with `ttsService` (expo-av) to isolate TrackPlayer issues
- Check iOS audio session settings in `trackPlayerService.ts:76`

### Modifying API Calls
- Update `openapi.yaml` first (source of truth)
- TypeScript types in `src/types/index.ts` should match OpenAPI schemas
- Add/update service methods in appropriate service file
- Handle errors with user-friendly `Alert.alert()` messages
