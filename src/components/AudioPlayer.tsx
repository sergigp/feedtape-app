import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface AudioPlayerProps {
  currentTrack?: {
    title: string;
    feedName?: string;
  };
  isPlaying: boolean;
  isLoading?: boolean;
  progress?: number; // 0-1
  duration?: string; // e.g., "2:30"
  onPlayPause: () => void;
  onSkipForward: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  isLoading = false,
  progress = 0,
  duration = '0:00',
  onPlayPause,
  onSkipForward,
}) => {
  if (!currentTrack) {
    return null;
  }

  return (
    <View style={styles.playerBar}>
      {/* Progress Bar at top */}
      <View style={styles.progressBarBackground}>
        <LinearGradient
          colors={[colors.progressStart, colors.progressEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressBarFill, { width: `${Math.max(progress * 100, 5)}%` }]}
        />
      </View>

      <View style={styles.playerContent}>
        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          {currentTrack.feedName && (
            <Text style={styles.trackSource} numberOfLines={1}>
              {currentTrack.feedName}
            </Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.playerControls}>
          <Text style={styles.timeText}>{duration}</Text>

          <TouchableOpacity
            onPress={onPlayPause}
            style={styles.controlIcon}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color={colors.foreground}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onSkipForward} style={styles.controlIcon}>
            <Ionicons name="play-skip-forward" size={28} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  playerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.playerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 20, // For iPhone X+ home indicator
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: colors.muted,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
  },
  playerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  trackInfo: {
    flex: 1,
    marginRight: 16,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  trackSource: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginRight: 15,
  },
  controlIcon: {
    marginLeft: 15,
    padding: 4,
  },
});
