# 🤖 ProcessorWorker API Guide

## 📋 Service Overview

The **ProcessorWorker** is the AI inference engine of the distributed platform. It receives text prompts via P2P RPC and processes them through **Ollama/Llama3** to generate AI responses.

**Core Function**: Converts user text prompts into AI-generated responses through local Llama3 model integration.

---

## 🎯 What This Service Does

- **Processes AI Requests**: Receives prompts and returns AI-generated responses
- **Ollama Integration**: Interfaces with local Ollama service running Llama3 model
- **P2P Discovery**: Announces itself as `processor` topic on the DHT network
- **Request Validation**: Validates input format and handles errors gracefully
- **Metrics & Logging**: Tracks performance and logs all activities

---

## 📡 Exposed Endpoints

### **RPC Methods** (P2P Network)

#### 1. `ping()`
- **Purpose**: Health check
- **Input**: None
- **Output**: `{ status: "healthy", timestamp: 1643723400000, service: "processor" }`

#### 2. `processRequest(data)`
- **Purpose**: AI inference processing
- **Input**: `{ prompt: "Your question here" }`
- **Output**: `{ prompt: "...", response: "AI response", processed_at: "2025-07-30T12:00:00.000Z", requestId: "abc123" }`
- **Error**: `{ error: true, message: "Error description", requestId: "abc123" }`

### **HTTP Endpoints**

#### Metrics
- **URL**: `http://localhost:9102/metrics`
- **Purpose**: Prometheus metrics for monitoring
- **Format**: Prometheus exposition format

---

## 🔗 External Dependencies

### **Required Services**
1. **Ollama**: 
   - **URL**: `http://localhost:11434/api/generate`
   - **Model**: `llama3`
   - **Timeout**: 30 seconds
   - **Purpose**: AI model inference

### **Required Infrastructure**
2. **P2P Network**: 
   - **Framework**: `hp-svc-facs-net`
   - **Purpose**: Service discovery and RPC communication

3. **Storage**: 
   - **Framework**: `hp-svc-facs-store`
   - **Directory**: `./data/processor`
   - **Purpose**: Persistent data storage

### **Runtime Requirements**
- **Node.js**: Version 18+ (for native fetch support)
- **Memory**: Minimum 2GB (for AI model processing)
- **Network**: Local network access for P2P communication

---

## 🚀 Quick Start

```bash
# 1. Ensure Ollama is running with Llama3
ollama pull llama3
ollama serve

# 2. Start ProcessorWorker
npm run start:processor

# 3. Verify health
curl http://localhost:9102/metrics
```

---

## 🔧 Configuration

### **Environment**
- **Metrics Port**: 9102
- **P2P Topic**: `processor`
- **Storage Dir**: `./data/processor`
- **Ollama Timeout**: 30 seconds

### **Key Files**
- **Main**: `processor_worker/processor-worker.js`
- **Helper**: `processor_worker/processor-helper.js`
- **Tests**: `tests/unit/workers/processor_worker/`

---

## ⚠️ Common Error Types

1. **Ollama Connection**: `"Cannot connect to Ollama - make sure it's running on localhost:11434"`
2. **Timeout**: `"Ollama request timeout (30s)"`
3. **Invalid Input**: `"Invalid input: expected { prompt: string }"`
4. **API Error**: `"Ollama API error: 500 Internal Server Error"`

---

## 📊 Monitoring

- **Metrics**: Available at `http://localhost:9102/metrics`
- **Logs**: Written to `logs/event.log`, `logs/error.log`, `logs/prompt.log`
- **Health Check**: Use `ping()` RPC method
- **Request Tracking**: Each request gets unique ID for tracing