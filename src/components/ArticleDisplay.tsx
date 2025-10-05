import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RSSItem } from '../services/rssParser';

interface ArticleDisplayProps {
  article: RSSItem | null;
  currentSpeed?: number;
}

export const ArticleDisplay: React.FC<ArticleDisplayProps> = ({ article, currentSpeed = 1.0 }) => {
  if (!article) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No article loaded</Text>
      </View>
    );
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.sourceTag}>
          <Ionicons name="newspaper-outline" size={16} color="#007AFF" />
          <Text style={styles.sourceText}>RSS Feed</Text>
        </View>

        {currentSpeed !== 1.0 && (
          <View style={styles.speedIndicator}>
            <Text style={styles.speedIndicatorText}>Playing at {currentSpeed}x</Text>
          </View>
        )}
      </View>

      {/* Article Title */}
      <Text style={styles.title}>{article.title}</Text>

      {/* Meta Information */}
      <View style={styles.meta}>
        {article.author && (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color="#666" />
            <Text style={styles.metaText}>{article.author}</Text>
          </View>
        )}

        {article.pubDate && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.metaText}>{formatDate(article.pubDate)}</Text>
          </View>
        )}
      </View>

      {/* Article Preview */}
      <View style={styles.contentContainer}>
        <Text style={styles.contentLabel}>Content Preview</Text>
        <Text style={styles.content} numberOfLines={10} ellipsizeMode="tail">
          {article.plainText}
        </Text>
      </View>

      {/* Statistics */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Ionicons name="text-outline" size={20} color="#007AFF" />
          <Text style={styles.statLabel}>Words</Text>
          <Text style={styles.statValue}>
            {article.plainText.split(' ').filter(word => word.length > 0).length}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={20} color="#007AFF" />
          <Text style={styles.statLabel}>Est. Time</Text>
          <Text style={styles.statValue}>
            {Math.ceil(article.plainText.split(' ').length / (150 * currentSpeed))} min
          </Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="language-outline" size={20} color="#007AFF" />
          <Text style={styles.statLabel}>Language</Text>
          <Text style={styles.statValue}>ES</Text>
        </View>
      </View>

      {/* Link Reference */}
      {article.link && (
        <View style={styles.linkContainer}>
          <Ionicons name="link-outline" size={16} color="#007AFF" />
          <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">
            {article.link}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sourceText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  speedIndicator: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  speedIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    lineHeight: 32,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  contentContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  contentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  linkText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#007AFF',
    flex: 1,
  },
});