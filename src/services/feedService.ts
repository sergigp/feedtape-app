import { Feed } from '../types';
import { ApiClient } from './apiClient';

class FeedService {
  // Get all feeds for the current user
  async getFeeds(): Promise<Feed[]> {
    try {
      console.log('[FeedService] Fetching feeds');
      const feeds = await ApiClient.get<Feed[]>('/api/feeds');
      console.log(`[FeedService] Retrieved ${feeds.length} feeds`);
      return feeds;
    } catch (error) {
      console.error('[FeedService] Failed to fetch feeds:', error);
      throw error;
    }
  }

  // Add a new feed
  async addFeed(id: string, url: string, title: string): Promise<void> {
    try {
      console.log('[FeedService] Adding feed:', { id, url, title });
      await ApiClient.post('/api/feeds', { id, url, title });
      console.log('[FeedService] Feed added successfully');
    } catch (error) {
      console.error('[FeedService] Failed to add feed:', error);
      throw error;
    }
  }

  // Update a feed's title
  async updateFeed(feedId: string, title: string): Promise<void> {
    try {
      console.log('[FeedService] Updating feed:', { feedId, title });
      await ApiClient.put(`/api/feeds/${feedId}`, { title });
      console.log('[FeedService] Feed updated successfully');
    } catch (error) {
      console.error('[FeedService] Failed to update feed:', error);
      throw error;
    }
  }

  // Delete a feed
  async deleteFeed(feedId: string): Promise<void> {
    try {
      console.log('[FeedService] Deleting feed:', feedId);
      await ApiClient.delete(`/api/feeds/${feedId}`);
      console.log('[FeedService] Feed deleted successfully');
    } catch (error) {
      console.error('[FeedService] Failed to delete feed:', error);
      throw error;
    }
  }
}

export default new FeedService();
