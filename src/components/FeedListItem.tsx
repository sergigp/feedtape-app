import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface FeedListItemProps {
  title: string;
  subtitle?: string;
  isActive?: boolean;
  isGrayedOut?: boolean;
  onPress?: () => void;
  onPlayPress?: () => void;
}

export const FeedListItem: React.FC<FeedListItemProps> = ({
  title,
  subtitle,
  isActive = false,
  isGrayedOut = false,
  onPress,
  onPlayPress,
}) => {
  return (
    <View style={styles.feedItem}>
      <TouchableOpacity onPress={onPress} style={styles.textContainer}>
        <Text style={[styles.feedTitle, isGrayedOut && styles.grayText]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.feedSubtitle, isGrayedOut && styles.grayText]}>
            {isGrayedOut ? 'all played' : subtitle}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={isGrayedOut ? onPress : onPlayPress}>
        <Ionicons
          name={isGrayedOut ? 'reload' : 'play'}
          size={24}
          color={isGrayedOut ? colors.grayedOut : colors.foreground}
        />
      </TouchableOpacity>
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
