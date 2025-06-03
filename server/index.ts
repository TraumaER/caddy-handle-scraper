import express from 'express';
import { json } from 'body-parser';

const app = express();
const port = process.env.PORT ?? '3030';
const handshakeKey = process.env.CHS_HANDSHAKE_KEY;

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

const validateBody = (body: unknown) => {
  if (!body) {
    return 'Request body required';
  }

  if (!Array.isArray(body)) {
    return 'Request body must be an array';
  }

  for (const item of body) {
    if (!item || typeof item !== 'object') {
      return 'Each item must be an object';
    }

    if (!('subdomain' in item) || typeof item.subdomain !== 'string') {
      return 'Each item must contain a subdomain string';
    }

    if (!('port' in item) || typeof item.port !== 'number') {
      return 'Each item must contain a subdomainPort number';
    }
  }
};

app.post(
  '/services',
  validateAuth,
  (
    req: express.Request<
      unknown,
      unknown,
      Array<{ subdomain: string; port: number }>
    >,
    res: express.Response
  ) => {
    const services = req.body;
    const validationError = validateBody(services);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    console.log({ services });
    res.json({ message: 'Services configuration received' });
  }
);

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
