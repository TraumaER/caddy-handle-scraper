# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript monorepo that automates creation of subdomain handlers for docker containers in a Caddy reverse proxy setup. The system consists of a client that scrapes Docker containers for subdomain labels and a server that receives service data and writes Caddy configuration files.

## Architecture

- **Monorepo Structure**: Uses Yarn workspaces with two main packages:
  - `client/`: Scans Docker containers for subdomain labels and sends data to server
  - `server/`: Express API server that stores service data in SQLite and writes Caddy handler files
  - `types/`: Shared TypeScript types for client-server communication

- **Client**: Uses `dockerode` to list running containers with specific labels, extracts subdomain and port information, and POSTs to server
- **Server**: Express server with SQLite database storage, writes Caddy configuration files to `/data/chs/shared/handlers/`
- **Authentication**: Simple handshake key-based authentication between client and server

## Development Commands

### Root Level
- `yarn client:start` - Start the client application
- `yarn server:start` - Start the server application
- `yarn handshake` - Generate authentication key for client/server communication
- `yarn format` - Format code with Prettier

### Individual Workspaces
- `cd client && yarn start` - Run client directly with tsx
- `cd server && yarn start` - Run server directly with tsx

### Code Quality
- Use ESLint configuration from `eslint.config.mjs` which includes TypeScript, import sorting, and markdown linting
- Run linting: `npx eslint .`
- Format code: `yarn format`

### Testing
- Tests use Vitest framework with comprehensive mocking
- Run all tests: `yarn test`
- Run client tests only: `yarn test:client`
- Run server tests only: `yarn test:server`
- Tests include:
  - Server API endpoint testing with mocked database and filesystem
  - Client Docker API integration with mocked dockerode
  - Environment variable validation
  - Error handling scenarios
  - Dry run mode functionality for both client and server
- Tests are designed to run without external dependencies (Docker daemon, database, etc.)

## Key Environment Variables

### Server
- `CHS_HANDSHAKE_KEY` (required): Authentication key
- `CHS_PORT` (optional): Server port, defaults to 3030
- `CHS_DRY_RUN` (optional): Set to "true" to enable dry run mode (prints actions instead of executing)

### Client
- `CHS_HANDSHAKE_KEY` (required): Authentication key
- `CHS_SERVER_URL` (required): Server base URL (e.g., http://192.168.10.100:3030)
- `CHS_SUBDOMAIN_LABEL` (optional): Docker label to scan, defaults to "app.subdomain"
- `CHS_SUBDOMAIN_LABEL_PORT` (optional): Port label, defaults to "${CHS_SUBDOMAIN_LABEL}.port"
- `CHS_HOST_IP` (optional): Host IP for reverse proxy, defaults to "127.0.0.1"
- `CHS_DRY_RUN` (optional): Set to "true" to enable dry run mode (prints payload instead of sending)

## Database Schema

The server uses SQLite with a `services` table:
- `subdomain` (TEXT, PRIMARY KEY)
- `host_ip` (TEXT)
- `port` (INTEGER)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

## Testing

Comprehensive test suite using Vitest with mocking of external dependencies:
- Server tests cover API endpoints, database operations, and file generation
- Client tests cover Docker integration, environment handling, and error scenarios
- All tests run without requiring Docker daemon, database, or external services
- Run tests with `yarn test` (all), `yarn test:client`, or `yarn test:server`

## Docker Integration

- `client.Dockerfile` and `server.Dockerfile` for containerized deployment
- `docker-compose.yml` for orchestrated setup
- Client integrates with Docker daemon via dockerode to scan container labels