import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrackItem } from './TrackItem';
import { AudioPlayer } from './AudioPlayer';
import { TechnicolorText } from './TechnicolorText';
import { TechnicolorButton } from './TechnicolorButton';
import { Post } from '../types';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

interface TrackListProps {
  feedTitle: string;
  lastReadAt: string | null | undefined;
  posts: Post[];
  selectedIndex: number | null;
  progressMap: { [key: number]: number };
  isPlaying: boolean;
  isLoading: boolean;
  onTrackSelect: (index: number) => void;
  onPlayPause: () => void;
  onSkipForward: () => void;
  onBack: () => void;
  onSettingsPress: () => void;
  getPostDuration: (post: Post) => string;
}

export const TrackList: React.FC<TrackListProps> = ({
  feedTitle,
  lastReadAt,
  posts,
  selectedIndex,
  progressMap,
  isPlaying,
  isLoading,
  onTrackSelect,
  onPlayPause,
  onSkipForward,
  onBack,
  onSettingsPress,
  getPostDuration,
}) => {
  // Calculate new tracks count based on last_read_at
  const newTracksCount = React.useMemo(() => {
    if (!lastReadAt) return posts.length; // All new if never read

    const lastReadDate = new Date(lastReadAt);
    return posts.filter(post => {
      if (!post.pubDate) return true; // Include if no pubDate
      const postDate = new Date(post.pubDate);
      return postDate > lastReadDate;
    }).length;
  }, [posts, lastReadAt]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Left side: Back arrow + Feed title */}
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={onBack}
            testID="back-button"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color="#8E2DE2"
            />
          </TouchableOpacity>
          <TechnicolorText
            text={feedTitle.toLowerCase()}
            style={styles.feedTitleHeader}
          />
        </View>

        {/* Right side: Settings button */}
        <TouchableOpacity onPress={onSettingsPress}>
          <Ionicons
            name="ellipsis-vertical"
            size={24}
            color={colors.foreground}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {/* Hero Card - New Tracks */}
      <View style={styles.cardContainer}>
        <View style={styles.card}>
          {/* Cassette Logo */}
          <View style={styles.logoImageContainer}>
            <Image
              source={require('../../assets/feedtape-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* New Tracks Count */}
          <Text style={styles.cardTitle}>
            {newTracksCount} new track{newTracksCount !== 1 ? 's' : ''}
          </Text>

          {/* Play Button */}
          <TechnicolorButton
            label="PLAY"
            icon="play"
            onPress={() => {
              if (posts.length > 0) {
                onTrackSelect(0);
                onPlayPause();
              }
            }}
          />

          {/* Subtitle */}
          <Text style={styles.cardSubtitle}>
            Listen in Headline mode
          </Text>
        </View>
      </View>

      {/* Tracks Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>tracks</Text>
      </View>

      {/* Track List */}
      <FlatList
        data={posts}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <TrackItem
            title={item.title}
            duration={getPostDuration(item)}
            isActive={selectedIndex === index}
            progress={progressMap[index] || 0}
            onPress={() => onTrackSelect(index)}
          />
        )}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />

      {/* Audio Player */}
      <AudioPlayer
        currentTrack={
          selectedIndex !== null
            ? { title: posts[selectedIndex].title }
            : undefined
        }
        isPlaying={isPlaying}
        isLoading={isLoading}
        onPlayPause={onPlayPause}
        onSkipForward={onSkipForward}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.backgroundWhite,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  feedTitleHeader: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  // Hero Card styles
  cardContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  card: {
    backgroundColor: colors.cardBg,
    width: width * 0.9,
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 2,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  logoImageContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 140,
    height: 106,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 25,
    color: colors.foregroundDark,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 128, // pb-32 for fixed player
  },
});
