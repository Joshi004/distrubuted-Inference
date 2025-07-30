# 🏗️ Distributed AI Inference Platform - System Architecture

## 📋 Overview

The Distributed AI Inference Platform is a microservice-based system that provides AI inference capabilities as a service. The platform enables users to register, authenticate, and interact with AI models through both CLI and web interfaces.

**Key Characteristics:**
- **Microservice Architecture**: Loosely coupled workers handling specific domains
- **P2P Communication**: Workers communicate via RPC 
- **Event-Driven**: Asynchronous message passing between services
- **Secure**: JWT-based authentication with API key management

---

## 🔄 System Request Flow

The system follows a clear request flow from frontend to backend:

1. **Frontend** (React Web UI) → **Bridge Server** (HTTP/WebSocket interface)
2. **Bridge Server** → **Client Worker** (Request orchestration)
3. **Client Worker** → **Gateway Worker** (Authentication & routing)
4. **Gateway Worker** → **Auth Worker** OR **Processor Worker** (based on request type)
5. **Processor Worker** → **Ollama/Llama3** (AI inference)
6. Response flows back through the same chain

---

## 🎯 Application Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
│                                                             │
│  🌐 React Web UI              💻 CLI Interface              │
│  (Material-UI)                 (Interactive Tool)           │
└─────────────────┬─────────────────────┬─────────────────────┘
                  │                     │
                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  INTERFACE LAYER                            │
│                                                             │
│           🌉 Bridge Server          👤 Client Worker        │
│         (HTTP/WebSocket)           (Request Orchestration)  │
└─────────────────────────────────────────┬───────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   CORE BACKEND                              │
│                                                             │
│                🚪 Gateway Worker                            │
│            (Authentication & Routing)                      │
│                        │                                   │
│        ┌───────────────┼───────────────┐                   │
│        ▼               │               ▼                   │
│  🔐 Auth Worker        │        🤖 Processor Worker         │
│ (User Management)      │       (AI Integration)            │
│                        │               │                   │
└────────────────────────┼───────────────┼───────────────────┘
                         │               ▼
                         │    ┌─────────────────────┐
                         │    │   EXTERNAL LAYER    │
                         │    │                     │
                         │    │  🧠 Ollama/Llama3   │
                         │    │   (AI Models)       │
                         │    └─────────────────────┘
                         │
                    [Future: Other
                     Workers/Services]
```

**Request Flow:**
- **Authentication**: Web UI/CLI → Bridge → Client → Gateway → Auth Worker
- **AI Inference**: Web UI/CLI → Bridge → Client → Gateway → Processor → Ollama

---

## 🏗️ Core Components

### 🌐 Frontend Layer
- **React Web Application**: Modern UI built with Material-UI for user interactions
- **CLI Interface**: Command-line tool for developers and power users

### 🔧 Interface Layer
- **Bridge Server**: HTTP/WebSocket server that connects web UI to backend workers
- **Client Worker**: Orchestrates requests and manages user sessions

### ⚙️ Core Backend Workers

#### 🚪 Gateway Worker
- **Purpose**: Central routing and authentication hub
- **Responsibilities**:
  - Validates all incoming requests
  - Performs authentication and authorization
  - Routes requests to appropriate workers (Auth or Processor)
  - Applies rate limiting (future enhancement)
  - Tracks usage statistics (future enhancement)

#### 🔐 Auth Worker  
- **Purpose**: User management and authentication
- **Responsibilities**:
  - User registration and login
  - JWT token generation and validation
  - API key management
  - User data persistence

#### 🤖 Processor Worker
- **Purpose**: AI inference processing
- **Responsibilities**:
  - Processes AI prompts
  - Integrates with Ollama/Llama3 models
  - Handles model selection and configuration
  - Returns AI responses

---

## 📚 Core Libraries

The system is built on three foundational libraries:

### 1. **bfx-wrk-base**
- Base worker framework providing common functionality
- RPC server/client implementation
- Lifecycle management (start, stop, restart)
- Facility management system

### 2. **hp-svc-facs-net** 
- P2P networking layer for inter-worker communication
- Handles service discovery and RPC calls
- Provides encrypted communication between workers

### 3. **hp-svc-facs-store**
- Distributed storage using Hyperbee
- Key-value storage for user data, sessions, and configurations
- Provides data persistence across worker restarts

---

## 🔄 Authentication Flow

```
[User Login Request] → [Bridge Server] → [Client Worker] → [Gateway Worker] 
                                                               ↓
[JWT Token Response] ← [Bridge Server] ← [Client Worker] ← [Auth Worker]
```

1. User submits credentials via web UI or CLI
2. Request flows through Bridge Server → Client Worker → Gateway Worker
3. Gateway Worker forwards to Auth Worker for validation
4. Auth Worker generates JWT token and returns response
5. Token flows back to user interface

---

## 🔄 AI Inference Flow

```
[AI Prompt] → [Bridge Server] → [Client Worker] → [Gateway Worker]
                                                       ↓
[AI Response] ← [Bridge Server] ← [Client Worker] ← [Processor Worker] ← [Ollama]
```

1. User submits AI prompt via interface
2. Gateway Worker validates authentication
3. Gateway Worker routes to Processor Worker
4. Processor Worker calls Ollama/Llama3 for inference
5. AI response flows back to user

---

## 📊 Supporting Services

### 📝 Logging System
- **Centralized Logging**: All workers use shared logger
- **Structured Output**: JSON format for easy parsing
- **File-based Storage**: Logs written to `BackEnd/logs/`
  - `error.log` - Error messages and exceptions
  - `event.log` - General application events

### 📈 Metrics Collection
- **Prometheus Integration**: Standard metrics format
- **Worker-specific Metrics**: Each worker exposes metrics on different ports
  - Gateway: `http://localhost:9100/metrics`
  - Auth: `http://localhost:9101/metrics`
  - Processor: `http://localhost:9102/metrics`
- **System Metrics**: CPU, memory, request counters, response times

---

## 💾 Data Storage

Each worker maintains its own data directory:
- `data/auth/` - User accounts, JWT tokens, API keys
- `data/client/` - Client sessions and preferences
- `data/gateway/` - Rate limiting and usage tracking data
- `data/processor/` - Model cache and request history

---

## 🚀 Future Enhancements

### Short-term Improvements
- **Enhanced Rate Limiting**: More comprehensive request throttling per user/API key
- **Advanced Usage Tracking**: Detailed analytics and quota management
- **Improved Security**: Replace static JWT secrets with dynamic key rotation and enhanced encryption

### Production Readiness
- **Docker Containerization**: Package workers as Docker containers
- **Kubernetes Deployment**: Orchestrate services using Kubernetes for scalability
- **Load Balancing**: Distribute requests across multiple worker instances

The system can be extended to support additional AI backends, more sophisticated caching mechanisms, and advanced monitoring dashboards as requirements evolve.

