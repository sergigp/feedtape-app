import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import App from '../../App';
import * as SecureStore from 'expo-secure-store';
import { resetMockData, mockFeeds } from '../mocks/handlers';
import { server } from '../mocks/server';
import { rest } from 'msw';

describe('Feed Management Integration Tests', () => {
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    (SecureStore as any).__resetStorage();
    resetMockData();
    (Alert.alert as jest.Mock).mockClear();

    // Pre-authenticate user
    await SecureStore.setItemAsync('feedtape_access_token', 'mock-access-token-abc123');
    await SecureStore.setItemAsync('feedtape_refresh_token', 'mock-refresh-token-xyz789');
  });

  describe('View Feeds', () => {
    it('should display list of feeds after authentication', async () => {
      render(<App />);

      // Wait for splash screen to pass and feeds to load
      await waitFor(
        () => {
          // Should show feed items
          expect(screen.queryByText(/test feed 1/i)).toBeTruthy();
          expect(screen.queryByText(/test feed 2/i)).toBeTruthy();
        },
        { timeout: 5000 }
      );
    });

    it('should show empty state when no feeds exist', async () => {
      // Override mock to return empty feeds
      server.use(
        rest.get('https://delightful-freedom-production.up.railway.app/api/feeds', (req, res, ctx) => {
          return res(ctx.json([]));
        })
      );

      render(<App />);

      // Wait for splash and loading
      await waitFor(
        () => {
          expect(screen.queryByText(/no feeds yet/i)).toBeTruthy();
          expect(screen.queryByText(/add your first rss feed/i)).toBeTruthy();
        },
        { timeout: 5000 }
      );
    });

    it('should handle API error when fetching feeds', async () => {
      // Mock API error
      server.use(
        rest.get('https://delightful-freedom-production.up.railway.app/api/feeds', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Internal server error' }));
        })
      );

      render(<App />);

      // Should show error alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to load feeds')
        );
      });
    });
  });

  describe('Select Feed and View Articles', () => {
    it('should fetch RSS feed and display articles when feed is selected', async () => {
      render(<App />);

      // Wait for feeds to load
      await waitFor(
        () => {
          expect(screen.queryByText(/test feed 1/i)).toBeTruthy();
        },
        { timeout: 5000 }
      );

      // Select first feed
      const feed1 = screen.getByText(/test feed 1/i);
      fireEvent.press(feed1);

      // Should show articles from RSS feed
      await waitFor(
        () => {
          expect(screen.queryByText(/test article 1/i)).toBeTruthy();
          expect(screen.queryByText(/test article 2/i)).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should handle RSS fetch failure gracefully', async () => {
      // Mock RSS fetch to fail
      server.use(
        rest.get('https://example.com/feed.xml', (req, res, ctx) => {
          return res(ctx.status(500), ctx.text('Invalid XML'));
        })
      );

      render(<App />);

      // Wait for feeds to load
      await waitFor(
        () => {
          expect(screen.queryByText(/test feed 1/i)).toBeTruthy();
        },
        { timeout: 5000 }
      );

      // Select first feed
      const feed1 = screen.getByText(/test feed 1/i);
      fireEvent.press(feed1);

      // Should show error alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error Loading Feed',
          expect.stringContaining('Failed to load articles')
        );
      });
    });

    it('should navigate back to feed list when back button is pressed', async () => {
      render(<App />);

      // Wait for feeds to load
      await waitFor(
        () => {
          expect(screen.queryByText(/test feed 1/i)).toBeTruthy();
        },
        { timeout: 5000 }
      );

      // Select feed to navigate to track list
      const feed1 = screen.getByText(/test feed 1/i);
      fireEvent.press(feed1);

      // Wait for articles to load
      await waitFor(
        () => {
          expect(screen.queryByText(/test article 1/i)).toBeTruthy();
        },
        { timeout: 3000 }
      );

      // Press back button (look for back icon)
      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      // Should navigate back to feed list
      await waitFor(() => {
        expect(screen.queryByText(/test feed 1/i)).toBeTruthy();
        expect(screen.queryByText(/test article 1/i)).toBeNull();
      });
    });
  });

  describe('Refresh Feeds', () => {
    it('should reload feeds when refresh button is pressed', async () => {
      let callCount = 0;

      // Count API calls
      server.use(
        rest.get('https://delightful-freedom-production.up.railway.app/api/feeds', (req, res, ctx) => {
          callCount++;
          return res(ctx.json(mockFeeds));
        })
      );

      render(<App />);

      // Wait for initial load
      await waitFor(
        () => {
          expect(screen.queryByText(/test feed 1/i)).toBeTruthy();
        },
        { timeout: 5000 }
      );

      const initialCallCount = callCount;

      // Find and press refresh button
      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.press(refreshButton);

      // Should trigger another API call
      await waitFor(() => {
        expect(callCount).toBeGreaterThan(initialCallCount);
      });
    });
  });
});
