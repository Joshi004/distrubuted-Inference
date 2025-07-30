# 📊 Prometheus Metrics System Guide

## 📋 Overview

We implemented a **Prometheus metrics system** for monitoring our distributed AI inference platform. Each worker runs its own metrics server to track performance and system health without impacting request processing.

**Design Choice**: We use worker-specific metrics servers instead of centralized collection to avoid single points of failure in our P2P architecture.

## 📊 What Metrics We Collect

### **System Metrics (Automatic)**
- **CPU & Memory**: Process resource usage and Node.js heap statistics
- **Event Loop Performance**: Critical for P2P responsiveness  
- **Garbage Collection**: Impact on request latency
- **Active Resources**: Network connections and file handles

### **Business Metrics (Custom)**
- **Request Counters**: Total requests by method (`login`, `register`, `processPrompt`) and status (`success`, `error`)
- **Response Times**: Duration histograms with buckets optimized for AI inference (0.1s to 5s+)

## 🛠️ Implementation

### **SimpleMetrics Class**
We created a custom wrapper around `prom-client` that:
- Automatically tracks all RPC method calls
- Uses non-blocking collection (metrics recording happens asynchronously)  
- Labels metrics by worker name for distributed identification
- Provides zero-configuration setup

## 🌐 Metrics Endpoints

Each worker exposes metrics on its own port:

- **Gateway Worker**: `http://localhost:9100/metrics` - Request routing and authentication
- **Auth Worker**: `http://localhost:9101/metrics` - User authentication and JWT management  
- **Processor Worker**: `http://localhost:9102/metrics` - AI inference processing
- **Client Worker**: `http://localhost:9103/metrics` - Session management

## 📈 How to Use

### **Check System Health**
```bash
curl http://localhost:9100/metrics | grep nodejs_eventloop_lag_seconds
curl http://localhost:9100/metrics | grep process_resident_memory_bytes
```

### **Monitor Business Performance**  
```bash
curl http://localhost:9102/metrics | grep 'requests_total.*processRequest'
curl http://localhost:9101/metrics | grep 'request_duration_seconds.*login'
```

## 🔧 Integration

Workers automatically initialize metrics in their constructor:
```javascript
this.metrics = new SimpleMetrics('gateway', 9100)
```

RPC methods are wrapped for automatic tracking:
```javascript
async login(data) {
  return await this.metrics.wrapRpcMethod('login', Helper.login, this, data)
}
```

## 📊 Sample Output

**Request Metrics:**
```
requests_total{method="login",status="success",worker="gateway"} 1
requests_total{method="processPrompt",status="success",worker="gateway"} 1  
request_duration_seconds_sum{worker="gateway",method="processPrompt"} 7.947
```

**System Metrics:**
```
process_resident_memory_bytes{worker="gateway"} 110215168
nodejs_eventloop_lag_p99_seconds{worker="gateway"} 0.012083199
nodejs_gc_duration_seconds_count{worker="gateway",kind="minor"} 241
```


## 🎉 Summary

We built a distributed Prometheus metrics system that:

✅ **Non-blocking collection** - Doesn't impact AI processing performance  
✅ **Worker isolation** - Each service has independent metrics server  
✅ **Automatic tracking** - Zero-configuration RPC method monitoring  
✅ **Standard format** - Compatible with Grafana and monitoring tools  
✅ **Comprehensive coverage** - System health + business performance metrics