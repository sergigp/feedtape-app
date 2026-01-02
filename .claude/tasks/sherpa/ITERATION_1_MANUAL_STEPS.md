# Iteration 1: Manual Steps Required

## Overview

Iteration 1 has prepared the Sherpa ONNX TTS integration infrastructure, but requires manual Xcode configuration before testing.

## What's Been Completed

✅ Installed `react-native-sherpa-onnx-offline-tts` library from GitHub
✅ Downloaded and extracted English Piper VITS model files (64MB)
✅ Copied model files to `ios/feedtapeapppolly/models/` directory
✅ Created `sherpaOnnxService.ts` with initialize() and generate() methods
✅ Added comprehensive performance logging
✅ Created `SherpaTestScreen.tsx` component for testing

## Manual Steps Required

### Step 1: Add Model Files to Xcode Project

The model files are in the iOS directory but not yet added to the Xcode project as bundle resources.

1. Open the Xcode workspace:
   ```bash
   open ios/feedtapeapppolly.xcworkspace
   ```

2. In Xcode's left sidebar (Project Navigator), right-click on `feedtapeapppolly` folder

3. Select "Add Files to feedtapeapppolly..."

4. Navigate to `ios/feedtapeapppolly/models/`

5. Select the `models` folder

6. In the dialog that appears, configure:
   - ☑️ **"Create folder references"** (blue folder icon, NOT "Create groups")
   - ☑️ **Add to targets:** feedtapeapppolly
   - ☑️ **Copy items if needed** (should already be copied, but check this)

7. Click "Add"

8. Verify the `models` folder appears in the Project Navigator with a blue folder icon

9. Click on the project name at the top of the navigator

10. Select the `feedtapeapppolly` target

11. Go to "Build Phases" tab

12. Expand "Copy Bundle Resources"

13. Verify these files are listed:
    - `models/en/en_US-lessac-medium.onnx`
    - `models/en/tokens.txt`
    - `models/en/en_US-lessac-medium.onnx.json`
    - `models/espeak-ng-data/` (folder)

### Step 2: Build and Run on Device

Simulators may have limited native module support. Use a physical iOS device.

```bash
npx expo run:ios --device
```

Or select your device in Xcode and press Cmd+R to build.

### Step 3: Enable Test Screen

Temporarily modify `App.tsx` to render the test screen:

```typescript
// At the top of App.tsx, add:
import { SherpaTestScreen } from './src/components/SherpaTestScreen';

// In the default export, replace the main content with:
export default function App() {
  return (
    <View style={{ flex: 1, paddingTop: 50 }}>
      <SherpaTestScreen />
    </View>
  );
}
```

### Step 4: Run Manual Tests

1. **Initialize Test:**
   - Tap "Initialize" button
   - Check logs for:
     ```
     [SherpaONNX] Initializing TTS service...
     [SherpaONNX] Target language: en
     [SherpaONNX] Model config: {JSON with paths}
     [SherpaONNX] Initialization completed in Xms
     ```
   - If initialization fails, check Xcode console for native errors

2. **Generate WAV Test:**
   - Tap "Generate WAV" button
   - Check logs for:
     ```
     [SherpaONNX] Starting TTS generation...
     [SherpaONNX] Text length: 68 characters
     [SherpaONNX] Generation completed in Xms
     [SherpaONNX] WAV file: /path/to/file.wav
     [SherpaONNX] WAV file size: XXXX bytes
     ```

3. **Verify Success:**
   - Generation should complete in under 5 seconds for the test text
   - WAV file size should be > 0 bytes
   - No errors in console

## Troubleshooting

### "Model files not found"

- Verify files are in Xcode's "Copy Bundle Resources" (Build Phases)
- Clean build folder: Product → Clean Build Folder (Cmd+Shift+K)
- Rebuild the app

### "Failed to decode modelId JSON"

- Check console logs for the actual JSON being passed
- Verify `FileSystem.bundleDirectory` resolves correctly
- May need to use alternative path resolution method

### "TTSManager undefined" or module errors

- Verify pod install completed successfully
- Try: `cd ios && pod install && cd ..`
- Rebuild native modules: `npx expo prebuild --clean`

### Initialization hangs or crashes

- Check Xcode console for native Swift errors
- Verify model files are correct format (.onnx files)
- Ensure espeak-ng-data folder has correct structure

## Expected Performance

- **Initialization:** < 500ms
- **Generation (68 chars):** 1-3 seconds
- **WAV file size:** ~50-200KB for short test text

## Next Steps After Validation

Once Iteration 1 tests pass:

1. Document actual performance numbers in log.md
2. Proceed to Iteration 2: Audio Playback with expo-av
3. Integrate playback controls and sound management

## Files to Review

- Service: `src/services/sherpaOnnxService.ts`
- Test Screen: `src/components/SherpaTestScreen.tsx`
- Models: `ios/feedtapeapppolly/models/`
- Log: `.claude/tasks/sherpa/log.md`
