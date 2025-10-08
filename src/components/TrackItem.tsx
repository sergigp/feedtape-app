import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
        <Text
          style={[
            styles.title,
            isActive && styles.titleActive,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        <Text style={styles.duration}>{duration}</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,  // px-8 = 32px
    paddingVertical: 24,    // py-6 = 24px
  },
  title: {
    flex: 1,
    fontSize: 18,          // text-lg = 18px
    fontWeight: '300',     // font-light
    color: colors.foreground,
    opacity: 0.8,
  },
  titleActive: {
    fontWeight: '400',     // font-normal
    opacity: 1,
  },
  duration: {
    fontSize: 16,          // text-base = 16px
    color: colors.mutedForeground,
    marginLeft: 24,        // ml-6 = 24px
    fontWeight: '300',     // font-light
    fontVariant: ['tabular-nums'],
  },
});
