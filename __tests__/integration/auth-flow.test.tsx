import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import App from '../../App';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { resetMockData } from '../mocks/handlers';
import { server } from '../mocks/server';
import { rest } from 'msw';

describe('Auth Flow Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks between tests
    jest.clearAllMocks();
    (SecureStore as any).__resetStorage();
    resetMockData();
  });

  describe('Initial App Load - No Stored Tokens', () => {
    it('should show login screen when no tokens are stored', async () => {
      // Render the app
      render(<App />);

      // Wait for auth initialization to complete and login screen to appear
      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });
    });
  });

  describe('GitHub OAuth Login Flow', () => {
    it('should successfully login, store tokens, and navigate to feed list', async () => {
      // Mock successful OAuth flow
      (WebBrowser as any).__mockSuccessfulAuth(
        'mock-access-token-abc123',
        'mock-refresh-token-xyz789'
      );

      // Render the app
      render(<App />);

      // Wait for login screen
      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });

      // Tap login button
      const loginButton = screen.getByText(/continue with github/i);
      fireEvent.press(loginButton);

      // Verify login was successful by waiting for feed list
      await waitFor(
        () => {
          // Should show feed list (either loading or feed items)
          const loadingText = screen.queryByText(/loading feeds/i);
          const noFeedsText = screen.queryByText(/no feeds yet/i);
          expect(loadingText || noFeedsText).toBeTruthy();
        },
        { timeout: 5000 }
      );

      // Verify tokens were stored
      const storedTokens = (SecureStore as any).__getStorage();
      expect(storedTokens['feedtape_access_token']).toBe('mock-access-token-abc123');
      expect(storedTokens['feedtape_refresh_token']).toBe('mock-refresh-token-xyz789');
    });

    it('should handle cancelled OAuth flow gracefully', async () => {
      // Mock cancelled OAuth
      (WebBrowser as any).__mockCancelledAuth();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });

      const loginButton = screen.getByText(/continue with github/i);
      fireEvent.press(loginButton);

      // Should still show login screen (auth failed)
      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });

      // Should NOT store any tokens
      const storedTokens = (SecureStore as any).__getStorage();
      expect(storedTokens['feedtape_access_token']).toBeUndefined();
    });

    it('should handle dismissed OAuth flow gracefully', async () => {
      // Mock dismissed OAuth
      (WebBrowser as any).__mockDismissedAuth();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });

      const loginButton = screen.getByText(/continue with github/i);
      fireEvent.press(loginButton);

      // Should still show login screen
      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });

      // Should NOT store any tokens
      const storedTokens = (SecureStore as any).__getStorage();
      expect(storedTokens['feedtape_access_token']).toBeUndefined();
    });
  });

  describe('Auto-Authentication with Stored Tokens', () => {
    it('should auto-authenticate when valid tokens exist', async () => {
      // Pre-populate SecureStore with valid tokens
      await SecureStore.setItemAsync('feedtape_access_token', 'mock-access-token-abc123');
      await SecureStore.setItemAsync('feedtape_refresh_token', 'mock-refresh-token-xyz789');

      render(<App />);

      // Should NOT show login screen
      await waitFor(() => {
        expect(screen.queryByText(/continue with github/i)).toBeNull();
      });

      // Should show feed list after splash
      await waitFor(
        () => {
          const loadingText = screen.queryByText(/loading feeds/i);
          const noFeedsText = screen.queryByText(/no feeds yet/i);
          expect(loadingText || noFeedsText).toBeTruthy();
        },
        { timeout: 5000 }
      );
    });

    it('should logout and show login screen when stored tokens are invalid', async () => {
      // Pre-populate with invalid tokens
      await SecureStore.setItemAsync('feedtape_access_token', 'invalid-token');
      await SecureStore.setItemAsync('feedtape_refresh_token', 'invalid-refresh-token');

      // Mock API to return 401 for invalid token
      server.use(
        rest.get('https://delightful-freedom-production.up.railway.app/api/me', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
        }),
        rest.post('https://delightful-freedom-production.up.railway.app/auth/refresh', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ message: 'Invalid refresh token' }));
        })
      );

      render(<App />);

      // Should clear tokens and show login screen
      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });

      // Tokens should be cleared
      const storedTokens = (SecureStore as any).__getStorage();
      expect(storedTokens['feedtape_access_token']).toBeUndefined();
      expect(storedTokens['feedtape_refresh_token']).toBeUndefined();
    });
  });

  describe('Token Refresh Flow', () => {
    it('should automatically refresh expired access token on 401', async () => {
      // Pre-populate with tokens
      await SecureStore.setItemAsync('feedtape_access_token', 'expired-access-token');
      await SecureStore.setItemAsync('feedtape_refresh_token', 'mock-refresh-token-xyz789');

      let callCount = 0;

      // Mock first call to /api/me to return 401, then succeed after refresh
      server.use(
        rest.get('https://delightful-freedom-production.up.railway.app/api/me', (req, res, ctx) => {
          callCount++;
          if (callCount === 1) {
            // First call - expired token
            return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
          }
          // Second call - after refresh
          return res(ctx.json({
            id: 'test-user-123',
            settings: { voice: 'default', language: 'en' },
            subscription: {
              tier: 'free',
              status: 'active',
              usage: {
                minutes_used_today: 10,
                minutes_limit: 60,
                characters_used_today: 5000,
                characters_limit: 50000,
                resets_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              },
              limits: { max_feeds: 10 },
            },
          }));
        })
      );

      render(<App />);

      // Should successfully authenticate after token refresh
      await waitFor(
        () => {
          const loadingText = screen.queryByText(/loading feeds/i);
          const noFeedsText = screen.queryByText(/no feeds yet/i);
          expect(loadingText || noFeedsText).toBeTruthy();
        },
        { timeout: 5000 }
      );

      // Verify refresh endpoint was called
      expect(callCount).toBeGreaterThanOrEqual(2);

      // New tokens should be stored
      const storedTokens = (SecureStore as any).__getStorage();
      expect(storedTokens['feedtape_access_token']).toBe('mock-access-token-abc123');
      expect(storedTokens['feedtape_refresh_token']).toBe('mock-refresh-token-xyz789');
    });

    it('should logout user when token refresh fails', async () => {
      // Pre-populate with tokens
      await SecureStore.setItemAsync('feedtape_access_token', 'expired-access-token');
      await SecureStore.setItemAsync('feedtape_refresh_token', 'expired-refresh-token');

      // Mock both /api/me and /auth/refresh to fail
      server.use(
        rest.get('https://delightful-freedom-production.up.railway.app/api/me', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
        }),
        rest.post('https://delightful-freedom-production.up.railway.app/auth/refresh', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ message: 'Invalid refresh token' }));
        })
      );

      render(<App />);

      // Should logout and show login screen
      await waitFor(() => {
        expect(screen.getByText(/continue with github/i)).toBeTruthy();
      });

      // Tokens should be cleared
      const storedTokens = (SecureStore as any).__getStorage();
      expect(storedTokens['feedtape_access_token']).toBeUndefined();
      expect(storedTokens['feedtape_refresh_token']).toBeUndefined();
    });
  });
});
