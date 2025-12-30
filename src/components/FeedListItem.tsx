import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import nativeTtsService from '../services/nativeTtsService';

interface FeedListItemProps {
  title: string;
  subtitle?: string;
  isActive?: boolean;
  isGrayedOut?: boolean;
  isLoading?: boolean;
  unreadCount?: number;
  duration?: number;
  error?: boolean;
  onPress?: () => void;
  onPlayPress?: () => void;
}

export const FeedListItem: React.FC<FeedListItemProps> = ({
  title,
  subtitle,
  isActive = false,
  isGrayedOut = false,
  isLoading = false,
  unreadCount,
  duration,
  error = false,
  onPress,
  onPlayPress,
}) => {
  const getSubtitle = () => {
    if (isLoading) return 'Loading...';
    if (error) return 'Failed to load';
    if (isGrayedOut) return 'all played';
    if (unreadCount !== undefined && duration !== undefined) {
      const formattedDuration = nativeTtsService.formatDuration(duration);
      return `${unreadCount} new tracks - ${formattedDuration}`;
    }
    return subtitle;
  };

  return (
    <View style={styles.feedItem}>
      <TouchableOpacity onPress={onPress} style={styles.textContainer}>
        <Text style={[styles.feedTitle, isGrayedOut && styles.grayText]}>
          {title}
        </Text>
        <Text style={[styles.feedSubtitle, (isGrayedOut || error) && styles.grayText]}>
          {getSubtitle()}
        </Text>
      </TouchableOpacity>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.foreground} />
      ) : (
        <TouchableOpacity onPress={isGrayedOut ? onPress : onPlayPress}>
          <Ionicons
            name={isGrayedOut ? 'reload' : 'play'}
            size={24}
            color={isGrayedOut ? colors.grayedOut : colors.foreground}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  feedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foregroundDark,
    marginBottom: 4,
  },
  feedSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  grayText: {
    color: colors.grayedOut,
  },
});
