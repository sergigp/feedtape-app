# Implementation Plan: Sherpa ONNX TTS Integration (Spike/POC)

## Overview

Replace native iOS TTS with Sherpa ONNX running locally on-device. This is a proof-of-concept spike to validate feasibility, not production-ready code.

**Goal:** Validate Sherpa ONNX works on iOS with English/Spanish support, lock screen controls, and AirPods integration.

## Key Technical Decisions

### 1. Audio Playback Library: expo-av
- **Choice:** Use expo-av (v16.0.7) - already installed
- **Rationale:** Sufficient for spike, avoid new dependencies
- **Trade-off:** Deprecated library, but works fine for POC

### 2. Model Bundling Strategy: iOS App Bundle
- **Choice:** Bundle models directly in iOS app via Xcode
- **Rationale:** Simplest approach for spike, no download logic needed
- **Models Required:**
  - English: `en_US-lessac-medium.onnx` + `tokens.txt`
  - Spanish: `es_ES-sharvard-medium.onnx` + `tokens.txt`
  - Shared: `espeak-ng-data/` directory

### 3. Service Architecture: New Service
- **Choice:** Create `sherpaOnnxService.ts` alongside existing `nativeTtsService.ts`
- **Rationale:** Safe experimentation, easy A/B testing
- **Integration:** Conditional import in App.tsx via feature flag

### 4. Title + Content Handling: Concatenation
- **Choice:** Concatenate title + "\n\n" + content in single generate() call
- **Rationale:** Simpler than two separate generations

## User Stories

### Iteration 1: Sherpa ONNX Initialization & Basic Generation
**Expected Behavior**: Library initializes successfully and generates WAV files from text

**Manual Tests**:
- [ ] it_should_initialize_sherpa_onnx_without_crashing
- [ ] it_should_generate_wav_file_from_text
- [ ] it_should_log_text_length_and_generation_duration
- [ ] it_should_create_valid_wav_file_at_returned_path

**Implementation Notes**:
1. Download and bundle English model files in iOS app via Xcode:
   - `en_US-lessac-medium.onnx`, `tokens.txt`, `espeak-ng-data/`
   - Source: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2
2. Create `src/services/sherpaOnnxService.ts`:
   - Import `react-native-sherpa-onnx-offline-tts`
   - Implement `initialize()` - resolve bundle paths, call TTSManager.initialize()
   - Implement `generate(text: string): Promise<string>` - returns WAV file path
   - Add performance logging: start time, text length (chars), generation duration (ms)
3. Create test component to validate initialization and generation
4. Verify WAV file creation in temp directory

**Critical Files**:
- `/Users/sergigp/dev/personal/feedtape/app/src/services/sherpaOnnxService.ts` (new)
- iOS app bundle (Xcode project)

---

### Iteration 2: Audio Playback with expo-av
**Expected Behavior**: Generated WAV files play through device speakers with acceptable quality

**Manual Tests**:
- [ ] it_should_play_generated_wav_file
- [ ] it_should_produce_clear_audio_without_artifacts
- [ ] it_should_stop_playback_immediately_on_stop
- [ ] it_should_handle_multiple_speak_stop_cycles_without_memory_leaks

**Implementation Notes**:
1. Update `sherpaOnnxService.ts`:
   - Import `Audio` from `expo-av`
   - Add `currentSound: Audio.Sound | null` state
   - Implement `speak(text: string)`:
     - Call `generate()` to get WAV path
     - Create and play sound: `Audio.Sound.createAsync({ uri: wavPath })`
     - Log total time (generation + playback start)
   - Implement `stop()`:
     - Unload sound, clear state
2. Test with varying text lengths (short: 20 words, long: 500 words)

**Critical Files**:
- `/Users/sergigp/dev/personal/feedtape/app/src/services/sherpaOnnxService.ts` (modify)

---

### Iteration 3: Complete nativeTtsService API Compatibility
**Expected Behavior**: Service implements full API surface for drop-in replacement

**Manual Tests**:
- [ ] it_should_implement_all_native_tts_methods
- [ ] it_should_speak_title_with_pause_before_content (via speakWithTitle)
- [ ] it_should_fire_onStart_callback_when_playback_begins
- [ ] it_should_fire_onDone_callback_when_playback_completes
- [ ] it_should_track_speaking_state_correctly
- [ ] it_should_estimate_duration_accurately

**Implementation Notes**:
1. Reference API from `/Users/sergigp/dev/personal/feedtape/app/src/services/nativeTtsService.ts`
2. Implement in `sherpaOnnxService.ts`:
   - `speakWithTitle(title, content, options?)` - concatenate: `title + "\n\n" + content`
   - `pause()` - use `sound.pauseAsync()`
   - `resume()` - use `sound.playAsync()`
   - `isSpeaking()` - return speaking state
   - `getState()` - return `{ isSpeaking, currentText }`
   - `estimateDuration(text)` - copy from nativeTtsService (15 chars/sec)
   - `formatDuration(seconds)` - copy from nativeTtsService
   - `getAvailableVoices()` - return hardcoded English voice array
3. Add state management:
   - `currentText: string | null`
   - `speaking: boolean`
4. Implement callbacks (onStart, onDone, onError) using sound status updates
5. Add cleanup logic in `stop()`

**Critical Files**:
- `/Users/sergigp/dev/personal/feedtape/app/src/services/sherpaOnnxService.ts` (modify)
- `/Users/sergigp/dev/personal/feedtape/app/src/services/nativeTtsService.ts` (reference only)

---

### Iteration 4: iOS Background Audio & Lock Screen Controls
**Expected Behavior**: Audio plays in background, lock screen controls work, AirPods supported

**Manual Tests**:
- [ ] it_should_continue_playing_when_app_backgrounded
- [ ] it_should_continue_playing_when_screen_locked
- [ ] it_should_show_lock_screen_playback_controls
- [ ] it_should_pause_and_resume_from_lock_screen
- [ ] it_should_play_through_airpods_when_connected
- [ ] it_should_not_crash_on_foreground_background_transitions

**Implementation Notes**:
1. Configure AVAudioSession in `sherpaOnnxService.ts`:
   - Import `Audio.setAudioModeAsync()` from `expo-av`
   - Call during `initialize()`:
     ```typescript
     await Audio.setAudioModeAsync({
       playsInSilentModeIOS: true,
       staysActiveInBackground: true,
       shouldDuckAndroid: false,
     });
     ```
2. Update sound creation to enable Now Playing integration:
   - Set `progressUpdateIntervalMillis: 500` for lock screen updates
3. Test scenarios:
   - Start playback → minimize app → verify continues
   - Start playback → lock screen → verify continues
   - Connect AirPods → verify audio routes correctly
   - Use lock screen controls → verify pause/play works
4. Add error handling for AVAudioSession failures (log only)

**Critical Files**:
- `/Users/sergigp/dev/personal/feedtape/app/src/services/sherpaOnnxService.ts` (modify)
- `/Users/sergigp/dev/personal/feedtape/app/ios/feedtapeapppolly/Info.plist` (verify UIBackgroundModes present)

---

### Iteration 5: Spanish Language Support & App Integration
**Expected Behavior**: Both English and Spanish articles play correctly end-to-end in real app

**Manual Tests**:
- [ ] it_should_play_english_articles_with_english_voice
- [ ] it_should_play_spanish_articles_with_spanish_voice
- [ ] it_should_switch_languages_automatically_based_on_article
- [ ] it_should_maintain_lock_screen_controls_in_both_languages
- [ ] it_should_generate_audio_in_under_5_seconds_for_typical_articles
- [ ] it_should_integrate_with_app_without_breaking_existing_functionality

**Implementation Notes**:
1. Bundle Spanish model in iOS via Xcode:
   - Add `es_ES-sharvard-medium.onnx`, `tokens.txt`
   - Source: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-sharvard-medium.tar.bz2
   - Share existing `espeak-ng-data/` directory
2. Update `sherpaOnnxService.ts`:
   - Modify `initialize()` to accept language parameter
   - Add `switchLanguage(language: 'en' | 'es')` method
   - Re-initialize TTSManager with correct model paths
   - Update `speak()` to accept `options.language`:
     - Parse BCP-47: `en-US` → `en`, `es-ES` → `es`
     - Call `switchLanguage()` if different from current
3. Integrate into App.tsx:
   - Import `sherpaOnnxService` instead of `nativeTtsService` (lines 16)
   - Replace all `nativeTtsService` calls with `sherpaOnnxService`
   - Affected lines: 48-50, 108-110, 127-129, 183-239, 257-260
4. Test with real RSS feeds (English and Spanish articles)

**Critical Files**:
- `/Users/sergigp/dev/personal/feedtape/app/src/services/sherpaOnnxService.ts` (modify)
- `/Users/sergigp/dev/personal/feedtape/app/App.tsx` (modify - service import and calls)
- `/Users/sergigp/dev/personal/feedtape/app/src/components/FeedList.tsx` (no changes, verify compatibility)
- `/Users/sergigp/dev/personal/feedtape/app/src/components/FeedListItem.tsx` (no changes, verify compatibility)

---

## Fixed Configuration Values

For this spike, these values are hardcoded:
- **speakerId**: `0` (default/single-speaker)
- **speed**: `1.0` (normal playback rate)

## Performance Logging Requirements

Log to console for all operations:
```
[SherpaONNX] Starting TTS generation...
[SherpaONNX] Text length: 1234 characters
[SherpaONNX] Generation completed in 2345ms
[SherpaONNX] WAV file: /path/to/file.wav
```

## Deferred for Future (Out of Scope)

- WAV file cleanup (files accumulate in cache for spike)
- Advanced error handling and user-facing error messages
- Loading indicators during generation
- Performance optimization (caching, pre-generation)
- User-configurable speed/voice settings
- Multi-speaker voice selection
- Android support

## Testing Strategy

All testing is **manual** on physical iOS device (iOS 26+). Test with:
- **Short articles**: <500 words (~30 seconds)
- **Medium articles**: 500-1500 words (1-3 minutes)
- **Long articles**: >1500 words (>3 minutes)

Validate performance, memory usage, and audio quality across all lengths.

## Success Criteria

This spike is successful if:
1. Sherpa ONNX generates clear, natural-sounding audio on iOS
2. Both English and Spanish voices work correctly
3. Lock screen controls function properly
4. AirPods playback works
5. Performance is acceptable (<5s generation for typical 500-word article)
6. App integration works without breaking existing functionality
