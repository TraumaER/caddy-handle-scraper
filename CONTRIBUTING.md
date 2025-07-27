# Contributing to Caddy Handle Scraper

Thank you for your interest in contributing to Caddy Handle Scraper! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Coding Standards](#-coding-standards)
- [Testing Guidelines](#-testing-guidelines)
- [Submitting Changes](#-submitting-changes)
- [Release Process](#-release-process)

## 🤝 Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow:

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain a welcoming environment

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- Yarn package manager
- Docker (for integration testing)
- Git

### First Time Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/caddy-handle-scraper.git
   cd caddy-handle-scraper
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/caddy-handle-scraper.git
   ```

3. **Install dependencies**
   ```bash
   yarn install
   ```

4. **Verify setup**
   ```bash
   yarn test
   yarn format
   npx eslint .
   ```

## 🛠️ Development Setup

### Development Commands

```bash
# Install dependencies
yarn install

# Start development servers
yarn client:start    # Start client in development mode
yarn server:start    # Start server in development mode

# Testing
yarn test            # Run all tests
yarn test:client     # Run client tests only
yarn test:server     # Run server tests only
yarn test --watch    # Watch mode for tests

# Code quality
npx eslint .         # Run linting
yarn format          # Format code with Prettier

# Generate authentication key
yarn handshake       # Creates shared key for client/server
```

### Environment Setup

Create a `.env` file for local development:

```bash
# Authentication
CHS_HANDSHAKE_KEY=your-dev-key-here

# Server config
CHS_PORT=3030

# Client config
CHS_SERVER_URL=http://localhost:3030
CHS_HOST_IP=127.0.0.1
CHS_SUBDOMAIN_LABEL=app.subdomain
CHS_POLL_INTERVAL=10000

# Development flags
CHS_DRY_RUN=false
DEBUG=chs:*
```

### Docker Development

```bash
# Build development images
docker-compose -f docker-compose.dev.yml build

# Start services
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## 📁 Project Structure

```
caddy-handle-scraper/
├── client/                 # Client application
│   ├── client.ts          # Core client logic
│   ├── client.test.ts     # Client tests
│   ├── index.ts           # Client entry point
│   ├── index.test.ts      # Integration tests
│   ├── package.json       # Client dependencies
│   └── vitest.config.ts   # Test configuration
├── server/                 # Server application
│   ├── app.ts             # Express app setup
│   ├── app.test.ts        # Server tests
│   ├── index.ts           # Server entry point
│   ├── index.test.ts      # Integration tests
│   ├── package.json       # Server dependencies
│   ├── vitest.config.ts   # Test configuration
│   └── vitest.setup.ts    # Test setup
├── types/                  # Shared TypeScript types
│   └── index.ts           # Type definitions
├── .github/               # GitHub workflows
├── docs/                  # Documentation
├── package.json           # Root package.json
├── yarn.lock              # Lockfile
├── eslint.config.mjs      # ESLint configuration
├── prettier.config.js     # Prettier configuration
├── tsconfig.json          # TypeScript configuration
├── client.Dockerfile      # Client Docker image
├── server.Dockerfile      # Server Docker image
├── docker-compose.yml     # Production compose
├── CLAUDE.md              # AI assistant context
├── README.md              # Main documentation
└── CONTRIBUTING.md        # This file
```

## 🎨 Coding Standards

### TypeScript Guidelines

- **Strict TypeScript**: All code must pass strict type checking
- **Explicit types**: Prefer explicit type annotations for function parameters and return types
- **Interfaces**: Use interfaces for object shapes, types for unions/primitives
- **Naming conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes and interfaces
  - `UPPER_SNAKE_CASE` for constants

### Code Style

We use ESLint and Prettier for consistent code formatting:

```bash
# Check linting
npx eslint .

# Auto-fix issues
npx eslint . --fix

# Format code
yarn format
```

### Key ESLint Rules

- **Import sorting**: Imports must be sorted alphabetically
- **Object property sorting**: Object properties should be sorted
- **No unused variables**: Remove unused imports and variables
- **Consistent naming**: Use descriptive variable names
- **Comment style**: Use JSDoc for functions, brief comments for complex logic

### Example Code Style

```typescript
/**
 * Process a services request by updating the database
 * @param body - The request payload containing services
 * @returns Promise that resolves when processing is complete
 */
export async function processServicesRequest(body: ServicesRequest): Promise<void> {
  const { host_ip, services } = body;
  
  // Process each service in the request
  for (const service of services) {
    await upsertService({
      hostIp: host_ip,
      port: service.port,
      subdomain: service.subdomain,
    });
  }
}
```

## 🧪 Testing Guidelines

### Testing Framework

We use **Vitest** for testing with comprehensive mocking:

- Unit tests for individual functions
- Integration tests for API endpoints
- Mocked external dependencies (Docker, filesystem, database)

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('specific functionality', () => {
    it('should handle the expected case', () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle error cases', () => {
      // Test error handling
      expect(() => functionWithError()).toThrow('Expected error message');
    });
  });
});
```

### Testing Requirements

- **Coverage**: Aim for >90% test coverage
- **Mocking**: Mock all external dependencies (Docker, filesystem, network)
- **Error cases**: Test both success and failure scenarios
- **Environment**: Tests should run without external dependencies

### Running Tests

```bash
# All tests
yarn test

# Specific workspace
yarn test:client
yarn test:server

# Watch mode
yarn test --watch

# Coverage report
yarn test --coverage
```

## 📤 Submitting Changes

### Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Write code following the style guidelines
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   yarn test
   npx eslint .
   yarn format
   ```

4. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

### Commit Message Format

We use conventional commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(client): add dry run mode for testing
fix(server): handle missing port labels correctly
docs: update README with new environment variables
test(server): add tests for dry run functionality
```

### Pull Request Guidelines

**Before submitting:**
- [ ] Tests pass (`yarn test`)
- [ ] Linting passes (`npx eslint .`)
- [ ] Code is formatted (`yarn format`)
- [ ] Documentation is updated
- [ ] Commit messages follow convention

**PR Description should include:**
- Clear description of the change
- Motivation and context
- Breaking changes (if any)
- Testing instructions

### Review Process

1. **Automated checks**: CI runs tests and linting
2. **Code review**: Maintainers review the code
3. **Feedback**: Address any review comments
4. **Approval**: PR approved by maintainer
5. **Merge**: Squash and merge to main branch

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update version** in `package.json` files
2. **Update CHANGELOG.md** with new changes
3. **Create release tag**
   ```bash
   git tag -a v1.2.3 -m "Release v1.2.3"
   git push origin v1.2.3
   ```
4. **GitHub release** created automatically
5. **Docker images** built and published

## 🐛 Bug Reports

When reporting bugs, please include:

- **Environment**: OS, Node.js version, Docker version
- **Steps to reproduce**: Clear, numbered steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Logs**: Relevant error messages or logs
- **Configuration**: Environment variables (redact sensitive data)

Use this template:

```markdown
## Bug Description
Brief description of the issue

## Environment
- OS: Ubuntu 22.04
- Node.js: v18.17.0
- Docker: 24.0.5

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Logs
```
error logs here
```

## Configuration
```bash
CHS_HANDSHAKE_KEY=***
CHS_SERVER_URL=http://localhost:3030
# ... other relevant config
```
```

## 💡 Feature Requests

For feature requests, please:

1. **Check existing issues** to avoid duplicates
2. **Describe the problem** you're trying to solve
3. **Propose a solution** with implementation details
4. **Consider alternatives** and their trade-offs
5. **Assess impact** on existing functionality

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check README.md and code comments

## 🙏 Recognition

Contributors will be recognized in:

- GitHub contributors list
- Release notes for significant contributions
- README acknowledgments section

Thank you for contributing to Caddy Handle Scraper! 🎉