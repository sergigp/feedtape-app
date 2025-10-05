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
} from 'react-native';
import { MinimalPlayer } from './src/components/MinimalPlayer';
import { parseRSSFeed, RSSItem } from './src/services/rssParser';
import { sampleFeedXML } from './src/data/feedData';
import { AWS_CONFIG } from './src/config/aws.config';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  const [articles, setArticles] = useState<RSSItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [awsCredentials, setAwsCredentials] = useState({
    accessKeyId: AWS_CONFIG.accessKeyId,
    secretAccessKey: AWS_CONFIG.secretAccessKey,
    region: AWS_CONFIG.region || 'eu-west-1',
  });
  const [tempCredentials, setTempCredentials] = useState({ ...awsCredentials });

  useEffect(() => {
    loadFeed();
    checkCredentials();
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
      }, 500);
    }
  };

  const handleSaveCredentials = () => {
    if (!tempCredentials.accessKeyId || !tempCredentials.secretAccessKey) {
      Alert.alert('Missing Credentials', 'Please enter AWS credentials');
      return;
    }

    setAwsCredentials({ ...tempCredentials });
    setShowCredentialsModal(false);
  };

  const selectArticle = (index: number) => {
    setSelectedIndex(index);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < articles.length - 1) {
      setSelectedIndex(selectedIndex + 1);
      setIsPlaying(false);
    }
  };

  const handlePrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
      setIsPlaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Minimal Header */}
      <View style={styles.header}>
        <Text style={styles.title}>FeedTape</Text>
        <TouchableOpacity onPress={() => setShowCredentialsModal(true)}>
          <Ionicons name="settings-outline" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Article List */}
      <FlatList
        data={articles}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.articleItem,
              selectedIndex === index && styles.selectedArticle
            ]}
            onPress={() => selectArticle(index)}
          >
            <Text
              style={[
                styles.articleTitle,
                selectedIndex === index && styles.selectedTitle
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />

      {/* Minimal Player Controls */}
      <MinimalPlayer
        text={selectedIndex !== null ? articles[selectedIndex].plainText : ''}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onNext={handleNext}
        onPrevious={handlePrevious}
        awsCredentials={awsCredentials.accessKeyId ? awsCredentials : undefined}
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
              onChangeText={(text) => setTempCredentials({ ...tempCredentials, accessKeyId: text })}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Secret Access Key"
              value={tempCredentials.secretAccessKey}
              onChangeText={(text) => setTempCredentials({ ...tempCredentials, secretAccessKey: text })}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Region (e.g., eu-west-1 for EU)"
              value={tempCredentials.region}
              onChangeText={(text) => setTempCredentials({ ...tempCredentials, region: text })}
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
              onPress={() => Alert.alert(
                'How to Get AWS Credentials',
                '1. Sign up for AWS Free Tier\n2. Go to IAM Console\n3. Create new user with programmatic access\n4. Attach "AmazonPollyReadOnlyAccess" policy\n5. Copy Access Key ID and Secret'
              )}
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  listContent: {
    paddingBottom: 10,
  },
  articleItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  selectedArticle: {
    backgroundColor: '#FFF3E0',
  },
  articleTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  selectedTitle: {
    color: '#FF9900',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
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
    backgroundColor: '#f5f5f5',
  },
  saveButton: {
    marginLeft: 8,
    backgroundColor: '#FF9900',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
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
    color: '#666',
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 18,
  },
});
