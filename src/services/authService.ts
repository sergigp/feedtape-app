import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { TokenResponse, User } from '../types';
import { ApiClient } from './apiClient';
import { API_BASE_URL } from '../config/env';

const TOKEN_KEY = 'feedtape_access_token';
const REFRESH_TOKEN_KEY = 'feedtape_refresh_token';

// Required for OAuth flow to work properly
WebBrowser.maybeCompleteAuthSession();

class AuthService {
  // Store tokens securely
  async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      ApiClient.setTokens(accessToken, refreshToken);
      console.log('[AuthService] Tokens stored successfully');
    } catch (error) {
      console.error('[AuthService] Failed to store tokens:', error);
      throw error;
    }
  }

  // Retrieve stored tokens
  async getStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    try {
      const accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      return { accessToken, refreshToken };
    } catch (error) {
      console.error('[AuthService] Failed to retrieve tokens:', error);
      return { accessToken: null, refreshToken: null };
    }
  }

  // Clear stored tokens
  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      ApiClient.setTokens(null, null);
      console.log('[AuthService] Tokens cleared');
    } catch (error) {
      console.error('[AuthService] Failed to clear tokens:', error);
    }
  }

  // Initiate GitHub OAuth flow
  async loginWithGitHub(): Promise<TokenResponse> {
    try {
      const authUrl = `${API_BASE_URL}/auth/oauth/github?mobile=true`;

      console.log('[AuthService] Opening GitHub OAuth flow');
      console.log('[AuthService] OAuth URL:', authUrl);

      // Open the OAuth URL using auth session (designed for OAuth flows)
      console.log('[AuthService] Opening auth session...');
      let authResult;
      try {
        authResult = await WebBrowser.openAuthSessionAsync(
          authUrl,
          'feedtape://auth/callback'
        );
        console.log('[AuthService] Auth session result:', authResult);

        // Check the result type
        if (authResult.type === 'cancel') {
          throw new Error('User cancelled authentication');
        }

        if (authResult.type === 'dismiss') {
          throw new Error('Authentication dismissed');
        }

        if (authResult.type !== 'success') {
          throw new Error(`Unexpected auth result type: ${authResult.type}`);
        }

        // Parse tokens from the result URL
        const resultUrl = new URL(authResult.url);
        const token = resultUrl.searchParams.get('token');
        const refreshToken = resultUrl.searchParams.get('refresh_token');
        const expiresIn = resultUrl.searchParams.get('expires_in');

        if (!token || !refreshToken) {
          throw new Error('No tokens received from OAuth callback');
        }

        const tokenResponse: TokenResponse = {
          token,
          refresh_token: refreshToken,
          expires_in: expiresIn ? parseInt(expiresIn, 10) : 3600,
        };

        await this.storeTokens(token, refreshToken);
        return tokenResponse;

      } catch (authError: any) {
        console.error('[AuthService] Auth session error:', authError);
        throw new Error(`Failed to authenticate: ${authError.message}`);
      }
    } catch (error) {
      console.error('[AuthService] GitHub login failed:', error);
      throw error;
    }
  }

  // Get current user info
  async getCurrentUser(): Promise<User> {
    try {
      const user = await ApiClient.get<User>('/api/me');
      return user;
    } catch (error) {
      console.error('[AuthService] Failed to get current user:', error);
      throw error;
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      const { refreshToken } = await this.getStoredTokens();

      if (refreshToken) {
        // Call logout endpoint
        await ApiClient.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('[AuthService] Logout API call failed:', error);
      // Continue with local cleanup even if API call fails
    } finally {
      await this.clearTokens();
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const { accessToken, refreshToken } = await this.getStoredTokens();
    return !!(accessToken && refreshToken);
  }

  // Initialize auth state (call on app startup)
  async initialize(): Promise<boolean> {
    try {
      const { accessToken, refreshToken } = await this.getStoredTokens();

      if (!accessToken || !refreshToken) {
        return false;
      }

      ApiClient.setTokens(accessToken, refreshToken);

      // Verify tokens are still valid by fetching user info
      await this.getCurrentUser();
      return true;
    } catch (error) {
      console.error('[AuthService] Token validation failed:', error);
      await this.clearTokens();
      return false;
    }
  }
}

export default new AuthService();
