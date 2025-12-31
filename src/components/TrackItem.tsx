import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { colors } from '../constants/colors';

interface TrackItemProps {
  title: string;
  duration: string;
  isActive?: boolean;
  isPlaying?: boolean;  // New: indicates if audio is currently playing
  isRead?: boolean;  // New: indicates if article has been read
  progress?: number; // 0-100
  onPress?: () => void;
}

// Animated audio bars component
const AudioBars: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isPlaying) {
      const createAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300 + delay,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 300 + delay,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const animations = Animated.parallel([
        createAnimation(bar1, 0),
        createAnimation(bar2, 100),
        createAnimation(bar3, 50),
      ]);

      animations.start();

      return () => {
        animations.stop();
      };
    } else {
      bar1.setValue(0.3);
      bar2.setValue(0.3);
      bar3.setValue(0.3);
    }
  }, [isPlaying, bar1, bar2, bar3]);

  return (
    <View style={styles.audioBars}>
      <Animated.View
        style={[
          styles.bar,
          {
            transform: [
              {
                scaleY: bar1,
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bar,
          {
            transform: [
              {
                scaleY: bar2,
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bar,
          {
            transform: [
              {
                scaleY: bar3,
              },
            ],
          },
        ]}
      />
    </View>
  );
};

export const TrackItem: React.FC<TrackItemProps> = ({
  title,
  duration,
  isActive = false,
  isPlaying = false,
  isRead = false,
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
            isRead && styles.titleRead,
          ]}
        >
          {title}
        </Text>

        {/* Right side: Duration + Audio indicator */}
        <View style={styles.rightContent}>
          <Text style={styles.duration}>{duration}</Text>
          {isActive && <AudioBars isPlaying={isPlaying} />}
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
  titleRead: {
    color: colors.mutedForeground,
    opacity: 0.6,
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
  audioBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 20,
    width: 24,
  },
  bar: {
    width: 3,
    height: 16,
    backgroundColor: colors.foreground,
    borderRadius: 2,
  },
});
