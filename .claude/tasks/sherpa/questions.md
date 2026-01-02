# Questions:

## Section 1: Model Selection and Configuration

### Question 1: Which Sherpa ONNX model should be used?

- Sherpa ONNX requires specific Piper VITS ONNX models with accompanying tokens.txt and espeak-ng-data directory
- Multiple models are available with different voices, languages, and quality levels
- Some models support multiple speakers (speakerId parameter)
- Question: Which specific Piper VITS ONNX model should be bundled with the app? Should we support multiple models or just one?
- Answer: Im not very familiarized with this so I will need your help, by now I would like to support english and spanish. Not sure what files do I need to download and where to put them.

### Question 2: Where should the model files be stored?

- Models need to be accessible at runtime with absolute file paths
- Options include: app bundle (increases app size), downloaded on first launch (requires network), or user-selectable download (more complex UX)
- Question: Should models be bundled with the app or downloaded on demand? If downloaded, when should this happen (first launch, on-demand, user choice)?
- Answer: I believe that by now we can add them to the app bundle as it sounds like the most easy way to do it by now.

### Question 3: Which languages/voices should be supported?

- Current native TTS supports any system-installed language
- Sherpa ONNX requires pre-downloaded models for each language
- Question: Which specific languages should be supported with bundled/downloadable models? Should we maintain the same language support as native TTS or start with a subset (e.g., just English)?
- Answer: english and spanish by now.

## Section 2: Audio Playback Architecture

### Question 4: How should WAV files be played back?

- The library's `generate()` method outputs a WAV file path
- The library also provides `generateAndPlay()` which plays directly without file persistence
- Question: Should we use `generate()` and handle playback separately (allows pause/resume/seeking), or use `generateAndPlay()` for simpler implementation? What playback controls are required?
- Answer: We need to use generate as we will need control of the audio with airpods or with locked screen for example.

### Question 5: How should generated audio files be managed?

- If using `generate()`, WAV files will accumulate in device storage
- Need to decide on cleanup strategy (immediate deletion, cache management, user control)
- Question: Should generated WAV files be cached for re-playback, or deleted immediately after use? If cached, what's the max cache size and cleanup policy?
- Answer: This is an spike so I believe we can postpone this stuff and implement it later if this works. This could be the first thing we do after this task if this works.

### Question 6: What happens to pause/resume functionality?

- Current native TTS has pause/resume methods (iOS only)
- If using `generateAndPlay()`, pause/resume may not be available
- If using `generate()` with separate audio player, pause/resume is possible but requires additional implementation
- Question: Is pause/resume required, or is it acceptable to only support stop/play (restart from beginning)?
- Answer: yes, we need to use generate. Btw we only support ios by now.

## Section 3: User Experience and Migration

### Question 7: How should the title + content speaking behavior work?

- Current implementation has `speakWithTitle()` which speaks title, pauses 2 seconds, then speaks content
- With Sherpa ONNX, this could be: (a) two separate `generate()` calls concatenated, (b) single `generate()` call with text concatenation, or (c) single call with SSML-like markup
- Question: Should we maintain the 2-second pause between title and content? Should they be generated as one audio file or two separate files?
- Answer: Whatever is easier by now.

### Question 8: Should there be any fallback to native TTS?

- Sherpa ONNX requires models to be available and initialized
- Initialization or generation could fail (missing models, corrupted files, unsupported text)
- Question: Should the app fall back to native TTS if Sherpa ONNX fails, or show an error to the user? Is this purely experimental or intended for production?
- Answer: Not by now. Lets just log an error by now. We can make the solution more robust in further iterations, this is just a spike, a prove of concept.

### Question 9: What about the rate and pitch options?

- Current native TTS supports rate (0.5-2.0) and pitch (0.5-2.0)
- Sherpa ONNX only supports speed adjustment (similar to rate)
- Pitch is determined by the model/speaker and cannot be adjusted at runtime
- Question: Is it acceptable to lose pitch adjustment capability? Should the app expose speed adjustment to users, or use a fixed speed?
- Answer: yes. But by now lets hardcode it.

## Section 4: Performance and Quality Expectations

### Question 10: What are the acceptable generation times?

- Sherpa ONNX runs locally and generates audio in real-time (or near real-time)
- For long articles (several thousand words), generation could take seconds or minutes depending on device
- Question: Should there be a loading indicator during generation? Should very long articles be split into chunks? What's the maximum acceptable wait time before playback starts?
- Answer: Give me your best shot, but remember that this is a prove of concept so by now its ok if I need to wait. We can optimize it later. What i would like to have is logs logging the post lenght and how long it took to tts it. I also want to log when we start the process.

### Question 11: How should we handle the speakerId parameter?

- Multi-speaker models allow different voices via speakerId (0, 1, 2, etc.)
- Single-speaker models typically only accept speakerId=0
- Question: Should the app expose voice selection to users if a multi-speaker model is used? Or always use the default speaker?
- Answer: lets use default always by now.

## Section 5: Development and Testing

### Question 12: iOS 26 specific considerations

- You mentioned "iOS 26" in the context - did you mean iOS 16, or is this a typo?
- Question: What's the minimum iOS version we should target? Should we maintain Android support or is this iOS-only?
- Answer: ios 26 was already released. No android, just ios. Btw there are no automatic tests in this repo now, we are prototyping, so all tests will be manual.

### Question 13: How should errors be communicated to users?

- Sherpa ONNX can fail at initialization (missing models) or generation (unsupported text, memory issues)
- Current native TTS shows generic error alerts
- Question: Should Sherpa ONNX errors be shown differently than native TTS errors? Should there be specific troubleshooting guidance (e.g., "model not found, please reinstall")?
- Answer: by now lets log stuff and we can improve later.
