import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { PostsProvider, usePosts } from './src/contexts/PostsContext';
import { LoginScreen } from './src/components/LoginScreen';
import { SplashScreen } from './src/components/SplashScreen';
import { FeedList } from './src/components/FeedList';
import { TrackList } from './src/components/TrackList';
import { SettingsScreen } from './src/components/SettingsScreen';
import { Post } from './src/services/rssParser';
import sherpaOnnxService from './src/services/sherpaOnnxService';
import readStatusService from './src/services/readStatusService';
import contentPipelineService from './src/services/contentPipelineService';
import { colors } from './src/constants/colors';
import { Feed } from './src/types';

type Screen = 'splash' | 'feedList' | 'trackList' | 'settings';

function AppContent() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { isLoading: postsLoading, initializeFeeds, getPostsByFeed } = usePosts();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);

  // Track selection state
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

    // Add volume listener to suppress VolumeUpdate warnings
    let volumeSubscription: any = null;
    try {
      const TTSManager = NativeModules.TTSManager;
      if (TTSManager) {
        const eventEmitter = new NativeEventEmitter(TTSManager);
        volumeSubscription = eventEmitter.addListener('VolumeUpdate', () => {
          // No-op listener to suppress warnings
        });
      }
    } catch (e) {
      // Ignore if event emitter setup fails
    }

    return () => {
      sherpaOnnxService.stop();
      volumeSubscription?.remove();
    };
  }, []);

  // Initialize feeds when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log('[App] User authenticated, initializing feeds');
      initializeFeeds();
    }
  }, [isAuthenticated, authLoading]);

  // Handle splash screen transition when feeds are loaded
  useEffect(() => {
    if (isAuthenticated && !authLoading && !postsLoading) {
      const transitionToFeed = () => {
        console.log('[App] Feeds loaded - showing feed list');
        setCurrentScreen((prevScreen) => {
          // Only transition from splash to feedList, don't interfere with other screens
          return prevScreen === 'splash' ? 'feedList' : prevScreen;
        });
      };

      // In test mode, transition immediately without setTimeout
      if (process.env.NODE_ENV === 'test') {
        transitionToFeed();
      } else {
        // In production, show splash for minimum 3 seconds or until feeds load
        const splashTimer = setTimeout(transitionToFeed, 3000);
        return () => clearTimeout(splashTimer);
      }
    }
  }, [isAuthenticated, authLoading, postsLoading]);

  // Navigation handlers
  const handleFeedSelect = async (feed: Feed) => {
    console.log(`[App] Feed selected: ${feed.title}`);
    setSelectedFeed(feed);

    // Navigate to track list - posts are already in context from app startup
    setCurrentScreen('trackList');
  };

  const handleBackToFeedList = () => {
    console.log('[App] Navigating back to feed list');
    // Stop playback when going back
    if (isPlaying) {
      sherpaOnnxService.stop();
      setIsPlaying(false);
    }
    setSelectedIndex(null);
    // Clear pipeline queue to stop processing posts that aren't being viewed
    contentPipelineService.clearQueue();
    console.log('[App] Cleared pipeline queue');
    // Posts stay in context - no need to clear
    setCurrentScreen('feedList');
  };

  // Helper function to get cleaned posts for the selected feed
  const getCleanedPosts = (): Post[] => {
    if (!selectedFeed) return [];
    const feedPosts = getPostsByFeed(selectedFeed.id);
    return feedPosts.filter((post: Post) => post.status === 'cleaned');
  };

  // Track selection and playback handlers
  const selectArticle = async (index: number) => {
    const posts = getCleanedPosts();

    // If clicking on the currently selected track, toggle play/pause
    if (selectedIndex === index) {
      await handlePlayPause();
      return;
    }

    // Stop current playback if any
    if (isPlaying) {
      sherpaOnnxService.stop();
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

      // Use cleanedContent if available, fallback to plainText for backward compatibility
      const contentToSpeak = post.cleanedContent || post.plainText;
      const usingCleaned = post.cleanedContent !== null;

      // Log cleaning status and content sample
      console.log(`[App] Playback using ${usingCleaned ? 'CLEANED' : 'FALLBACK'} content (status: ${post.status})`);

      // Log first 5 sentences to evaluate cleaning quality
      const sentences = contentToSpeak.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
      const firstFiveSentences = sentences.slice(0, 5).join('. ') + '.';
      console.log('[App] First 5 sentences:');
      console.log(firstFiveSentences);
      console.log(`[App] Total: ${contentToSpeak.length} chars, ${sentences.length} sentences`);

      // Speak the post with title announcement
      sherpaOnnxService.speakWithTitle(post.title, contentToSpeak, {
        language: getLanguageForPost(post),
        onDone: async () => {
          console.log('[App] Post finished, checking for next unread post');
          setIsPlaying(false);

          const posts = getCleanedPosts();

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

    const posts = getCleanedPosts();
    const post = posts[selectedIndex];
    if (!post) return;

    try {
      const speaking = await sherpaOnnxService.isSpeaking();

      if (isPlaying || speaking) {
        // Stop
        await sherpaOnnxService.stop();
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
    const posts = getCleanedPosts();
    if (selectedIndex !== null && selectedIndex < posts.length - 1) {
      selectArticle(selectedIndex + 1);
    }
  };

  const getPostDuration = (post: Post): string => {
    // Use cleanedContent for more accurate duration estimation
    const content = post.cleanedContent || post.plainText;
    const seconds = sherpaOnnxService.estimateDuration(content);
    return sherpaOnnxService.formatDuration(seconds);
  };

  const handleSettingsPress = () => {
    console.log('[App] Navigating to settings');
    setCurrentScreen('settings');
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
        return selectedFeed ? (
          <TrackList
            feedId={selectedFeed.id}
            feedTitle={selectedFeed.title || selectedFeed.url || ''}
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
        ) : null;

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
      <PostsProvider>
        <AppContent />
      </PostsProvider>
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
