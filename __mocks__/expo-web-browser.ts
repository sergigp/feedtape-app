// Mock implementation of expo-web-browser
export type WebBrowserResult =
  | { type: 'cancel' }
  | { type: 'dismiss' }
  | { type: 'success'; url: string };

let mockAuthResult: WebBrowserResult = { type: 'cancel' };

export const openAuthSessionAsync = jest.fn(
  async (authUrl: string, redirectUrl: string): Promise<WebBrowserResult> => {
    return mockAuthResult;
  }
);

export const maybeCompleteAuthSession = jest.fn(() => {});

// Test helpers
export const __setMockAuthResult = (result: WebBrowserResult) => {
  mockAuthResult = result;
};

export const __mockSuccessfulAuth = (token: string, refreshToken: string) => {
  mockAuthResult = {
    type: 'success',
    url: `feedtape://auth/callback?token=${token}&refresh_token=${refreshToken}&expires_in=3600`,
  };
};

export const __mockCancelledAuth = () => {
  mockAuthResult = { type: 'cancel' };
};

export const __mockDismissedAuth = () => {
  mockAuthResult = { type: 'dismiss' };
};
