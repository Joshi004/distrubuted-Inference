#!/bin/bash

# Worker Management Script
# This script helps you check, start, and stop all worker processes

echo "🔧 =================== WORKER MANAGEMENT ==================="
echo ""

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check running workers
check_workers() {
    echo -e "${BLUE}📋 CHECKING RUNNING WORKERS...${NC}"
    echo ""
    
    # Check Auth Workers
    AUTH_PIDS=$(ps aux | grep "auth_worker/auth-worker.js" | grep -v grep | awk '{print $2}')
    if [ -n "$AUTH_PIDS" ]; then
        echo -e "${GREEN}🔐 AUTH WORKERS:${NC}"
        ps aux | grep "auth_worker/auth-worker.js" | grep -v grep | while read line; do
            echo "   $line"
        done
        echo ""
    else
        echo -e "${RED}🔐 AUTH WORKER: Not running${NC}"
        echo ""
    fi
    
    # Check Gateway Workers
    GATEWAY_PIDS=$(ps aux | grep "gateway_worker/gateway-worker.js" | grep -v grep | awk '{print $2}')
    if [ -n "$GATEWAY_PIDS" ]; then
        echo -e "${GREEN}🌐 GATEWAY WORKERS:${NC}"
        ps aux | grep "gateway_worker/gateway-worker.js" | grep -v grep | while read line; do
            echo "   $line"
        done
        echo ""
    else
        echo -e "${RED}🌐 GATEWAY WORKER: Not running${NC}"
        echo ""
    fi
    
    # Check Processor Workers
    PROCESSOR_PIDS=$(ps aux | grep "processor_worker/processor-worker.js" | grep -v grep | awk '{print $2}')
    if [ -n "$PROCESSOR_PIDS" ]; then
        echo -e "${GREEN}⚡ PROCESSOR WORKERS:${NC}"
        ps aux | grep "processor_worker/processor-worker.js" | grep -v grep | while read line; do
            echo "   $line"
        done
        echo ""
    else
        echo -e "${RED}⚡ PROCESSOR WORKER: Not running${NC}"
        echo ""
    fi
    
    # Check Client Workers (including CLI client)
    CLIENT_PIDS=$(ps aux | grep -E "(client_worker/client-worker.js|client_worker/cli-client.js)" | grep -v grep | awk '{print $2}')
    if [ -n "$CLIENT_PIDS" ]; then
        echo -e "${GREEN}💻 CLIENT WORKERS:${NC}"
        ps aux | grep -E "(client_worker/client-worker.js|client_worker/cli-client.js)" | grep -v grep | while read line; do
            echo "   $line"
        done
        echo ""
    else
        echo -e "${RED}💻 CLIENT WORKER: Not running${NC}"
        echo ""
    fi
    
    # Check Bridge Server
    BRIDGE_PIDS=$(ps aux | grep "bridge.server.js" | grep -v grep | awk '{print $2}')
    if [ -n "$BRIDGE_PIDS" ]; then
        echo -e "${GREEN}🌉 BRIDGE SERVER:${NC}"
        ps aux | grep "bridge.server.js" | grep -v grep | while read line; do
            echo "   $line"
        done
        echo ""
    else
        echo -e "${RED}🌉 BRIDGE SERVER: Not running${NC}"
        echo ""
    fi
}

# Function to kill all workers
kill_all_workers() {
    echo -e "${YELLOW}🛑 STOPPING ALL WORKERS...${NC}"
    echo ""
    
    # Kill Auth Workers
    AUTH_PIDS=$(ps aux | grep "auth_worker/auth-worker.js" | grep -v grep | awk '{print $2}')
    if [ -n "$AUTH_PIDS" ]; then
        echo "🔐 Stopping Auth Workers: $AUTH_PIDS"
        echo "$AUTH_PIDS" | xargs kill -9 2>/dev/null
    fi
    
    # Kill Gateway Workers
    GATEWAY_PIDS=$(ps aux | grep "gateway_worker/gateway-worker.js" | grep -v grep | awk '{print $2}')
    if [ -n "$GATEWAY_PIDS" ]; then
        echo "🌐 Stopping Gateway Workers: $GATEWAY_PIDS"
        echo "$GATEWAY_PIDS" | xargs kill -9 2>/dev/null
    fi
    
    # Kill Processor Workers
    PROCESSOR_PIDS=$(ps aux | grep "processor_worker/processor-worker.js" | grep -v grep | awk '{print $2}')
    if [ -n "$PROCESSOR_PIDS" ]; then
        echo "⚡ Stopping Processor Workers: $PROCESSOR_PIDS"
        echo "$PROCESSOR_PIDS" | xargs kill -9 2>/dev/null
    fi
    
    # Kill Client Workers (including CLI client)
    CLIENT_PIDS=$(ps aux | grep -E "(client_worker/client-worker.js|client_worker/cli-client.js)" | grep -v grep | awk '{print $2}')
    if [ -n "$CLIENT_PIDS" ]; then
        echo "💻 Stopping Client Workers: $CLIENT_PIDS"
        echo "$CLIENT_PIDS" | xargs kill -9 2>/dev/null
    fi
    
    # Kill Bridge Server
    BRIDGE_PIDS=$(ps aux | grep "bridge.server.js" | grep -v grep | awk '{print $2}')
    if [ -n "$BRIDGE_PIDS" ]; then
        echo "🌉 Stopping Bridge Server: $BRIDGE_PIDS"
        echo "$BRIDGE_PIDS" | xargs kill -9 2>/dev/null
    fi
    
    echo ""
    echo -e "${GREEN}✅ All workers stopped!${NC}"
    echo ""
}

# Function to kill specific worker type
kill_specific_worker() {
    case $1 in
        "auth")
            AUTH_PIDS=$(ps aux | grep "auth_worker/auth-worker.js" | grep -v grep | awk '{print $2}')
            if [ -n "$AUTH_PIDS" ]; then
                echo "🔐 Stopping Auth Workers: $AUTH_PIDS"
                echo "$AUTH_PIDS" | xargs kill -9 2>/dev/null
                echo -e "${GREEN}✅ Auth Workers stopped!${NC}"
            else
                echo -e "${RED}❌ No Auth Workers running${NC}"
            fi
            ;;
        "gateway")
            GATEWAY_PIDS=$(ps aux | grep "gateway_worker/gateway-worker.js" | grep -v grep | awk '{print $2}')
            if [ -n "$GATEWAY_PIDS" ]; then
                echo "🌐 Stopping Gateway Workers: $GATEWAY_PIDS"
                echo "$GATEWAY_PIDS" | xargs kill -9 2>/dev/null
                echo -e "${GREEN}✅ Gateway Workers stopped!${NC}"
            else
                echo -e "${RED}❌ No Gateway Workers running${NC}"
            fi
            ;;
        "processor")
            PROCESSOR_PIDS=$(ps aux | grep "processor_worker/processor-worker.js" | grep -v grep | awk '{print $2}')
            if [ -n "$PROCESSOR_PIDS" ]; then
                echo "⚡ Stopping Processor Workers: $PROCESSOR_PIDS"
                echo "$PROCESSOR_PIDS" | xargs kill -9 2>/dev/null
                echo -e "${GREEN}✅ Processor Workers stopped!${NC}"
            else
                echo -e "${RED}❌ No Processor Workers running${NC}"
            fi
            ;;
        "client")
            CLIENT_PIDS=$(ps aux | grep -E "(client_worker/client-worker.js|client_worker/cli-client.js)" | grep -v grep | awk '{print $2}')
            if [ -n "$CLIENT_PIDS" ]; then
                echo "💻 Stopping Client Workers: $CLIENT_PIDS"
                echo "$CLIENT_PIDS" | xargs kill -9 2>/dev/null
                echo -e "${GREEN}✅ Client Workers stopped!${NC}"
            else
                echo -e "${RED}❌ No Client Workers running${NC}"
            fi
            ;;
        "bridge")
            BRIDGE_PIDS=$(ps aux | grep "bridge.server.js" | grep -v grep | awk '{print $2}')
            if [ -n "$BRIDGE_PIDS" ]; then
                echo "🌉 Stopping Bridge Server: $BRIDGE_PIDS"
                echo "$BRIDGE_PIDS" | xargs kill -9 2>/dev/null
                echo -e "${GREEN}✅ Bridge Server stopped!${NC}"
            else
                echo -e "${RED}❌ No Bridge Server running${NC}"
            fi
            ;;
        *)
            echo -e "${RED}❌ Invalid worker type. Use: auth, gateway, processor, client, or bridge${NC}"
            ;;
    esac
}

# Function to start workers with proper environment
start_workers() {
    echo -e "${BLUE}🚀 STARTING WORKERS WITH ENVIRONMENT VARIABLES...${NC}"
    echo ""
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ .env file not found! Creating default .env file...${NC}"
        cat > .env << EOF
# JWT Configuration
JWT_SECRET=distributed-ai-secure-secret-key-2025

# Rate Limiting Configuration
MAX_REQUESTS_PER_INTERVAL=10
RESET_INTERVAL_MINUTE=1

# Bridge Server Port
PORT=3000
EOF
        echo -e "${GREEN}✅ Created .env file with default values${NC}"
        echo ""
    fi
    
    echo "📋 Current .env configuration:"
    cat .env
    echo ""
    
    # Create logs directory if it doesn't exist
    if [ ! -d "logs" ]; then
        echo -e "${YELLOW}📁 Creating logs directory...${NC}"
        mkdir -p logs
        echo -e "${GREEN}✅ Logs directory created${NC}"
        echo ""
    fi
    
    case $1 in
        "auth")
            echo "🔐 Starting Auth Worker..."
            nohup node auth_worker/auth-worker.js > logs/auth-worker.log 2>&1 &
            echo -e "${GREEN}✅ Auth Worker started!${NC}"
            ;;
        "gateway")
            echo "🌐 Starting Gateway Worker..."
            nohup node gateway_worker/gateway-worker.js > logs/gateway-worker.log 2>&1 &
            echo -e "${GREEN}✅ Gateway Worker started!${NC}"
            ;;
        "processor")
            echo "⚡ Starting Processor Worker..."
            nohup node processor_worker/processor-worker.js > logs/processor-worker.log 2>&1 &
            echo -e "${GREEN}✅ Processor Worker started!${NC}"
            ;;
        "client")
            echo "💻 Starting Client Worker..."
            nohup node client_worker/client-worker.js > logs/client-worker.log 2>&1 &
            echo -e "${GREEN}✅ Client Worker started!${NC}"
            ;;
        "bridge")
            echo "🌉 Starting Bridge Server..."
            nohup node client_worker/bridge.server.js > logs/bridge-server.log 2>&1 &
            echo -e "${GREEN}✅ Bridge Server started!${NC}"
            ;;
        "all")
            echo "🔐 Starting Auth Worker..."
            nohup node auth_worker/auth-worker.js > logs/auth-worker.log 2>&1 &
            sleep 2
            echo "🌐 Starting Gateway Worker..."
            nohup node gateway_worker/gateway-worker.js > logs/gateway-worker.log 2>&1 &
            sleep 2
            echo "⚡ Starting Processor Worker..."
            nohup node processor_worker/processor-worker.js > logs/processor-worker.log 2>&1 &
            sleep 2
            echo "🌉 Starting Bridge Server (HTTP API)..."
            nohup node client_worker/bridge.server.js > logs/bridge-server.log 2>&1 &
            echo -e "${GREEN}✅ All core workers started!${NC}"
            echo -e "${BLUE}💡 Note: Use 'start client' separately to run the interactive CLI${NC}"
            ;;
        *)
            echo -e "${RED}❌ Invalid worker type. Use: auth, gateway, processor, client, bridge, or all${NC}"
            ;;
    esac
}

# Main menu
show_menu() {
    echo ""
    echo -e "${BLUE}🎯 WORKER MANAGEMENT OPTIONS:${NC}"
    echo "1. Check worker status"
    echo "2. Stop all workers"
    echo "3. Stop specific worker (auth/gateway/processor/client/bridge)"
    echo "4. Start specific worker (auth/gateway/processor/client/bridge/all)"
    echo "5. Restart all workers (stop + start)"
    echo "6. Show logs directory"
    echo "7. Exit"
    echo ""
}

# Main execution
case $1 in
    "check" | "status")
        check_workers
        ;;
    "stop")
        if [ -n "$2" ]; then
            kill_specific_worker $2
        else
            kill_all_workers
        fi
        ;;
    "start")
        if [ -n "$2" ]; then
            start_workers $2
        else
            echo -e "${RED}❌ Please specify worker type: auth, gateway, processor, client, bridge, or all${NC}"
        fi
        ;;
    "restart")
        kill_all_workers
        sleep 3
        start_workers all
        ;;
    "logs")
        echo -e "${BLUE}📁 Log files location: $(pwd)/logs/${NC}"
        ls -la logs/
        ;;
    "menu" | "")
        check_workers
        while true; do
            show_menu
            read -p "Choose an option (1-7): " choice
            case $choice in
                1) check_workers ;;
                2) kill_all_workers ;;
                3) 
                    read -p "Enter worker type (auth/gateway/processor/client/bridge): " worker_type
                    kill_specific_worker $worker_type 
                    ;;
                4) 
                    read -p "Enter worker type (auth/gateway/processor/client/bridge/all): " worker_type
                    start_workers $worker_type 
                    ;;
                5) 
                    kill_all_workers
                    sleep 3
                    start_workers all
                    ;;
                6) 
                    echo -e "${BLUE}📁 Log files location: $(pwd)/logs/${NC}"
                    ls -la logs/
                    ;;
                7) 
                    echo -e "${GREEN}👋 Goodbye!${NC}"
                    exit 0 
                    ;;
                *) echo -e "${RED}❌ Invalid option. Please choose 1-7.${NC}" ;;
            esac
        done
        ;;
    *)
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  check/status           - Check worker status"
        echo "  stop [worker_type]     - Stop workers (all if no type specified)"
        echo "  start [worker_type]    - Start workers (auth/gateway/processor/client/bridge/all)"
        echo "  restart               - Restart all workers"
        echo "  logs                  - Show logs directory"
        echo "  menu                  - Interactive menu (default)"
        echo ""
        echo "Examples:"
        echo "  $0 check"
        echo "  $0 stop auth"
        echo "  $0 start all"
        echo "  $0 restart"
        ;;
esac