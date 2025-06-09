import Database from 'better-sqlite3';
import { json } from 'body-parser';
import express from 'express';
import hasIn from 'lodash/hasIn';
import path from 'node:path';

import { Service, ServicesRequest } from '../types';

const app = express();
const port = process.env.PORT ?? '3030';
const handshakeKey = process.env.CHS_HANDSHAKE_KEY;

const db = new Database(
  path.resolve(process.env.CHS_DB_DIR ?? './', 'services.sqlite3')
);

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

if (!handshakeKey) {
  console.error('CHS_HANDSHAKE_KEY environment variable is required');
  process.exit(1);
}

app.use(json());

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

const validateBody = (body: Partial<ServicesRequest>) => {
  if (!body) {
    return 'Request body required';
  }

  if (!hasIn(body, 'host_ip')) {
    return 'Request host_ip required';
  }

  if (!hasIn(body, 'services') || !Array.isArray(body.services)) {
    return 'Request services required and must be an array';
  }

  for (const item of body.services) {
    if (!item || typeof item !== 'object') {
      return 'Each service must be an object';
    }

    if (!hasIn(item, 'subdomain')) {
      return 'Each service must contain a subdomain string';
    }

    if (!hasIn(item, 'port')) {
      return 'Each service must contain a subdomainPort number';
    }
  }
};

app.get(
  '/health-check',
  validateAuth,
  (_: express.Request, res: express.Response) => {
    console.log('Health check received');
    res.json({ message: 'Health check received' });
  }
);

app.get(
  '/services',
  validateAuth,
  (_: express.Request, res: express.Response) => {
    res.json(db.prepare('SELECT * FROM services').all());
  }
);

app.post(
  '/services',
  validateAuth,
  (
    req: express.Request<unknown, unknown, ServicesRequest>,
    res: express.Response
  ) => {
    const body = req.body;
    const validationError = validateBody(body);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    updateDB(body);

    res.json({ message: 'Success' });
  }
);
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
    res.json({ message: 'Success' });
  }
);

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});

const updateDB = (body: ServicesRequest) => {
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
