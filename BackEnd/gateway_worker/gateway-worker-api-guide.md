# 🚪 GatewayWorker API Guide

## 📋 Service Overview

The **GatewayWorker** is the central routing and authentication hub of the distributed platform. It acts as the main entry point for all client requests, handling authentication, rate limiting, and routing requests to appropriate backend services.

**Core Function**: Routes authenticated requests to AuthWorker or ProcessorWorker while enforcing rate limits and security policies.

---

## 🎯 What This Service Does

- **Request Routing**: Forwards requests to appropriate backend services (auth/processor)
- **Authentication**: Validates JWT tokens for protected endpoints
- **Rate Limiting**: Enforces per-user request limits (default: 10 requests/minute)
- **Service Discovery**: Discovers and connects to AuthWorker and ProcessorWorker instances
- **P2P Gateway**: Announces itself as `gateway` topic on the DHT network
- **Security Enforcement**: Protects API endpoints with token validation
- **Metrics & Logging**: Tracks routing performance and authentication events

---

## 📡 Exposed Endpoints

### **RPC Methods** (P2P Network)

#### 1. `ping()`
- **Purpose**: Health check
- **Input**: None
- **Output**: `{ status: "healthy", timestamp: 1643723400000, service: "gateway" }`

#### 2. `processPrompt(data)`
- **Purpose**: AI inference routing (requires authentication)
- **Input**: `{ data: { prompt: "Your question" }, meta: { key: "jwt_token" } }`
- **Output**: `{ prompt: "...", response: "AI response", processed_at: "...", requestId: "..." }`
- **Auth Required**: Yes (JWT token in meta.key)

#### 3. `register(data)`
- **Purpose**: User registration routing
- **Input**: `{ data: { email: "user@example.com", password: "password123" }, meta: {} }`
- **Output**: `{ success: true, status: 201, message: "User registered successfully", email: "..." }`
- **Auth Required**: No

#### 4. `login(data)`
- **Purpose**: User authentication routing
- **Input**: `{ data: { email: "user@example.com", password: "password123" }, meta: {} }`
- **Output**: `{ success: true, status: 200, email: "...", key: "jwt_token" }`
- **Auth Required**: No

#### 5. `verifySession(data)`
- **Purpose**: JWT token validation
- **Input**: `{ data: {}, meta: { key: "jwt_token" } }`
- **Output**: `{ valid: true, email: "...", rateLimitInfo: {...} }`
- **Auth Required**: Yes (JWT token in meta.key)

### **HTTP Endpoints**

#### Metrics
- **URL**: `http://localhost:9100/metrics`
- **Purpose**: Prometheus metrics for monitoring
- **Format**: Prometheus exposition format

---

## 🔗 External Dependencies

### **Required Services**
1. **AuthWorker**: 
   - **Topic**: `auth`
   - **Purpose**: User registration and authentication
   - **Methods**: register, login

2. **ProcessorWorker**: 
   - **Topic**: `processor`
   - **Purpose**: AI inference processing
   - **Methods**: processRequest

### **Required Libraries**
3. **jsonwebtoken**: 
   - **Purpose**: JWT token validation
   - **Secret**: From `JWT_SECRET` environment variable
   - **Validation**: Token verification for protected endpoints

4. **Rate Limiter**: 
   - **Purpose**: Per-user request throttling
   - **Storage**: Hyperbee database
   - **Default**: 10 requests per minute per user

### **Required Infrastructure**
5. **P2P Network**: 
   - **Framework**: `hp-svc-facs-net`
   - **Purpose**: Service discovery and RPC communication

6. **Storage**: 
   - **Framework**: `hp-svc-facs-store` (Hyperbee)
   - **Directory**: `./data/gateway`
   - **Database**: `rate-limits` (for rate limiting data)

### **Runtime Requirements**
- **Node.js**: Version 16+
- **Environment Variables**: `JWT_SECRET`, `MAX_REQUESTS_PER_INTERVAL`, `RESET_INTERVAL_MINUTE`
- **Network**: Access to AuthWorker and ProcessorWorker services

---

## 🚀 Quick Start

```bash
# 1. Set environment variables (optional)
export JWT_SECRET="your-secure-secret-key"
export MAX_REQUESTS_PER_INTERVAL=10
export RESET_INTERVAL_MINUTE=1

# 2. Start GatewayWorker
npm run start:gateway

# 3. Verify health
curl http://localhost:9100/metrics
```

---

## 🔧 Configuration

### **Environment**
- **Metrics Port**: 9100
- **P2P Topic**: `gateway`
- **Storage Dir**: `./data/gateway`
- **Service Discovery**: Auto-discovers `auth` and `processor` services

### **Rate Limiting**
- **Default Limit**: 10 requests per minute per user
- **Window**: 1 minute sliding window
- **Storage**: Persistent in Hyperbee database
- **Behavior**: Fail-open on storage errors

### **Environment Variables**
- **JWT_SECRET**: JWT signing secret (defaults to built-in secret)
- **MAX_REQUESTS_PER_INTERVAL**: Request limit per window (default: 10)
- **RESET_INTERVAL_MINUTE**: Rate limit window in minutes (default: 1)

### **Key Files**
- **Main**: `gateway_worker/gateway-worker.js`
- **Helper**: `gateway_worker/gateway-helper.js`
- **Rate Limiter**: `gateway_worker/rate-limiter.js`
- **Tests**: `tests/unit/workers/gateway_worker/`

---

## 🔐 Authentication Flow

### **Protected Endpoints**
- `processPrompt` - Requires valid JWT token
- `verifySession` - Requires valid JWT token

### **Public Endpoints**
- `ping` - No authentication required
- `register` - No authentication required
- `login` - No authentication required

### **Request Format**
All requests must follow the format:
```json
{
  "data": { /* actual request data */ },
  "meta": { "key": "jwt_token_here" /* for protected endpoints */ }
}
```

---

## ⚠️ Common Error Types

1. **Authentication Required**: `"Unauthorized: Invalid or expired token"` (Status: 401)
2. **Rate Limit Exceeded**: `"Rate limit exceeded"` (Status: 429)
3. **Invalid Request Format**: `"Invalid request format: expected { data: {...}, meta: { key: '...' } }"`
4. **Service Unavailable**: `"Backend service temporarily unavailable"` (Status: 503)
5. **Discovery Failure**: `"Could not discover auth/processor services"`

---

## 📊 Rate Limiting

### **Per-User Limits**
- **Default**: 10 requests per minute per user (email)
- **Window**: Sliding 1-minute window
- **Persistence**: Stored in Hyperbee database
- **Reset**: Automatic after window expires

### **Rate Limit Response**
```json
{
  "allowed": false,
  "status": 429,
  "message": "Rate limit exceeded",
  "retryAfter": 45,
  "rateLimitInfo": {
    "remainingRequests": 0,
    "maxRequests": 10,
    "nextResetInSeconds": 45,
    "windowDurationMinutes": 1
  }
}
```

---

## 📊 Monitoring

- **Metrics**: Available at `http://localhost:9100/metrics`
- **Logs**: Written to `logs/event.log`, `logs/error.log`
- **Health Check**: Use `ping()` RPC method
- **Request Tracking**: Each request gets unique ID for tracing
- **Service Discovery**: Logs available auth/processor services
- **Authentication Events**: JWT validation success/failure tracking