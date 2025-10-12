import { rest } from 'msw';
import type { User, Feed, TokenResponse } from '../../src/types';

const API_BASE_URL = 'https://delightful-freedom-production.up.railway.app';

// Mock data
export const mockUser: User = {
  id: 'test-user-123',
  settings: {
    voice: 'default',
    language: 'en',
  },
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
    limits: {
      max_feeds: 10,
    },
  },
};

export const mockFeeds: Feed[] = [
  {
    id: 'feed-1',
    url: 'https://example.com/feed.xml',
    title: 'Test Feed 1',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'feed-2',
    url: 'https://example.com/feed2.xml',
    title: 'Test Feed 2',
    created_at: '2025-01-02T00:00:00Z',
  },
];

export const mockTokenResponse: TokenResponse = {
  token: 'mock-access-token-abc123',
  refresh_token: 'mock-refresh-token-xyz789',
  expires_in: 3600,
};

export const mockRSSContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Article 1</title>
      <link>https://example.com/article1</link>
      <pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate>
      <description><![CDATA[This is test article 1 content for TTS.]]></description>
    </item>
    <item>
      <title>Test Article 2</title>
      <link>https://example.com/article2</link>
      <pubDate>Wed, 02 Jan 2025 00:00:00 GMT</pubDate>
      <description><![CDATA[This is test article 2 content for TTS.]]></description>
    </item>
  </channel>
</rss>`;

// Request handlers
export const handlers = [
  // Auth endpoints
  rest.post(`${API_BASE_URL}/auth/refresh`, async (req, res, ctx) => {
    const body = await req.json() as any;
    if (body.refresh_token === 'mock-refresh-token-xyz789') {
      return res(ctx.json(mockTokenResponse));
    }
    return res(ctx.status(401), ctx.json({ message: 'Invalid refresh token' }));
  }),

  rest.post(`${API_BASE_URL}/auth/logout`, (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  // User endpoints
  rest.get(`${API_BASE_URL}/api/me`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }
    return res(ctx.json(mockUser));
  }),

  rest.patch(`${API_BASE_URL}/api/me`, async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }
    const body = await req.json() as any;
    const updatedUser = { ...mockUser, settings: { ...mockUser.settings, ...body } };
    return res(ctx.json(updatedUser));
  }),

  // Feed endpoints
  rest.get(`${API_BASE_URL}/api/feeds`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }
    return res(ctx.json(mockFeeds));
  }),

  rest.post(`${API_BASE_URL}/api/feeds`, async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }
    const body = await req.json() as any;
    const newFeed: Feed = {
      id: body.id,
      url: body.url,
      title: body.title,
      created_at: new Date().toISOString(),
    };
    mockFeeds.push(newFeed);
    return res(ctx.status(204));
  }),

  rest.put(`${API_BASE_URL}/api/feeds/:feedId`, async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }
    const body = await req.json() as any;
    const feed = mockFeeds.find(f => f.id === req.params.feedId);
    if (feed) {
      feed.title = body.title;
    }
    return res(ctx.status(204));
  }),

  rest.delete(`${API_BASE_URL}/api/feeds/:feedId`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }
    const index = mockFeeds.findIndex(f => f.id === req.params.feedId);
    if (index !== -1) {
      mockFeeds.splice(index, 1);
    }
    return res(ctx.status(204));
  }),

  // TTS endpoint
  rest.post(`${API_BASE_URL}/api/tts/synthesize`, async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }

    // Return mock audio data (empty MP3 for testing)
    const mockAudioBuffer = new ArrayBuffer(1024);
    return res(
      ctx.set('Content-Type', 'audio/mpeg'),
      ctx.set('X-Duration-Seconds', '60'),
      ctx.set('X-Character-Count', '500'),
      ctx.body(mockAudioBuffer)
    );
  }),

  // Mock external RSS feed fetching
  rest.get('https://example.com/feed.xml', (req, res, ctx) => {
    return res(
      ctx.set('Content-Type', 'application/xml'),
      ctx.text(mockRSSContent)
    );
  }),

  rest.get('https://example.com/feed2.xml', (req, res, ctx) => {
    return res(
      ctx.set('Content-Type', 'application/xml'),
      ctx.text(mockRSSContent)
    );
  }),
];

// Helper to reset mock data between tests
export const resetMockData = () => {
  mockFeeds.length = 0;
  mockFeeds.push(
    {
      id: 'feed-1',
      url: 'https://example.com/feed.xml',
      title: 'Test Feed 1',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'feed-2',
      url: 'https://example.com/feed2.xml',
      title: 'Test Feed 2',
      created_at: '2025-01-02T00:00:00Z',
    }
  );
};
