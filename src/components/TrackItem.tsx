import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface TrackItemProps {
  title: string;
  duration: string;
  isActive?: boolean;
  progress?: number; // 0-100
  onPress?: () => void;
}

export const TrackItem: React.FC<TrackItemProps> = ({
  title,
  duration,
  isActive = false,
  progress = 0,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.container}
    >
      {/* Progress bar background */}
      <View
        style={[
          styles.progressBar,
          {
            width: `${progress}%`,
          },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Title - takes most space, multi-line */}
        <Text
          style={[
            styles.title,
            isActive && styles.titleActive,
          ]}
        >
          {title}
        </Text>

        {/* Right side: Duration + Play button */}
        <View style={styles.rightContent}>
          <Text style={styles.duration}>{duration}</Text>
          <TouchableOpacity style={styles.playButton}>
            <Ionicons
              name="play"
              size={20}
              color={colors.foreground}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.muted,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',  // Align to top for multi-line titles
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: colors.foreground,
    lineHeight: 22,
  },
  titleActive: {
    fontWeight: '500',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  duration: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    padding: 4,
  },
});
