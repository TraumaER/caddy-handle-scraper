/**
 * Express application setup for managing Caddy reverse proxy services
 * @module app
 */
import Database from 'better-sqlite3';
import { json } from 'body-parser';
import express from 'express';
import camelCase from 'lodash/camelCase';
import hasIn from 'lodash/hasIn';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { Service, ServiceRow, ServicesRequest } from '../types';

/**
 * Create and configure Express application
 * @param handshakeKey - Authentication key
 * @param dryRun - Whether to run in dry run mode
 * @returns Configured Express application
 */
export function createApp(handshakeKey: string, dryRun = false) {
  const app = express();

  // Create necessary directories (only in live mode)
  if (!dryRun) {
    mkdirp.sync(path.resolve('/data', 'chs', 'shared', 'handlers'));
    mkdirp.sync(path.resolve('/data', 'chs', 'private'));
  }

  /**
   * SQLite database connection (only in live mode)
   */
  const db = dryRun ? null : new Database(path.resolve('/data', 'chs', 'private', 'db.sqlite3'));

  // Create services table if it doesn't exist (only in live mode)
  if (!dryRun && db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        subdomain TEXT NOT NULL UNIQUE,
        host_ip TEXT NOT NULL,
        port INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (subdomain)
      );
    `);
  }

  // Use JSON body parser middleware
  app.use(json());

  /**
   * Middleware to validate authentication using handshake key
   */
  const validateAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const headerKey = req.header('X-Handshake-Key');
    if (headerKey !== handshakeKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  /**
   * Middleware to validate request body for service operations
   */
  const validateBody = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const body = req.body;
    if (!body) {
      res.status(400).json({ error: 'Request body required' });
      return;
    }

    if (!hasIn(body, 'host_ip')) {
      res.status(400).json({ error: 'host_ip required' });
      return;
    }

    if (!hasIn(body, 'services') || !Array.isArray(body.services)) {
      res.status(400).json({ error: 'Services required and must be an array' });
      return;
    }

    for (const item of body.services) {
      if (!item || typeof item !== 'object') {
        res.status(400).json({ error: 'Services must be an array of objects' });
        return;
      }

      if (!hasIn(item, 'subdomain')) {
        res.status(400).json({ error: 'Each service must contain a subdomain' });
        return;
      }

      if (!hasIn(item, 'port')) {
        res.status(400).json({ error: 'Each service must contain a port' });
        return;
      }
    }
    next();
  };

  /**
   * Process a services request by inserting or updating services in the database
   */
  const processRequest = (body: ServicesRequest) => {
    if (dryRun) {
      console.log('DRY RUN: Would process the following database operations:');
      body.services.forEach((service) => {
        console.log(`DRY RUN: Would upsert service - subdomain: ${service.subdomain}, host_ip: ${body.host_ip}, port: ${service.port}`);
      });
      return;
    }

    if (!db) return;

    const insert = db.prepare(
      `INSERT INTO services (subdomain, host_ip, port, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?);
          `
    );
    const update = db.prepare(
      `UPDATE services SET port = ?, updated_at = ? WHERE subdomain = ?`
    );

    const upsertServices = db.transaction((services: Service[]) => {
      services.forEach((service) => {
        const now = new Date().toISOString();
        const existingPort = db
          .prepare('SELECT port FROM services WHERE subdomain = ?')
          .get(service.subdomain) as { port: number } | undefined;
        if (!existingPort) {
          insert.run(service.subdomain, body.host_ip, service.port, now, now);
        } else {
          if (existingPort.port !== service.port) {
            update.run(service.port, now, service.subdomain);
          }
        }
      });
    });

    upsertServices(body.services);
  };

  /**
   * Get all services from the database
   */
  const getAllServices = (): Array<ServiceRow> => {
    if (dryRun || !db) {
      return [];
    }
    return db.prepare('SELECT * FROM services').all() as Array<ServiceRow>;
  };

  /**
   * Generate a Caddy handler template for a service
   */
  const handlerTemplate = ({
    host_ip,
    port,
    subdomain,
  }: {
    host_ip: string;
    port: number;
    subdomain: string;
  }) => {
    const subdomainCamel = camelCase(subdomain);
    return `@${subdomainCamel} host ${subdomain}.{$INTERNAL_DOMAIN}
handle @${subdomainCamel} {
  reverse_proxy ${host_ip}:${port}
}`;
  };

  /**
   * Write handler files for all services grouped by host IP
   */
  const writeHandlerFiles = () => {
    const services = getAllServices();
    
    if (dryRun) {
      console.log('DRY RUN: Would write handler files for the following services:');
      const servicesByHost = services.reduce(
        (acc, service) => {
          if (!acc[service.host_ip]) {
            acc[service.host_ip] = [];
          }
          acc[service.host_ip].push(service);
          return acc;
        },
        {} as Record<string, ServiceRow[]>
      );

      Object.entries(servicesByHost).forEach(([hostIp, hostServices]) => {
        const formattedServices = hostServices.map(handlerTemplate);
        const fileName = `chs_${hostIp.replace(/\./g, '_')}`;
        console.log(`DRY RUN: Would write file: /data/chs/shared/handlers/${fileName}`);
        console.log('DRY RUN: File contents:');
        console.log(formattedServices.join('\n\n'));
        console.log('');
      });
      return;
    }

    const servicesByHost = services.reduce(
      (acc, service) => {
        if (!acc[service.host_ip]) {
          acc[service.host_ip] = [];
        }
        acc[service.host_ip].push(service);
        return acc;
      },
      {} as Record<string, ServiceRow[]>
    );

    Object.entries(servicesByHost).forEach(([hostIp, hostServices]) => {
      const formattedServices = hostServices.map(handlerTemplate);
      writeFileSync(
        path.resolve(
          '/data',
          'chs',
          'shared',
          'handlers',
          `chs_${hostIp.replace(/\./g, '_')}`
        ),
        formattedServices.join('\n\n'),
        { encoding: 'utf-8' }
      );
    });
  };

  /**
   * Health check endpoint
   */
  app.get(
    '/health-check',
    validateAuth,
    (_: express.Request, res: express.Response) => {
      console.log('Health check received');
      res.json({ message: 'Health check received' });
    }
  );

  /**
   * Get all services endpoint
   */
  app.get(
    '/services',
    validateAuth,
    (_: express.Request, res: express.Response) => {
      console.log('Getting all services from database');
      res.json(getAllServices());
    }
  );

  /**
   * Create or update services endpoint
   */
  app.post(
    '/services',
    validateAuth,
    validateBody,
    (
      req: express.Request<unknown, unknown, ServicesRequest>,
      res: express.Response
    ) => {
      const body = req.body;
      
      if (dryRun) {
        console.log('DRY RUN: Received services request:');
        console.log(JSON.stringify(body, null, 2));
      } else {
        console.log('Received services request');
      }

      processRequest(body);
      writeHandlerFiles();

      res.json({ message: 'Success' });
    }
  );

  /**
   * Delete service endpoint
   */
  app.delete(
    '/services/:subdomain',
    validateAuth,
    (req: express.Request<unknown, unknown, unknown>, res: express.Response) => {
      const params = req.params as { subdomain: string };
      if (!hasIn(params, 'subdomain') && !params.subdomain.length) {
        res.status(400).json({ error: 'subdomain required' });
        return;
      }
      if (dryRun) {
        console.log(`DRY RUN: Would delete service: ${params.subdomain}`);
      } else {
        console.log('Deleting service: ', params.subdomain);
        if (db) {
          db.prepare(`DELETE FROM services WHERE subdomain = ?`).run(
            params.subdomain
          );
        }
      }
      writeHandlerFiles();
      res.json({ message: 'Success' });
    }
  );

  return { app, db, getAllServices, processRequest, writeHandlerFiles };
}