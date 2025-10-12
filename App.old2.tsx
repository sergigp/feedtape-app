import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SplashScreen } from './src/components/SplashScreen';
import { TrackItem } from './src/components/TrackItem';
import { AudioPlayer } from './src/components/AudioPlayer';
import { parseRSSFeed, RSSItem } from './src/services/rssParser';
import { sampleFeedXML } from './src/data/feedData';
import { AWS_CONFIG } from './src/config/aws.config';
import { Ionicons } from '@expo/vector-icons';
import ttsService from './src/services/pollyTtsService';
import { colors } from './src/constants/colors';

export default function App() {
  const [articles, setArticles] = useState<RSSItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [awsCredentials, setAwsCredentials] = useState({
    accessKeyId: AWS_CONFIG.accessKeyId,
    secretAccessKey: AWS_CONFIG.secretAccessKey,
    region: AWS_CONFIG.region || 'eu-west-1',
  });
  const [tempCredentials, setTempCredentials] = useState({ ...awsCredentials });
  const [progressMap, setProgressMap] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    loadFeed();
    checkCredentials();

    // Hide splash after 2 seconds
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => {
      clearTimeout(splashTimer);
      ttsService.stop();
    };
  }, []);

  const loadFeed = () => {
    try {
      const parsedArticles = parseRSSFeed(sampleFeedXML);
      setArticles(parsedArticles);
      console.log(`Loaded ${parsedArticles.length} articles`);
    } catch (error) {
      console.error('Error loading feed:', error);
      Alert.alert('Error', 'Failed to load articles');
    }
  };

  const checkCredentials = () => {
    if (!awsCredentials.accessKeyId) {
      setTimeout(() => {
        setShowCredentialsModal(true);
      }, 2500); // Show after splash
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
      console.log('Polly initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Polly:', error);
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

  const selectArticle = (index: number) => {
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
        // Pause
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
      console.error('Playback error:', error);
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

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Image
            source={require('./assets/feedtape-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <TouchableOpacity
            onPress={() => setShowCredentialsModal(true)}
            style={styles.settingsButton}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.foregroundMedium} />
          </TouchableOpacity>
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
            onPress={() => selectArticle(index)}
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
        onPlayPause={handlePlayPause}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
      />

      {/* Credentials Modal */}
      <Modal
        visible={showCredentialsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCredentialsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>AWS Credentials</Text>
            <Text style={styles.modalDescription}>
              To use Amazon Polly, you need AWS credentials.{'\n'}
              Sign up for AWS Free Tier to get 1M neural TTS characters/month free.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Access Key ID"
              value={tempCredentials.accessKeyId}
              onChangeText={(text) =>
                setTempCredentials({ ...tempCredentials, accessKeyId: text })
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Secret Access Key"
              value={tempCredentials.secretAccessKey}
              onChangeText={(text) =>
                setTempCredentials({ ...tempCredentials, secretAccessKey: text })
              }
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Region (e.g., eu-west-1 for EU)"
              value={tempCredentials.region}
              onChangeText={(text) =>
                setTempCredentials({ ...tempCredentials, region: text })
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.regionHint}>
              For neural voices use: eu-west-1 (Ireland) or eu-central-1 (Frankfurt).
              {'\n'}eu-north-1 (Stockholm) only supports standard voices.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCredentialsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveCredentials}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.helpLink}
              onPress={() =>
                Alert.alert(
                  'How to Get AWS Credentials',
                  '1. Sign up for AWS Free Tier\n2. Go to IAM Console\n3. Create new user with programmatic access\n4. Attach "AmazonPollyReadOnlyAccess" policy\n5. Copy Access Key ID and Secret'
                )
              }
            >
              <Text style={styles.helpLinkText}>How to get AWS credentials?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
    width: 200, // Set explicit width since 'auto' doesn't work well in RN
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
  listContent: {
    paddingBottom: 128, // pb-32 for fixed player
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
