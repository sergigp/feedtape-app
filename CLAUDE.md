# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FeedTape is a React Native/Expo mobile app that converts RSS feeds to audio using iOS/Android native text-to-speech. Users authenticate with GitHub OAuth, manage their RSS feed subscriptions, and listen to articles as audio.

**Tech Stack:**
- Frontend: React Native (0.81.4), Expo (~54.0), TypeScript
- TTS: `expo-speech` (iOS AVSpeechSynthesizer / Android TextToSpeech)
- Backend Integration: REST API for auth and feed management
- Authentication: GitHub OAuth via expo-web-browser, JWT tokens stored in expo-secure-store
- State Management: React Context (AuthContext)

## Development Commands

### Running the App
```bash
# Standard development
npm start

# iOS development
npm run ios

# Android development
npm run android
```

### Platform-Specific Commands
```bash
# iOS
npm run ios

# Android
npm run android

# Web (limited support)
npm run web
```

## Architecture

### Service Layer Architecture
The app uses a **singleton service pattern** for all major features:

1. **Authentication Flow** (`authService.ts` → `AuthContext.tsx`)
   - `authService.loginWithGitHub()`: Opens OAuth flow via WebBrowser, receives tokens in callback URL
   - Tokens stored in SecureStore, automatically added to API requests via `ApiClient`
   - `AuthContext` manages auth state globally, provides `useAuth()` hook
   - Token refresh handled automatically by `ApiClient` on 401 responses

2. **Text-to-Speech** (`nativeTtsService.ts`)
   - Uses `expo-speech` which wraps iOS AVSpeechSynthesizer and Android TextToSpeech
   - Simple foreground playback with play/pause/stop controls
   - Supports multiple languages and system voices
   - **Deferred features** (future task): Background playback, lock screen controls, progress tracking

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
          └─ AudioPlayer (playback controls)
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
6. Call `nativeTtsService.speak(article.plainText, options)`
7. iOS/Android native TTS speaks the text directly
8. Playback stops when done or user taps stop

## API Integration

Backend API for auth and feed management. Key endpoints:

- **Auth:**
  - `GET /auth/oauth/github?mobile=true` - Start OAuth flow
  - `GET /auth/callback/github?code=...` - OAuth callback (returns tokens)
  - `POST /auth/refresh` - Refresh access token
  - `POST /auth/logout` - Invalidate refresh token

- **User:**
  - `GET /api/me` - Get user info, settings, subscription
  - `PATCH /api/me` - Update user settings

- **Feeds:**
  - `GET /api/feeds` - List user's feeds
  - `POST /api/feeds` - Add feed (requires client-generated UUID)
  - `PUT /api/feeds/{feedId}` - Update feed title
  - `DELETE /api/feeds/{feedId}` - Delete feed

All protected endpoints require `Authorization: Bearer <token>` header (handled by ApiClient).

## Important Implementation Details

### Token Management
- Access tokens expire after 1 hour (default)
- Refresh tokens are long-lived
- `ApiClient` automatically refreshes on 401
- Tokens stored in `expo-secure-store` (encrypted on-device storage)

### Native TTS Notes
- Uses `expo-speech` for cross-platform TTS
- Speaks directly (no audio file generation)
- Pause/resume works on iOS, may not work on Android
- Available voices depend on device/OS language packs

### RSS Parsing
- RSS fetched directly from feed URLs (not proxied)
- Parser extracts: `title`, `link`, `contentSnippet` (plain text), `isoDate`
- HTML stripped from content for TTS input

## Testing Notes

To manually test:

1. **Authentication:** Login with GitHub account, verify tokens stored
2. **Feed Management:** Add/remove feeds, verify persistence across app restarts
3. **Playback:** Test with various article lengths, verify TTS speaks correctly
4. **Token Refresh:** Wait >1 hour, verify token auto-refresh on API call

## Deferred Features (Future Tasks)

The following features are planned but not yet implemented:

- **Background audio playback** - Play while app is minimized
- **Lock screen controls** - Control playback from lock screen
- **AirPods/AirPlay support** - External audio device integration
- **Progress tracking** - Visual progress bar during playback

These will require integrating `react-native-track-player` with TTS audio file generation.

## Common Development Tasks

### Adding a New Language
1. Check `expo-speech` supports the language code
2. Update `nativeTtsService.speak()` options with language parameter
3. Test on device (language packs may need to be installed)

### Debugging TTS Issues
- Check console logs: `[NativeTTS]` prefix
- Verify `expo-speech` is properly installed
- Test on real device (simulators may have limited TTS support)

### Modifying API Calls
- TypeScript types in `src/types/index.ts`
- Add/update service methods in appropriate service file
- Handle errors with user-friendly `Alert.alert()` messages
