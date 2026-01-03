import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export interface SpeakOptions {
  language?: string;  // e.g., 'es-ES', 'en-US'
  rate?: number;      // Speed (0.5 to 2.0, default 1.0)
  pitch?: number;     // Not used (Sherpa ONNX doesn't support pitch)
  voice?: string;     // Not used (speakerId hardcoded to 0)
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

class SherpaOnnxService {
  private initialized: boolean = false;
  private currentLanguage: 'en' | 'es' | null = null;
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private currentText: string | null = null;
  private speaking: boolean = false;
  private currentCallbacks: {
    onStart?: () => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  } = {};

  async initialize(language: 'en' | 'es' = 'en'): Promise<void> {
    const startTime = Date.now();
    console.log('[SherpaONNX] Initializing TTS service...');
    console.log(`[SherpaONNX] Target language: ${language}`);

    try {
      if (Platform.OS !== 'ios') {
        throw new Error('Sherpa ONNX TTS is only supported on iOS for this spike');
      }

      // Debug: Check what methods are available
      console.log('[SherpaONNX] Available TTSManager methods:', Object.keys(TTSManager));

      // Get the bundle paths for the model files
      const modelConfig = this.getModelConfig(language);
      console.log(`[SherpaONNX] Model config: ${modelConfig}`);

      // Initialize TTSManager with the model configuration JSON
      TTSManager.initialize(modelConfig);

      this.initialized = true;
      this.currentLanguage = language;

      const duration = Date.now() - startTime;
      console.log(`[SherpaONNX] Initialization completed in ${duration}ms`);
    } catch (error) {
      console.error('[SherpaONNX] Initialization failed:', error);
      throw error;
    }
  }

  async speak(text: string, options?: SpeakOptions): Promise<void> {
    // Auto-initialize if needed
    if (!this.initialized) {
      const language = this.parseLanguage(options?.language);
      await this.initialize(language);
    }

    // Stop any current speech
    await this.stop();

    console.log('[SherpaONNX] Speaking text with length:', text.length);

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
      console.error('[SherpaONNX] Speak failed:', error);
      this.speaking = false;
      this.currentText = null;
      this.currentCallbacks.onError?.(error as Error);
      throw error;
    }
  }

  async speakWithTitle(title: string, content: string, options?: SpeakOptions): Promise<void> {
    // Concatenate title and content with newlines (simpler approach for spike)
    const fullText = `${title}\n\n${content}`;
    console.log('[SherpaONNX] Speaking with title:', title);
    await this.speak(fullText, options);
  }

  private async generate(text: string, speakerId: number = 0, speed: number = 1.0): Promise<string> {
    if (!this.initialized) {
      throw new Error('SherpaOnnxService not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const textLength = text.length;

    console.log('[SherpaONNX] Starting TTS generation...');
    console.log(`[SherpaONNX] Text length: ${textLength} characters`);
    console.log(`[SherpaONNX] Speaker ID: ${speakerId}, Speed: ${speed}`);

    try {
      const wavFilePath = await TTSManager.generate(text, speakerId, speed);

      const duration = Date.now() - startTime;
      console.log(`[SherpaONNX] Generation completed in ${duration}ms`);
      console.log(`[SherpaONNX] WAV file: ${wavFilePath}`);

      return wavFilePath;
    } catch (error) {
      console.error('[SherpaONNX] Generation failed:', error);
      throw error;
    }
  }

  private parseLanguage(language?: string): 'en' | 'es' {
    if (!language) return 'en';

    // Parse BCP-47 language codes (en-US -> en, es-ES -> es)
    const langCode = language.toLowerCase().split('-')[0];

    if (langCode === 'es') return 'es';
    return 'en'; // Default to English
  }

  async generateAndPlay(text: string, speakerId: number = 0, speed: number = 1.0): Promise<void> {
    if (!this.initialized) {
      throw new Error('SherpaOnnxService not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const textLength = text.length;

    console.log('[SherpaONNX] Starting TTS generation and playback (native)...');
    console.log(`[SherpaONNX] Text length: ${textLength} characters`);
    console.log(`[SherpaONNX] Speaker ID: ${speakerId}, Speed: ${speed}`);

    try {
      await TTSManager.generateAndPlay(text, speakerId, speed);

      const duration = Date.now() - startTime;
      console.log(`[SherpaONNX] Generation and playback completed in ${duration}ms`);
      this.isPlaying = true;
    } catch (error) {
      console.error('[SherpaONNX] Generation and playback failed:', error);
      throw error;
    }
  }

  private async playInternal(wavFilePath: string): Promise<void> {
    console.log('[SherpaONNX] Starting playback...');
    console.log(`[SherpaONNX] WAV file: ${wavFilePath}`);

    try {
      // Configure audio mode for playback with background support
      console.log('[SherpaONNX] Configuring audio session...');
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      console.log('[SherpaONNX] Audio session configured for background playback');

      // Load the audio file
      console.log('[SherpaONNX] Loading audio file...');

      // Ensure the file path has the file:// prefix for iOS
      const fileUri = wavFilePath.startsWith('file://') ? wavFilePath : `file://${wavFilePath}`;
      console.log('[SherpaONNX] File URI:', fileUri);

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: fileUri },
        {
          shouldPlay: true,
          volume: 1.0,
          progressUpdateIntervalMillis: 500,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      console.log('[SherpaONNX] Audio file loaded, status:', JSON.stringify(status));

      this.sound = sound;
      this.isPlaying = true;

      console.log('[SherpaONNX] Playback started');

      // Fire onStart callback
      this.currentCallbacks.onStart?.();
    } catch (error) {
      console.error('[SherpaONNX] Playback failed:', error);
      console.error('[SherpaONNX] Error details:', JSON.stringify(error));
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (!this.sound) {
      console.log('[SherpaONNX] No sound loaded to pause');
      return;
    }

    try {
      await this.sound.pauseAsync();
      this.isPlaying = false;
      this.speaking = false;
      console.log('[SherpaONNX] Playback paused');
    } catch (error) {
      console.error('[SherpaONNX] Pause failed:', error);
      throw error;
    }
  }

  async resume(): Promise<void> {
    if (!this.sound) {
      console.log('[SherpaONNX] No sound loaded to resume');
      return;
    }

    try {
      await this.sound.playAsync();
      this.isPlaying = true;
      this.speaking = true;
      console.log('[SherpaONNX] Playback resumed');
    } catch (error) {
      console.error('[SherpaONNX] Resume failed:', error);
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
      console.log('[SherpaONNX] Playback stopped');
    } catch (error) {
      console.error('[SherpaONNX] Stop failed:', error);
      throw error;
    }
  }

  private onPlaybackStatusUpdate(status: any): void {
    if (status.isLoaded) {
      this.isPlaying = status.isPlaying;

      if (status.didJustFinish) {
        console.log('[SherpaONNX] Playback finished');
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
        identifier: 'sherpa-onnx-en',
        name: 'Sherpa ONNX English',
        language: 'en-US',
      },
      {
        identifier: 'sherpa-onnx-es',
        name: 'Sherpa ONNX Spanish',
        language: 'es-ES',
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getPlaybackStatus(): { isPlaying: boolean; hasSound: boolean } {
    return {
      isPlaying: this.isPlaying,
      hasSound: this.sound !== null,
    };
  }

  async switchLanguage(language: 'en' | 'es'): Promise<void> {
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

  private getModelConfig(language: 'en' | 'es'): string {
    // For iOS, we need to provide paths to bundled resources
    // The native module expects a JSON string with modelPath, tokensPath, and dataDirPath
    const modelMap = {
      en: 'en_US-lessac-medium.onnx',
      es: 'es_ES-sharvard-medium.onnx',
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
    console.log('[SherpaONNX] Deinitializing TTS service...');

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

  getCurrentLanguage(): 'en' | 'es' | null {
    return this.currentLanguage;
  }
}

export default new SherpaOnnxService();
