import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/components/LoginScreen';
import { SplashScreen } from './src/components/SplashScreen';
import { FeedList } from './src/components/FeedList';
import { TrackList } from './src/components/TrackList';
import { parseRSSFeed, RSSItem } from './src/services/rssParser';
import { sampleFeedXML } from './src/data/feedData';
import trackPlayerService from './src/services/trackPlayerService';
import feedService from './src/services/feedService';
import { colors } from './src/constants/colors';
import { Feed } from './src/types';

type Screen = 'splash' | 'feedList' | 'trackList';

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);

  // Article state
  const [articles, setArticles] = useState<RSSItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [progressMap, setProgressMap] = useState<{ [key: number]: number }>({});

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('[App] Mounting');
    loadFeed();

    return () => {
      trackPlayerService.stop();
    };
  }, []);

  // Handle splash screen transition when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const transitionToFeed = () => {
        console.log('[App] Splash timeout - showing feed list');
        setCurrentScreen((prevScreen) => {
          // Only transition from splash to feedList, don't interfere with other screens
          return prevScreen === 'splash' ? 'feedList' : prevScreen;
        });
      };

      // In test mode, transition immediately without setTimeout
      if (process.env.NODE_ENV === 'test') {
        transitionToFeed();
      } else {
        // In production, show splash for 3 seconds
        const splashTimer = setTimeout(transitionToFeed, 3000);
        return () => clearTimeout(splashTimer);
      }
    }
  }, [isAuthenticated, authLoading]);

  const loadFeed = () => {
    try {
      const parsedArticles = parseRSSFeed(sampleFeedXML);
      setArticles(parsedArticles);
      console.log(`[App] Loaded ${parsedArticles.length} articles`);
    } catch (error) {
      console.error('[App] Error loading feed:', error);
      Alert.alert('Error', 'Failed to load articles');
    }
  };

  // Navigation handlers
  const handleFeedSelect = async (feed: Feed) => {
    console.log(`[App] Feed selected: ${feed.title}, fetching RSS content`);
    setSelectedFeed(feed);
    setIsLoading(true);

    try {
      // Fetch RSS content from the feed URL
      const xmlContent = await feedService.fetchRSSContent(feed.url);

      // Parse the RSS feed
      const parsedArticles = parseRSSFeed(xmlContent);
      console.log(`[App] Parsed ${parsedArticles.length} articles from ${feed.title}`);

      // Update articles state
      setArticles(parsedArticles);

      // Navigate to track list
      setCurrentScreen('trackList');
    } catch (error) {
      console.error('[App] Failed to fetch/parse RSS feed:', error);
      Alert.alert(
        'Error Loading Feed',
        'Failed to load articles from this feed. Please check the feed URL and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToFeedList = () => {
    console.log('[App] Navigating back to feed list');
    // Stop playback when going back
    if (isPlaying) {
      trackPlayerService.stop();
      setIsPlaying(false);
    }
    setSelectedIndex(null);
    setCurrentScreen('feedList');
  };

  // Track selection and playback handlers
  const selectArticle = (index: number) => {
    console.log(`[App] Track selected: ${index}`);
    // If already playing this article, do nothing
    if (selectedIndex === index && isPlaying) {
      return;
    }

    // Stop current playback if any
    if (isPlaying) {
      trackPlayerService.stop();
      setIsPlaying(false);
    }

    setSelectedIndex(index);
    setProgressMap({ ...progressMap, [index]: 0 });
  };

  const handlePlayPause = async () => {
    if (selectedIndex === null) return;

    const article = articles[selectedIndex];
    if (!article) return;

    try {
      if (isPlaying) {
        // Stop
        await trackPlayerService.stop();
        setIsPlaying(false);
      } else {
        // Play
        setIsLoading(true);

        await trackPlayerService.speak(article.plainText, article.link, {
          language: 'auto',
          onProgressUpdate: (progress) => {
            setProgressMap((prev) => ({
              ...prev,
              [selectedIndex]: progress,
            }));
          },
        });

        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[App] Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play audio. Check your internet connection.');
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handleSkipBack = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      selectArticle(selectedIndex - 1);
    }
  };

  const handleSkipForward = () => {
    if (selectedIndex !== null && selectedIndex < articles.length - 1) {
      selectArticle(selectedIndex + 1);
    }
  };

  const getArticleDuration = (article: RSSItem): string => {
    const seconds = trackPlayerService.estimateDuration(article.plainText);
    return trackPlayerService.formatDuration(seconds);
  };

  // Render current screen
  const renderScreen = () => {
    // Show loading while checking authentication
    if (authLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      );
    }

    // Show login screen if not authenticated
    if (!isAuthenticated) {
      return <LoginScreen />;
    }

    // Show app screens if authenticated
    console.log(`[App] Rendering screen: ${currentScreen}`);

    switch (currentScreen) {
      case 'splash':
        return <SplashScreen />;

      case 'feedList':
        return (
          <FeedList
            onFeedSelect={handleFeedSelect}
            onSettingsPress={() => console.log('[App] Settings pressed - not implemented yet')}
          />
        );

      case 'trackList':
        return (
          <TrackList
            feedTitle={selectedFeed?.title || selectedFeed?.url || ''}
            articles={articles}
            selectedIndex={selectedIndex}
            progressMap={progressMap}
            isPlaying={isPlaying}
            isLoading={isLoading}
            onTrackSelect={selectArticle}
            onPlayPause={handlePlayPause}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            onBack={handleBackToFeedList}
            onSettingsPress={() => console.log('[App] Settings pressed - not implemented yet')}
            getArticleDuration={getArticleDuration}
          />
        );

      default:
        return <SplashScreen />;
    }
  };

  return (
    <>
      <StatusBar style="auto" />
      {renderScreen()}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
