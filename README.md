# Caddy Handle Scraper

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Caddy](https://img.shields.io/badge/Caddy-1F88C0?style=flat&logo=caddy&logoColor=white)

Automate creation of subdomain handlers for Docker containers in a Caddy reverse proxy setup. This TypeScript monorepo provides a client-server architecture to dynamically generate Caddy configuration files based on Docker container labels.

## 🚀 Overview

The Caddy Handle Scraper consists of two main components:

- **Client**: Scans Docker containers for subdomain labels and sends service data to the server
- **Server**: Receives service data, stores it in SQLite, and generates Caddy handler configuration files

This automation eliminates the need to manually manage Caddy configuration files for each new service in your homelab or containerized environment.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Server Setup](#-server-setup)
- [Client Setup](#-client-setup)
- [Docker Usage](#-docker-usage)
- [Configuration](#-configuration)
- [Development](#-development)
- [API Documentation](#-api-documentation)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## ⚡ Quick Start

### Prerequisites

- Node.js 18+ and Yarn
- Docker (for client scanning)
- SQLite (automatically handled)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd caddy-handle-scraper
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Generate authentication key**
   ```bash
   yarn handshake
   ```
   This creates a shared authentication key for client-server communication.

4. **Start the server**
   ```bash
   # Set required environment variables
   export CHS_HANDSHAKE_KEY="your-generated-key"
   export CHS_PORT="3030"
   
   # Start server
   yarn server:start
   ```

5. **Start the client**
   ```bash
   # Set required environment variables
   export CHS_HANDSHAKE_KEY="your-generated-key"
   export CHS_SERVER_URL="http://localhost:3030"
   export CHS_HOST_IP="192.168.1.100"  # Your machine's IP
   
   # Start client
   yarn client:start
   ```

6. **Label your Docker containers**
   ```bash
   docker run -d \
     --label "app.subdomain=myapp" \
     --label "app.subdomain.port=3000" \
     -p 3000:3000 \
     my-application
   ```

## 🏗️ Architecture

```
┌─────────────────┐    HTTP POST     ┌─────────────────┐
│                 │   (services)     │                 │
│     Client      │ ───────────────► │     Server      │
│                 │                  │                 │
│ - Docker scan   │                  │ - SQLite DB     │
│ - Label extract │                  │ - File writer   │
│ - Periodic poll │                  │ - API endpoints │
└─────────────────┘                  └─────────────────┘
         │                                     │
         ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│  Docker Engine  │                  │ Caddy Handlers  │
│                 │                  │                 │
│ - Running       │                  │ - Generated     │
│   containers    │                  │   config files  │
│ - Labels        │                  │ - Auto-reload   │
└─────────────────┘                  └─────────────────┘
```

## 🖥️ Server Setup

The server component manages service data and generates Caddy configuration files.

### Description

The server provides a REST API for managing services and automatically generates Caddy handler files in the `/data/chs/shared/handlers/` directory. Each file contains reverse proxy configurations grouped by host IP.

### Running the Server

```bash
# Development
yarn server:start

# Production (with Docker)
docker-compose up server
```

### Generated Handler Files

The server creates files like `chs_192_168_1_100` with content:
```
@myapp host myapp.{$INTERNAL_DOMAIN}
handle @myapp {
  reverse_proxy 192.168.1.100:3000
}

@anotherapp host anotherapp.{$INTERNAL_DOMAIN}
handle @anotherapp {
  reverse_proxy 192.168.1.100:4000
}
```

### Server Environment Variables

| Variable          | Required | Type     | Default | Description                                                     |
| ----------------- | -------- | -------- | ------- | --------------------------------------------------------------- |
| CHS_HANDSHAKE_KEY | ✅       | `string` |         | Authentication key (generate with `yarn handshake`)            |
| CHS_PORT          | ❌       | `number` | `3030`  | Server listening port                                           |
| CHS_DRY_RUN       | ❌       | `string` | `false` | Set to "true" to print actions instead of executing them       |

## 📱 Client Setup

The client scans Docker containers and reports services to the server.

### Description

The client monitors Docker containers with specific labels and periodically sends service information to the server. It extracts subdomain and port information from container labels and handles automatic fallback to published ports.

### Running the Client

```bash
# Development
yarn client:start

# Production (with Docker)
docker-compose up client
```

### Container Labeling

Label your containers for automatic discovery:

```bash
# Basic labeling
docker run -d \
  --label "app.subdomain=webapp" \
  --label "app.subdomain.port=8080" \
  my-web-application

# Using docker-compose
services:
  webapp:
    image: my-web-application
    labels:
      - "app.subdomain=webapp"
      - "app.subdomain.port=8080"
    ports:
      - "8080:8080"
```

### Client Environment Variables

| Variable                 | Required | Type     | Default                       | Description                                                     |
| ------------------------ | -------- | -------- | ----------------------------- | --------------------------------------------------------------- |
| CHS_HANDSHAKE_KEY        | ✅       | `string` |                               | Authentication key (same as server)                            |
| CHS_SERVER_URL           | ✅       | `string` |                               | Server URL (e.g., `http://192.168.10.100:3030`)               |
| CHS_SUBDOMAIN_LABEL      | ❌       | `string` | `app.subdomain`               | Docker label to scan for subdomain names                       |
| CHS_SUBDOMAIN_LABEL_PORT | ❌       | `string` | `${CHS_SUBDOMAIN_LABEL}.port` | Docker label for port specification                            |
| CHS_HOST_IP              | ❌       | `string` | `127.0.0.1`                   | Host IP for reverse proxy (should be client machine's IP)      |
| CHS_POLL_INTERVAL        | ❌       | `number` | `60000`                       | Polling interval in milliseconds                               |
| CHS_DRY_RUN              | ❌       | `string` | `false`                       | Set to "true" to print payload instead of sending              |

## 🐳 Docker Usage

### Using Docker Compose

```yaml
version: '3.8'
services:
  chs-server:
    build:
      context: .
      dockerfile: server.Dockerfile
    environment:
      - CHS_HANDSHAKE_KEY=your-secure-key
      - CHS_PORT=3030
    volumes:
      - ./data:/data
    ports:
      - "3030:3030"

  chs-client:
    build:
      context: .
      dockerfile: client.Dockerfile
    environment:
      - CHS_HANDSHAKE_KEY=your-secure-key
      - CHS_SERVER_URL=http://chs-server:3030
      - CHS_HOST_IP=192.168.1.100
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - chs-server
```

### Individual Docker Images

```bash
# Build images
docker build -f server.Dockerfile -t chs-server .
docker build -f client.Dockerfile -t chs-client .

# Run server
docker run -d \
  -e CHS_HANDSHAKE_KEY=your-key \
  -e CHS_PORT=3030 \
  -v $(pwd)/data:/data \
  -p 3030:3030 \
  chs-server

# Run client
docker run -d \
  -e CHS_HANDSHAKE_KEY=your-key \
  -e CHS_SERVER_URL=http://server-ip:3030 \
  -e CHS_HOST_IP=192.168.1.100 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  chs-client
```

## ⚙️ Configuration

### Dry Run Mode

Both client and server support dry run mode for testing:

```bash
# Client dry run - shows what would be sent
export CHS_DRY_RUN=true
yarn client:start

# Server dry run - shows what would be written
export CHS_DRY_RUN=true
yarn server:start
```

### Custom Labels

Configure custom Docker labels:

```bash
export CHS_SUBDOMAIN_LABEL="service.domain"
export CHS_SUBDOMAIN_LABEL_PORT="service.domain.port"
```

## 🛠️ Development

### Setup

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Run linting
npx eslint .

# Format code
yarn format
```

### Project Structure

```
├── client/               # Client application
│   ├── __tests__/        # Client tests
│   │   ├── client.test.ts
│   │   └── index.test.ts
│   ├── client.ts         # Core client logic
│   ├── index.ts          # Entry point
│   └── package.json      # Client dependencies
├── server/               # Server application
│   ├── __tests__/        # Server tests
│   │   ├── app.test.ts
│   │   └── index.test.ts
│   ├── app.ts            # Express app setup
│   ├── index.ts          # Entry point
│   ├── package.json      # Server dependencies
│   └── vitest.setup.ts   # Test setup
├── types/                # Shared TypeScript types
├── vitest.config.ts      # Centralized test configuration
└── docs/                 # Documentation
```

### Testing

```bash
# Run all tests
yarn test

# Run specific workspace tests
yarn test:client
yarn test:server

# Watch mode
yarn test --watch
```

## 📚 API Documentation

### Server Endpoints

#### Health Check
```http
GET /health-check
X-Handshake-Key: your-key
```

#### Get All Services
```http
GET /services
X-Handshake-Key: your-key
```

#### Update Services
```http
POST /services
X-Handshake-Key: your-key
Content-Type: application/json

{
  "host_ip": "192.168.1.100",
  "services": [
    {
      "subdomain": "webapp",
      "port": 3000
    }
  ]
}
```

#### Delete Service
```http
DELETE /services/:subdomain
X-Handshake-Key: your-key
```

## 🔧 Troubleshooting

### Common Issues

**Client can't connect to Docker**
```bash
# Ensure Docker socket is accessible
ls -la /var/run/docker.sock

# Add user to docker group
sudo usermod -aG docker $USER
```

**Server authentication failures**
```bash
# Verify handshake key matches between client and server
echo $CHS_HANDSHAKE_KEY
```

**No containers found**
```bash
# Check container labels
docker inspect container-name | grep -A 10 Labels

# Verify containers are running
docker ps --filter "label=app.subdomain"
```

### Debug Mode

Enable debug logging:
```bash
export DEBUG=chs:*
yarn client:start
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with TypeScript and Node.js
- Uses Docker API via dockerode
- SQLite for data persistence
- Caddy for reverse proxy configuration
