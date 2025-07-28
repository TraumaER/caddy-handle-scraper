/**
 * Express server for managing Caddy reverse proxy services
 * @module server
 */
import { createApp } from './app';

/**
 * Server port from environment variable or default
 */
const port = process.env.CHS_PORT ?? '3030';

/**
 * Handshake key for authentication from environment variable
 */
const handshakeKey = process.env.CHS_HANDSHAKE_KEY;

/**
 * Dry run mode from environment variable
 */
const dryRun = process.env.CHS_DRY_RUN === 'true';

// Validate handshake key is provided
if (!handshakeKey) {
  console.error('CHS_HANDSHAKE_KEY environment variable is required');
  process.exit(1);
}

// Create and configure the Express application
const { app } = createApp(handshakeKey, dryRun);

/**
 * Start the server and listen for incoming connections
 */
app.listen(Number(port), '0.0.0.0', () => {
  const mode = dryRun ? 'DRY RUN MODE' : 'LIVE MODE';
  console.log(`Server listening on port ${port} in ${mode}`);
});
