import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrackItem } from './TrackItem';
import { AudioPlayer } from './AudioPlayer';
import { RSSItem } from '../services/rssParser';
import { colors } from '../constants/colors';

interface TrackListProps {
  feedTitle: string;
  articles: RSSItem[];
  selectedIndex: number | null;
  progressMap: { [key: number]: number };
  isPlaying: boolean;
  isLoading: boolean;
  onTrackSelect: (index: number) => void;
  onPlayPause: () => void;
  onSkipForward: () => void;
  onBack: () => void;
  onSettingsPress: () => void;
  getArticleDuration: (article: RSSItem) => string;
}

export const TrackList: React.FC<TrackListProps> = ({
  feedTitle,
  articles,
  selectedIndex,
  progressMap,
  isPlaying,
  isLoading,
  onTrackSelect,
  onPlayPause,
  onSkipForward,
  onBack,
  onSettingsPress,
  getArticleDuration,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            testID="back-button"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>

          {/* Logo */}
          <Image
            source={require('../../assets/feedtape-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Settings Button */}
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

        {/* Feed Title */}
        <View style={styles.feedTitleContainer}>
          <Text style={styles.feedTitle}>{feedTitle}</Text>
        </View>
      </View>

      {/* Track List */}
      <FlatList
        data={articles}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <TrackItem
            title={item.title}
            duration={getArticleDuration(item)}
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
            ? { title: articles[selectedIndex].title }
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
    paddingVertical: 24, // py-6 (reduced from py-12)
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 32,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: 8,
  },
  logo: {
    height: 48, // h-12 = 48px (smaller in track list)
    width: 150,
  },
  settingsButton: {
    position: 'absolute',
    right: 32,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 8,
  },
  feedTitleContainer: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    alignItems: 'center',
  },
  feedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 128, // pb-32 for fixed player
  },
});
