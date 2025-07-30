#!/bin/bash

echo "🧹 Cleaning up P2P Demo environment..."

# Kill any running worker processes
echo "🛑 Stopping any running workers..."
pkill -f "node workers" 2>/dev/null || true

# Remove RocksDB lock files
echo "🗑️  Removing database lock files..."
find data -name "LOCK" -type f -delete 2>/dev/null || true

echo "✅ Cleanup completed!"
echo ""
echo "💡 You can now start the workers cleanly:"
echo "   Terminal 1: npm run start:processor"
echo "   Terminal 2: npm run start:gateway"  
echo "   Terminal 3: npm run start:client" 