import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Post, FeedLoadState, Feed } from '../types';
import feedService from '../services/feedService';
import { parseRSSPost } from '../services/rssParser';
import contentCleaningService from '../services/contentCleaningService';

interface PostsContextType {
  posts: Post[];
  isLoading: boolean;
  feedStates: Map<string, FeedLoadState>;
  initializeFeeds: () => Promise<void>;
  retryFeed: (feedId: string) => Promise<void>;
  getFeedState: (feedId: string) => FeedLoadState | undefined;
  updatePost: (post: Post) => void;
  getPostsByFeed: (feedId: string) => Post[];
  clearPosts: () => void;
}

const PostsContext = createContext<PostsContextType | undefined>(undefined);

export const usePosts = () => {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePosts must be used within a PostsProvider');
  }
  return context;
};

interface PostsProviderProps {
  children: ReactNode;
}

// Concurrency control constants - Worker pool pattern at both levels
const FEED_BATCH_SIZE = 5;  // Feed worker pool: 5 workers pulling feeds from queue
const POST_BATCH_SIZE = 5;  // Post worker pool: 5 workers per feed pulling posts from queue
// Total max concurrency: 5 feed workers × 5 post workers = 25 operations

export const PostsProvider: React.FC<PostsProviderProps> = ({ children }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Performance: Use Map for O(1) post lookups by link
  const [postIndexMap, setPostIndexMap] = useState<Map<string, number>>(new Map());
  // Track loading state for each feed
  const [feedStates, setFeedStates] = useState<Map<string, FeedLoadState>>(new Map());

  // Update a single feed's state
  const updateFeedState = (feedId: string, update: Partial<FeedLoadState>) => {
    setFeedStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(feedId) || { feedId, status: 'idle' as const };
      newStates.set(feedId, { ...current, ...update });
      return newStates;
    });
  };

  // Add posts incrementally (per feed)
  const addPosts = (newPosts: Post[]) => {
    // Update posts and index map together to avoid race conditions
    setPosts(prev => {
      const newPostsArray = [...prev, ...newPosts];

      // Rebuild entire index map from scratch to ensure consistency
      setPostIndexMap(() => {
        const newMap = new Map<string, number>();
        newPostsArray.forEach((post, index) => {
          newMap.set(post.link, index);
        });
        return newMap;
      });

      return newPostsArray;
    });
  };

  // Get feed state (exposed to consumers)
  const getFeedState = (feedId: string): FeedLoadState | undefined => {
    return feedStates.get(feedId);
  };

  // Retry a failed feed
  const retryFeed = async (feedId: string) => {
    console.log(`[PostsContext] Retrying feed ${feedId}`);

    // Remove old posts for this feed
    setPosts(prev => {
      const filtered = prev.filter(p => p.feedId !== feedId);

      // Rebuild index map without this feed's posts
      setPostIndexMap(prevMap => {
        const newMap = new Map<string, number>();
        filtered.forEach((post, i) => {
          newMap.set(post.link, i);
        });
        return newMap;
      });

      return filtered;
    });

    // Find feed metadata and retry processing
    try {
      const feeds = await feedService.getFeeds();
      const feed = feeds.find(f => f.id === feedId);

      if (!feed) {
        throw new Error('Feed not found');
      }

      await processFeedProgressive(feed);
    } catch (error) {
      console.error(`[PostsContext] Retry failed for feed ${feedId}:`, error);
      updateFeedState(feedId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to retry feed'
      });
    }
  };

  // Process all posts for a single feed with worker pool pattern
  // Uses a queue with concurrent workers for better throughput
  const processPostsForFeed = async (
    feedPosts: Post[],
    onUpdate: (post: Post) => void
  ): Promise<void> => {
    const queue = [...feedPosts];

    // Create worker pool: each worker continuously processes from queue
    // As soon as a worker finishes, it grabs the next post (no waiting for slow posts)
    const workers = Array.from({ length: POST_BATCH_SIZE }, async () => {
      while (queue.length > 0) {
        const post = queue.shift();
        if (!post) break;

        try {
          // Clean the post
          const cleanedContent = contentCleaningService.cleanContent(post.rawContent);

          // Update post with cleaned content
          const updatedPost = {
            ...post,
            cleanedContent,
            status: 'cleaned' as const,
          };

          onUpdate(updatedPost);
        } catch (error) {
          console.error(`[PostsContext] Failed to clean post ${post.link}:`, error);

          const errorPost = {
            ...post,
            status: 'error' as const,
          };

          onUpdate(errorPost);
        }
      }
    });

    // Wait for all workers to complete
    await Promise.all(workers);
  };

  // Process a single feed progressively through all states
  const processFeedProgressive = async (feed: Feed) => {
    console.log(`[PostsContext] Processing feed: ${feed.title}`);

    // Step 1: Mark as 'fetching'
    updateFeedState(feed.id, { status: 'fetching' });

    try {
      // Step 2: Fetch RSS with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Feed fetch timeout')), 15000);
      });

      const xmlContent = await Promise.race([
        feedService.fetchRSSContent(feed.url),
        timeoutPromise
      ]);

      // Step 3: Parse RSS with 15-item limit
      const parsedPosts = parseRSSPost(xmlContent, { maxItems: 15 });
      console.log(`[PostsContext] Parsed ${parsedPosts.length} posts from ${feed.title}`);

      // Step 4: Convert to Post objects with state machine fields
      const feedPosts = parsedPosts.map(parsed => ({
        ...parsed,
        feedId: feed.id,
        rawContent: parsed.content,
        cleanedContent: null,
        status: 'raw' as const,
      }));

      // Step 5: Add to state incrementally
      addPosts(feedPosts);

      // Step 6: Handle empty feeds (all posts filtered out by date)
      if (feedPosts.length === 0) {
        console.log(`[PostsContext] Feed ${feed.title} has no recent posts, marking as ready`);
        updateFeedState(feed.id, { status: 'ready' });
        return;
      }

      // Step 7: Mark as 'processing' with progress
      updateFeedState(feed.id, {
        status: 'processing',
        progress: { total: feedPosts.length, cleaned: 0 }
      });

      // Step 8: Start PER-FEED pipeline for this feed's posts
      await processPostsForFeed(feedPosts, updatePost);

    } catch (error) {
      console.error(`[PostsContext] Feed ${feed.id} failed:`, error);
      updateFeedState(feed.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load feed'
      });
    }
  };

  const initializeFeeds = async () => {
    // Prevent concurrent calls
    if (isLoading) {
      console.log('[PostsContext] Already loading, skipping duplicate initialization');
      return;
    }

    console.log('[PostsContext] Starting feed initialization');
    setIsLoading(true);

    try {
      // 1. Fetch feed metadata from backend (fast)
      const feeds = await feedService.getFeeds();
      console.log(`[PostsContext] Fetched ${feeds.length} feeds from backend`);

      // 2. Initialize all feeds to 'idle' state immediately
      const initialStates = new Map<string, FeedLoadState>();
      feeds.forEach(feed => {
        initialStates.set(feed.id, { feedId: feed.id, status: 'idle' });
      });
      setFeedStates(initialStates);
      setIsLoading(false);  // ← Feeds now visible in UI!

      // 3. Process feeds with worker pool pattern
      // Create queue and spawn FEED_BATCH_SIZE workers
      // Each worker continuously processes feeds from queue
      const feedQueue = [...feeds];

      const feedWorkers = Array.from({ length: FEED_BATCH_SIZE }, async (_, workerIndex) => {
        console.log(`[PostsContext] Feed worker ${workerIndex + 1} started`);

        while (feedQueue.length > 0) {
          const feed = feedQueue.shift();
          if (!feed) break;

          console.log(`[PostsContext] Worker ${workerIndex + 1} processing: ${feed.title}`);
          await processFeedProgressive(feed);
        }

        console.log(`[PostsContext] Feed worker ${workerIndex + 1} finished`);
      });

      await Promise.all(feedWorkers);
      console.log('[PostsContext] All feeds processed');
    } catch (error) {
      console.error('[PostsContext] Failed to initialize feeds:', error);
      setIsLoading(false);
    }
  };

  // Update a single post by link (unique identifier)
  const updatePost = (updatedPost: Post) => {
    setPosts(prevPosts => {
      // Find post index - use map for O(1) lookup, fallback to O(n) search if map not ready
      let index = postIndexMap.get(updatedPost.link);

      if (index === undefined) {
        // Map not updated yet due to async state updates - search the array
        index = prevPosts.findIndex(p => p.link === updatedPost.link);

        if (index === -1) {
          // Post truly not found - log warning but continue processing
          console.warn('[PostsContext] updatePost called for unknown post:', updatedPost.link);
          return prevPosts;  // No change
        }
      }

      // Create new array with updated post (immutable update)
      const newPosts = [...prevPosts];
      newPosts[index] = updatedPost;
      return newPosts;
    });

    // Track feed completion progress using functional updates to avoid race conditions
    if (updatedPost.status === 'cleaned' || updatedPost.status === 'error') {
      setFeedStates(prevStates => {
        const feedState = prevStates.get(updatedPost.feedId);

        // Only update if feed is in processing state with progress tracking
        if (feedState?.status === 'processing' && feedState.progress) {
          const progress = feedState.progress;
          const newCleaned = progress.cleaned + 1;
          const newStates = new Map(prevStates);

          if (newCleaned >= progress.total) {
            // All posts processed, mark feed as ready
            console.log(`[PostsContext] Feed ${updatedPost.feedId} is ready (${newCleaned}/${progress.total} posts cleaned)`);
            newStates.set(updatedPost.feedId, {
              feedId: updatedPost.feedId,
              status: 'ready'
            });
          } else {
            // Update progress
            console.log(`[PostsContext] Feed ${updatedPost.feedId} progress: ${newCleaned}/${progress.total} posts cleaned`);
            newStates.set(updatedPost.feedId, {
              feedId: updatedPost.feedId,
              status: 'processing',
              progress: { total: progress.total, cleaned: newCleaned }
            });
          }

          return newStates;
        }

        // No update needed, return previous state
        return prevStates;
      });
    }
  };

  // Get all posts for a specific feed
  const getPostsByFeed = (feedId: string): Post[] => {
    return posts.filter(post => post.feedId === feedId);
  };

  // Clear all posts (called on logout)
  const clearPosts = () => {
    console.log('[PostsContext] Clearing all posts');
    setPosts([]);
    setPostIndexMap(new Map());
    setIsLoading(false);
  };

  const value: PostsContextType = {
    posts,
    isLoading,
    feedStates,
    initializeFeeds,
    retryFeed,
    getFeedState,
    updatePost,
    getPostsByFeed,
    clearPosts,
  };

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
};
