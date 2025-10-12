// TTS Service - Backend API integration
// Converts text to speech using the backend TTS endpoint

import { Audio, AVPlaybackStatus } from 'expo-av';
import { API_BASE_URL } from '../config/env';
import * as SecureStore from 'expo-secure-store';

export interface TTSOptions {
  language?: 'auto' | 'es' | 'en' | 'fr' | 'de' | 'pt' | 'it';
  onProgressUpdate?: (progress: number) => void;
}

const TOKEN_KEY = 'feedtape_access_token';

class TTSService {
  private currentSound: Audio.Sound | null = null;
  private isInitialized = false;
  private isSpeaking = false;
  private isPaused = false;
  private progressCallback: ((progress: number) => void) | null = null;
  private progressInterval: NodeJS.Timeout | null = null;

  /**
   * Make an authenticated request to the backend
   */
  private async makeAuthenticatedRequest(url: string, body: any): Promise<Response> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[TTS] Making request to:', url);
    console.log('[TTS] Request body:', body);
    console.log('[TTS] Has auth token:', !!token);

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  /**
   * Initialize audio service
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure audio for iOS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      this.isInitialized = true;
      console.log('[TTS] Service initialized successfully');
    } catch (error) {
      console.error('[TTS] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech and play it
   */
  async speak(text: string, link: string, options?: TTSOptions): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      // Stop any current speech
      await this.stop();

      console.log('[TTS] Speaking text with length:', text.length);

      const startTime = Date.now();

      // Prepare request body
      const requestBody: any = {
        text,
        link,
      };

      if (options?.language) {
        requestBody.language = options.language;
      }

      // Call backend TTS API using ApiClient's internal token
      const url = `${API_BASE_URL}/api/tts/synthesize`;

      // We need to manually construct this request because ApiClient expects JSON responses
      // but TTS returns binary audio data
      const response = await this.makeAuthenticatedRequest(url, requestBody);

      console.log('[TTS] Response status:', response.status);
      console.log('[TTS] Response headers:', {
        contentType: response.headers.get('Content-Type'),
        contentLength: response.headers.get('Content-Length'),
      });

      if (!response.ok) {
        const contentType = response.headers.get('Content-Type');
        let errorMessage = `HTTP ${response.status}`;

        if (contentType?.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.message || errorMessage;
        } else {
          const errorText = await response.text().catch(() => '');
          errorMessage = errorText || errorMessage;
        }

        console.error('[TTS] Request failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log(`[TTS] Audio synthesis took ${Date.now() - startTime}ms`);

      // Get audio blob from response
      const audioBlob = await response.blob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);

      const base64Audio = await base64Promise;

      // Load and play audio using expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri: base64Audio },
        {
          shouldPlay: true,
          volume: 1.0,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.currentSound = sound;
      this.isSpeaking = true;
      this.isPaused = false;
      this.progressCallback = options?.onProgressUpdate || null;

      // Start progress tracking if callback provided
      if (this.progressCallback) {
        this.startProgressTracking();
      }

      console.log('[TTS] Audio playback started');

    } catch (error) {
      console.error('[TTS] Speak error:', error);
      this.isSpeaking = false;
      throw error;
    }
  }

  /**
   * Start tracking playback progress
   */
  private async startProgressTracking() {
    if (!this.currentSound || !this.progressCallback) return;

    // Clear any existing interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Update progress every 100ms
    this.progressInterval = setInterval(async () => {
      if (!this.currentSound || !this.progressCallback) {
        this.stopProgressTracking();
        return;
      }

      try {
        const status = await this.currentSound.getStatusAsync();
        if (status.isLoaded) {
          const progress = status.durationMillis && status.durationMillis > 0
            ? (status.positionMillis / status.durationMillis) * 100
            : 0;

          this.progressCallback(Math.min(progress, 100));

          if (status.didJustFinish) {
            this.stopProgressTracking();
          }
        }
      } catch (error) {
        console.error('[TTS] Error tracking progress:', error);
        this.stopProgressTracking();
      }
    }, 100);
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.progressCallback) {
      this.progressCallback(0);
      this.progressCallback = null;
    }
  }

  /**
   * Handle playback status updates
   */
  private onPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (status.isLoaded) {
      if (status.didJustFinish) {
        console.log('[TTS] Playback finished');
        this.isSpeaking = false;
        this.isPaused = false;
        this.stopProgressTracking();
        this.cleanupSound();
      }
    } else if (status.error) {
      console.error('[TTS] Playback error:', status.error);
      this.isSpeaking = false;
      this.isPaused = false;
      this.stopProgressTracking();
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
        console.log('[TTS] Playback paused');
      } catch (error) {
        console.error('[TTS] Failed to pause:', error);
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
        console.log('[TTS] Playback resumed');
      } catch (error) {
        console.error('[TTS] Failed to resume:', error);
      }
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    this.stopProgressTracking();
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.cleanupSound();
        this.isSpeaking = false;
        this.isPaused = false;
        console.log('[TTS] Playback stopped');
      } catch (error) {
        console.error('[TTS] Failed to stop:', error);
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
        console.error('[TTS] Failed to unload sound:', error);
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
   * Estimate duration in seconds based on text length
   * Average speech rate: ~15 characters per second for natural TTS
   */
  estimateDuration(text: string): number {
    const CHARS_PER_SECOND = 15;
    return Math.ceil(text.length / CHARS_PER_SECOND);
  }

  /**
   * Format duration as MM:SS
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Clean up resources
   */
  async destroy() {
    await this.stop();
    this.isInitialized = false;
  }
}

// Export singleton instance
export default new TTSService();
