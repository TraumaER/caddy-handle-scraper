/**
 * Express server for managing Caddy reverse proxy services
 * @module server
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
 * Express application instance
 * @type {express.Application}
 */
const app = express();
/**
 * Server port from environment variable or default
 * @type {string}
 */
const port = process.env.PORT ?? '3030';
/**
 * Handshake key for authentication from environment variable
 * @type {string|undefined}
 */
const handshakeKey = process.env.CHS_HANDSHAKE_KEY;

// Create necessary directories
mkdirp.sync(path.resolve('/data', 'shared', 'handlers'));
mkdirp.sync(path.resolve('/data', 'private'));

/**
 * SQLite database connection
 * @type {Database}
 */
const db = new Database(path.resolve('/data', 'private', 'db.sqlite3'));

// Create services table if it doesn't exist
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

// Validate handshake key is provided
if (!handshakeKey) {
  console.error('CHS_HANDSHAKE_KEY environment variable is required');
  process.exit(1);
}

// Use JSON body parser middleware
app.use(json());

/**
 * Middleware to validate authentication using handshake key
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 * @returns {void}
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
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 * @returns {void}
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
 * Health check endpoint
 * @route GET /health-check
 * @authentication Required
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
 * @route GET /services
 * @authentication Required
 * @returns {Array<ServiceRow>} Array of all service records
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
 * @route POST /services
 * @authentication Required
 * @param {ServicesRequest} req.body - The request body containing host_ip and services
 * @returns {Object} Success message
 */
app.post(
  '/services',
  validateAuth,
  validateBody,
  (
    req: express.Request<unknown, unknown, ServicesRequest>,
    res: express.Response
  ) => {
    console.log('Received services request');
    const body = req.body;

    processRequest(body);

    writeHandlerFiles();

    res.json({ message: 'Success' });
  }
);

/**
 * Delete service endpoint
 * @route DELETE /services/:subdomain
 * @authentication Required
 * @param {string} req.params.subdomain - The subdomain of the service to delete
 * @returns {Object} Success message
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
    console.log('Deleting service: ', params.subdomain);
    db.prepare(`DELETE FROM services WHERE subdomain = ?`).run(
      params.subdomain
    );
    writeHandlerFiles();
    res.json({ message: 'Success' });
  }
);

/**
 * Start the server and listen for incoming connections
 */
app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});

/**
 * Process a services request by inserting or updating services in the database
 * @param {ServicesRequest} body - The request body containing host_ip and services
 * @returns {void}
 */
const processRequest = (body: ServicesRequest) => {
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
 * @returns {Array<ServiceRow>} Array of all service records
 */
const getAllServices = (): Array<ServiceRow> =>
  db.prepare('SELECT * FROM services').all() as Array<ServiceRow>;

/**
 * Generate a Caddy handler template for a service
 * @param {Object} params - Parameters for the template
 * @param {string} params.host_ip - The IP address of the host
 * @param {number} params.port - The port number of the service
 * @param {string} params.subdomain - The subdomain for the service
 * @returns {string} Formatted Caddy handler template
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
 * @returns {void}
 */
const writeHandlerFiles = () => {
  const services = getAllServices();
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
        'shared',
        'handlers',
        `chs_${hostIp.replace(/\./g, '_')}`
      ),
      formattedServices.join('\n\n'),
      { encoding: 'utf-8' }
    );
  });
};
