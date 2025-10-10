// Environment configuration
// Set EXPO_PUBLIC_API_URL environment variable to override the default API URL

const DEV_API_URL = 'http://localhost:8080';
const PROD_API_URL = 'https://delightful-freedom-production.up.railway.app';

// Expo exposes environment variables that start with EXPO_PUBLIC_ at runtime
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || PROD_API_URL;

// Helper to check if running in dev mode
export const isDevelopment = API_BASE_URL === DEV_API_URL;

console.log('[Config] API_BASE_URL:', API_BASE_URL);
console.log('[Config] Development mode:', isDevelopment);
