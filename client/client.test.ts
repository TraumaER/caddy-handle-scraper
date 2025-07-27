import Docker from 'dockerode';
import net from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ClientConfig,
  ContainerClient,
  createClientConfig,
  setupSignalHandlers,
} from './client';

// Mock dependencies
vi.mock('dockerode');
vi.mock('net');

// Mock global fetch
global.fetch = vi.fn();

// Store original environment
const originalEnv = process.env;

describe('Client Module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Reset environment
    process.env = {
      ...originalEnv,
      CHS_DRY_RUN: 'false',
      CHS_HANDSHAKE_KEY: 'test-key-123',
      CHS_HOST_IP: '192.168.1.100',
      CHS_POLL_INTERVAL: '5000',
      CHS_SERVER_URL: 'http://localhost:3030',
      CHS_SUBDOMAIN_LABEL: 'app.subdomain',
    };

    // Mock net.isIPv4
    vi.mocked(net.isIPv4).mockImplementation((input: unknown) => {
      return typeof input === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(input);
    });

    // Mock fetch
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ message: 'Success' }),
      ok: true,
      status: 200,
    } as Response);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe('createClientConfig', () => {
    it('should create config from environment variables', () => {
      const config = createClientConfig();

      expect(config).toEqual({
        dryRun: false,
        handshakeKey: 'test-key-123',
        hostIP: '192.168.1.100',
        pollInterval: 5000,
        serverURL: 'http://localhost:3030',
        subdomainLabel: 'app.subdomain',
        subdomainPortLabel: 'app.subdomain.port',
      });
    });

    it('should use default values when optional env vars are missing', () => {
      delete process.env.CHS_HOST_IP;
      delete process.env.CHS_SUBDOMAIN_LABEL;
      delete process.env.CHS_POLL_INTERVAL;
      delete process.env.CHS_HANDSHAKE_KEY;

      const config = createClientConfig();

      expect(config).toEqual({
        dryRun: false,
        handshakeKey: '',
        hostIP: '127.0.0.1',
        pollInterval: 60000,
        serverURL: 'http://localhost:3030',
        subdomainLabel: 'app.subdomain',
        subdomainPortLabel: 'app.subdomain.port',
      });
    });

    it('should throw error when server URL is missing', () => {
      delete process.env.CHS_SERVER_URL;

      expect(() => createClientConfig()).toThrow(
        'CHS_SERVER_URL environment variable is required'
      );
    });

    it('should handle dry run mode when enabled', () => {
      process.env.CHS_DRY_RUN = 'true';
      const config = createClientConfig();
      expect(config.dryRun).toBe(true);
    });

    it('should default dry run to false when not set', () => {
      delete process.env.CHS_DRY_RUN;
      const config = createClientConfig();
      expect(config.dryRun).toBe(false);
    });

    it('should handle custom subdomain label', () => {
      process.env.CHS_SUBDOMAIN_LABEL = 'service.name';

      const config = createClientConfig();

      expect(config.subdomainLabel).toBe('service.name');
      expect(config.subdomainPortLabel).toBe('service.name.port');
    });

    it('should handle explicit port label', () => {
      process.env.CHS_SUBDOMAIN_LABEL_PORT = 'custom.port.label';

      const config = createClientConfig();

      expect(config.subdomainPortLabel).toBe('custom.port.label');
    });
  });

  describe('ContainerClient', () => {
    let mockDocker: Docker;
    let mockListContainers: ReturnType<typeof vi.fn>;
    let config: ClientConfig;

    beforeEach(() => {
      config = {
        handshakeKey: 'test-key-123',
        hostIP: '192.168.1.100',
        pollInterval: 5000,
        serverURL: 'http://localhost:3030',
        subdomainLabel: 'app.subdomain',
        subdomainPortLabel: 'app.subdomain.port',
      };

      mockListContainers = vi.fn();
      mockDocker = {
        listContainers: mockListContainers,
      } as unknown as Docker;
      vi.mocked(Docker).mockImplementation(() => mockDocker);
    });

    describe('scanAndSend', () => {
      it('should list containers with correct filters', async () => {
        const mockContainers = [
          {
            Labels: {
              'app.subdomain': 'test-app',
              'app.subdomain.port': '3000',
            },
            Ports: [{ IP: '192.168.1.100', PublicPort: 3000 }],
          },
        ];

        mockListContainers.mockResolvedValue(mockContainers);

        const client = new ContainerClient(config, mockDocker);
        await client.scanAndSend();

        expect(mockListContainers).toHaveBeenCalledWith({
          filters: {
            label: ['app.subdomain'],
            status: ['running'],
          },
        });
      });

      it('should create correct payload with port from label', async () => {
        const mockContainers = [
          {
            Labels: {
              'app.subdomain': 'test-app',
              'app.subdomain.port': '3000',
            },
            Ports: [{ IP: '192.168.1.100', PublicPort: 8080 }],
          },
        ];

        mockListContainers.mockResolvedValue(mockContainers);

        const client = new ContainerClient(config, mockDocker);
        await client.scanAndSend();

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3030/services',
          expect.objectContaining({
            body:
              expect.stringContaining('test-app') &&
              expect.stringContaining('3000'),
            headers: {
              'Content-Type': 'application/json',
              'X-Handshake-Key': 'test-key-123',
            },
            method: 'POST',
          })
        );
      });

      it('should fallback to port from Ports array when label is missing', async () => {
        const mockContainers = [
          {
            Labels: {
              'app.subdomain': 'test-app',
              // No port label
            },
            Ports: [
              { IP: '192.168.1.100', PublicPort: 8080 },
              { IP: '::1', PublicPort: 8081 }, // IPv6, should be filtered out
            ],
          },
        ];

        mockListContainers.mockResolvedValue(mockContainers);

        const client = new ContainerClient(config, mockDocker);
        await client.scanAndSend();

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3030/services',
          expect.objectContaining({
            body:
              expect.stringContaining('test-app') &&
              expect.stringContaining('8080'),
          })
        );
      });

      it('should handle multiple containers', async () => {
        const mockContainers = [
          {
            Labels: {
              'app.subdomain': 'app1',
              'app.subdomain.port': '3000',
            },
            Ports: [],
          },
          {
            Labels: {
              'app.subdomain': 'app2',
            },
            Ports: [{ IP: '192.168.1.100', PublicPort: 4000 }],
          },
        ];

        mockListContainers.mockResolvedValue(mockContainers);

        const client = new ContainerClient(config, mockDocker);
        await client.scanAndSend();

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:3030/services',
          expect.objectContaining({
            body:
              expect.stringContaining('app1') &&
              expect.stringContaining('app2') &&
              expect.stringContaining('3000') &&
              expect.stringContaining('4000'),
          })
        );
      });

      it('should handle HTTP errors', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: false,
          status: 500,
        } as Response);

        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockListContainers.mockResolvedValue([]);

        const client = new ContainerClient(config, mockDocker);
        await client.scanAndSend();

        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to send payload:',
          expect.objectContaining({
            message: 'HTTP error! status: 500',
          })
        );

        consoleSpy.mockRestore();
      });

      it('should handle network errors', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockListContainers.mockResolvedValue([]);

        const client = new ContainerClient(config, mockDocker);
        await client.scanAndSend();

        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to send payload:',
          expect.objectContaining({
            message: 'Network error',
          })
        );

        consoleSpy.mockRestore();
      });

      it('should handle Docker API errors', async () => {
        mockListContainers.mockRejectedValue(
          new Error('Docker daemon not running')
        );

        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        const client = new ContainerClient(config, mockDocker);
        await client.scanAndSend();

        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to send payload:',
          expect.objectContaining({
            message: 'Docker daemon not running',
          })
        );

        consoleSpy.mockRestore();
      });

      it('should not make fetch request in dry run mode', async () => {
        const dryRunConfig = { ...config, dryRun: true };
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        const mockContainers = [
          {
            Labels: {
              'app.subdomain': 'test-app',
              'app.subdomain.port': '3000',
            },
            Ports: [],
          },
        ];

        mockListContainers.mockResolvedValue(mockContainers);
        const client = new ContainerClient(dryRunConfig, mockDocker);
        await client.scanAndSend();

        expect(fetch).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Would send the following payload to server:');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('test-app')
        );
        expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Would POST to: http://localhost:3030/services');

        consoleSpy.mockRestore();
      });
    });

    describe('startMonitoring', () => {
      it('should start monitoring with correct interval', () => {
        const setIntervalSpy = vi.spyOn(global, 'setInterval');
        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});
        mockListContainers.mockResolvedValue([]);

        const client = new ContainerClient(config, mockDocker);
        client.startMonitoring();

        expect(consoleSpy).toHaveBeenCalledWith(
          'Starting container monitoring in LIVE MODE...'
        );
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

        setIntervalSpy.mockRestore();
        consoleSpy.mockRestore();
      });

      it('should display dry run mode in start monitoring message', () => {
        const dryRunConfig = { ...config, dryRun: true };
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        mockListContainers.mockResolvedValue([]);
        
        const client = new ContainerClient(dryRunConfig, mockDocker);
        client.startMonitoring();

        expect(consoleSpy).toHaveBeenCalledWith(
          'Starting container monitoring in DRY RUN MODE...'
        );

        consoleSpy.mockRestore();
      });

      it('should call scanAndSend immediately and on interval', async () => {
        mockListContainers.mockResolvedValue([]);

        const client = new ContainerClient(config, mockDocker);
        const scanSpy = vi.spyOn(client, 'scanAndSend').mockResolvedValue();

        client.startMonitoring();

        // Should call immediately
        expect(scanSpy).toHaveBeenCalledTimes(1);

        // Should call again after interval
        await vi.advanceTimersByTimeAsync(5000);
        expect(scanSpy).toHaveBeenCalledTimes(2);

        scanSpy.mockRestore();
      });
    });

    describe('stop', () => {
      it('should clear interval and log message', () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});
        mockListContainers.mockResolvedValue([]);

        const client = new ContainerClient(config, mockDocker);
        client.startMonitoring();
        client.stop();

        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          '\nStopping container monitoring...'
        );

        clearIntervalSpy.mockRestore();
        consoleSpy.mockRestore();
      });

      it('should handle stop when not monitoring', () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});

        const client = new ContainerClient(config, mockDocker);
        client.stop(); // Stop without starting

        expect(clearIntervalSpy).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalled();

        clearIntervalSpy.mockRestore();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('setupSignalHandlers', () => {
    it('should setup signal handlers for all specified signals', () => {
      const processOnSpy = vi
        .spyOn(process, 'on')
        .mockImplementation(() => process);
      const mockClient = {
        stop: vi.fn(),
      } as unknown as ContainerClient;

      setupSignalHandlers(mockClient);

      ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR2'].forEach((signal) => {
        expect(processOnSpy).toHaveBeenCalledWith(signal, expect.any(Function));
      });

      processOnSpy.mockRestore();
    });

    it('should call client.stop and process.exit on signal', () => {
      const processOnSpy = vi
        .spyOn(process, 'on')
        .mockImplementation(() => process);
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const mockClient = {
        stop: vi.fn(),
      } as unknown as ContainerClient;

      setupSignalHandlers(mockClient);

      // Get the signal handler for SIGINT
      const signalHandler = processOnSpy.mock.calls.find(
        (call) => call[0] === 'SIGINT'
      )?.[1] as () => void;

      expect(signalHandler).toBeDefined();

      expect(() => signalHandler()).toThrow('process.exit called');
      expect(mockClient.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);

      processOnSpy.mockRestore();
      mockExit.mockRestore();
    });
  });
});
