import { ApiError } from '../types';

export const API_BASE_URL = 'https://delightful-freedom-production.up.railway.app';

export class ApiClient {
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;
  private static onTokenRefresh?: (token: string, refreshToken: string) => void;
  private static onAuthError?: () => void;

  static setTokens(accessToken: string | null, refreshToken: string | null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  static setOnTokenRefresh(callback: (token: string, refreshToken: string) => void) {
    this.onTokenRefresh = callback;
  }

  static setOnAuthError(callback: () => void) {
    this.onAuthError = callback;
  }

  private static async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.accessToken = data.token;
      this.refreshToken = data.refresh_token;

      if (this.onTokenRefresh) {
        this.onTokenRefresh(data.token, data.refresh_token);
      }

      return true;
    } catch (error) {
      console.error('[ApiClient] Token refresh failed:', error);
      return false;
    }
  }

  static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authorization header if token exists
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, {
        ...options,
        headers,
      });

      // If 401 and we have a refresh token, try to refresh
      if (response.status === 401 && this.refreshToken) {
        console.log('[ApiClient] 401 received, attempting token refresh');
        const refreshed = await this.refreshAccessToken();

        if (refreshed) {
          // Retry the request with new token
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          response = await fetch(url, {
            ...options,
            headers,
          });
        } else {
          // Refresh failed, trigger auth error
          if (this.onAuthError) {
            this.onAuthError();
          }
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(error.message);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json();
    } catch (error) {
      console.error(`[ApiClient] Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  static get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
