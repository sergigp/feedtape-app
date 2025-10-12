// Mock implementation of react-native-fs
const fileSystem: Record<string, string> = {};

const RNFS = {
  CachesDirectoryPath: '/mock/cache',
  DocumentDirectoryPath: '/mock/documents',

  writeFile: jest.fn(async (filepath: string, contents: string, encoding?: string) => {
    fileSystem[filepath] = contents;
  }),

  readFile: jest.fn(async (filepath: string, encoding?: string): Promise<string> => {
    if (!fileSystem[filepath]) {
      throw new Error(`File not found: ${filepath}`);
    }
    return fileSystem[filepath];
  }),

  exists: jest.fn(async (filepath: string): Promise<boolean> => {
    return filepath in fileSystem;
  }),

  unlink: jest.fn(async (filepath: string): Promise<void> => {
    delete fileSystem[filepath];
  }),
};

// Test helpers
export const __getFileSystem = () => ({ ...fileSystem });

export const __resetFileSystem = () => {
  Object.keys(fileSystem).forEach(key => delete fileSystem[key]);
};

export default RNFS;
