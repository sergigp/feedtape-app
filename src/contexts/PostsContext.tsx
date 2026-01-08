import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Post } from '../types';
import feedService from '../services/feedService';
import { parseRSSFeed } from '../services/rssParser';
import contentPipelineService from '../services/contentPipelineService';

interface PostsContextType {
  posts: Post[];
  isLoading: boolean;
  initializeFeeds: () => Promise<void>;
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

export const PostsProvider: React.FC<PostsProviderProps> = ({ children }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Performance: Use Map for O(1) post lookups by link
  const [postIndexMap, setPostIndexMap] = useState<Map<string, number>>(new Map());

  const initializeFeeds = async () => {
    // Prevent concurrent calls
    if (isLoading) {
      console.log('[PostsContext] Already loading, skipping duplicate initialization');
      return;
    }

    console.log('[PostsContext] Starting feed initialization');
    setIsLoading(true);

    try {
      // Fetch all feeds from backend
      const feeds = await feedService.getFeeds();
      console.log(`[PostsContext] Fetched ${feeds.length} feeds from backend`);

      // Fetch RSS content for all feeds in parallel with 15-second timeout per feed
      const feedPromises = feeds.map(async (feed) => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Feed fetch timeout')), 15000);
        });

        const fetchPromise = feedService.fetchRSSContent(feed.url).then((xmlContent) => {
          const parsedPosts = parseRSSFeed(xmlContent);
          console.log(`[PostsContext] Parsed ${parsedPosts.length} posts from ${feed.title}`);

          // Convert ParsedPost to Post with state machine fields
          return parsedPosts.map((parsed) => ({
            ...parsed,
            feedId: feed.id,
            rawContent: parsed.content,
            cleanedContent: null,
            status: 'raw' as const,
          }));
        });

        return Promise.race([fetchPromise, timeoutPromise]);
      });

      // Use Promise.allSettled to handle failures gracefully
      const results = await Promise.allSettled(feedPromises);

      // Collect successful results and log failures
      const allPosts: Post[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allPosts.push(...result.value);
        } else {
          console.error(`[PostsContext] Feed ${feeds[index].id} (${feeds[index].title}) failed:`, result.reason);
        }
      });

      console.log(`[PostsContext] Collected ${allPosts.length} posts from ${results.filter(r => r.status === 'fulfilled').length}/${feeds.length} feeds`);

      // Add posts to state and build index map
      setPosts(allPosts);
      const indexMap = new Map<string, number>();
      allPosts.forEach((post, index) => {
        indexMap.set(post.link, index);
      });
      setPostIndexMap(indexMap);
      setIsLoading(false);

      // Start pipeline processing (non-blocking)
      console.log('[PostsContext] Starting content pipeline');
      contentPipelineService.processPosts(allPosts, updatePost);
    } catch (error) {
      console.error('[PostsContext] Failed to initialize feeds:', error);
      setIsLoading(false);
    }
  };

  // Update a single post by link (unique identifier)
  const updatePost = (updatedPost: Post) => {
    // Performance: Use Map for O(1) lookup instead of O(n) findIndex
    const index = postIndexMap.get(updatedPost.link);
    if (index === undefined) {
      // Post not found - this shouldn't happen, but log it
      console.warn('[PostsContext] updatePost called for unknown post:', updatedPost.link);
      return;
    }

    setPosts(prevPosts => {
      // Create new array with updated post (immutable update)
      const newPosts = [...prevPosts];
      newPosts[index] = updatedPost;
      return newPosts;
    });
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
    initializeFeeds,
    updatePost,
    getPostsByFeed,
    clearPosts,
  };

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
};
