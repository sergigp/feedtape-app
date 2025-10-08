import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { TokenResponse, User } from '../types';
import { ApiClient, API_BASE_URL } from './apiClient';

const TOKEN_KEY = 'feedtape_access_token';
const REFRESH_TOKEN_KEY = 'feedtape_refresh_token';

// Required for OAuth flow to work properly
WebBrowser.maybeCompleteAuthSession();

// Create a promise that resolves when deep link is received
let deepLinkResolver: ((url: string) => void) | null = null;

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
    let linkingSubscription: any = null;

    try {
      const authUrl = `${API_BASE_URL}/auth/oauth/github`;

      console.log('[AuthService] Opening GitHub OAuth flow');

      // Create a promise that resolves when we receive the deep link
      const deepLinkPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('OAuth timeout - no response received'));
        }, 300000); // 5 minute timeout

        deepLinkResolver = (url: string) => {
          clearTimeout(timeout);
          resolve(url);
        };
      });

      // Listen for deep links
      linkingSubscription = Linking.addEventListener('url', (event) => {
        console.log('[AuthService] Deep link received:', event.url);
        if (deepLinkResolver) {
          deepLinkResolver(event.url);
          deepLinkResolver = null;
        }
      });

      // Open the OAuth URL
      await WebBrowser.openBrowserAsync(authUrl);

      // Wait for the deep link callback
      const callbackUrl = await deepLinkPromise;

      // Parse tokens from the callback URL
      const url = new URL(callbackUrl);
      const token = url.searchParams.get('token');
      const refreshToken = url.searchParams.get('refresh_token');
      const expiresIn = url.searchParams.get('expires_in');

      if (!token || !refreshToken) {
        throw new Error('No tokens received from OAuth callback');
      }

      const tokenResponse: TokenResponse = {
        token,
        refresh_token: refreshToken,
        expires_in: expiresIn ? parseInt(expiresIn, 10) : 3600,
      };

      await this.storeTokens(token, refreshToken);

      // Dismiss the browser
      await WebBrowser.dismissBrowser();

      return tokenResponse;
    } catch (error) {
      console.error('[AuthService] GitHub login failed:', error);
      throw error;
    } finally {
      // Clean up the listener
      if (linkingSubscription) {
        linkingSubscription.remove();
      }
      deepLinkResolver = null;
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
