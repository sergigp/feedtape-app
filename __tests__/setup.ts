// Global test setup
import './mocks/server'; // Start MSW server
import { Alert } from 'react-native';

// Silence console logs during tests (comment out for debugging)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Alert globally
jest.spyOn(Alert, 'alert');

// Use real timers to allow setTimeout to work properly
jest.useRealTimers();

// Global test utilities
global.mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
