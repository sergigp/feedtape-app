import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/components/LoginScreen';
import { SplashScreen } from './src/components/SplashScreen';
import { FeedList } from './src/components/FeedList';
import { TrackList } from './src/components/TrackList';
import { parseRSSFeed, RSSItem } from './src/services/rssParser';
import { sampleFeedXML } from './src/data/feedData';
import { AWS_CONFIG } from './src/config/aws.config';
import ttsService from './src/services/pollyTtsService';
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

  // Credentials state
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [awsCredentials, setAwsCredentials] = useState({
    accessKeyId: AWS_CONFIG.accessKeyId,
    secretAccessKey: AWS_CONFIG.secretAccessKey,
    region: AWS_CONFIG.region || 'eu-west-1',
  });
  const [tempCredentials, setTempCredentials] = useState({ ...awsCredentials });

  useEffect(() => {
    console.log('[App] Mounting');
    loadFeed();
    // checkCredentials(); // Disabled - will use backend API in future

    // Hide splash after 3 seconds and show feed list
    const splashTimer = setTimeout(() => {
      console.log('[App] Splash timeout - showing feed list');
      setCurrentScreen('feedList');
    }, 3000);

    return () => {
      clearTimeout(splashTimer);
      ttsService.stop();
    };
  }, []);

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

  const checkCredentials = () => {
    if (!awsCredentials.accessKeyId) {
      setTimeout(() => {
        setShowCredentialsModal(true);
      }, 3500); // Show after splash
    } else {
      initializePolly();
    }
  };

  const initializePolly = async () => {
    if (!awsCredentials.accessKeyId) return;

    try {
      await ttsService.init(
        awsCredentials.accessKeyId,
        awsCredentials.secretAccessKey,
        awsCredentials.region || 'eu-west-1'
      );
      console.log('[App] Polly initialized successfully');
    } catch (error) {
      console.error('[App] Failed to initialize Polly:', error);
      Alert.alert('Initialization Error', 'Failed to initialize Amazon Polly. Check your credentials.');
    }
  };

  const handleSaveCredentials = () => {
    if (!tempCredentials.accessKeyId || !tempCredentials.secretAccessKey) {
      Alert.alert('Missing Credentials', 'Please enter AWS credentials');
      return;
    }

    setAwsCredentials({ ...tempCredentials });
    setShowCredentialsModal(false);
    initializePolly();
  };

  // Navigation handlers
  const handleFeedSelect = (feed: Feed) => {
    console.log(`[App] Feed selected: ${feed.title}, navigating to track list`);
    setSelectedFeed(feed);
    setCurrentScreen('trackList');
  };

  const handleBackToFeedList = () => {
    console.log('[App] Navigating back to feed list');
    // Stop playback when going back
    if (isPlaying) {
      ttsService.stop();
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
      ttsService.stop();
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
        await ttsService.stop();
        setIsPlaying(false);
      } else {
        // Play
        setIsLoading(true);

        await ttsService.speak(article.plainText, {
          voiceId: 'Lucia',
          engine: 'neural',
          rate: '100%',
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
    const seconds = ttsService.estimateDuration(article.plainText);
    return ttsService.formatDuration(seconds);
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.foreground,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 8,
    backgroundColor: colors.muted,
  },
  saveButton: {
    marginLeft: 8,
    backgroundColor: colors.buttonBg,
  },
  cancelButtonText: {
    color: colors.mutedForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  helpLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  helpLinkText: {
    color: '#007AFF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  regionHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 18,
  },
});
