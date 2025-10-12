import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

interface FeedListItemProps {
  title: string;
  isActive?: boolean;
  onPress?: () => void;
}

export const FeedListItem: React.FC<FeedListItemProps> = ({
  title,
  isActive = false,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.container}
    >
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
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
