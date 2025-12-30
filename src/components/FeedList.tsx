import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { FeedListItem } from './FeedListItem';
import { colors } from '../constants/colors';
import { Feed } from '../types';
import feedService from '../services/feedService';

const { width } = Dimensions.get('window');

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

  const handleFeedPress = (feed: Feed) => {
    console.log(`[FeedList] Feed selected: ${feed.title}`);
    setActiveFeed(feed);
    onFeedSelect(feed);
  };

  const handleAddFeed = () => {
    Alert.alert('Coming Soon', 'Add feed functionality will be available soon.');
  };

  const handleDailyPlay = () => {
    Alert.alert('Coming Soon', 'Daily feedtape functionality will be available soon.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoTextMain}>feed</Text>
          <Text style={styles.logoTextAccent}>tape</Text>
        </View>
        <TouchableOpacity onPress={onSettingsPress}>
          <Ionicons name="settings-sharp" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.foreground} />
          <Text style={styles.loadingText}>Loading feeds...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Card */}
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              {/* Cassette Icon */}
              <View style={styles.cassetteContainer}>
                <MaterialCommunityIcons
                  name="cassette"
                  size={100}
                  color={colors.cassetteOrange}
                />
              </View>

              <Text style={styles.cardTitle}>Your daily feedtape is ready - 3:30</Text>

              <TouchableOpacity onPress={handleDailyPlay} activeOpacity={0.8}>
                <LinearGradient
                  colors={[colors.playGradientStart, colors.playGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.playButton}
                >
                  <Ionicons name="play" size={22} color={colors.buttonText} style={styles.playIcon} />
                  <Text style={styles.playButtonText}>PLAY</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* My Feeds Section */}
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <Text style={styles.feedHeaderTitle}>my feeds</Text>
              <TouchableOpacity onPress={handleAddFeed}>
                <Feather name="plus" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {feeds.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="globe-outline" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No feeds yet</Text>
                <Text style={styles.emptySubtitle}>
                  Tap + to add your first RSS feed
                </Text>
              </View>
            ) : (
              feeds.map((feed, index) => (
                <FeedListItem
                  key={feed.id}
                  title={feed.title || feed.url}
                  subtitle="7 new tracks - 3:20"
                  isActive={activeFeed?.id === feed.id}
                  isGrayedOut={index === feeds.length - 1 && feeds.length > 3}
                  onPress={() => handleFeedPress(feed)}
                  onPlayPress={() => handleFeedPress(feed)}
                />
              ))
            )}

            {/* Bottom padding for player bar */}
            <View style={{ height: 120 }} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.backgroundWhite,
  },
  logoContainer: {
    flexDirection: 'row',
  },
  logoTextMain: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.logoMain,
  },
  logoTextAccent: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.logoAccent,
  },
  // Hero Card
  cardContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  card: {
    backgroundColor: colors.cardBg,
    width: width * 0.9,
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cassetteContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cassetteBg,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.foregroundDark,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 25,
    color: colors.foregroundDark,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderRadius: 4,
  },
  playIcon: {
    marginRight: 8,
  },
  playButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  // Feed List
  feedSection: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  feedHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  // Loading & Empty States
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
    paddingVertical: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
