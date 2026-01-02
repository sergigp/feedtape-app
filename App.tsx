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
import { SettingsScreen } from './src/components/SettingsScreen';
import { SherpaTestScreen } from './src/components/SherpaTestScreen';
import { parseRSSFeed, Post } from './src/services/rssParser';
import nativeTtsService from './src/services/nativeTtsService';
import feedService from './src/services/feedService';
import readStatusService from './src/services/readStatusService';
import { colors } from './src/constants/colors';
import { Feed } from './src/types';

type Screen = 'splash' | 'feedList' | 'trackList' | 'settings';

// TEMPORARY: Set to true to test Sherpa ONNX (Iteration 1)
const ENABLE_SHERPA_TEST = true;

function AppContent() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);

  // Post state
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [progressMap, setProgressMap] = useState<{ [key: number]: number }>({});

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('[App] Mounting');

    // Initialize read status service
    readStatusService.initialize().catch(error => {
      console.error('[App] Failed to initialize read status:', error);
    });

    return () => {
      nativeTtsService.stop();
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

  // Navigation handlers
  const handleFeedSelect = async (feed: Feed) => {
    console.log(`[App] Feed selected: ${feed.title}, fetching RSS content`);
    setSelectedFeed(feed);
    setIsLoading(true);

    try {
      // Fetch RSS content from the feed URL
      const xmlContent = await feedService.fetchRSSContent(feed.url);

      // Parse the RSS feed (filters articles older than 90 days)
      const posts = parseRSSFeed(xmlContent);
      console.log(`[App] Parsed ${posts.length} posts from ${feed.title}`);

      // Update posts state
      setPosts(posts);

      // Navigate to track list
      setCurrentScreen('trackList');
    } catch (error) {
      console.error('[App] Failed to fetch/parse RSS feed:', error);
      Alert.alert(
        'Error Loading Feed',
        'Failed to load posts from this feed. Please check the feed URL and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToFeedList = () => {
    console.log('[App] Navigating back to feed list');
    // Stop playback when going back
    if (isPlaying) {
      nativeTtsService.stop();
      setIsPlaying(false);
    }
    setSelectedIndex(null);
    setCurrentScreen('feedList');
  };

  // Track selection and playback handlers
  const selectArticle = async (index: number) => {
    console.log(`[App] Track selected: ${index}`);

    // If clicking on the currently selected track, toggle play/pause
    if (selectedIndex === index) {
      await handlePlayPause();
      return;
    }

    // Stop current playback if any
    if (isPlaying) {
      nativeTtsService.stop();
      setIsPlaying(false);
    }

    // Select the new track
    setSelectedIndex(index);
    setProgressMap({ ...progressMap, [index]: 0 });

    // Automatically start playing the newly selected track
    const post = posts[index];
    if (!post) return;

    // Use extracted playback helper
    await startPlayback(post, index);
  };

  const getLanguageForPost = (post: Post): string => {
    // Priority 1: User preference override (optional)
    if (user?.settings?.language) {
      const userLangMap: Record<string, string> = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'pt': 'pt-PT',
        'it': 'it-IT',
      };
      const mapped = userLangMap[user.settings.language];
      if (mapped) {
        console.log(`[App] User preference override: ${mapped}`);
        return mapped;
      }
    }

    // Priority 2: Use detected language (guaranteed to exist)
    console.log(`[App] Using detected language: ${post.language}`);
    return post.language;
  };

  /**
   * Start playback for a post with auto-play support
   * Extracted to avoid code duplication between selectArticle and handlePlayPause
   */
  const startPlayback = async (post: Post, index: number) => {
    try {
      setIsPlaying(true);

      // Mark as read when starting playback
      await readStatusService.markAsRead(
        post.link,
        selectedFeed?.id,
        post.title
      );

      // Speak the post with title announcement
      nativeTtsService.speakWithTitle(post.title, post.plainText, {
        language: getLanguageForPost(post),
        onDone: async () => {
          console.log('[App] Post finished, checking for next unread post');
          setIsPlaying(false);

          // Find next unread post
          const nextUnreadIndex = posts.findIndex((p, i) =>
            i > index && !readStatusService.isRead(p.link)
          );

          if (nextUnreadIndex !== -1) {
            console.log('[App] Waiting 2 seconds before next post');
            // Wait 2 seconds before playing next post
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Guard: Check if still on track list screen (fix race condition)
            if (currentScreen !== 'trackList') {
              console.log('[App] Screen changed, canceling auto-play');
              return;
            }

            console.log('[App] Auto-playing next unread post:', nextUnreadIndex);
            // Handle errors from auto-play (fix unhandled promise)
            selectArticle(nextUnreadIndex).catch(error => {
              console.error('[App] Auto-play error:', error);
              setIsPlaying(false);
            });
          } else {
            console.log('[App] No more unread posts');
          }
        },
        onError: (error) => {
          console.error('[App] TTS error:', error);
          setIsPlaying(false);
        },
      });
    } catch (error) {
      console.error('[App] Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play audio.');
      setIsPlaying(false);
    }
  };

  const handlePlayPause = async () => {
    if (selectedIndex === null) return;

    const post = posts[selectedIndex];
    if (!post) return;

    try {
      const speaking = await nativeTtsService.isSpeaking();

      if (isPlaying || speaking) {
        // Stop
        await nativeTtsService.stop();
        setIsPlaying(false);
      } else {
        // Play using extracted playback helper
        await startPlayback(post, selectedIndex);
      }
    } catch (error) {
      console.error('[App] Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play audio.');
      setIsPlaying(false);
    }
  };

  const handleSkipForward = () => {
    if (selectedIndex !== null && selectedIndex < posts.length - 1) {
      selectArticle(selectedIndex + 1);
    }
  };

  const getPostDuration = (post: Post): string => {
    const seconds = nativeTtsService.estimateDuration(post.plainText);
    return nativeTtsService.formatDuration(seconds);
  };

  const handleSettingsPress = () => {
    console.log('[App] Navigating to settings');
    setCurrentScreen('settings');
  };

  // Render current screen
  const renderScreen = () => {
    // TEMPORARY: Show Sherpa test screen for Iteration 1 testing
    if (ENABLE_SHERPA_TEST) {
      return <SherpaTestScreen />;
    }

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
            onSettingsPress={handleSettingsPress}
          />
        );

      case 'trackList':
        return (
          <TrackList
            feedTitle={selectedFeed?.title || selectedFeed?.url || ''}
            posts={posts}
            selectedIndex={selectedIndex}
            progressMap={progressMap}
            isPlaying={isPlaying}
            isLoading={isLoading}
            onTrackSelect={selectArticle}
            onPlayPause={handlePlayPause}
            onSkipForward={handleSkipForward}
            onBack={handleBackToFeedList}
            onSettingsPress={handleSettingsPress}
            getPostDuration={getPostDuration}
          />
        );

      case 'settings':
        return <SettingsScreen onBack={() => setCurrentScreen('feedList')} />;

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
