import TTSManager from "react-native-sherpa-onnx-offline-tts";
import { Platform } from "react-native";
import { Audio } from "expo-av";

export interface SpeakOptions {
  language?: string; // e.g., 'es-ES', 'en-US'
  rate?: number; // Speed (0.5 to 2.0, default 1.0)
  pitch?: number; // Not used (Sherpa ONNX doesn't support pitch)
  voice?: string; // Not used (speakerId hardcoded to 0)
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

class SherpaOnnxService {
  private initialized: boolean = false;
  private currentLanguage: "en" | "es" | "fr" | null = null;
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private currentText: string | null = null;
  private speaking: boolean = false;
  private currentCallbacks: {
    onStart?: () => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  } = {};
  private speakStartTime: number = 0;

  async initialize(language: "en" | "es" | "fr" = "en"): Promise<void> {
    try {
      if (Platform.OS !== "ios") {
        throw new Error("Sherpa ONNX TTS is only supported on iOS for this spike");
      }

      // Get the bundle paths for the model files
      const modelConfig = this.getModelConfig(language);

      // Initialize TTSManager with the model configuration JSON
      TTSManager.initialize(modelConfig);

      this.initialized = true;
      this.currentLanguage = language;
    } catch (error) {
      console.error("[SherpaONNX] Initialization failed:", error);
      throw error;
    }
  }

  async speak(text: string, options?: SpeakOptions): Promise<void> {
    // Track total user wait time
    this.speakStartTime = Date.now();

    // Auto-initialize if needed
    if (!this.initialized) {
      const language = this.parseLanguage(options?.language);
      await this.initialize(language);
    }

    // Stop any current speech
    await this.stop();

    this.currentText = text;
    this.speaking = true;
    this.currentCallbacks = {
      onStart: options?.onStart,
      onDone: options?.onDone,
      onError: options?.onError,
    };

    try {
      // Switch language if needed
      const targetLanguage = this.parseLanguage(options?.language);
      if (targetLanguage !== this.currentLanguage) {
        await this.switchLanguage(targetLanguage);
      }

      // Generate WAV file
      const speed = options?.rate ?? 1.0;
      const wavFilePath = await this.generate(text, 0, speed);

      // Play the WAV file
      await this.playInternal(wavFilePath);
    } catch (error) {
      console.error("[SherpaONNX] Speak failed:", error);
      this.speaking = false;
      this.currentText = null;
      this.currentCallbacks.onError?.(error as Error);
      throw error;
    }
  }

  async speakWithTitle(title: string, content: string, options?: SpeakOptions): Promise<void> {
    // Concatenate title and content with newlines (simpler approach for spike)
    const fullText = `${title}\n\n${content}`;
    await this.speak(fullText, options);
  }

  private async generate(text: string, speakerId: number = 0, speed: number = 1.0): Promise<string> {
    if (!this.initialized) {
      throw new Error("SherpaOnnxService not initialized. Call initialize() first.");
    }

    const startTime = Date.now();

    try {
      const wavFilePath = await TTSManager.generate(text, speakerId, speed);

      const generationTimeMs = Date.now() - startTime;
      const generationTimeSec = generationTimeMs / 1000;

      // Calculate normalized metrics
      const estimatedAudioDurationSec = this.estimateDuration(text);
      const audioDurationMin = estimatedAudioDurationSec / 60;

      // Normalize: seconds to generate 1 minute of audio
      const secondsPerMinuteOfAudio = generationTimeSec / audioDurationMin;

      // Performance logging (compact)
      console.log(
        `[SherpaONNX] Generated ${this.formatDuration(estimatedAudioDurationSec)} audio in ${generationTimeSec.toFixed(2)}s (${secondsPerMinuteOfAudio.toFixed(2)}s per 1min of audio)`
      );

      return wavFilePath;
    } catch (error) {
      console.error("[SherpaONNX] Generation failed:", error);
      throw error;
    }
  }

  private parseLanguage(language?: string): "en" | "es" | "fr" {
    if (!language) return "en";

    // Parse BCP-47 language codes (en-US -> en, es-ES -> es, fr-FR -> fr)
    const langCode = language.toLowerCase().split("-")[0];

    if (langCode === "es") return "es";
    if (langCode === "fr") return "fr";
    return "en"; // Default to English
  }

  async generateAndPlay(text: string, speakerId: number = 0, speed: number = 1.0): Promise<void> {
    if (!this.initialized) {
      throw new Error("SherpaOnnxService not initialized. Call initialize() first.");
    }

    const startTime = Date.now();
    const textLength = text.length;

    console.log("[SherpaONNX] Starting TTS generation and playback (native)...");
    console.log(`[SherpaONNX] Text length: ${textLength} characters`);
    console.log(`[SherpaONNX] Speaker ID: ${speakerId}, Speed: ${speed}`);

    try {
      await TTSManager.generateAndPlay(text, speakerId, speed);

      const duration = Date.now() - startTime;
      console.log(`[SherpaONNX] Generation and playback completed in ${duration}ms`);
      this.isPlaying = true;
    } catch (error) {
      console.error("[SherpaONNX] Generation and playback failed:", error);
      throw error;
    }
  }

  private async playInternal(wavFilePath: string): Promise<void> {
    try {
      // Configure audio mode for playback with background support
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Ensure the file path has the file:// prefix for iOS
      const fileUri = wavFilePath.startsWith("file://") ? wavFilePath : `file://${wavFilePath}`;

      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        {
          shouldPlay: true,
          volume: 1.0,
          progressUpdateIntervalMillis: 500,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      this.isPlaying = true;

      // Calculate total user wait time
      const totalWaitTimeSec = (Date.now() - this.speakStartTime) / 1000;

      console.log(`[SherpaONNX] Playback started (${totalWaitTimeSec.toFixed(2)}s wait)`);

      // Fire onStart callback
      this.currentCallbacks.onStart?.();
    } catch (error) {
      console.error("[SherpaONNX] Playback failed:", error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.pauseAsync();
      this.isPlaying = false;
      this.speaking = false;
    } catch (error) {
      console.error("[SherpaONNX] Pause failed:", error);
      throw error;
    }
  }

  async resume(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.playAsync();
      this.isPlaying = true;
      this.speaking = true;
    } catch (error) {
      console.error("[SherpaONNX] Resume failed:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.sound) {
      this.speaking = false;
      this.currentText = null;
      return;
    }

    try {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
      this.isPlaying = false;
      this.speaking = false;
      this.currentText = null;
    } catch (error) {
      console.error("[SherpaONNX] Stop failed:", error);
      throw error;
    }
  }

  private onPlaybackStatusUpdate(status: any): void {
    if (status.isLoaded) {
      this.isPlaying = status.isPlaying;

      if (status.didJustFinish) {
        this.isPlaying = false;
        this.speaking = false;
        this.currentText = null;

        // Fire onDone callback
        this.currentCallbacks.onDone?.();
      }
    }
  }

  async isSpeaking(): Promise<boolean> {
    return this.speaking;
  }

  async getState() {
    return {
      isSpeaking: this.speaking,
      currentText: this.currentText,
    };
  }

  async getAvailableVoices(): Promise<any[]> {
    // Sherpa ONNX doesn't provide voice enumeration API
    // Return hardcoded list for compatibility
    return [
      {
        identifier: "sherpa-onnx-en",
        name: "Sherpa ONNX English",
        language: "en-US",
      },
      {
        identifier: "sherpa-onnx-es",
        name: "Sherpa ONNX Spanish",
        language: "es-ES",
      },
      {
        identifier: "sherpa-onnx-fr",
        name: "Sherpa ONNX French",
        language: "fr-FR",
      },
    ];
  }

  estimateDuration(text: string): number {
    // Average speech rate: ~15 characters per second for natural TTS
    const CHARS_PER_SECOND = 15;
    return Math.ceil(text.length / CHARS_PER_SECOND);
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  getPlaybackStatus(): { isPlaying: boolean; hasSound: boolean } {
    return {
      isPlaying: this.isPlaying,
      hasSound: this.sound !== null,
    };
  }

  async switchLanguage(language: "en" | "es" | "fr"): Promise<void> {
    if (this.currentLanguage === language) {
      console.log(`[SherpaONNX] Already using ${language} model`);
      return;
    }

    console.log(`[SherpaONNX] Switching language from ${this.currentLanguage} to ${language}`);

    // Deinitialize current model
    if (this.initialized) {
      TTSManager.deinitialize();
      this.initialized = false;
    }

    // Reinitialize with new language
    await this.initialize(language);
  }

  private getModelConfig(language: "en" | "es" | "fr"): string {
    // For iOS, we need to provide paths to bundled resources
    // The native module expects a JSON string with modelPath, tokensPath, and dataDirPath
    const modelMap = {
      en: "en_US-lessac-medium.onnx",
      es: "es_ES-sharvard-medium.onnx",
      fr: "fr_FR-siwis-medium.onnx",
    };

    const modelFileName = modelMap[language];

    // iOS bundled resources - use relative paths from bundle root
    // The native Swift code will resolve these using Bundle.main
    const config = {
      modelPath: `models/${language}/${modelFileName}`,
      tokensPath: `models/${language}/tokens.txt`,
      dataDirPath: `models/espeak-ng-data`,
    };

    return JSON.stringify(config);
  }

  async deinitialize(): Promise<void> {
    // Stop any playing audio
    await this.stop();

    // Deinitialize the TTS engine
    if (this.initialized) {
      TTSManager.deinitialize();
      this.initialized = false;
      this.currentLanguage = null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentLanguage(): "en" | "es" | "fr" | null {
    return this.currentLanguage;
  }
}

export default new SherpaOnnxService();
