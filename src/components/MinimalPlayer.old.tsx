import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ttsService from '../services/pollyTtsService';

interface MinimalPlayerProps {
  text: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStop: () => void;
  awsCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
  };
}

export const MinimalPlayer: React.FC<MinimalPlayerProps> = ({
  text,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onStop,
  awsCredentials
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (awsCredentials) {
      initializePolly();
    }

    return () => {
      ttsService.stop();
    };
  }, [awsCredentials]);

  const initializePolly = async () => {
    if (!awsCredentials) return;

    try {
      setIsLoading(true);
      await ttsService.init(
        awsCredentials.accessKeyId,
        awsCredentials.secretAccessKey,
        awsCredentials.region || 'eu-west-1'
      );
      setIsInitialized(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize Polly:', error);
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!isInitialized || !text) return;

    try {
      setIsLoading(true);

      if (isPlaying) {
        await ttsService.stop();
      } else {
        // Hardcoded to use Lucia voice (Spanish female neural)
        await ttsService.speak(text, {
          voiceId: 'Lucia',
          engine: 'neural',
          rate: '100%'
        });
      }

      onPlayPause();
      setIsLoading(false);
    } catch (error) {
      console.error('Playback error:', error);
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    await ttsService.stop();
    onStop();
  };

  return (
    <View style={styles.container}>
      {/* Previous */}
      <TouchableOpacity onPress={onPrevious} style={styles.button}>
        <Ionicons name="play-skip-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Play/Pause */}
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[styles.button, styles.playButton]}
        disabled={isLoading || !isInitialized}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={28}
            color="#fff"
          />
        )}
      </TouchableOpacity>

      {/* Stop */}
      <TouchableOpacity
        onPress={handleStop}
        style={styles.button}
        disabled={!isPlaying}
      >
        <Ionicons
          name="stop"
          size={24}
          color={isPlaying ? "#333" : "#ccc"}
        />
      </TouchableOpacity>

      {/* Next */}
      <TouchableOpacity onPress={onNext} style={styles.button}>
        <Ionicons name="play-skip-forward" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    padding: 12,
    marginHorizontal: 15,
  },
  playButton: {
    backgroundColor: '#FF9900',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});