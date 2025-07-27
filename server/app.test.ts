import Database from 'better-sqlite3';
import express from 'express';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
// import { tmpdir } from 'node:os';
// import path from 'node:path';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app';

// Mock dependencies
vi.mock('better-sqlite3');
vi.mock('mkdirp');
vi.mock('node:fs');

// Create a test directory that we can clean up
// const testDataDir = path.join(tmpdir(), 'chs-test');

// Mock process.env for testing
const originalEnv = process.env;
beforeEach(() => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    CHS_DRY_RUN: 'false',
    CHS_HANDSHAKE_KEY: 'test-key-123',
    CHS_PORT: '3030',
  };

  // Mock filesystem operations
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(mkdirSync).mockImplementation(() => '');
  vi.mocked(rmSync).mockImplementation(() => {});

  // Mock database
  const mockDb = {
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(),
      run: vi.fn(),
    })),
    transaction: vi.fn((fn) => fn),
  };
  vi.mocked(Database).mockReturnValue(mockDb as Database);
});

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

describe('App Module', () => {
  describe('Database operations', () => {
    it('should create services table on startup in live mode', () => {
      createApp('test-key', false);

      const mockDb = vi.mocked(Database).mock.results[0].value;
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS services')
      );
    });

    it('should not create database in dry run mode', () => {
      createApp('test-key', true);

      expect(Database).not.toHaveBeenCalled();
    });
  });

  describe('Handler template generation', () => {
    it('should generate correct Caddy handler template', async () => {
      // Mock database to return test services
      const mockServices = [
        {
          created_at: '2024-01-01T00:00:00.000Z',
          host_ip: '192.168.1.100',
          port: 3000,
          subdomain: 'test-app',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      // Create a fresh mock database instance for this test
      const mockDb = {
        exec: vi.fn(),
        prepare: vi.fn(() => ({
          all: vi.fn(() => mockServices),
          get: vi.fn(),
          run: vi.fn(),
        })),
        transaction: vi.fn((fn) => fn),
      };
      vi.mocked(Database).mockReturnValue(mockDb as Database);

      const { writeHandlerFiles } = createApp('test-key');
      writeHandlerFiles();

      // Check if writeFileSync was called with correct template
      const expectedTemplate = `@testApp host test-app.{$INTERNAL_DOMAIN}
handle @testApp {
  reverse_proxy 192.168.1.100:3000
}`;

      const { writeFileSync } = await import('node:fs');
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('chs_192_168_1_100'),
        expectedTemplate,
        { encoding: 'utf-8' }
      );
    });
  });

  describe('Service processing', () => {
    it('should handle service upsert correctly', () => {
      const mockInsert = vi.fn();
      const mockUpdate = vi.fn();
      const mockGet = vi.fn();

      // Create a fresh mock database instance for this test
      const mockDb = {
        exec: vi.fn(),
        prepare: vi.fn((query: string) => {
          if (query.includes('INSERT')) return { run: mockInsert };
          if (query.includes('UPDATE')) return { run: mockUpdate };
          if (query.includes('SELECT port')) return { get: mockGet };
          return { all: vi.fn(() => []) };
        }),
        transaction: vi.fn((fn) => fn),
      };
      vi.mocked(Database).mockReturnValue(mockDb as Database);

      // Test new service insertion
      mockGet.mockReturnValue(undefined);

      const { processRequest } = createApp('test-key');
      
      const testRequest = {
        host_ip: '192.168.1.100',
        services: [{ port: 3000, subdomain: 'new-app' }],
      };

      processRequest(testRequest);

      // Verify that transaction was called
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});

describe('API Endpoints Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    const appInstance = createApp('test-key-123', false);
    app = appInstance.app;
  });

  describe('Authentication middleware', () => {
    it('should reject requests without handshake key', async () => {
      const response = await supertest(app).get('/health-check').expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should reject requests with invalid handshake key', async () => {
      const response = await supertest(app)
        .get('/health-check')
        .set('X-Handshake-Key', 'invalid-key')
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should accept requests with valid handshake key', async () => {
      const response = await supertest(app)
        .get('/health-check')
        .set('X-Handshake-Key', 'test-key-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Health check received' });
    });
  });

  describe('POST /services validation', () => {
    const validHeaders = { 'X-Handshake-Key': 'test-key-123' };

    it('should reject empty body', async () => {
      const response = await supertest(app)
        .post('/services')
        .set(validHeaders)
        .expect(400);

      expect(response.body).toEqual({ error: 'Request body required' });
    });

    it('should reject body without host_ip', async () => {
      const response = await supertest(app)
        .post('/services')
        .set(validHeaders)
        .send({ services: [] })
        .expect(400);

      expect(response.body).toEqual({ error: 'host_ip required' });
    });

    it('should reject body without services array', async () => {
      const response = await supertest(app)
        .post('/services')
        .set(validHeaders)
        .send({ host_ip: '192.168.1.100' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Services required and must be an array',
      });
    });

    it('should reject services without required fields', async () => {
      const response = await supertest(app)
        .post('/services')
        .set(validHeaders)
        .send({
          host_ip: '192.168.1.100',
          services: [{ subdomain: 'test' }], // missing port
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Each service must contain a port',
      });
    });

    it('should accept valid service request', async () => {
      const response = await supertest(app)
        .post('/services')
        .set(validHeaders)
        .send({
          host_ip: '192.168.1.100',
          services: [
            { port: 3000, subdomain: 'test-app' },
            { port: 4000, subdomain: 'another-app' },
          ],
        })
        .expect(200);

      expect(response.body).toEqual({ message: 'Success' });
    });
  });

  describe('GET /services', () => {
    it('should return all services', async () => {
      const response = await supertest(app)
        .get('/services')
        .set('X-Handshake-Key', 'test-key-123')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('DELETE /services/:subdomain', () => {
    it('should delete service by subdomain', async () => {
      const response = await supertest(app)
        .delete('/services/test-app')
        .set('X-Handshake-Key', 'test-key-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Success' });
    });

    it('should reject empty subdomain', async () => {
      await supertest(app)
        .delete('/services/')
        .set('X-Handshake-Key', 'test-key-123')
        .expect(404); // Express returns 404 for missing route params
    });
  });

  describe('Dry run mode tests', () => {
    let dryRunApp: express.Application;

    beforeEach(() => {
      const appInstance = createApp('test-key-123', true);
      dryRunApp = appInstance.app;
    });

    it('should handle POST /services in dry run mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const payload = {
        host_ip: '192.168.1.100',
        services: [
          { port: 3000, subdomain: 'test-app' },
          { port: 4000, subdomain: 'another-app' },
        ],
      };

      const response = await supertest(dryRunApp)
        .post('/services')
        .set('X-Handshake-Key', 'test-key-123')
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ message: 'Success' });
      expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Received services request:');
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));
      expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Would process the following database operations:');
      expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Would upsert service - subdomain: test-app, host_ip: 192.168.1.100, port: 3000');
      expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Would upsert service - subdomain: another-app, host_ip: 192.168.1.100, port: 4000');

      consoleSpy.mockRestore();
    });

    it('should handle DELETE /services/:subdomain in dry run mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const response = await supertest(dryRunApp)
        .delete('/services/test-app')
        .set('X-Handshake-Key', 'test-key-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Success' });
      expect(consoleSpy).toHaveBeenCalledWith('DRY RUN: Would delete service: test-app');

      consoleSpy.mockRestore();
    });

    it('should return empty array for GET /services in dry run mode', async () => {
      const response = await supertest(dryRunApp)
        .get('/services')
        .set('X-Handshake-Key', 'test-key-123')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });
});