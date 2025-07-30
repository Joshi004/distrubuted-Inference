# 💻 ClientWorker API Guide

## 📋 Service Overview

The **ClientWorker** is the client-side orchestration service that provides both programmatic and HTTP interfaces for interacting with the distributed platform. It handles session management, request routing to the gateway, and provides both CLI and web UI interfaces.

**Core Function**: Acts as the client-side proxy that manages authentication sessions and routes requests to the GatewayWorker while providing multiple interface options.

---

## 🎯 What This Service Does

- **Session Management**: Manages JWT tokens and user authentication state
- **Request Orchestration**: Routes requests to GatewayWorker with automatic authentication
- **Multiple Interfaces**: Provides CLI, HTTP REST API, and programmatic interfaces
- **Robust Connectivity**: Implements retry logic and handles stale DHT announcements
- **Authentication Flow**: Handles user registration, login, logout, and session verification
- **Error Handling**: Provides comprehensive error handling and user-friendly messages

---

## 📡 Exposed Endpoints

### **Programmatic Methods** (ClientWorker Class)

#### 1. `sendRequest(inputPrompt)`
- **Purpose**: Send AI inference requests
- **Input**: `"Your question or prompt here"`
- **Output**: `{ prompt: "...", response: "AI response", processed_at: "...", requestId: "..." }`
- **Auth Required**: Yes (automatic via stored session)

#### 2. `registerUser(email, password)`
- **Purpose**: Register new user account
- **Input**: `email: "user@example.com", password: "password123"`
- **Output**: `{ success: true, status: 201, message: "User registered successfully", email: "..." }`
- **Auth Required**: No

#### 3. `loginUser(email, password)`
- **Purpose**: Authenticate user and store session
- **Input**: `email: "user@example.com", password: "password123"`
- **Output**: `{ success: true, status: 200, email: "...", key: "jwt_token" }`
- **Auth Required**: No

#### 4. `logout()`
- **Purpose**: Clear current session
- **Input**: None
- **Output**: `{ success: true, message: "Logged out successfully" }`
- **Auth Required**: No

#### 5. `verifySession()`
- **Purpose**: Validate current session
- **Input**: None
- **Output**: `{ success: true, valid: true, email: "...", rateLimitInfo: {...} }`
- **Auth Required**: Yes (automatic via stored session)

#### 6. `getApiToken()`
- **Purpose**: Get current JWT token
- **Input**: None
- **Output**: `{ success: true, token: "jwt_token", message: "API token retrieved successfully" }`
- **Auth Required**: No (returns stored session token)

### **HTTP REST API** (Bridge Server)

#### User Management
- **POST** `/register` - User registration
  - **Body**: `{ email: "user@example.com", password: "password123" }`
  - **Response**: `{ success: true, status: 201, message: "User registered successfully" }`

- **POST** `/login` - User authentication
  - **Body**: `{ email: "user@example.com", password: "password123" }`
  - **Response**: `{ success: true, status: 200, email: "...", key: "jwt_token" }`

#### AI Inference
- **POST** `/inference` - AI prompt processing
  - **Body**: `{ query: "Your question here" }`
  - **Headers**: `Authorization: Bearer jwt_token`
  - **Response**: `{ prompt: "...", response: "AI response", processed_at: "..." }`

#### Session Management
- **POST** `/verify-session` - Session validation
  - **Headers**: `Authorization: Bearer jwt_token`
  - **Response**: `{ valid: true, email: "...", rateLimitInfo: {...} }`

- **POST** `/get-api-token` - Get API token
  - **Response**: `{ success: true, token: "jwt_token" }`

#### Health Check
- **GET** `/health` - Service health check
  - **Response**: `{ status: "healthy", timestamp: 1643723400000 }`

### **CLI Interface**

#### Interactive Commands
- `register <email> <password>` - Register new user
- `login <email> <password>` - Login user
- `logout` - Clear session
- `status` - Show authentication status
- `gettoken` - Display current API token
- `settoken <token>` - Set API token manually
- `help` - Show available commands
- `exit` - Quit CLI
- `<any text>` - Send as AI prompt

---

## 🔗 External Dependencies

### **Required Services**
1. **GatewayWorker**: 
   - **Topic**: `gateway`
   - **Purpose**: Request routing, authentication, and rate limiting
   - **Methods**: processPrompt, register, login, verifySession

### **Required Infrastructure**
2. **P2P Network**: 
   - **Framework**: `hp-svc-facs-net`
   - **Purpose**: Service discovery and RPC communication to gateway

3. **Storage**: 
   - **Framework**: `hp-svc-facs-store`
   - **Directory**: `./data/client`
   - **Purpose**: Client-side data storage (future use)

### **HTTP Interface Dependencies**
4. **Express Server**: 
   - **Purpose**: HTTP REST API for web UI integration
   - **Port**: 3000 (configurable via PORT environment variable)
   - **Features**: CORS enabled, JSON parsing, error handling

### **Runtime Requirements**
- **Node.js**: Version 16+
- **Network**: Access to GatewayWorker service via P2P
- **Environment Variables**: `PORT` (optional, defaults to 3000)

---

## 🚀 Quick Start

### **Programmatic Usage**
```javascript
const ClientWorker = require('./client-worker.js')

const worker = new ClientWorker(conf, ctx)
worker.start(async (err) => {
  if (err) throw err
  
  // Register and login
  await worker.registerUser('user@example.com', 'password123')
  await worker.loginUser('user@example.com', 'password123')
  
  // Send AI prompt
  const result = await worker.sendRequest('Explain quantum computing')
  console.log(result.response)
})
```

### **CLI Usage**
```bash
# Start interactive CLI
npm run start:cli

# Use commands
register user@example.com password123
login user@example.com password123
What is machine learning?
exit
```

### **HTTP API Usage**
```bash
# Start bridge server
npm run start:bridge

# Register user
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Login and get token
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Send AI prompt
curl -X POST http://localhost:3000/inference \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query":"Explain artificial intelligence"}'
```

---

## 🔧 Configuration

### **Environment**
- **HTTP Port**: 3000 (configurable via `PORT` environment variable)
- **P2P Topic**: Connects to `gateway` topic
- **Storage Dir**: `./data/client`
- **Session Storage**: In-memory JWT token storage

### **Key Files**
- **Main**: `client_worker/client-worker.js`
- **Helper**: `client_worker/client-helper.js`
- **Bridge Server**: `client_worker/bridge.server.js`
- **CLI Interface**: `client_worker/cli-client.js`
- **Tests**: `tests/unit/workers/client_worker/` (if exists)

### **Connection Settings**
- **Retry Logic**: 3 retries with 200ms base delay
- **Robust Requests**: Handles stale DHT announcements automatically
- **Error Recovery**: Comprehensive error detection and recovery

---

## 🔐 Session Management

### **Authentication Flow**
1. **Registration/Login**: Stores JWT token in `sessionKey` property
2. **Automatic Auth**: Automatically includes JWT in protected requests
3. **Session Persistence**: Token persists for worker lifetime
4. **Manual Token Setting**: Supports manual token setting via CLI
5. **Session Verification**: Can validate current session status

### **Protected vs Public Methods**
- **Protected**: `sendRequest()`, `verifySession()` (require active session)
- **Public**: `registerUser()`, `loginUser()`, `logout()`, `getApiToken()`

---

## ⚠️ Common Error Types

1. **No Session**: `"No active session - please login first"`
2. **Gateway Unavailable**: `"Gateway worker may not be running"` 
3. **Network Issues**: `"Connection was closed"` or `"CHANNEL_CLOSED"`
4. **Stale Announcements**: `"This may be a stale DHT announcement"`
5. **Service Unavailable**: `"Client worker is not ready yet"` (HTTP)
6. **Authentication Failed**: `"Unauthorized: Invalid or expired token"`

---

## 🔄 Interface Comparison

| Feature | Programmatic | CLI | HTTP API |
|---------|-------------|-----|----------|
| **Session Management** | Automatic | Interactive | Stateless |
| **Error Handling** | Exceptions | User-friendly messages | HTTP status codes |
| **Use Case** | Integration | Development/Testing | Web UI |
| **Authentication** | Stored in instance | Stored in session | Stored on CLI Session |
| **Retry Logic** | Built-in | Built-in | Client responsibility |

---

## 📊 Monitoring

- **Logs**: Written to `logs/event.log`, `logs/error.log`
- **HTTP Logs**: Bridge server requests logged separately
- **Request Tracking**: Each request gets unique ID for tracing
- **Session Events**: JWT token operations logged
- **Error Categories**: Specific error types for troubleshooting
- **Health Endpoint**: HTTP `/health` for service monitoring