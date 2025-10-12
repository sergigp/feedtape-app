// Track Player Service - Background audio with AirPods/AirPlay support
// Converts text to speech using the backend TTS endpoint and plays with react-native-track-player

import TrackPlayer, {
  Capability,
  State,
  Event,
  RepeatMode,
} from 'react-native-track-player';
import { API_BASE_URL } from '../config/env';
import * as SecureStore from 'expo-secure-store';
import RNFS from 'react-native-fs';

export interface TTSOptions {
  language?: 'auto' | 'es' | 'en' | 'fr' | 'de' | 'pt' | 'it';
  onProgressUpdate?: (progress: number) => void;
}

const TOKEN_KEY = 'feedtape_access_token';

class TrackPlayerService {
  private isInitialized = false;
  private isSpeaking = false;
  private progressCallback: ((progress: number) => void) | null = null;
  private progressInterval: NodeJS.Timeout | null = null;
  private currentTrackId: string | null = null;
  private currentFileUri: string | null = null;

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

    console.log('[TrackPlayer] Making request to:', url);
    console.log('[TrackPlayer] Request body:', body);
    console.log('[TrackPlayer] Has auth token:', !!token);

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  /**
   * Initialize track player service
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[TrackPlayer] Initializing...');

      // Setup track player (wrapped in try-catch to handle already initialized case)
      try {
        await TrackPlayer.setupPlayer();
      } catch (setupError: any) {
        // If already initialized, that's fine - just continue
        if (setupError?.message?.includes('already been initialized')) {
          console.log('[TrackPlayer] Already initialized, skipping setup');
        } else {
          throw setupError;
        }
      }

      // Configure capabilities (controls available in lock screen/control center)
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
      });

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('[TrackPlayer] Service initialized successfully');
    } catch (error) {
      console.error('[TrackPlayer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for playback events
   */
  private setupEventListeners() {
    TrackPlayer.addEventListener(Event.PlaybackState, async (data) => {
      console.log('[TrackPlayer] State changed:', data.state);

      if (data.state === State.Playing) {
        this.isSpeaking = true;
        this.startProgressTracking();
      } else if (data.state === State.Paused || data.state === State.Stopped) {
        this.isSpeaking = false;
        this.stopProgressTracking();
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (data) => {
      console.log('[TrackPlayer] Track changed:', data);
    });
  }

  /**
   * Delete old cached audio file
   */
  private async deleteOldAudioFile() {
    if (this.currentFileUri) {
      try {
        const exists = await RNFS.exists(this.currentFileUri);
        if (exists) {
          await RNFS.unlink(this.currentFileUri);
          console.log('[TrackPlayer] Deleted old audio file:', this.currentFileUri);
        }
      } catch (error) {
        console.warn('[TrackPlayer] Failed to delete old audio file:', error);
      }
      this.currentFileUri = null;
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
      // Stop any current playback and delete old file
      await this.stop();

      console.log('[TrackPlayer] Speaking text with length:', text.length);

      const startTime = Date.now();

      // Prepare request body
      const requestBody: any = {
        text,
        link,
      };

      if (options?.language) {
        requestBody.language = options.language;
      }

      // Call backend TTS API
      const url = `${API_BASE_URL}/api/tts/synthesize`;
      const response = await this.makeAuthenticatedRequest(url, requestBody);

      console.log('[TrackPlayer] Response status:', response.status);

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

        console.error('[TrackPlayer] Request failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log(`[TrackPlayer] Audio synthesis took ${Date.now() - startTime}ms`);

      // Get audio blob from response
      const audioBlob = await response.blob();
      console.log('[TrackPlayer] Audio blob size:', audioBlob.size);

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

      // Save to local file system using react-native-fs
      // Extract the base64 data without the data URL prefix
      const base64Data = base64Audio.split(',')[1];

      // Use RNFS cache directory (always available)
      const fileUri = `${RNFS.CachesDirectoryPath}/tts-${Date.now()}.mp3`;

      console.log('[TrackPlayer] Saving audio to:', fileUri);
      await RNFS.writeFile(fileUri, base64Data, 'base64');

      // Store the current file URI for cleanup later
      this.currentFileUri = fileUri;

      // Generate unique track ID
      this.currentTrackId = `track-${Date.now()}`;

      // Extract title from text (first 50 chars or first sentence)
      const title = text.split(/[.!?]/)[0].substring(0, 50) + '...';

      console.log('[TrackPlayer] Adding track with file URI:', fileUri);

      // Add track to queue with local file URI
      await TrackPlayer.add({
        id: this.currentTrackId,
        url: fileUri,
        title: title,
        artist: 'FeedTape',
        description: link,
      });

      // Store progress callback
      this.progressCallback = options?.onProgressUpdate || null;

      // Start playback
      await TrackPlayer.play();

      console.log('[TrackPlayer] Playback started');

    } catch (error) {
      console.error('[TrackPlayer] Speak error:', error);
      this.isSpeaking = false;
      throw error;
    }
  }

  /**
   * Start tracking playback progress
   */
  private async startProgressTracking() {
    if (!this.progressCallback) return;

    // Clear any existing interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Update progress every 100ms
    this.progressInterval = setInterval(async () => {
      if (!this.progressCallback) {
        this.stopProgressTracking();
        return;
      }

      try {
        const position = await TrackPlayer.getPosition();
        const duration = await TrackPlayer.getDuration();

        if (duration && duration > 0) {
          const progress = (position / duration) * 100;
          this.progressCallback(Math.min(progress, 100));

          // Check if playback finished
          if (progress >= 99.9) {
            this.stopProgressTracking();
          }
        }
      } catch (error) {
        console.error('[TrackPlayer] Error tracking progress:', error);
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
   * Pause current playback
   */
  async pause(): Promise<void> {
    if (this.isSpeaking) {
      try {
        await TrackPlayer.pause();
        console.log('[TrackPlayer] Playback paused');
      } catch (error) {
        console.error('[TrackPlayer] Failed to pause:', error);
      }
    }
  }

  /**
   * Resume paused playback
   */
  async resume(): Promise<void> {
    try {
      await TrackPlayer.play();
      console.log('[TrackPlayer] Playback resumed');
    } catch (error) {
      console.error('[TrackPlayer] Failed to resume:', error);
    }
  }

  /**
   * Stop current playback
   */
  async stop(): Promise<void> {
    this.stopProgressTracking();
    try {
      await TrackPlayer.reset();
      this.isSpeaking = false;
      this.currentTrackId = null;
      console.log('[TrackPlayer] Playback stopped');

      // Delete the old audio file after stopping
      await this.deleteOldAudioFile();
    } catch (error) {
      console.error('[TrackPlayer] Failed to stop:', error);
    }
  }

  /**
   * Get current state
   */
  async getState() {
    const state = await TrackPlayer.getState();
    return {
      isInitialized: this.isInitialized,
      isSpeaking: state === State.Playing,
      isPaused: state === State.Paused,
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
    await TrackPlayer.destroy();
    this.isInitialized = false;
  }

  /**
   * Clear all cached audio files (useful for freeing up space)
   */
  async clearCache(): Promise<void> {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const files = await RNFS.readDir(cacheDir);
      const audioFiles = files.filter(file =>
        file.name.startsWith('tts-') && file.name.endsWith('.mp3')
      );

      console.log(`[TrackPlayer] Clearing ${audioFiles.length} cached audio files`);

      for (const file of audioFiles) {
        await RNFS.unlink(file.path);
      }

      console.log('[TrackPlayer] Cache cleared successfully');
    } catch (error) {
      console.error('[TrackPlayer] Failed to clear cache:', error);
    }
  }
}

// Export singleton instance
export default new TrackPlayerService();
