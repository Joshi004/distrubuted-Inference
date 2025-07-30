# 🔐 AuthWorker API Guide

## 📋 Service Overview

The **AuthWorker** is the user authentication and authorization service of the distributed platform. It handles user registration, login, password hashing, and JWT token generation for secure API access.

**Core Function**: Manages user accounts and generates JWT tokens for authenticated access to the platform.

---

## 🎯 What This Service Does

- **User Registration**: Creates new user accounts with encrypted password storage
- **User Authentication**: Validates login credentials and generates JWT tokens
- **Password Security**: Uses bcrypt for secure password hashing (10 salt rounds)
- **Token Management**: Generates 24-hour JWT tokens for API access
- **P2P Discovery**: Announces itself as `auth` topic on the DHT network
- **Metrics & Logging**: Tracks authentication events and performance

---

## 📡 Exposed Endpoints

### **RPC Methods** (P2P Network)

#### 1. `ping()`
- **Purpose**: Health check
- **Input**: None
- **Output**: `{ status: "healthy", timestamp: 1643723400000, service: "auth" }`

#### 2. `register(data)`
- **Purpose**: User registration
- **Input**: `{ email: "user@example.com", password: "password123" }`
- **Success**: `{ success: true, status: 201, message: "User registered successfully", email: "user@example.com" }`
- **Error**: `{ success: false, status: 409, message: "User already exists" }`

#### 3. `login(data)`
- **Purpose**: User authentication and token generation
- **Input**: `{ email: "user@example.com", password: "password123" }`
- **Success**: `{ success: true, status: 200, email: "user@example.com", key: "jwt_token_here" }`
- **Error**: `{ success: false, status: 401, message: "Invalid credentials" }`

### **HTTP Endpoints**

#### Metrics
- **URL**: `http://localhost:9101/metrics`
- **Purpose**: Prometheus metrics for monitoring
- **Format**: Prometheus exposition format

---

## 🔗 External Dependencies

### **Required Libraries**
1. **bcrypt**: 
   - **Purpose**: Password hashing and validation
   - **Configuration**: 10 salt rounds
   - **Usage**: Secure password storage

2. **jsonwebtoken**: 
   - **Purpose**: JWT token generation and validation
   - **Expiration**: 24 hours
   - **Secret**: From `JWT_SECRET` environment variable

### **Required Infrastructure**
3. **P2P Network**: 
   - **Framework**: `hp-svc-facs-net`
   - **Purpose**: Service discovery and RPC communication

4. **Storage**: 
   - **Framework**: `hp-svc-facs-store` (Hyperbee)
   - **Directory**: `./data/auth`
   - **Database**: `users` (key: email, value: user data)

### **Runtime Requirements**
- **Node.js**: Version 16+
- **Environment Variables**: `JWT_SECRET` (optional, has default)
- **Storage**: Persistent storage for user database
- **Network**: Local network access for P2P communication

---

## 🚀 Quick Start

```bash
# 1. Set JWT secret (optional)
export JWT_SECRET="your-secure-secret-key"

# 2. Start AuthWorker
npm run start:auth

# 3. Verify health
curl http://localhost:9101/metrics
```

---

## 🔧 Configuration

### **Environment**
- **Metrics Port**: 9101
- **P2P Topic**: `auth`
- **Storage Dir**: `./data/auth`
- **JWT Expiration**: 24 hours
- **Password Salt Rounds**: 10

### **Environment Variables**
- **JWT_SECRET**: Custom JWT signing secret (defaults to built-in secret)

### **Key Files**
- **Main**: `auth_worker/auth-worker.js`
- **Helper**: `auth_worker/auth-helper.js`
- **Tests**: `tests/unit/workers/auth_worker/`

---

## ⚠️ Common Error Types

1. **User Already Exists**: `"User already exists"` (Status: 409)
2. **Invalid Credentials**: `"Invalid credentials"` (Status: 401)
3. **Missing Fields**: `"Email and password are required"` (Status: 400)
4. **Service Unavailable**: `"Authentication service temporarily unavailable"` (Status: 503)
5. **Storage Issues**: `"Store facility not available"` (Status: 503)

---

## 📊 Security Features

### **Password Security**
- **Hashing**: bcrypt with 10 salt rounds
- **Storage**: Only hashed passwords stored, never plaintext
- **Validation**: Secure comparison using bcrypt.compare()

### **JWT Tokens**
- **Algorithm**: HS256 (HMAC SHA-256)
- **Expiration**: 24 hours
- **Payload**: Email and role information
- **Secret**: Configurable via environment variable

### **Data Storage**
- **Database**: Hyperbee (distributed key-value store)
- **Encryption**: At-rest encryption via Hyperbee
- **Isolation**: Separate database per auth service instance

---

## 📊 Monitoring

- **Metrics**: Available at `http://localhost:9101/metrics`
- **Logs**: Written to `logs/event.log`, `logs/error.log`
- **Health Check**: Use `ping()` RPC method
- **Request Tracking**: Each request gets unique ID for tracing
- **JWT Events**: Special logging for token generation and validation