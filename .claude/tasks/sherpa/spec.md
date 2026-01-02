## Context

I want to invest some time on trying to replace native tts service in ios 26 with sherpa onnx running locally in the device.

## Scope

Replace native tts service with a new one using sherpa onnx. I've forked a library and patched it to have the generate method that in theory should output a wav file. The library is still not in any npm registry but it's in github here: https://github.com/sergigp/react-native-sherpa-onnx-offline-tts
The scope of this task is basically replace the service, no new behaviour or functionalities, just "read" the posts and the headlines using sherpa onnx running locally.

## Implementation Notes

### Recommended Piper VITS Models

For English and Spanish support, recommended models from the Piper TTS project:

**English (US):**
- Model: `en_US-lessac-medium` (good quality, reasonable size)
- Files needed:
  - `en_US-lessac-medium.onnx` (model file)
  - `en_US-lessac-medium.onnx.json` (config file)
  - `tokens.txt` (included with model)
  - `espeak-ng-data/` (shared across models)

**Spanish (ES):**
- Model: `es_ES-sharvard-medium` (good quality, reasonable size)
- Files needed:
  - `es_ES-sharvard-medium.onnx` (model file)
  - `es_ES-sharvard-medium.onnx.json` (config file)
  - `tokens.txt` (included with model)
  - `espeak-ng-data/` (shared across models)

These can be downloaded from: https://github.com/rhasspy/piper/releases

### Technical Implementation Plan

1. **Install Dependencies:**
   - Add forked library: `react-native-sherpa-onnx-offline-tts` from GitHub
   - Likely needs `react-native-fs` for file path handling
   - May need audio player library (e.g., `expo-av` or `react-native-track-player`)

2. **Bundle Models:**
   - Add model files to iOS app bundle
   - Create directory structure: `assets/models/en/` and `assets/models/es/`
   - Include espeak-ng-data in bundle

3. **Service Implementation:**
   - Create new `sherpaOnnxService.ts` replacing `nativeTtsService.ts`
   - Initialize Sherpa ONNX on service creation with bundled model paths
   - Implement `generate()` → audio player flow
   - Maintain same API surface as existing service

4. **Audio Playback:**
   - Integrate audio player for WAV file playback
   - Support lock screen controls via iOS audio session
   - Enable AirPods/Bluetooth audio routing

## Key Clarifications and Answered Questions

### Proof of Concept Nature
- This is a **spike/proof of concept**, not a production-ready implementation
- Focus on validating that Sherpa ONNX works, not on robustness or optimization
- Manual testing only (no automated tests)
- Optimizations and polish can be deferred to future iterations

### Platform & Version Support
- **iOS only** (iOS 26+)
- No Android support required for this spike
- Manual testing on real iOS devices

### Language Support
- **English and Spanish** models required
- Need to identify and bundle appropriate Piper VITS ONNX models for both languages
- Models will be bundled with the app (not downloaded)

### Model Storage & Configuration
- **Bundle models with the app** for simplicity
- Requires:
  - ONNX model file for each language
  - tokens.txt for each model
  - espeak-ng-data directory
- Models stored in app bundle, accessed via absolute file paths at runtime

### Audio Generation & Playback
- **Use `generate()` method** (not `generateAndPlay()`)
  - Generates WAV file and returns file path
  - Allows integration with audio player for lock screen/AirPods control
  - Enables pause/resume/seeking functionality
- WAV file cleanup: **Deferred** - acceptable to accumulate files during spike
- Audio player integration required for full playback control

### Title + Content Speaking
- Implement simplest approach (use developer discretion)
- No strict requirement to maintain 2-second pause between title and content
- Single concatenated text generation is acceptable

### Voice & Speed Configuration
- **Use default speakerId** (speakerId=0)
- **Hardcode speed** parameter (no user configuration)
- Pitch adjustment not available (model-determined)

### Error Handling
- **No fallback to native TTS**
- Log errors to console for debugging
- No sophisticated error UI or recovery required for this spike
- Focus: validate Sherpa ONNX functionality, not error handling

### Performance & Logging
- Generation time may be slow for long articles - **acceptable for spike**
- **Required logging:**
  - Log when TTS generation process starts
  - Log article text length (character count)
  - Log generation duration (time taken to generate WAV file)
- No loading indicators or chunking required for spike
- Performance optimization deferred to future iterations

### Service API Compatibility
- Replace `nativeTtsService` implementation while maintaining the same public API
- Service used in: `App.tsx`, `FeedListItem.tsx`, `FeedList.tsx`
- Maintain existing methods where possible:
  - `speak(text, options)`
  - `speakWithTitle(title, content, options)`
  - `stop()`
  - `pause()` / `resume()` (may have different implementation)
  - `isSpeaking()`
  - State management methods

### Future Enhancements (Out of Scope)
- WAV file caching and cleanup strategy
- Performance optimization for long articles
- Loading indicators during generation
- User-configurable voices or speed
- Robust error handling and recovery
- Fallback to native TTS
