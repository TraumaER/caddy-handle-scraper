import Docker from 'dockerode';
import net from 'net';

import { ServicesRequest } from '../types';

/**
 * Client configuration interface
 */
export interface ClientConfig {
  dryRun: boolean;
  handshakeKey: string;
  hostIP: string;
  pollInterval: number;
  serverURL: string;
  subdomainLabel: string;
  subdomainPortLabel?: string;
}

/**
 * Create client configuration from environment variables
 */
export function createClientConfig(): ClientConfig {
  const serverURL = process.env.CHS_SERVER_URL;
  if (!serverURL) {
    throw new Error('CHS_SERVER_URL environment variable is required');
  }

  const subdomainLabel = process.env.CHS_SUBDOMAIN_LABEL ?? 'app.subdomain';
  const subdomainPortLabel =
    process.env.CHS_SUBDOMAIN_LABEL_PORT ?? `${subdomainLabel}.port`;

  return {
    dryRun: process.env.CHS_DRY_RUN === 'true',
    handshakeKey: process.env.CHS_HANDSHAKE_KEY || '',
    hostIP: process.env.CHS_HOST_IP ?? '127.0.0.1',
    pollInterval: Number(process.env.CHS_POLL_INTERVAL ?? 60_000),
    serverURL,
    subdomainLabel,
    subdomainPortLabel,
  };
}

/**
 * Docker container scraper client
 */
export class ContainerClient {
  private docker: Docker;
  private config: ClientConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(config: ClientConfig, docker?: Docker) {
    this.config = config;
    this.docker = docker || new Docker();
  }

  /**
   * Scan Docker containers and send services to server
   */
  async scanAndSend(): Promise<void> {
    try {
      const containersWithLabel = await this.docker.listContainers({
        filters: {
          label: [this.config.subdomainLabel],
          status: ['running'],
        },
      });

      const payload: ServicesRequest = {
        host_ip: this.config.hostIP,
        services: containersWithLabel.map((container) => {
          return {
            port: container.Labels[this.config.subdomainPortLabel!]
              ? Number(container.Labels[this.config.subdomainPortLabel!])
              : container.Ports.filter((port) => net.isIPv4(port.IP))[0]
                  .PublicPort,
            subdomain: container.Labels[this.config.subdomainLabel],
          };
        }),
      };

      if (this.config.dryRun) {
        console.log('DRY RUN: Would send the following payload to server:');
        console.log(JSON.stringify(payload, null, 2));
        console.log(`DRY RUN: Would POST to: ${this.config.serverURL}/services`);
        return;
      }

      const response = await fetch(`${this.config.serverURL}/services`, {
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'X-Handshake-Key': this.config.handshakeKey,
        },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send payload:', error);
    }
  }

  /**
   * Start monitoring containers at regular intervals
   */
  startMonitoring(): void {
    const mode = this.config.dryRun ? 'DRY RUN MODE' : 'LIVE MODE';
    console.log(`Starting container monitoring in ${mode}...`);
    this.scanAndSend();
    this.intervalId = setInterval(() => {
      this.scanAndSend();
    }, this.config.pollInterval);
  }

  /**
   * Stop monitoring and cleanup
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('\nStopping container monitoring...');
    }
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
export function setupSignalHandlers(client: ContainerClient): void {
  const cleanup = () => {
    client.stop();
    process.exit(0);
  };

  ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR2'].forEach((signal) => {
    process.on(signal, cleanup);
  });
}