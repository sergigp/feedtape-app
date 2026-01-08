import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Post } from '../types';

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

  // Will be implemented in Iteration 5
  const initializeFeeds = async () => {
    console.log('[PostsContext] initializeFeeds() not yet implemented - will be added in Iteration 5');
    setIsLoading(false);
  };

  // Update a single post by link (unique identifier)
  const updatePost = (updatedPost: Post) => {
    setPosts(prevPosts => {
      const index = prevPosts.findIndex(p => p.link === updatedPost.link);
      if (index === -1) {
        // Post not found - this shouldn't happen, but log it
        console.warn('[PostsContext] updatePost called for unknown post:', updatedPost.link);
        return prevPosts;
      }

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
