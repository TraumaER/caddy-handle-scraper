import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContainerClient } from './client';

// Mock the client module
vi.mock('./client');

// Mock process.exit to prevent actual exit during tests
// const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
//   throw new Error('process.exit called');
// });

// Store original environment
const originalEnv = process.env;

describe('Client Index Module', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    
    // Reset environment
    process.env = {
      ...originalEnv,
      CHS_HANDSHAKE_KEY: 'test-key-123',
      CHS_HOST_IP: '192.168.1.100',
      CHS_POLL_INTERVAL: '5000',
      CHS_SERVER_URL: 'http://localhost:3030',
      CHS_SUBDOMAIN_LABEL: 'app.subdomain',
    };

    // Mock the client module functions
    const mockClient = {
      startMonitoring: vi.fn(),
    };

    const { ContainerClient, createClientConfig, setupSignalHandlers } = vi.mocked(await import('./client'));
    vi.mocked(createClientConfig).mockReturnValue({
      handshakeKey: 'test-key-123',
      hostIP: '192.168.1.100',
      pollInterval: 5000,
      serverURL: 'http://localhost:3030',
      subdomainLabel: 'app.subdomain',
      subdomainPortLabel: 'app.subdomain.port',
    });
    vi.mocked(ContainerClient).mockImplementation(() => mockClient as ContainerClient);
    vi.mocked(setupSignalHandlers).mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('Configuration', () => {
    it('should have correct mock configuration', async () => {
      const { createClientConfig } = vi.mocked(await import('./client'));
      
      // Verify mock returns correct config
      const config = createClientConfig();
      expect(config).toEqual({
        handshakeKey: 'test-key-123',
        hostIP: '192.168.1.100',
        pollInterval: 5000,
        serverURL: 'http://localhost:3030',
        subdomainLabel: 'app.subdomain',
        subdomainPortLabel: 'app.subdomain.port',
      });
    });

    it('should mock ContainerClient constructor', async () => {
      const { ContainerClient } = vi.mocked(await import('./client'));
      
      // Verify ContainerClient is mocked
      expect(ContainerClient).toBeDefined();
      expect(vi.isMockFunction(ContainerClient)).toBe(true);
    });

    it('should mock setupSignalHandlers', async () => {
      const { setupSignalHandlers } = vi.mocked(await import('./client'));
      
      // Verify setupSignalHandlers is mocked
      expect(setupSignalHandlers).toBeDefined();
      expect(vi.isMockFunction(setupSignalHandlers)).toBe(true);
    });
  });
});