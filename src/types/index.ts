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

export interface TtsRequest {
  text: string;
  language?: 'auto' | 'es' | 'en' | 'fr' | 'de' | 'pt' | 'it';
  voice?: string;
  speed?: number;
  quality?: 'standard' | 'neural';
}
