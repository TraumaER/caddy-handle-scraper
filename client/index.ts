/**
 * Docker container monitoring client
 * @module client
 */
import { ContainerClient, createClientConfig, setupSignalHandlers } from './client';

try {
  // Create configuration from environment
  const config = createClientConfig();
  
  // Create and start the client
  const client = new ContainerClient(config);
  
  // Setup signal handlers for graceful shutdown
  setupSignalHandlers(client);
  
  // Start monitoring
  client.startMonitoring();
} catch (error) {
  console.error('Failed to start client:', error);
  process.exit(1);
}
