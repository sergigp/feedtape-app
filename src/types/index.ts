// API Response Types based on OpenAPI spec

export interface TokenResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
}

export interface UserSettings {
  voice?: string;
  language?: 'es' | 'en' | 'fr' | 'de' | 'pt' | 'it';
}

export interface SubscriptionUsage {
  minutes_used_today: number;
  minutes_limit: number;
  characters_used_today: number;
  characters_limit: number;
  resets_at: string;
}

export interface SubscriptionLimits {
  max_feeds: number;
}

export interface Subscription {
  tier: 'free' | 'pro';
  status: 'active' | 'expired' | 'cancelled';
  usage: SubscriptionUsage;
  limits: SubscriptionLimits;
}

export interface User {
  id: string;
  settings: UserSettings;
  subscription: Subscription;
}

export interface Feed {
  id: string;
  url: string;
  title?: string;
  created_at?: string;
  last_read_at?: string | null;
  posts?: Post[];  // Feed optionally contains its posts
}

export interface FeedStats {
  unreadCount: number;
  totalDuration: number;
  isLoading: boolean;
  error?: boolean;
}

export interface ApiError {
  message: string;
}

// Post Type - Individual feed item with enriched metadata
export interface Post {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  content: string;       // Raw HTML content
  plainText: string;     // Clean text for TTS
  language: string;      // BCP-47 code, always present, guaranteed 'en-US' minimum

  // Future AI enrichments (not implemented yet):
  // summary?: string;
  // headline?: string;
  // readingTime?: number;
  // sentiment?: 'positive' | 'negative' | 'neutral';
}
