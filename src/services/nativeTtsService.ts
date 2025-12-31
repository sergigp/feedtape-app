// Native TTS Service - iOS/Android native text-to-speech using expo-speech
// Provides simple foreground TTS playback without background audio support

import * as Speech from 'expo-speech';

export interface SpeakOptions {
  language?: string;  // e.g., 'es-ES', 'en-US'
  rate?: number;      // 0.5 to 2.0 (default 1.0)
  pitch?: number;     // 0.5 to 2.0 (default 1.0)
  voice?: string;     // System voice identifier
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

class NativeTtsService {
  private currentText: string | null = null;
  private speaking = false;

  /**
   * Speak text using native TTS
   */
  async speak(text: string, options?: SpeakOptions): Promise<void> {
    // Stop any current speech
    await this.stop();

    console.log('[NativeTTS] Speaking text with length:', text.length);

    this.currentText = text;
    this.speaking = true;

    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        language: options?.language || 'en-US',
        rate: options?.rate ?? 1.0,
        pitch: options?.pitch ?? 1.0,
        voice: options?.voice,
        onStart: () => {
          console.log('[NativeTTS] Speech started');
          this.speaking = true;
          options?.onStart?.();
        },
        onDone: () => {
          console.log('[NativeTTS] Speech completed');
          this.speaking = false;
          this.currentText = null;
          options?.onDone?.();
          resolve();
        },
        onError: (error) => {
          console.error('[NativeTTS] Speech error:', error);
          this.speaking = false;
          this.currentText = null;
          options?.onError?.(error);
          reject(error);
        },
        onStopped: () => {
          console.log('[NativeTTS] Speech stopped');
          this.speaking = false;
          // Don't call onDone here, only on natural completion
        },
      });
    });
  }

  /**
   * Speak article with title announcement
   * Speaks the title first, pauses for 2 seconds, then speaks the content
   */
  async speakWithTitle(title: string, content: string, options?: SpeakOptions): Promise<void> {
    // Stop any current speech
    await this.stop();

    console.log('[NativeTTS] Speaking with title:', title);
    this.currentText = `${title}\n\n${content}`;
    this.speaking = true;

    try {
      // First, speak the title
      await new Promise<void>((resolve, reject) => {
        Speech.speak(title, {
          language: options?.language || 'en-US',
          rate: options?.rate ?? 1.0,
          pitch: options?.pitch ?? 1.0,
          voice: options?.voice,
          onStart: () => {
            console.log('[NativeTTS] Speaking title');
            options?.onStart?.();
          },
          onDone: () => {
            console.log('[NativeTTS] Title completed');
            resolve();
          },
          onError: (error) => {
            console.error('[NativeTTS] Title speech error:', error);
            reject(error);
          },
        });
      });

      // Check if we were stopped during title
      if (!this.speaking) {
        console.log('[NativeTTS] Stopped during title');
        return;
      }

      // Pause for 2 seconds
      console.log('[NativeTTS] Pausing for 2 seconds');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if we were stopped during pause
      if (!this.speaking) {
        console.log('[NativeTTS] Stopped during pause');
        return;
      }

      // Then speak the content
      await new Promise<void>((resolve, reject) => {
        Speech.speak(content, {
          language: options?.language || 'en-US',
          rate: options?.rate ?? 1.0,
          pitch: options?.pitch ?? 1.0,
          voice: options?.voice,
          onStart: () => {
            console.log('[NativeTTS] Speaking content');
          },
          onDone: () => {
            console.log('[NativeTTS] Content completed');
            this.speaking = false;
            this.currentText = null;
            options?.onDone?.();
            resolve();
          },
          onError: (error) => {
            console.error('[NativeTTS] Content speech error:', error);
            this.speaking = false;
            this.currentText = null;
            options?.onError?.(error);
            reject(error);
          },
          onStopped: () => {
            console.log('[NativeTTS] Content stopped');
            this.speaking = false;
          },
        });
      });
    } catch (error) {
      this.speaking = false;
      this.currentText = null;
      throw error;
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    if (await Speech.isSpeakingAsync()) {
      console.log('[NativeTTS] Stopping speech');
      await Speech.stop();
    }
    this.speaking = false;
    this.currentText = null;
  }

  /**
   * Pause current speech (iOS only)
   */
  async pause(): Promise<void> {
    console.log('[NativeTTS] Pausing speech');
    await Speech.pause();
    this.speaking = false;
  }

  /**
   * Resume paused speech (iOS only)
   */
  async resume(): Promise<void> {
    console.log('[NativeTTS] Resuming speech');
    await Speech.resume();
    this.speaking = true;
  }

  /**
   * Check if currently speaking
   */
  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
  }

  /**
   * Get available voices for a language
   */
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    return Speech.getAvailableVoicesAsync();
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
   * Get current state
   */
  async getState() {
    const speaking = await Speech.isSpeakingAsync();
    return {
      isSpeaking: speaking,
      currentText: this.currentText,
    };
  }
}

// Export singleton instance
export default new NativeTtsService();
