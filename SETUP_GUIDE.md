# 🚀 Distributed AI Inference Platform - Complete Setup Guide

Welcome to the **Distributed AI Inference Platform**! This guide will walk you through setting up the entire system from scratch, including the backend services, frontend web UI, and CLI client.

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [System Overview](#-system-overview)
3. [Environment Setup](#-environment-setup)
4. [Backend Setup](#-backend-setup)
5. [Frontend Setup](#-frontend-setup)
6. [CLI Client Setup](#-cli-client-setup)
7. [Verification & Testing](#-verification--testing)
8. [Usage Examples](#-usage-examples)
9. [Troubleshooting](#-troubleshooting)
10. [Service Management](#-service-management)

---

## 🔧 Prerequisites

### Required Software

1. **Node.js** (v16.0 or higher)
   ```bash
   # Check your Node.js version
   node --version
   # Should return v16.0.0 or higher
   ```

2. **npm** (comes with Node.js)
   ```bash
   # Check your npm version
   npm --version
   ```

3. **Git** (for cloning the repository)
   ```bash
   git --version
   ```

4. **Ollama** (for AI model integration)
   - Visit [ollama.ai](https://ollama.ai/) for installation instructions
   - Install the Llama3 model:
   ```bash
   # After installing Ollama
   ollama pull llama3
   ```

### System Requirements

- **Operating System**: macOS, Linux, or Windows
- **Memory**: Minimum 4GB RAM (8GB+ recommended for AI models)
- **Storage**: At least 10GB free space (for AI models)
- **Network**: Internet connection for model downloads

---

## 🏗️ System Overview

The platform consists of several interconnected components:

```
[Web UI] ──────┐    ┌──[Auth Worker]
               │    │
[CLI Tool] ────┼────┤    ┌──[Processor Worker] ──► [Ollama/Llama3]
               │    │    │
               └────► [Gateway Worker] ──┘
                    ▲
                    │
               [Bridge Server]
                    ▲
                    │
               [Client Worker]
```

**Components:**
- **Frontend**: React web application with Material-UI
- **Bridge Server**: HTTP API connecting web UI to backend
- **Client Worker**: Request orchestration and session management
- **Gateway Worker**: Authentication and request routing
- **Auth Worker**: User registration and authentication
- **Processor Worker**: AI inference integration with Ollama

---

## 🌍 Environment Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd distrubuted-Inference
```

### 2. Project Structure Overview

```
distrubuted-Inference/
├── BackEnd/                 # Backend services and workers
│   ├── auth_worker/         # Authentication service
│   ├── client_worker/       # Client orchestration
│   ├── gateway_worker/      # Request routing
│   ├── processor_worker/    # AI inference
│   ├── config/              # Configuration files
│   ├── logs/                # Log files (created automatically)
│   └── manage-workers.sh    # Service management script
└── FrontEnd/                # React web application
    ├── src/
    ├── public/
    └── package.json
```

### 3. Environment Variables

The system will automatically create a `.env` file in the BackEnd directory with default values. You can customize these settings:

```bash
cd BackEnd
```

Create or edit `.env` file:
```bash
# JWT Configuration
JWT_SECRET=distributed-ai-secure-secret-key-2025

# Rate Limiting Configuration
MAX_REQUESTS_PER_INTERVAL=10
RESET_INTERVAL_MINUTE=1

# Bridge Server Port
PORT=3000
```

---

## ⚙️ Backend Setup

### 1. Install Backend Dependencies

```bash
cd BackEnd
npm install
```

This will install all required dependencies including:
- Authentication libraries (bcrypt, jsonwebtoken)
- HTTP server (express)
- Worker framework (bfx-wrk-base)
- P2P networking (hp-svc-facs-net)
- Storage facilities (hp-svc-facs-store)

### 2. Directory Structure (Auto-Created)

**No manual directory creation is required!** ✅

### 3. Start Backend Services

You have two options for starting the backend services:

#### Option A: Use the Management Script (Recommended)

```bash
# Make the script executable
chmod +x manage-workers.sh

# Start all core services
./manage-workers.sh start all
```

This will start:
- Auth Worker (port: auto-assigned via P2P)
- Gateway Worker (port: auto-assigned via P2P)
- Processor Worker (port: auto-assigned via P2P)
- Bridge Server (port: 3000)

#### Option B: Start Services Manually

Open 4 separate terminal windows and run:

**Terminal 1 - Auth Worker:**
```bash
cd BackEnd
npm run start:auth
```

**Terminal 2 - Gateway Worker:**
```bash
cd BackEnd
npm run start:gateway
```

**Terminal 3 - Processor Worker:**
```bash
cd BackEnd
npm run start:processor
```

**Terminal 4 - Bridge Server:**
```bash
cd BackEnd
npm run start:bridge
```

### 4. Verify Backend Services

Check that all services are running:

```bash
# Using the management script
./manage-workers.sh check

# Or manually check processes
ps aux | grep "worker"
```

You should see all workers running and the bridge server listening on port 3000.

---

## 🌐 Frontend Setup

### 1. Install Frontend Dependencies

```bash
cd FrontEnd
npm install
```

This installs:
- React framework
- Material-UI components
- React Router for navigation
- Axios for HTTP requests

### 2. Configure Frontend Port (Already Done)

The frontend is pre-configured to run on **port 4012** via the `package.json` script:
```json
"start": "PORT=4012 react-scripts start"
```

### 3. Start the Frontend Development Server

```bash
npm start
```

The React development server will start and open your browser to:
```
http://localhost:4012
```

**Note**: The frontend runs on port 4012, while the bridge server runs on port 3000.

### 4. Frontend Features

The web interface provides:
- **User Registration**: Create new user accounts
- **User Login**: Authenticate with existing accounts
- **API Token Management**: Generate and manage API tokens
- **AI Prompt Interface**: Send prompts to AI models
- **Rate Limit Display**: View current usage and limits
- **Navigation**: Easy switching between features

---

## 💻 CLI Client Setup

### 1. Start the CLI Client

The CLI client is part of the backend services but runs separately for interactive use:

```bash
cd BackEnd
npm run start:cli
```

### 2. CLI Commands

Once the CLI starts, you'll see available commands:

```
💡 Available commands:
💡   • Type any prompt to send to the AI model
💡   • Type "register <email> <password>" to register a new user
💡   • Type "login <email> <password>" to login a user
💡   • Type "logout" to clear session and logout
💡   • Type "settoken <token>" to set API token manually
💡   • Type "gettoken" to get current API token
💡   • Type "status" to show authentication status
💡   • Type "help" to see all commands
💡   • Type "exit" to quit
🌐   Get API tokens from web UI: http://localhost:4012
```

### 3. CLI Usage Examples

```bash
# Register a new user
register user@example.com mypassword

# Login with existing credentials
login user@example.com mypassword

# Send an AI prompt
What is the weather like today?

# Check authentication status
status

# Get current API token
gettoken

# Exit the CLI
exit
```

---

## ✅ Verification & Testing

### 1. Service Health Check

```bash
cd BackEnd

# Check all services
./manage-workers.sh check

# Check logs
./manage-workers.sh logs
```

### 2. Test API Endpoints

Test the bridge server endpoints:

```bash
# Test registration endpoint
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# Test login endpoint
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'
```

### 3. Test Web Interface

1. Open browser to `http://localhost:4012`
2. Register a new user account
3. Login with the created account
4. Generate an API token
5. Send a test prompt to the AI

### 4. Test CLI Interface

1. Start the CLI client: `npm run start:cli`
2. Register a user: `register test@example.com password123`
3. Login: `login test@example.com password123`
4. Send AI prompt: `Write a haiku about technology`

---

## 📖 Usage Examples

### Web Interface Workflow

1. **Open the Web UI**
   ```
   http://localhost:4012
   ```

2. **Register a New User**
   - Click "Register" in the navigation
   - Enter email and password
   - Click "Register" button

3. **Login**
   - Click "Login" in the navigation
   - Enter your credentials
   - Click "Login" button

4. **Generate API Token**
   - After login, you'll see an API token modal
   - Copy the generated token for future use

5. **Send AI Prompts**
   - Go to the main prompt page
   - Enter your question or prompt
   - Click "Send Query"
   - View the AI response

### CLI Workflow

```bash
# Start CLI
npm run start:cli

# Register and login
register developer@example.com devpass123
login developer@example.com devpass123

# Send prompts
Explain quantum computing in simple terms
Write a Python function to calculate fibonacci numbers
What are the benefits of microservice architecture?

# Check status and exit
status
exit
```

### API Integration

For external applications, use the bridge server API:

```javascript
// Register user
const registerResponse = await fetch('http://localhost:3000/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'api@example.com',
    password: 'apipass123'
  })
});

// Login user
const loginResponse = await fetch('http://localhost:3000/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'api@example.com',
    password: 'apipass123'
  })
});

const { key } = await loginResponse.json();

// Send inference request
const inferenceResponse = await fetch('http://localhost:3000/inference', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  },
  body: JSON.stringify({
    query: 'Explain machine learning'
  })
});
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Services Won't Start

**Problem**: Workers fail to start or crash immediately

**Solutions**:
```bash
# Check Node.js version
node --version  # Should be 16.0+

# Clear old data and restart
cd BackEnd
./cleanup.sh
./manage-workers.sh restart

# Check for port conflicts
lsof -i :3000  # Should only show bridge server
```

#### 2. Ollama Connection Issues

**Problem**: AI prompts fail with Ollama errors

**Solutions**:
```bash
# Check if Ollama is running
ollama list

# Start Ollama service if needed
ollama serve

# Verify Llama3 model is installed
ollama pull llama3

# Test Ollama directly
ollama run llama3 "Hello world"
```

#### 3. Frontend Connection Issues

**Problem**: Web UI can't connect to backend

**Solutions**:
```bash
# Verify bridge server is running
curl http://localhost:3000/health

# Check CORS settings in bridge.server.js
# Ensure Access-Control-Allow-Origin is set

# Restart bridge server
cd BackEnd
./manage-workers.sh stop bridge
./manage-workers.sh start bridge
```

#### 4. P2P Discovery Issues

**Problem**: Workers can't find each other

**Solutions**:
```bash
# Check network configuration
cat BackEnd/config/facs/dev.net.config.json

# Restart all workers with delay
./manage-workers.sh stop
sleep 5
./manage-workers.sh start all

# Check firewall settings (allow local connections)
```


---
## 🎛️ Service Management

### Using the Management Script

The `manage-workers.sh` script provides comprehensive service management:

```bash
# Interactive menu
./manage-workers.sh

# Direct commands
./manage-workers.sh check          # Check status
./manage-workers.sh start all      # Start all services
./manage-workers.sh stop          # Stop all services
./manage-workers.sh restart       # Restart all services
./manage-workers.sh start auth    # Start specific service
./manage-workers.sh stop gateway  # Stop specific service
./manage-workers.sh logs          # View logs directory
```

### Manual Service Management

```bash
# Start individual services
npm run start:auth       # Auth worker
npm run start:gateway    # Gateway worker
npm run start:processor  # Processor worker
npm run start:bridge     # Bridge server
npm run start:cli        # CLI client

# Check running processes
ps aux | grep "node.*worker"

# Kill specific processes
pkill -f "auth-worker.js"
pkill -f "gateway-worker.js"
```



## 🎉 You're All Set!

Your Distributed AI Inference Platform is now ready for use! 

### Quick Test Checklist

- [ ] Backend services are running (check with `./manage-workers.sh check`)
- [ ] Frontend is accessible at `http://localhost:4012`
- [ ] Bridge server responds at `http://localhost:3000`
- [ ] Ollama is running with Llama3 model
- [ ] User registration works via web UI
- [ ] User login works via web UI
- [ ] AI prompts return responses
- [ ] CLI client connects and works

### Next Steps

1. **Explore the Web Interface**: Try different AI prompts and user management features
2. **Test the CLI**: Experience the command-line interface for development workflows
3. **Monitor Services**: Keep an eye on logs and service health
4. **Scale**: Consider adding more processor workers for increased capacity

### Getting Help

- Check the `logs/` directory for detailed error information
- Use the troubleshooting section above for common issues
