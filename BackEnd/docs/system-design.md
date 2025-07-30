# AI Inference Platform - System Design Document

## 🎯 Overview

The AI Inference Platform is a **microservice-based system** that provides AI inference capabilities as a service over Hyperswarm RPC. Users can register, get API keys, and make inference requests to various AI models with built-in rate limiting, usage tracking, and monitoring.

## 🏗️ Architecture Principles

- **Microservice Architecture**: Each service handles a specific domain
- **P2P Communication**: Services communicate over Hyperswarm RPC
- **Event-Driven**: Asynchronous message passing between services
- **Scalable**: Services can be distributed across multiple nodes
- **Secure**: API key-based authentication and authorization

## 📐 System Components

### 1. **Authentication Service** 🔐
**Purpose**: User management, API key generation, and request authentication

**Responsibilities**:
- User registration and login
- API key generation and validation
- JWT token management
- User session handling

**API Methods**:
- `registerUser(userData)` → User registration
- `loginUser(credentials)` → User authentication
- `generateApiKey(userId)` → API key creation
- `validateApiKey(apiKey)` → API key verification
- `getUserUsage(userId)` → Usage statistics

### 2. **Gateway Service** 🚪
**Purpose**: Request routing, rate limiting, and load balancing

**Responsibilities**:
- Authenticate incoming requests
- Apply rate limiting per user/API key
- Route requests to appropriate inference services
- Track usage statistics
- Load balance across inference workers

**API Methods**:
- `processInferenceRequest(request, auth)` → Main inference endpoint
- `getServiceHealth()` → Health check
- `getUserQuota(userId)` → Current usage/limits

### 3. **Inference Service** 🤖
**Purpose**: AI model integration and inference processing

**Responsibilities**:
- Manage connections to AI backends (Ollama, OpenAI, etc.)
- Process inference requests
- Handle model switching and routing
- Cache frequent requests
- Monitor model performance

**API Methods**:
- `processPrompt(prompt, modelConfig)` → AI inference
- `listAvailableModels()` → Model catalog
- `getModelStatus(modelId)` → Model health

### 4. **Metrics Service** 📊
**Purpose**: System monitoring and metrics collection

**Responsibilities**:
- Collect request metrics (latency, throughput, errors)
- Export Prometheus metrics
- Track system resource usage
- Generate usage reports
- Monitor service health

**API Methods**:
- `recordMetric(metricName, value, labels)` → Metric recording
- `getMetrics()` → Prometheus format export
- `getSystemHealth()` → Overall system status

### 5. **Web Interface Service** 🌐
**Purpose**: User-facing web dashboard

**Responsibilities**:
- User registration/login UI
- Usage dashboard and analytics
- API key management interface
- System monitoring dashboard
- User settings and preferences

**Endpoints**:
- `GET /` → Landing page
- `POST /register` → User registration
- `POST /login` → User login
- `GET /dashboard` → User dashboard
- `GET /api-keys` → API key management

## 🔄 Data Flow Diagrams

### User Registration Flow
```
[User] → [Web Interface] → [Auth Service] → [Database]
                      ↓
              [API Key Generated] → [User Dashboard]
```

### Inference Request Flow
```
[CLI Client] → [Gateway Service] → [Auth Service] (validate API key)
                     ↓                    ↓
           [Rate Limiting Check] ← [Usage Database]
                     ↓
           [Inference Service] → [AI Backend (Ollama/OpenAI)]
                     ↓
           [Metrics Service] ← [Response + Metrics]
                     ↓
                [CLI Client] ← [Final Response]
```

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

### Usage Statistics Table
```sql
CREATE TABLE usage_stats (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    api_key_id UUID REFERENCES api_keys(id),
    request_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Request Logs Table
```sql
CREATE TABLE request_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    api_key_id UUID REFERENCES api_keys(id),
    prompt_hash VARCHAR(64), -- For privacy
    model_used VARCHAR(50),
    response_time_ms INTEGER,
    tokens_used INTEGER,
    status VARCHAR(20), -- success, error, timeout
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Service Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_platform

# Services
AUTH_SERVICE_PORT=3001
GATEWAY_SERVICE_PORT=3002
INFERENCE_SERVICE_PORT=3003
METRICS_SERVICE_PORT=3004
WEB_SERVICE_PORT=3000

# AI Backends
OLLAMA_URL=http://localhost:11434
OPENAI_API_KEY=sk-...

# Rate Limiting
DEFAULT_RATE_LIMIT=100  # requests per hour
PREMIUM_RATE_LIMIT=1000 # requests per hour

# Monitoring
PROMETHEUS_PORT=9090
METRICS_ENABLED=true
```

## 📊 Metrics & Monitoring

### Key Metrics to Track
- **Request Metrics**: Total requests, requests/second, response time
- **Error Metrics**: Error rate, error types, failed requests
- **Usage Metrics**: Active users, API key usage, token consumption
- **System Metrics**: CPU usage, memory usage, disk I/O
- **Business Metrics**: User registration rate, API key generation

### Prometheus Metrics Examples
```
# Request counter
ai_platform_requests_total{service="gateway", method="processInferenceRequest", status="success"}

# Response time histogram
ai_platform_request_duration_seconds{service="inference", model="llama3"}

# Active users gauge
ai_platform_active_users{time_window="24h"}

# Rate limit violations
ai_platform_rate_limit_violations_total{user_id="...", api_key_id="..."}
```

## 🚀 Deployment Architecture

### Development Environment
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Local Dev     │    │   Database      │    │   AI Backend    │
│                 │    │                 │    │                 │
│ • All services  │◄──►│ • PostgreSQL    │    │ • Ollama        │
│ • Web interface │    │ • Redis cache   │    │ • Local models  │
│ • CLI client    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Production Environment
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Load      │    │   Auth      │    │   Gateway   │    │ Inference   │
│  Balancer   │◄──►│  Service    │◄──►│   Service   │◄──►│   Service   │
│             │    │             │    │             │    │ (Multiple)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Web       │    │  Database   │    │   Metrics   │    │ AI Backend  │
│ Interface   │    │   Cluster   │    │   Service   │    │   Cluster   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## 🔒 Security Considerations

### Authentication & Authorization
- **API Keys**: Secure random generation, hashed storage
- **Rate Limiting**: Per-user and per-API-key limits  
- **Input Validation**: Sanitize all user inputs
- **HTTPS**: All external communications encrypted

### Data Privacy
- **Prompt Hashing**: Store hashes instead of actual prompts
- **User Data**: Minimal data collection, GDPR compliance
- **Audit Logs**: Track all sensitive operations

### Network Security
- **Hyperswarm**: Encrypted P2P communication
- **Firewall**: Restrict database and internal service access
- **API Gateway**: Single point of entry with security controls

## 📈 Scalability Strategy

### Horizontal Scaling
- **Inference Services**: Multiple workers for AI processing
- **Database**: Read replicas for metrics and usage data  
- **Load Balancing**: Distribute requests across service instances

### Performance Optimization
- **Caching**: Redis for frequent requests and user sessions
- **Connection Pooling**: Efficient database connections
- **Async Processing**: Non-blocking I/O for all services

### Auto-scaling Triggers
- **CPU Usage**: Scale inference services when CPU > 80%
- **Request Queue**: Add workers when queue depth > 100
- **Response Time**: Scale when average response time > 5s

## 🧪 Testing Strategy

### Unit Tests
- Individual service method testing
- Mock external dependencies (AI backends, database)
- Test error conditions and edge cases

### Integration Tests  
- End-to-end request flow testing
- Service-to-service communication
- Database integration testing

### Load Tests
- Simulate concurrent users and requests
- Test rate limiting and quota enforcement
- Measure system performance under load

## 📚 API Documentation

### Client SDK Examples
```javascript
// JavaScript SDK
const aiClient = new AIInferenceClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-platform.com'
});

const response = await aiClient.inference({
  prompt: 'Explain quantum computing',
  model: 'llama3',
  maxTokens: 500
});
```

### REST API (for web interface)
```bash
# User registration
POST /api/auth/register
{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "secure_password"
}

# Generate API key
POST /api/auth/api-keys
Authorization: Bearer <jwt_token>
{
  "name": "My CLI Key"
}

# Make inference request
POST /api/inference
X-API-Key: <api_key>
{
  "prompt": "Write a poem about AI",
  "model": "llama3"
}
```

## 🎯 Success Criteria

### Functional Requirements ✅
- [ ] Users can register and get API keys
- [ ] CLI tool can authenticate and make requests  
- [ ] Rate limiting prevents abuse
- [ ] Usage tracking works accurately
- [ ] Multiple AI models supported

### Non-Functional Requirements 📊
- [ ] **Performance**: < 5s average response time
- [ ] **Scalability**: Handle 1000+ concurrent requests
- [ ] **Availability**: 99.9% uptime
- [ ] **Security**: No unauthorized access possible

### Monitoring & Operations 🔍
- [ ] **Metrics**: All key metrics collected
- [ ] **Alerting**: Automated alerts for issues
- [ ] **Logging**: Comprehensive audit trail
- [ ] **Documentation**: Complete API and deployment docs 