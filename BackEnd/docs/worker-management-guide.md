# 🔧 Worker Management Script Guide

## 📋 Overview

We created a **worker management script** (`manage-workers.sh`) to simplify starting, stopping, and monitoring our distributed AI workers. The script handles all worker lifecycle operations and provides both command-line and interactive menu interfaces.

**Design Choice**: We built a centralized management tool because manually managing 5+ worker processes across different terminals was inefficient and error-prone.

## 🔄 What It Manages

### **Worker Types**
- **Auth Worker** (`auth-worker.js`) - User authentication and JWT management
- **Gateway Worker** (`gateway-worker.js`) - Request routing and rate limiting  
- **Processor Worker** (`processor-worker.js`) - AI inference processing
- **Client Worker** (`client-worker.js`) - Session and client management
- **Bridge Server** (`bridge.server.js`) - HTTP API for web interface

### **Automatic Features**
- **Environment Setup**: Creates `.env` file with default values if missing
- **Log Capture**: Redirects each worker's output to separate log files
- **Process Tracking**: Monitors running workers by PID
- **Sequential Startup**: Adds delays between worker starts for proper initialization

## 🎯 Usage

### **Command Line Interface**

#### **Check Worker Status**
```bash
./manage-workers.sh check
./manage-workers.sh status
```

#### **Start Workers**
```bash
# Start all core workers (recommended)
./manage-workers.sh start all

# Start specific worker
./manage-workers.sh start auth
./manage-workers.sh start gateway
./manage-workers.sh start processor
./manage-workers.sh start bridge
```

#### **Stop Workers**
```bash
# Stop all workers
./manage-workers.sh stop

# Stop specific worker
./manage-workers.sh stop auth
./manage-workers.sh stop gateway
```

#### **Restart All Workers**
```bash
./manage-workers.sh restart
```

#### **View Logs**
```bash
./manage-workers.sh logs
```

### **Interactive Menu**
```bash
# Default - opens interactive menu
./manage-workers.sh
./manage-workers.sh menu
```

**Menu Options:**
1. Check worker status
2. Stop all workers  
3. Stop specific worker
4. Start specific worker
5. Restart all workers
6. Show logs directory
7. Exit

## 📁 Log Management

### **Log Files Created**
- `logs/auth-worker.log` - Auth worker console output
- `logs/gateway-worker.log` - Gateway worker console output
- `logs/processor-worker.log` - Processor worker console output
- `logs/client-worker.log` - Client worker console output
- `logs/bridge-server.log` - Bridge server console output

### **Log Content**
Each log captures the worker's startup sequence, emoji-enhanced status messages, and runtime output for debugging.

## ⚙️ Environment Configuration

### **Automatic .env Creation**
If no `.env` file exists, the script creates one with defaults:

```bash
JWT_SECRET=distributed-ai-secure-secret-key-2025
MAX_REQUESTS_PER_INTERVAL=10
RESET_INTERVAL_MINUTE=1
PORT=3000
```

### **Environment Display**
The script shows current configuration before starting workers to ensure proper setup.

## 🚀 Typical Workflow

### **Development Setup**
```bash
# 1. Start all core workers
./manage-workers.sh start all

# 2. Check everything is running
./manage-workers.sh check

# 3. View logs if issues
./manage-workers.sh logs
```

### **Individual Worker Management**
```bash
# Restart just the processor worker
./manage-workers.sh stop processor
./manage-workers.sh start processor
```

### **Full System Restart**
```bash
# Clean restart of entire system
./manage-workers.sh restart
```

## 🎯 Key Features

### **Process Safety**
- Uses `kill -9` for reliable worker termination
- Checks PIDs before attempting operations
- Provides clear success/failure feedback

### **Startup Sequencing**
- Starts Auth worker first (JWT dependency)
- Starts Gateway worker second (routing dependency)  
- Starts Processor worker third (AI processing)
- Starts Bridge server last (web interface)

### **Error Handling**
- Validates worker types before operations
- Shows helpful error messages for invalid commands
- Gracefully handles missing processes

## 🔍 Monitoring

### **Process Identification**
The script uses process names to identify workers:
- `auth_worker/auth-worker.js`
- `gateway_worker/gateway-worker.js`
- `processor_worker/processor-worker.js` 
- `client_worker/client-worker.js`
- `bridge.server.js`

### **Status Colors**
- 🟢 **Green**: Workers running normally
- 🔴 **Red**: Workers not running
- 🟡 **Yellow**: Operations in progress
- 🔵 **Blue**: Information messages

## 🎉 Summary

We built a comprehensive worker management system that:

✅ **Centralized Control** - Single script manages all distributed workers  
✅ **Flexible Interface** - Both command-line and interactive menu options  
✅ **Automatic Setup** - Creates environment files and log directories  
✅ **Process Safety** - Reliable start/stop operations with PID tracking  
✅ **Development Friendly** - Color-coded output and clear status reporting  

This script eliminates the complexity of manually managing our distributed AI inference platform workers.