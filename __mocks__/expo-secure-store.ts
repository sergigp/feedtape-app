// Mock implementation of expo-secure-store
const storage: Record<string, string> = {};

export const setItemAsync = jest.fn(async (key: string, value: string): Promise<void> => {
  storage[key] = value;
});

export const getItemAsync = jest.fn(async (key: string): Promise<string | null> => {
  return storage[key] || null;
});

export const deleteItemAsync = jest.fn(async (key: string): Promise<void> => {
  delete storage[key];
});

// Helper to reset storage between tests
export const __resetStorage = () => {
  Object.keys(storage).forEach(key => delete storage[key]);
};

// Helper to inspect storage in tests
export const __getStorage = () => ({ ...storage });
