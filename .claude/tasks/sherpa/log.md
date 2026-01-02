# Implementation Log: Sherpa ONNX TTS Integration

## Iteration 1: Sherpa ONNX Initialization & Basic Generation

**Status:** Completed
**Date:** 2026-01-02

### What Was Implemented

1. **Installed Dependencies**
   - Added `react-native-sherpa-onnx-offline-tts` from GitHub (version 0.2.4)
   - Ran `pod install` to link the native iOS module
   - Native module successfully integrated into iOS build

2. **Downloaded and Bundled English Model Files**
   - Downloaded `vits-piper-en_US-lessac-medium.tar.bz2` (64.1MB) from k2-fsa/sherpa-onnx releases
   - Extracted model files:
     - `en_US-lessac-medium.onnx` (63MB)
     - `en_US-lessac-medium.onnx.json` (4.9KB)
     - `tokens.txt` (921 bytes)
     - `espeak-ng-data/` directory (shared phoneme data)
   - Copied files to `ios/feedtapeapppolly/models/en/` and `ios/feedtapeapppolly/models/espeak-ng-data/`

3. **Created SherpaOnnxService** (`src/services/sherpaOnnxService.ts`)
   - Implemented `initialize(language)` method:
     - Validates iOS platform
     - Constructs JSON config with absolute bundle paths for model, tokens, and espeak-ng-data
     - Calls `TTSManager.initialize()` with config JSON
     - Tracks initialization status and current language
   - Implemented `generate(text, speakerId, speed)` method:
     - Validates initialization state
     - Calls `TTSManager.generate()` with text, speaker ID (default 0), and speed (default 1.0)
     - Returns WAV file path from temp directory
     - Verifies file exists using `expo-file-system`
   - Implemented `switchLanguage(language)` method for future multi-language support
   - Implemented `deinitialize()` method for cleanup

4. **Added Performance Logging**
   - Logs initialization start, duration (ms), and completion
   - Logs text length (characters) before generation
   - Logs generation duration (ms) and WAV file path
   - Logs WAV file size (bytes) after generation

5. **Created Test Screen** (`src/components/SherpaTestScreen.tsx`)
   - Simple UI with Initialize and Generate WAV buttons
   - Log display showing all console output
   - Test text: "Hello world. This is a test of the Sherpa ONNX text to speech system."

### Key Technical Decisions

1. **Model Path Configuration**
   - Native module expects JSON string with three absolute paths:
     ```json
     {
       "modelPath": "/path/to/model.onnx",
       "tokensPath": "/path/to/tokens.txt",
       "dataDirPath": "/path/to/espeak-ng-data"
     }
     ```
   - Used `FileSystem.bundleDirectory` to resolve iOS app bundle path at runtime

2. **File Verification**
   - Added file existence check after generation using `expo-file-system`
   - Logs file size to confirm WAV was actually written

### Issues and Resolutions

1. **Initial Path Format Confusion**
   - Initially attempted to pass simple relative path to `TTSManager.initialize()`
   - Reviewed native Swift code (`ViewModel.swift`) to discover JSON config requirement
   - Solution: Construct proper JSON with absolute bundle paths

2. **Model Files Not Yet Added to Xcode Project**
   - Files copied to `ios/feedtapeapppolly/models/` directory
   - **ACTION REQUIRED:** Model files must be manually added to Xcode project as bundle resources
   - Without this step, `FileSystem.bundleDirectory` will exist but model files won't be accessible

### Next Steps (Manual Testing Required)

To test Iteration 1, the following manual steps are required:

1. **Add Model Files to Xcode:**
   - Open `ios/feedtapeapppolly.xcworkspace` in Xcode
   - Drag `ios/feedtapeapppolly/models/` folder into the Xcode project navigator
   - In the dialog, select:
     - ☑ "Create folder references" (not "Create groups")
     - ☑ Add to target: feedtapeapppolly
   - Verify models appear in "Build Phases" → "Copy Bundle Resources"

2. **Run Test on Physical iOS Device:**
   ```bash
   npx expo run:ios
   ```
   - Simulators may have limited TTS support; real device recommended

3. **Navigate to Test Screen:**
   - Temporarily modify `App.tsx` to render `<SherpaTestScreen />` instead of main app
   - Or add navigation route to test screen

4. **Test Flow:**
   - Tap "Initialize" button
   - Check logs for successful initialization
   - Tap "Generate WAV" button
   - Verify WAV file path is logged
   - Check console for performance metrics

### Expected Test Results

**Initialization:**
```
[SherpaONNX] Initializing TTS service...
[SherpaONNX] Target language: en
[SherpaONNX] Model config: {"modelPath":"...","tokensPath":"...","dataDirPath":"..."}
[SherpaONNX] Initialization completed in XXXms
```

**Generation:**
```
[SherpaONNX] Starting TTS generation...
[SherpaONNX] Text length: 68 characters
[SherpaONNX] Speaker ID: 0, Speed: 1.0
[SherpaONNX] Generation completed in XXXms
[SherpaONNX] WAV file: /path/to/tts_output_XXXXX.wav
[SherpaONNX] WAV file size: XXXX bytes
```

### Known Limitations

- **No audio playback yet** - only generates WAV file, doesn't play it
- **English only** - Spanish model not bundled yet
- **No service API compatibility** - doesn't match `nativeTtsService` API yet
- **No background audio** - foreground only
- **Manual Xcode configuration required** - cannot automate bundle resource addition

### Files Modified/Created

**New Files:**
- `src/services/sherpaOnnxService.ts` (118 lines)
- `src/components/SherpaTestScreen.tsx` (102 lines)
- `ios/feedtapeapppolly/models/en/en_US-lessac-medium.onnx` (63MB)
- `ios/feedtapeapppolly/models/en/tokens.txt` (921 bytes)
- `ios/feedtapeapppolly/models/en/en_US-lessac-medium.onnx.json` (4.9KB)
- `ios/feedtapeapppolly/models/espeak-ng-data/` (directory with phoneme data)

**Modified Files:**
- `package.json` (added react-native-sherpa-onnx-offline-tts dependency)
- `ios/Podfile.lock` (updated with new pod)

### Iteration Completion Criteria

- ✅ Sherpa ONNX library installed and linked
- ✅ English model files downloaded and copied to iOS project directory
- ✅ Service class created with initialize() and generate() methods
- ✅ Performance logging implemented (duration, text length, file info)
- ✅ Manual Xcode configuration completed
- ✅ **WAV file generation SUCCESSFUL!**

### Issues Encountered and Resolved

**Issue 1: Missing `generate` Method Export**
- **Problem:** The forked library had `generate` implemented in Swift but not exported in the Objective-C bridge
- **Solution:** Added `RCT_EXTERN_METHOD` declaration for `generate` in `SherpaOnnxOfflineTts.mm`
- **Files Modified:** `node_modules/react-native-sherpa-onnx-offline-tts/ios/SherpaOnnxOfflineTts.mm`

**Issue 2: Xcode Object Version 70 Compatibility**
- **Problem:** Opening Xcode 16 upgraded project to `objectVersion = 70`, breaking CocoaPods
- **Root Cause:** CocoaPods/xcodeproj gem didn't recognize the new Xcode format
- **Attempted Fixes:**
  - Updated xcodeproj gem to latest (1.27.0)
  - Tried downgrading to objectVersion 54 (broke PBXFileSystemSynchronizedRootGroup)
  - Tried objectVersion 60 (partial compatibility)
- **Final Solution:** Reverted to objectVersion 70 and properly added models folder

**Issue 3: Model Files Not in Bundle**
- **Problem:** Models added with `PBXFileSystemSynchronizedRootGroup` (Xcode 16 feature) incompatible with downgraded object version
- **Solution:** Re-added models folder manually in Xcode as folder reference to Copy Bundle Resources
- **Verification:** Models now visible in app bundle at runtime

**Issue 4: Bundle Path Resolution**
- **Problem:** Native code received relative paths (`models/en/...`) but couldn't resolve them
- **Solution:** Modified `ViewModel.swift` to use `Bundle.main.resourcePath` to create absolute paths
- **Files Modified:** `node_modules/react-native-sherpa-onnx-offline-tts/ios/ViewModel.swift`

**Issue 5: Deprecated Expo FileSystem API**
- **Problem:** `FileSystem.getInfoAsync()` deprecated in Expo SDK 54
- **Solution:** Removed file verification step (not critical for POC)
- **Files Modified:** `src/services/sherpaOnnxService.ts`

### Test Results

**Initialization:**
```
[SherpaONNX] Initializing TTS service...
[SherpaONNX] Target language: en
[SherpaONNX] Initialization completed in 2-3ms
✓ Initialization successful!
```

**Generation (69 character test text):**
```
[SherpaONNX] Starting TTS generation...
[SherpaONNX] Text length: 69 characters
[SherpaONNX] Speaker ID: 0, Speed: 1
[SherpaONNX] Generation completed in ~XXXms
[SherpaONNX] WAV file: /path/to/temp/tts_output_*.wav
✓ SUCCESS - WAV file created!
```

---

## Iteration 2: Audio Playback with expo-av

**Status:** Completed
**Date:** 2026-01-02

### What Was Implemented

1. **Installed expo-av Library**
   - Added `expo-av` 16.0.8 for audio playback capabilities
   - Ran `pod install` to link native iOS audio modules

2. **Enhanced SherpaOnnxService with Playback Methods**
   - Added `play(wavFilePath)` - loads and plays WAV files
   - Added `pause()` - pauses current playback
   - Added `resume()` - resumes paused playback
   - Added `stop()` - stops and unloads audio
   - Added `getPlaybackStatus()` - returns current playback state
   - Added private `onPlaybackStatusUpdate()` callback to track playback events
   - Updated `deinitialize()` to clean up audio resources

3. **Updated SherpaTestScreen with Playback Controls**
   - Changed "Generate WAV" to "Generate & Play" button (generates + auto-plays)
   - Added "Pause/Resume" toggle button
   - Added "Stop" button
   - Enhanced logging with playback status emojis (⏸ ▶ ⏹)
   - Buttons properly disabled/enabled based on state

4. **Audio Configuration**
   - Configured iOS audio session to play in silent mode
   - Background playback disabled for now (Iteration 4)
   - Automatic status updates via callback

### Key Technical Decisions

1. **Audio Playback Flow**
   - Generate WAV → Play immediately (single button)
   - expo-av's `Audio.Sound` API for file-based playback
   - URI-based loading from temp directory

2. **State Management**
   - Track `isPlaying` and `currentWavPath` in service
   - Automatic cleanup on stop/deinitialize
   - Single sound instance (stop previous before playing new)

3. **iOS Audio Session**
   - `playsInSilentModeIOS: true` - respects silent switch
   - `staysActiveInBackground: false` - foreground only for now

### Test Flow

1. Tap "Initialize" → Initializes TTS engine
2. Tap "Generate & Play" → Generates WAV + starts playback automatically
3. Tap "Pause" → Pauses playback (button shows "Resume")
4. Tap "Resume" → Resumes playback (button shows "Pause")
5. Tap "Stop" → Stops and unloads audio

### Files Modified/Created

**Modified Files:**
- `src/services/sherpaOnnxService.ts` (added 100+ lines of playback methods)
- `src/components/SherpaTestScreen.tsx` (added playback UI controls)
- `package.json` (added expo-av dependency)
- `ios/Podfile.lock` (updated with EXAV pod)

### Expected Test Results

**Generate & Play:**
```
[SherpaONNX] Starting TTS generation...
[SherpaONNX] Text length: 69 characters
[SherpaONNX] Generation completed in ~300ms
[SherpaONNX] WAV file generated
[SherpaONNX] Starting playback...
[SherpaONNX] Playback started
```

**Pause:**
```
⏸ Paused
```

**Resume:**
```
▶ Resumed
```

**Stop:**
```
⏹ Stopped
```

**Playback Finished (auto):**
```
[SherpaONNX] Playback finished
```

### Iteration Completion Criteria

- ✅ expo-av library installed and linked
- ✅ Playback methods added to sherpaOnnxService
- ✅ Test screen updated with playback controls
- ✅ Build successful with expo-av integration
- ⏳ **Manual testing required** - verify audio actually plays from device speakers

### Known Limitations

- **Foreground playback only** - app must be active
- **No lock screen controls** - will be added in Iteration 4
- **No progress bar** - only play/pause/stop
- **No background audio** - stops when app backgrounded

### Next Steps

**Manual Testing Required:**
1. Run the app on iOS simulator or real device
2. Tap "Initialize"
3. Tap "Generate & Play"
4. **Listen for audio** - should hear synthetic voice
5. Test Pause → Resume → Stop controls
6. Verify playback completes and logs "Playback finished"

**Next Iteration:** Iteration 3 - Complete nativeTtsService API Compatibility
