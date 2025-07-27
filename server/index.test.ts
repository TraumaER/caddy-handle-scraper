import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the app module
vi.mock('./app');

const originalEnv = process.env;

beforeEach(async () => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    CHS_HANDSHAKE_KEY: 'test-key-123',
    CHS_PORT: '3030',
  };

  // Mock the createApp function
  const mockApp = {
    listen: vi.fn((port, host, callback) => {
      if (callback) callback();
    }),
  };

  const { createApp } = await import('./app');
  vi.mocked(createApp).mockReturnValue({
    app: mockApp,
    db: {} as Database,
    getAllServices: vi.fn(),
    processRequest: vi.fn(),
    writeHandlerFiles: vi.fn(),
  });
});

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

describe('Server Index Module', () => {
  describe('App configuration', () => {
    it('should mock createApp function', async () => {
      const { createApp } = await import('./app');
      
      expect(createApp).toBeDefined();
      expect(vi.isMockFunction(createApp)).toBe(true);
    });

    it('should return mocked app instance', async () => {
      const { createApp } = await import('./app');
      
      const result = createApp('test-key');
      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('db');
      expect(result).toHaveProperty('processRequest');
      expect(result).toHaveProperty('getAllServices');
      expect(result).toHaveProperty('writeHandlerFiles');
    });
  });
});
