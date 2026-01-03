import React, { useState, useEffect } from "react";
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
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { FeedListItem } from "./FeedListItem";
import { TechnicolorText } from "./TechnicolorText";
import { TechnicolorButton } from "./TechnicolorButton";
import { colors } from "../constants/colors";
import { Feed, FeedStats } from "../types";
import feedService from "../services/feedService";
import { parseRSSFeed } from "../services/rssParser";
import nativeTtsService from "../services/nativeTtsService";
import readStatusService from "../services/readStatusService";

const { width } = Dimensions.get("window");

interface FeedListProps {
  onFeedSelect: (feed: Feed) => void;
  onSettingsPress: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({ onFeedSelect, onSettingsPress }) => {
  const [activeFeed, setActiveFeed] = useState<Feed | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [feedStats, setFeedStats] = useState<Record<string, FeedStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeedStats = async (feedsToLoad: Feed[]) => {
    // Initialize all feeds as loading
    const initialStats: Record<string, FeedStats> = {};
    feedsToLoad.forEach((feed) => {
      initialStats[feed.id] = { unreadCount: 0, totalDuration: 0, isLoading: true };
    });
    setFeedStats(initialStats);

    // Fetch all feeds in parallel
    const results = await Promise.allSettled(
      feedsToLoad.map(async (feed) => {
        const xmlContent = await feedService.fetchRSSContent(feed.url);
        // Parse RSS feed (filters articles older than 90 days)
        const posts = parseRSSFeed(xmlContent);

        // Filter unread posts using read status service
        const unreadPosts = posts.filter((post) => {
          return !readStatusService.isRead(post.link);
        });

        // Calculate total duration for unread posts
        const totalDuration = unreadPosts.reduce((sum, post) => {
          return sum + nativeTtsService.estimateDuration(post.plainText);
        }, 0);

        return {
          feedId: feed.id,
          unreadCount: unreadPosts.length,
          totalDuration,
        };
      })
    );

    // Update stats for each feed
    const updatedStats: Record<string, FeedStats> = {};
    results.forEach((result, index) => {
      const feedId = feedsToLoad[index].id;
      if (result.status === "fulfilled") {
        updatedStats[feedId] = {
          unreadCount: result.value.unreadCount,
          totalDuration: result.value.totalDuration,
          isLoading: false,
        };
      } else {
        console.error(`[FeedList] Failed to load stats for feed ${feedId}:`, result.reason);
        updatedStats[feedId] = {
          unreadCount: 0,
          totalDuration: 0,
          isLoading: false,
          error: true,
        };
      }
    });
    setFeedStats(updatedStats);
  };

  const loadFeeds = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const fetchedFeeds = await feedService.getFeeds();
      setFeeds(fetchedFeeds);
      // Load stats for all feeds in parallel
      loadFeedStats(fetchedFeeds);
    } catch (error) {
      console.error("[FeedList] Failed to load feeds:", error);
      Alert.alert("Error", "Failed to load feeds. Please try again.");
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const handleFeedPress = (feed: Feed) => {
    setActiveFeed(feed);
    onFeedSelect(feed);
  };

  const handleAddFeed = () => {
    Alert.alert("Coming Soon", "Add feed functionality will be available soon.");
  };

  const handleDailyPlay = () => {
    Alert.alert("Coming Soon", "Daily feedtape functionality will be available soon.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TechnicolorText text="feedtape" style={styles.logoText} />
        <TouchableOpacity onPress={onSettingsPress}>
          <Ionicons name="settings-sharp" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadFeeds(true)}
              tintColor={colors.foreground}
            />
          }
        >
          {/* Hero Card */}
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              {/* Logo Image */}
              <View style={styles.logoImageContainer}>
                <Image
                  source={require("../../assets/feedtape-logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.cardTitle}>Your daily feedtape is ready - 3:30</Text>

              <TechnicolorButton
                label="PLAY"
                icon="play"
                onPress={handleDailyPlay}
              />
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
                <Text style={styles.emptySubtitle}>Tap + to add your first RSS feed</Text>
              </View>
            ) : (
              feeds.map((feed) => {
                const stats = feedStats[feed.id];
                const isGrayedOut = stats && !stats.isLoading && stats.unreadCount === 0;
                return (
                  <FeedListItem
                    key={feed.id}
                    title={feed.title || feed.url}
                    isActive={activeFeed?.id === feed.id}
                    isLoading={stats?.isLoading}
                    unreadCount={stats?.unreadCount}
                    duration={stats?.totalDuration}
                    error={stats?.error}
                    isGrayedOut={isGrayedOut}
                    onPress={() => handleFeedPress(feed)}
                    onPlayPress={() => handleFeedPress(feed)}
                  />
                );
              })
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.backgroundWhite,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  // Hero Card
  cardContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  card: {
    backgroundColor: colors.cardBg,
    width: width * 0.9,
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 2,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  logoImageContainer: {
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 140,
    height: 106,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 25,
    color: colors.foregroundDark,
  },
  // Feed List
  feedSection: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  feedHeaderTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.foreground,
  },
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  emptyContainer: {
    paddingVertical: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
