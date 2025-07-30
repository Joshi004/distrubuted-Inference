# 🤖 Distributed AI Inference Platform

A P2P distributed AI inference system with microservices architecture. Users interact with AI models through web UI, CLI, or API interfaces backed by secure authentication and intelligent routing.

## 📋 Quick Reference Guide

This README serves as a navigation hub to all project documentation. The platform consists of:
- **Frontend**: React web application with Material-UI
- **Backend**: Four P2P worker services (Auth, Gateway, Processor, Client)
- **External**: Ollama AI service for model inference

## 📚 Complete Documentation Index

### 📋 Project Setup & Architecture
- [**SETUP_GUIDE.md**](SETUP_GUIDE.md) - Complete installation and configuration guide for the entire platform including prerequisites, environment setup, and verification steps
- [**SYSTEM_ARCHITECTURE.md**](SYSTEM_ARCHITECTURE.md) - Detailed system architecture, request flow diagrams, and microservice interactions

### 🖥️ Frontend Documentation
- [**FrontEnd/README.md**](FrontEnd/README.md) - React application setup, features, and usage instructions for the web UI
- [**FrontEnd/FRONTEND_ARCHITECTURE.md**](FrontEnd/FRONTEND_ARCHITECTURE.md) - Frontend architecture patterns, component structure, routing, and authentication flow

### ⚙️ Backend Documentation
- [**BackEnd/README.md**](BackEnd/README.md) - Backend overview with quick start guide and links to all backend services

#### 🔧 Worker Service APIs
- [**BackEnd/auth_worker/auth-worker-api-guide.md**](BackEnd/auth_worker/auth-worker-api-guide.md) - Authentication service endpoints for user registration, login, and JWT token management
- [**BackEnd/gateway_worker/gateway-worker-api-guide.md**](BackEnd/gateway_worker/gateway-worker-api-guide.md) - Gateway service for request routing, rate limiting, and security enforcement
- [**BackEnd/processor_worker/processor-worker-api-guide.md**](BackEnd/processor_worker/processor-worker-api-guide.md) - AI inference service integration with Ollama/Llama3 for text processing
- [**BackEnd/client_worker/client-worker-api-guide.md**](BackEnd/client_worker/client-worker-api-guide.md) - Client interface service providing CLI, HTTP bridge, and programmatic API access

#### 🏗️ Infrastructure Guides
- [**BackEnd/docs/logging-system-guide.md**](BackEnd/docs/logging-system-guide.md) - Dual logging architecture with structured logs and human-readable output for monitoring and debugging
- [**BackEnd/docs/prometheus-metrics-guide.md**](BackEnd/docs/prometheus-metrics-guide.md) - Performance monitoring setup with Prometheus metrics and custom gauges
- [**BackEnd/docs/worker-management-guide.md**](BackEnd/docs/worker-management-guide.md) - Process management, deployment scripts, and worker lifecycle management
- [**BackEnd/docs/test-infrastructure-guide.md**](BackEnd/docs/test-infrastructure-guide.md) - Testing framework setup with Brittle, test organization, and execution guidelines

#### 📦 Package Dependencies
- [**BackEnd/bfx-wrk-base/README.md**](BackEnd/bfx-wrk-base/README.md) - Base worker framework providing common functionality for all microservices
- [**BackEnd/hp-svc-facs-net/README.md**](BackEnd/hp-svc-facs-net/README.md) - P2P networking service facilitator for Hyperswarm DHT communication
- [**BackEnd/hp-svc-facs-store/README.md**](BackEnd/hp-svc-facs-store/README.md) - Storage service facilitator for persistent data management

## 🚀 Quick Start

1. **Prerequisites**: Node.js, npm, Ollama with Llama3 model
2. **Install**: `npm install` in both BackEnd and FrontEnd directories
3. **Start Backend**: Run auth, gateway, processor, and client workers
4. **Start Frontend**: Launch React development server
5. **Access**: Web UI at http://localhost:3000 or use CLI client

For detailed setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

## 🔧 Technology Stack

**Backend:**
- Node.js with Hyperswarm P2P networking
- Ollama/Llama3 for AI inference
- bcrypt + JWT for authentication
- Prometheus for metrics
- Brittle + Sinon for testing

**Frontend:**
- React 18 with Material-UI (MUI) v5
- React Router for navigation
- Axios for HTTP communication
- Context API for state management

## 🔐 Security Features

- JWT-based authentication with 24-hour expiration
- Rate limiting (10 requests/minute per user)
- Input validation and sanitization
- Secure password hashing with bcrypt
- P2P network security with encrypted communication

## 📊 Monitoring & Observability

- Structured JSON logging with request tracing
- Prometheus metrics for performance monitoring
- Human-readable debug logs for development
- Comprehensive error handling and reporting

## 🏆 License

This project is part of the distributed AI inference platform ecosystem.

## 📁 Project Structure Design

We have made a deliberate design choice to keep both frontend and backend in the same repository for ease of cloning, sharing, and development. This monorepo approach simplifies setup and ensures version compatibility between all components.
