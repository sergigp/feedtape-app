import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ttsService, { SPANISH_VOICES } from '../services/pollyTtsService';

interface AudioPlayerProps {
  text: string;
  onSpeedChange?: (speed: string) => void;
  onVoiceChange?: (voiceId: string) => void;
  awsCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
  };
}

const PLAYBACK_SPEEDS = [
  { label: '0.75x', value: '75%' },
  { label: '1x', value: '100%' },
  { label: '1.25x', value: '125%' },
  { label: '1.5x', value: '150%' },
];

const VOICE_OPTIONS = [
  SPANISH_VOICES.LUCIA,   // ES-ES Female Neural
  SPANISH_VOICES.SERGIO,  // ES-ES Male Neural
  SPANISH_VOICES.MIA,     // ES-MX Female Neural
  SPANISH_VOICES.ANDRES,  // ES-MX Male Neural
];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  text,
  onSpeedChange,
  onVoiceChange,
  awsCredentials
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1); // Default to 1.0x
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0); // Default to Lucia
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializePolly();

    return () => {
      ttsService.stop();
    };
  }, [awsCredentials]);

  const initializePolly = async () => {
    if (!awsCredentials) {
      Alert.alert('Configuration Required', 'Please add AWS credentials in the app settings.');
      return;
    }

    try {
      setIsLoading(true);
      await ttsService.init(
        awsCredentials.accessKeyId,
        awsCredentials.secretAccessKey,
        awsCredentials.region || 'us-east-1'
      );
      setIsInitialized(true);
      setIsLoading(false);
      console.log('Polly initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Polly:', error);
      Alert.alert('Initialization Error', 'Failed to initialize Amazon Polly. Check your credentials.');
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!isInitialized) {
      Alert.alert('Not Ready', 'TTS service is not initialized yet.');
      return;
    }

    try {
      if (isPlaying) {
        if (isPaused) {
          // Resume
          await ttsService.resume();
          setIsPaused(false);
        } else {
          // Pause
          await ttsService.pause();
          setIsPaused(true);
        }
      } else {
        // Start playing
        setIsLoading(true);

        // Limit text for demo (remove this in production)
        const textToSpeak = text.length > 1000 ? text.substring(0, 1000) + "..." : text;

        const voice = VOICE_OPTIONS[selectedVoiceIndex];
        console.log(`Starting Polly with voice: ${voice.name} (${voice.language})`);

        await ttsService.speak(textToSpeak, {
          voiceId: voice.id,
          rate: PLAYBACK_SPEEDS[speedIndex].value,
          engine: 'neural' // Will automatically fallback to standard if region doesn't support it
        });

        setIsPlaying(true);
        setIsPaused(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play audio. Check your internet connection.');
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handleStop = async () => {
    await ttsService.stop();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const handleSpeedChange = () => {
    const newSpeedIndex = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(newSpeedIndex);

    if (onSpeedChange) {
      onSpeedChange(PLAYBACK_SPEEDS[newSpeedIndex].value);
    }
  };

  const handleVoiceChange = () => {
    const newVoiceIndex = (selectedVoiceIndex + 1) % VOICE_OPTIONS.length;
    setSelectedVoiceIndex(newVoiceIndex);

    if (onVoiceChange) {
      onVoiceChange(VOICE_OPTIONS[newVoiceIndex].id);
    }
  };

  const handleSkipBack = () => {
    console.log('Skip backward - not implemented in demo');
  };

  const handleSkipForward = () => {
    console.log('Skip forward - not implemented in demo');
  };

  const currentVoice = VOICE_OPTIONS[selectedVoiceIndex];

  return (
    <View style={styles.container}>
      {/* Voice Selection */}
      <TouchableOpacity
        style={styles.voiceSelector}
        onPress={handleVoiceChange}
      >
        <Ionicons name="mic-outline" size={20} color="#007AFF" />
        <Text style={styles.voiceText}>
          {currentVoice.name} ({currentVoice.language})
        </Text>
        <Text style={styles.engineBadge}>
          {currentVoice.neural ? 'Neural' : 'Standard'}
        </Text>
      </TouchableOpacity>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '0%' }]} />
        </View>
      </View>

      {/* Main Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={handleSkipBack}
          style={styles.controlButton}
        >
          <Ionicons name="play-skip-back" size={32} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePlayPause}
          style={[styles.controlButton, styles.playButton]}
          disabled={isLoading || !isInitialized}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons
              name={isPlaying && !isPaused ? "pause" : "play"}
              size={40}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkipForward}
          style={styles.controlButton}
        >
          <Ionicons name="play-skip-forward" size={32} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Secondary Controls */}
      <View style={styles.secondaryControls}>
        <TouchableOpacity
          onPress={handleStop}
          style={styles.secondaryButton}
          disabled={!isPlaying}
        >
          <Ionicons
            name="stop-circle-outline"
            size={28}
            color={isPlaying ? "#333" : "#ccc"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSpeedChange}
          style={[styles.secondaryButton, styles.speedButton]}
        >
          <Text style={styles.speedText}>{PLAYBACK_SPEEDS[speedIndex].label}</Text>
        </TouchableOpacity>
      </View>

      {/* AWS Polly Badge */}
      <View style={styles.pollyBadge}>
        <Text style={styles.pollyBadgeText}>Powered by Amazon Polly</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  voiceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  voiceText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  engineBadge: {
    backgroundColor: '#007AFF',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF9900', // Amazon orange
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlButton: {
    padding: 10,
    marginHorizontal: 20,
  },
  playButton: {
    backgroundColor: '#FF9900', // Amazon orange
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9900',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButton: {
    padding: 8,
  },
  speedButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  speedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pollyBadge: {
    alignItems: 'center',
    marginTop: 10,
  },
  pollyBadgeText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});