import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedListItem } from './FeedListItem';
import { colors } from '../constants/colors';
import { Feed } from '../types';
import feedService from '../services/feedService';

interface FeedListProps {
  onFeedSelect: (feed: Feed) => void;
  onSettingsPress: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({
  onFeedSelect,
  onSettingsPress,
}) => {
  const [activeFeed, setActiveFeed] = useState<Feed | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const fetchedFeeds = await feedService.getFeeds();
      setFeeds(fetchedFeeds);
    } catch (error) {
      console.error('[FeedList] Failed to load feeds:', error);
      Alert.alert('Error', 'Failed to load feeds. Please try again.');
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    loadFeeds(true);
  };

  const handleFeedPress = (feed: Feed) => {
    console.log(`[FeedList] Feed selected: ${feed.title}`);
    setActiveFeed(feed);
    onFeedSelect(feed);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          {/* Refresh Button - Top Left */}
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.refreshButton}
            disabled={isRefreshing}
            testID="refresh-button"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.foregroundMedium} />
            ) : (
              <Ionicons
                name="refresh"
                size={20}
                color={colors.foregroundMedium}
              />
            )}
          </TouchableOpacity>

          {/* Logo - Centered */}
          <Image
            source={require('../../assets/feedtape-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Settings Button - Top Right */}
          <TouchableOpacity
            onPress={onSettingsPress}
            style={styles.settingsButton}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={colors.foregroundMedium}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.foreground} />
          <Text style={styles.loadingText}>Loading feeds...</Text>
        </View>
      ) : feeds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="globe-outline" size={64} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No feeds yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your first RSS feed to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={feeds}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedListItem
              title={item.title || item.url}
              isActive={activeFeed?.id === item.id}
              onPress={() => handleFeedPress(item)}
            />
          )}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: {
    maxWidth: 448, // max-w-md
    marginHorizontal: 'auto',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32, // px-8
    paddingVertical: 48, // py-12
    position: 'relative',
  },
  logo: {
    height: 64, // h-16 = 64px
    width: 200,
  },
  refreshButton: {
    position: 'absolute',
    left: 32,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 8,
  },
  settingsButton: {
    position: 'absolute',
    right: 32,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 8,
  },
  list: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
});
