// Amazon Polly Text-to-Speech Service
// Uses AWS SDK to convert text to high-quality neural voices

import AWS from 'aws-sdk';
import { Audio, AVPlaybackStatus } from 'expo-av';

export interface PollyVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
  engine: string;
}

export interface TTSOptions {
  rate?: string; // Speed rate in %: "slow", "medium", "fast", or "x-slow", "x-fast", or percentage
  voiceId?: string;
  engine?: 'standard' | 'neural' | 'generative';
  outputFormat?: 'mp3' | 'ogg_vorbis' | 'pcm';
}

// Spanish voices available in Polly
export const SPANISH_VOICES = {
  // European Spanish (ES-ES)
  LUCIA: { id: 'Lucia', name: 'Lucia', language: 'es-ES', gender: 'Female', neural: true },
  SERGIO: { id: 'Sergio', name: 'Sergio', language: 'es-ES', gender: 'Male', neural: true },
  CONCHITA: { id: 'Conchita', name: 'Conchita', language: 'es-ES', gender: 'Female', neural: false },
  ENRIQUE: { id: 'Enrique', name: 'Enrique', language: 'es-ES', gender: 'Male', neural: false },

  // Mexican Spanish (ES-MX)
  MIA: { id: 'Mia', name: 'Mia', language: 'es-MX', gender: 'Female', neural: true },
  ANDRES: { id: 'Andrés', name: 'Andrés', language: 'es-MX', gender: 'Male', neural: true },

  // US Spanish (ES-US)
  LUPE: { id: 'Lupe', name: 'Lupe', language: 'es-US', gender: 'Female', neural: true },
  PEDRO: { id: 'Pedro', name: 'Pedro', language: 'es-US', gender: 'Male', neural: true },
  PENELOPE: { id: 'Penelope', name: 'Penélope', language: 'es-US', gender: 'Female', neural: false },
  MIGUEL: { id: 'Miguel', name: 'Miguel', language: 'es-US', gender: 'Male', neural: false },
};

class PollyTTSService {
  private polly: AWS.Polly | null = null;
  private currentSound: Audio.Sound | null = null;
  private isInitialized = false;
  private isSpeaking = false;
  private isPaused = false;

  /**
   * Initialize AWS Polly service
   */
  async init(accessKeyId: string, secretAccessKey: string, region = 'us-east-1'): Promise<void> {
    if (this.isInitialized) return;

    try {
      // List of regions that support neural voices
      const NEURAL_SUPPORTED_REGIONS = [
        'us-east-1',      // N. Virginia
        'us-west-2',      // Oregon
        'ca-central-1',   // Canada
        'eu-west-1',      // Ireland
        'eu-west-2',      // London
        'eu-central-1',   // Frankfurt
        'ap-southeast-1', // Singapore
        'ap-southeast-2', // Sydney
        'ap-northeast-1', // Tokyo
        'ap-northeast-2', // Seoul
      ];

      // Check if region supports neural voices
      if (!NEURAL_SUPPORTED_REGIONS.includes(region)) {
        console.warn(`Region ${region} doesn't support neural voices. Using standard voices instead.`);
      }

      // Configure AWS
      AWS.config.update({
        accessKeyId,
        secretAccessKey,
        region
      });

      // Create Polly client
      this.polly = new AWS.Polly({
        apiVersion: '2016-06-10',
        region
      });

      // Configure audio for iOS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true, // Important: play even in silent mode
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      this.isInitialized = true;
      console.log('Polly TTS Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Polly TTS:', error);
      throw error;
    }
  }

  /**
   * List available voices
   */
  async getVoices(languageCode?: string): Promise<PollyVoice[]> {
    if (!this.polly) throw new Error('Polly not initialized');

    try {
      const params: AWS.Polly.DescribeVoicesInput = {};
      if (languageCode) {
        params.LanguageCode = languageCode as any;
      }

      const result = await this.polly.describeVoices(params).promise();

      return (result.Voices || [])
        .filter(v => languageCode ? v.LanguageCode?.startsWith(languageCode) : true)
        .map(v => ({
          id: v.Id!,
          name: v.Name!,
          language: v.LanguageCode!,
          gender: v.Gender!,
          engine: v.SupportedEngines?.includes('neural') ? 'neural' : 'standard'
        }));
    } catch (error) {
      console.error('Failed to get voices:', error);
      return [];
    }
  }

  /**
   * Convert text to speech using Polly and play it
   */
  async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!this.polly) throw new Error('Polly not initialized. Call init() first.');

    try {
      // Stop any current speech
      await this.stop();

      // Check if we should use neural or standard engine based on region
      const currentRegion = AWS.config.region || 'us-east-1';
      const NEURAL_REGIONS = ['us-east-1', 'us-west-2', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-central-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2'];

      let engine = options?.engine || 'neural';
      let voiceId = options?.voiceId || 'Lucia';

      // If neural engine requested but region doesn't support it, fallback to standard
      if (engine === 'neural' && !NEURAL_REGIONS.includes(currentRegion)) {
        console.warn(`Neural engine not supported in ${currentRegion}, falling back to standard voice`);
        engine = 'standard';

        // Map neural voices to their standard equivalents
        const VOICE_FALLBACKS: { [key: string]: string } = {
          'Lucia': 'Conchita',    // ES-ES Female
          'Sergio': 'Enrique',    // ES-ES Male
          'Mia': 'Mia',          // ES-MX (has both standard and neural)
          'Andrés': 'Miguel',     // Fall back to US Spanish male
          'Lupe': 'Penelope',    // ES-US Female
          'Pedro': 'Miguel',      // ES-US Male
        };

        voiceId = VOICE_FALLBACKS[voiceId] || 'Conchita';
      }

      console.log('Polly: Speaking text with length:', text.length);
      console.log('Voice:', voiceId);
      console.log('Engine:', engine);
      console.log('Region:', currentRegion);

      // Prepare synthesis parameters
      const params: AWS.Polly.SynthesizeSpeechInput = {
        Text: text,
        OutputFormat: options?.outputFormat || 'mp3',
        VoiceId: voiceId,
        Engine: engine as 'standard' | 'neural',
        SampleRate: '24000', // High quality
      };

      // Add SSML wrapper for rate control if specified
      if (options?.rate) {
        params.TextType = 'ssml';
        params.Text = `<speak><prosody rate="${options.rate}">${text}</prosody></speak>`;
      }

      const startTime = Date.now();

      // Synthesize speech
      const result = await this.polly.synthesizeSpeech(params).promise();

      console.log(`Polly synthesis took ${Date.now() - startTime}ms`);

      if (!result.AudioStream) {
        throw new Error('No audio stream received from Polly');
      }

      // Convert audio stream to base64
      const audioBuffer = result.AudioStream as Buffer;
      const base64Audio = audioBuffer.toString('base64');
      const audioUri = `data:audio/mpeg;base64,${base64Audio}`;

      // Load and play audio using expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay: true,
          volume: 1.0,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.currentSound = sound;
      this.isSpeaking = true;
      this.isPaused = false;

      console.log('Polly: Audio playback started');

    } catch (error) {
      console.error('Polly speak error:', error);
      this.isSpeaking = false;
      throw error;
    }
  }

  /**
   * Handle playback status updates
   */
  private onPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (status.isLoaded) {
      if (status.didJustFinish) {
        console.log('Polly: Playback finished');
        this.isSpeaking = false;
        this.isPaused = false;
        this.cleanupSound();
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      this.isSpeaking = false;
      this.isPaused = false;
    }
  }

  /**
   * Pause current speech
   */
  async pause(): Promise<void> {
    if (this.currentSound && this.isSpeaking) {
      try {
        await this.currentSound.pauseAsync();
        this.isPaused = true;
        console.log('Polly: Playback paused');
      } catch (error) {
        console.error('Failed to pause:', error);
      }
    }
  }

  /**
   * Resume paused speech
   */
  async resume(): Promise<void> {
    if (this.currentSound && this.isPaused) {
      try {
        await this.currentSound.playAsync();
        this.isPaused = false;
        console.log('Polly: Playback resumed');
      } catch (error) {
        console.error('Failed to resume:', error);
      }
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.cleanupSound();
        this.isSpeaking = false;
        this.isPaused = false;
        console.log('Polly: Playback stopped');
      } catch (error) {
        console.error('Failed to stop:', error);
      }
    }
  }

  /**
   * Clean up audio resources
   */
  private async cleanupSound() {
    if (this.currentSound) {
      try {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      } catch (error) {
        console.error('Failed to unload sound:', error);
      }
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused
    };
  }

  /**
   * Clean up resources
   */
  async destroy() {
    await this.stop();
    this.polly = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
export default new PollyTTSService();