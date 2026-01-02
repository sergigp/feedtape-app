import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

class SherpaOnnxService {
  private initialized: boolean = false;
  private currentLanguage: 'en' | 'es' | null = null;
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;

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

  async generate(text: string, speakerId: number = 0, speed: number = 1.0): Promise<string> {
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

  async play(wavFilePath: string): Promise<void> {
    console.log('[SherpaONNX] Starting playback...');
    console.log(`[SherpaONNX] WAV file: ${wavFilePath}`);

    try {
      // Stop any currently playing sound
      await this.stop();

      // Configure audio mode for playback
      console.log('[SherpaONNX] Configuring audio session...');
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      console.log('[SherpaONNX] Audio session configured');

      // Load the audio file
      console.log('[SherpaONNX] Loading audio file...');

      // Ensure the file path has the file:// prefix for iOS
      const fileUri = wavFilePath.startsWith('file://') ? wavFilePath : `file://${wavFilePath}`;
      console.log('[SherpaONNX] File URI:', fileUri);

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true, volume: 1.0 },
        this.onPlaybackStatusUpdate.bind(this)
      );

      console.log('[SherpaONNX] Audio file loaded, status:', JSON.stringify(status));

      this.sound = sound;
      this.isPlaying = true;

      console.log('[SherpaONNX] Playback started');
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
      console.log('[SherpaONNX] Playback resumed');
    } catch (error) {
      console.error('[SherpaONNX] Resume failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.sound) {
      return;
    }

    try {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
      this.isPlaying = false;
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
      }
    }
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
