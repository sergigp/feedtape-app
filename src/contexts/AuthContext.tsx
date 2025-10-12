import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User } from '../types';
import authService from '../services/authService';
import { ApiClient } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Set up token refresh callback
  useEffect(() => {
    ApiClient.setOnTokenRefresh(async (token, refreshToken) => {
      await authService.storeTokens(token, refreshToken);
    });

    ApiClient.setOnAuthError(async () => {
      await handleLogout();
    });
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      console.log('[AuthContext] Initializing authentication');

      const authenticated = await authService.initialize();

      if (authenticated) {
        const userData = await authService.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
        console.log('[AuthContext] User authenticated:', userData.id);
      } else {
        console.log('[AuthContext] No valid session found');
      }
    } catch (error) {
      console.error('[AuthContext] Initialization failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      setIsLoading(true);
      console.log('[AuthContext] Starting login flow');

      await authService.loginWithGitHub();
      const userData = await authService.getCurrentUser();

      setUser(userData);
      setIsAuthenticated(true);
      console.log('[AuthContext] Login successful:', userData.id);
    } catch (error) {
      console.error('[AuthContext] Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await handleLogout();
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      console.log('[AuthContext] Logging out');

      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      console.log('[AuthContext] Logout successful');
    } catch (error) {
      console.error('[AuthContext] Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      console.log('[AuthContext] User data refreshed');
    } catch (error) {
      console.error('[AuthContext] Failed to refresh user data:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
