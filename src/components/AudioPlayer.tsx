import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface AudioPlayerProps {
  currentTrack?: {
    title: string;
  };
  isPlaying: boolean;
  isLoading?: boolean;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  isLoading = false,
  onPlayPause,
  onSkipBack,
  onSkipForward,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Current Track Title */}
        {currentTrack && (
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {/* Skip Back */}
          <TouchableOpacity
            onPress={onSkipBack}
            style={styles.controlButton}
            activeOpacity={0.7}
          >
            <Ionicons name="play-skip-back" size={20} color={colors.foreground} />
          </TouchableOpacity>

          {/* Play/Pause */}
          <TouchableOpacity
            onPress={onPlayPause}
            style={styles.playButton}
            activeOpacity={0.9}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.buttonText} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color={colors.buttonText}
                style={!isPlaying && { marginLeft: 2 }} // Center play icon optically
              />
            )}
          </TouchableOpacity>

          {/* Skip Forward */}
          <TouchableOpacity
            onPress={onSkipForward}
            style={styles.controlButton}
            activeOpacity={0.7}
          >
            <Ionicons name="play-skip-forward" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.playerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 50,
  },
  innerContainer: {
    maxWidth: 448,         // max-w-md = 448px (28rem)
    marginHorizontal: 'auto',
    paddingHorizontal: 32, // px-8 = 32px
    paddingVertical: 24,   // py-6 = 24px
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 20,      // mb-5 = 20px
  },
  trackTitle: {
    fontSize: 18,          // text-lg = 18px
    fontWeight: '300',     // font-light
    color: colors.foreground,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,               // gap-12 = 48px
  },
  controlButton: {
    width: 44,             // h-11 w-11 = 44px
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,             // h-14 w-14 = 56px
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.buttonBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
