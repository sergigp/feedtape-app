import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReadStatusData, ReadArticleInfo } from '../types';

/**
 * ReadStatusService - Client-side read/unread article tracking
 *
 * Manages article read status using AsyncStorage for persistence
 * and an in-memory Set for fast lookups.
 *
 * Features:
 * - Persistent storage across app sessions
 * - Automatic cleanup of entries older than 90 days
 * - O(1) read status lookups via in-memory cache
 * - Manual clear/cleanup via Settings screen
 */
class ReadStatusService {
  private readArticlesCache: Set<string> = new Set();
  private isInitialized = false;

  // Storage configuration
  private readonly STORAGE_KEY = '@feedtape:read_status_v1';
  private readonly CLEANUP_AGE_DAYS = 90;
  private readonly CLEANUP_CHECK_INTERVAL_DAYS = 7;

  /**
   * Initialize service - load read status from AsyncStorage
   * Must be called once at app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[ReadStatusService] Already initialized');
      return;
    }

    try {
      console.log('[ReadStatusService] Initializing...');
      await this.loadFromStorage();

      // Check if cleanup is needed (every 7 days)
      if (await this.shouldRunCleanup()) {
        console.log('[ReadStatusService] Running automatic cleanup...');
        await this.performCleanup();
      }

      this.isInitialized = true;
      console.log(`[ReadStatusService] Initialized with ${this.readArticlesCache.size} read articles`);
    } catch (error) {
      console.error('[ReadStatusService] Initialization failed:', error);
      // Continue with empty cache - app still works
      this.isInitialized = true;
    }
  }

  /**
   * Mark an article as read
   * Updates both in-memory cache and AsyncStorage
   */
  async markAsRead(articleLink: string, feedId?: string, title?: string): Promise<void> {
    try {
      // Optimistic update - add to cache immediately
      this.readArticlesCache.add(articleLink);

      // Load current data from storage
      const data = await this.loadFromStorage();

      // Add new entry
      data.articles[articleLink] = {
        readAt: new Date().toISOString(),
        feedId,
        title,
      };

      // Update metadata
      data.metadata.totalEntries = Object.keys(data.articles).length;

      // Save back to storage
      await this.saveToStorage(data);

      console.log(`[ReadStatusService] Marked as read: ${title || articleLink}`);
    } catch (error) {
      console.error('[ReadStatusService] Failed to mark as read:', error);
      // Keep in cache anyway - user sees it as read this session
    }
  }

  /**
   * Check if an article is read (synchronous)
   * Fast O(1) lookup from in-memory cache
   */
  isRead(articleLink: string): boolean {
    return this.readArticlesCache.has(articleLink);
  }

  /**
   * Get read status for multiple articles (batch lookup)
   * Returns Map for efficient lookups in FeedList
   */
  getBulkReadStatus(articleLinks: string[]): Map<string, boolean> {
    const statusMap = new Map<string, boolean>();
    articleLinks.forEach(link => {
      statusMap.set(link, this.readArticlesCache.has(link));
    });
    return statusMap;
  }

  /**
   * Clear all read status (manual from Settings)
   */
  async clearAll(): Promise<void> {
    try {
      console.log('[ReadStatusService] Clearing all read history...');

      // Clear in-memory cache
      this.readArticlesCache.clear();

      // Delete from AsyncStorage
      await AsyncStorage.removeItem(this.STORAGE_KEY);

      console.log('[ReadStatusService] Read history cleared');
    } catch (error) {
      console.error('[ReadStatusService] Failed to clear history:', error);
      throw error;
    }
  }

  /**
   * Run cleanup manually (from Settings)
   * Returns number of entries removed
   */
  async cleanup(): Promise<number> {
    try {
      console.log('[ReadStatusService] Running manual cleanup...');
      return await this.performCleanup();
    } catch (error) {
      console.error('[ReadStatusService] Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get statistics for Settings screen
   */
  async getStats(): Promise<{ totalRead: number; oldestEntry: string | null }> {
    try {
      const data = await this.loadFromStorage();
      const articles = Object.values(data.articles);

      if (articles.length === 0) {
        return { totalRead: 0, oldestEntry: null };
      }

      // Find oldest entry
      const oldestEntry = articles.reduce((oldest, article) => {
        return new Date(article.readAt) < new Date(oldest.readAt) ? article : oldest;
      });

      return {
        totalRead: articles.length,
        oldestEntry: oldestEntry.readAt,
      };
    } catch (error) {
      console.error('[ReadStatusService] Failed to get stats:', error);
      return { totalRead: 0, oldestEntry: null };
    }
  }

  /**
   * Load read status from AsyncStorage into memory
   */
  private async loadFromStorage(): Promise<ReadStatusData> {
    try {
      const jsonString = await AsyncStorage.getItem(this.STORAGE_KEY);

      if (!jsonString) {
        // No data yet - return empty structure
        return this.createEmptyData();
      }

      const data: ReadStatusData = JSON.parse(jsonString);

      // Build in-memory cache from stored data
      this.readArticlesCache = new Set(Object.keys(data.articles));

      return data;
    } catch (error) {
      console.error('[ReadStatusService] Failed to load from storage:', error);
      return this.createEmptyData();
    }
  }

  /**
   * Save read status data to AsyncStorage
   */
  private async saveToStorage(data: ReadStatusData): Promise<void> {
    try {
      const jsonString = JSON.stringify(data);
      await AsyncStorage.setItem(this.STORAGE_KEY, jsonString);
    } catch (error) {
      console.error('[ReadStatusService] Failed to save to storage:', error);
      throw error;
    }
  }

  /**
   * Check if automatic cleanup should run
   * Returns true if more than CLEANUP_CHECK_INTERVAL_DAYS have passed
   */
  private async shouldRunCleanup(): Promise<boolean> {
    try {
      const data = await this.loadFromStorage();

      if (!data.metadata?.lastCleanup) {
        return true; // First run ever
      }

      const lastCleanup = new Date(data.metadata.lastCleanup);
      const daysSince = (Date.now() - lastCleanup.getTime()) / (1000 * 60 * 60 * 24);

      return daysSince >= this.CLEANUP_CHECK_INTERVAL_DAYS;
    } catch (error) {
      console.error('[ReadStatusService] Failed to check cleanup status:', error);
      return false;
    }
  }

  /**
   * Remove entries older than CLEANUP_AGE_DAYS
   * Returns number of entries removed
   */
  private async performCleanup(): Promise<number> {
    try {
      const data = await this.loadFromStorage();
      const cutoffDate = new Date(Date.now() - this.CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000);

      let removedCount = 0;

      // Filter out old entries
      Object.entries(data.articles).forEach(([link, info]) => {
        if (new Date(info.readAt) < cutoffDate) {
          delete data.articles[link];
          this.readArticlesCache.delete(link);
          removedCount++;
        }
      });

      // Update metadata
      data.metadata = {
        ...data.metadata,
        lastCleanup: new Date().toISOString(),
        totalEntries: Object.keys(data.articles).length,
      };

      // Save cleaned data
      await this.saveToStorage(data);

      console.log(`[ReadStatusService] Cleanup complete: removed ${removedCount} old entries`);
      return removedCount;
    } catch (error) {
      console.error('[ReadStatusService] Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Create empty data structure
   */
  private createEmptyData(): ReadStatusData {
    return {
      articles: {},
      metadata: {
        lastCleanup: new Date().toISOString(),
        version: 1,
        totalEntries: 0,
      },
    };
  }
}

// Export singleton instance
export default new ReadStatusService();
