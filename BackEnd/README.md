# Distributed AI Inference Backend

A peer-to-peer distributed AI inference platform built with Node.js that provides scalable AI processing through microservices architecture. The system uses Hyperswarm for P2P networking and integrates with Ollama/Llama3 for AI model inference.

## Overview

This backend implements a distributed system where multiple worker services communicate over a P2P network to provide authenticated AI inference capabilities. The architecture separates concerns into specialized workers that handle authentication, request routing, and AI processing.

## Core Components

- **AuthWorker** - User authentication and JWT token management
- **GatewayWorker** - Request routing, rate limiting, and security enforcement  
- **ProcessorWorker** - AI inference engine using Ollama/Llama3 integration
- **ClientWorker** - Client-side interfaces (CLI, HTTP bridge, programmatic API)

## Quick Start

```bash
# Install dependencies
npm install

# Start all services (requires separate terminals)
npm run start:auth       # Authentication service
npm run start:gateway    # Gateway service  
npm run start:processor  # AI processing service
npm run start:bridge     # HTTP API bridge
# or
npm run start:cli        # Interactive CLI client

# Run tests
npm test

# Cleanup processes
npm run cleanup
```

## API Interfaces

- **HTTP REST API**: `POST /inference` on port 3000 (via bridge server)
- **Interactive CLI**: Command-line interface for direct interaction
- **P2P RPC**: Direct peer-to-peer communication between services
- **Programmatic API**: ClientWorker class for integration

## Documentation

### Worker API Guides
- [AuthWorker API Guide](auth_worker/auth-worker-api-guide.md) - Authentication and user management
- [GatewayWorker API Guide](gateway_worker/gateway-worker-api-guide.md) - Request routing and security
- [ProcessorWorker API Guide](processor_worker/processor-worker-api-guide.md) - AI inference processing
- [ClientWorker API Guide](client_worker/client-worker-api-guide.md) - Client interfaces and session management

### Worker Documentation
- [AuthWorker README](auth_worker/README.md) - Authentication service setup and usage
- [ClientWorker README](client_worker/README.md) - Client interfaces and bridge server

### Infrastructure Guides
- [Logging System Guide](docs/logging-system-guide.md) - Dual logging architecture and monitoring
- [Prometheus Metrics Guide](docs/prometheus-metrics-guide.md) - Performance monitoring and metrics
- [Worker Management Guide](docs/worker-management-guide.md) - Process management and deployment
- [Test Infrastructure Guide](docs/test-infrastructure-guide.md) - Testing framework and practices

## Architecture

The system uses a microservices architecture with P2P communication:

1. **Client** submits requests via HTTP/CLI → **ClientWorker**
2. **ClientWorker** routes authenticated requests → **GatewayWorker** 
3. **GatewayWorker** enforces security/rate limits → **ProcessorWorker**
4. **ProcessorWorker** processes via Ollama → returns AI response

## Dependencies

- **Runtime**: Node.js with Hyperswarm P2P networking
- **AI Engine**: Ollama with Llama3 model (external service)
- **Authentication**: bcrypt + JWT tokens
- **Testing**: Brittle framework with Sinon mocking
- **Monitoring**: Prometheus metrics + structured logging

## Security Features

- JWT-based authentication with 24-hour token expiration
- Rate limiting (10 requests/minute per user)
- Input validation and error handling
- Secure password hashing with bcrypt


