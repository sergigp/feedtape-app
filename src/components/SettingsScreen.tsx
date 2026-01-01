import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TechnicolorText } from './TechnicolorText';
import { colors } from '../constants/colors';
import readStatusService from '../services/readStatusService';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [stats, setStats] = useState({ totalRead: 0, oldestEntry: null as string | null });
  const [isClearing, setIsClearing] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const stats = await readStatusService.getStats();
      setStats(stats);
    } catch (error) {
      console.error('[SettingsScreen] Failed to load stats:', error);
    }
  };

  const handleClearHistory = () => {
    if (stats.totalRead === 0) {
      Alert.alert('No History', 'There is no read history to clear.');
      return;
    }

    Alert.alert(
      'Clear Read History',
      `This will clear ${stats.totalRead} read article${stats.totalRead !== 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await readStatusService.clearAll();
              await loadStats();
              Alert.alert('Success', 'Read history cleared successfully.');
            } catch (error) {
              console.error('[SettingsScreen] Failed to clear history:', error);
              Alert.alert('Error', 'Failed to clear read history. Please try again.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleRunCleanup = async () => {
    setIsRunningCleanup(true);
    try {
      const removed = await readStatusService.cleanup();
      await loadStats();

      if (removed === 0) {
        Alert.alert('Cleanup Complete', 'No old entries found to remove.');
      } else {
        Alert.alert(
          'Cleanup Complete',
          `Removed ${removed} article${removed !== 1 ? 's' : ''} older than 90 days.`
        );
      }
    } catch (error) {
      console.error('[SettingsScreen] Cleanup failed:', error);
      Alert.alert('Error', 'Failed to run cleanup. Please try again.');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const formatDate = (isoString: string | null): string => {
    if (!isoString) return 'N/A';

    const date = new Date(isoString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return 'Today';
    if (daysDiff === 1) return 'Yesterday';
    if (daysDiff < 7) return `${daysDiff} days ago`;
    if (daysDiff < 30) return `${Math.floor(daysDiff / 7)} weeks ago`;
    if (daysDiff < 90) return `${Math.floor(daysDiff / 30)} months ago`;
    return `${daysDiff} days ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} testID="back-button">
            <Ionicons name="chevron-back" size={24} color="#8E2DE2" />
          </TouchableOpacity>
          <TechnicolorText text="settings" style={styles.title} />
        </View>
      </View>
      <View style={styles.divider} />

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Read History Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Read History</Text>
          <Text style={styles.sectionDescription}>
            You have tracked {stats.totalRead} read article{stats.totalRead !== 1 ? 's' : ''}
            {stats.oldestEntry && ` (oldest from ${formatDate(stats.oldestEntry)})`}
          </Text>

          {/* Clear Read History Button */}
          <TouchableOpacity
            style={[
              styles.button,
              (isClearing || stats.totalRead === 0) && styles.buttonDisabled,
            ]}
            onPress={handleClearHistory}
            disabled={isClearing || stats.totalRead === 0}
          >
            {isClearing ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Clear Read History</Text>
            )}
          </TouchableOpacity>

          {/* Clean Up Old Entries Button */}
          <TouchableOpacity
            style={[styles.buttonSecondary, isRunningCleanup && styles.buttonDisabled]}
            onPress={handleRunCleanup}
            disabled={isRunningCleanup}
          >
            {isRunningCleanup ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Text style={styles.buttonTextSecondary}>Clean Up Old Entries (90+ days)</Text>
            )}
          </TouchableOpacity>

          {/* Info Text */}
          <Text style={styles.infoText}>
            Articles older than 90 days are automatically cleaned up weekly. Manual cleanup removes
            them immediately.
          </Text>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Read Tracking</Text>
          <Text style={styles.aboutText}>
            Read status is stored locally on your device. Articles are marked as read when you start
            listening to them. Entries older than 90 days are automatically removed to save storage
            space.
          </Text>
        </View>
      </ScrollView>
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
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#8E2DE2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonTextSecondary: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 8,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  aboutText: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
});
