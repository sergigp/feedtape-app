# FeedTape

React Native/Expo app for listening to RSS feeds using native text-to-speech.

## Prerequisites

### Required Software

1. **Node.js 18+**
   ```bash
   node --version  # Should be v18.x or higher
   ```

2. **Xcode** (for iOS Simulator)
   - Install from Mac App Store
   - Open Xcode at least once to accept the license
   - Install iOS Simulator: Xcode → Settings → Platforms → iOS

3. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

4. **Watchman** (recommended for file watching)
   ```bash
   brew install watchman
   ```

## Setup

### 1. Install Dependencies

```bash
cd /path/to/feedtape/app
npm install
```

### 2. Build Native Code (First Time Only)

Since the app uses native modules (expo-speech), you need to prebuild:

```bash
npx expo prebuild --platform ios
```

This creates the `ios/` folder with native Xcode project.

### 3. Install iOS Pods

```bash
cd ios && pod install && cd ..
```

## Running the App

### Option A: Using Production Backend (Recommended for Testing)

The app is configured to use a production backend by default. Just run:

```bash
npm run ios
```

This will:
- Start the Metro bundler
- Build the iOS app
- Launch the iOS Simulator
- Install and run the app

### Option B: Using Local Backend

If you're running the backend locally on port 8080:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080 npm run ios
```

**Note:** The iOS Simulator can access `localhost` directly. If using a physical device, use your machine's IP address instead.

## Common Commands

```bash
# Start Metro bundler only (if app is already installed)
npm start

# Run on iOS Simulator
npm run ios

# Clean build (if you have issues)
cd ios && rm -rf build Pods && pod install && cd ..
npm run ios

# View Metro bundler logs
# Press 'j' in terminal to open debugger
```

## Troubleshooting

### "No bundle URL present"
The Metro bundler isn't running or can't connect. Try:
```bash
npm start --reset-cache
```

### Build fails with CocoaPods error
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Simulator not booting
Open Xcode → Window → Devices and Simulators → Check simulator status

### TTS not speaking
- Check simulator volume (Hardware → Volume Up)
- Native TTS may have limited support on Simulator - test on physical device if issues persist

## Project Structure

```
src/
├── components/     # UI components
├── contexts/       # React Context (AuthContext)
├── services/       # Business logic
│   ├── nativeTtsService.ts  # Text-to-speech
│   ├── authService.ts       # GitHub OAuth
│   ├── feedService.ts       # RSS feeds
│   └── apiClient.ts         # HTTP client
├── config/         # Environment config
└── types/          # TypeScript types
```

## Backend Dependency

The app requires a backend server for:
- GitHub OAuth authentication
- Storing user's feed subscriptions

**Default API:** `https://delightful-freedom-production.up.railway.app`

To use a local backend, set `EXPO_PUBLIC_API_URL` as shown above.
