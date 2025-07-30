#!/bin/bash

# Run tests in isolated batches to prevent mock conflicts
# This preserves all test files while avoiding module mocking conflicts

echo "Running all tests in isolated batches..."
echo ""

# Track totals
total_tests=0
total_passed=0
total_failed=0

# Batch 1: Helpers (isolated)
echo "=== BATCH 1: Helper Tests ==="
result1=$(npx brittle tests/unit/helpers/auth-helper.test.js 2>&1)
batch1_exit=$?
echo "$result1"
if [[ $result1 =~ tests\ =\ ([0-9]+)/([0-9]+)\ pass ]]; then
  total_tests=$((total_tests + ${BASH_REMATCH[2]}))
  total_passed=$((total_passed + ${BASH_REMATCH[1]}))
fi
echo ""

# Batch 2: Auth Worker Tests (without helper to avoid conflict)
echo "=== BATCH 2: Auth Worker Tests ==="
result2=$(npx brittle tests/unit/workers/auth_worker/auth-helper.test.js tests/unit/workers/auth_worker/auth-worker.test.js 2>&1)
batch2_exit=$?
echo "$result2"
if [[ $result2 =~ tests\ =\ ([0-9]+)/([0-9]+)\ pass ]]; then
  total_tests=$((total_tests + ${BASH_REMATCH[2]}))
  total_passed=$((total_passed + ${BASH_REMATCH[1]}))
fi
echo ""

# Batch 3: Gateway Tests
echo "=== BATCH 3: Gateway Tests ==="
result3=$(npx brittle tests/unit/workers/gateway_worker/gateway-helper.test.js tests/unit/workers/gateway_worker/gateway-worker.test.js tests/unit/workers/gateway_worker/rate-limiter.test.js 2>&1)
batch3_exit=$?
echo "$result3"
if [[ $result3 =~ tests\ =\ ([0-9]+)/([0-9]+)\ pass ]]; then
  total_tests=$((total_tests + ${BASH_REMATCH[2]}))
  total_passed=$((total_passed + ${BASH_REMATCH[1]}))
fi
echo ""

# Batch 4: Client Worker Tests
echo "=== BATCH 4: Client Worker Tests ==="
result4=$(npx brittle tests/unit/workers/client_worker/client-worker.test.js 2>&1)
batch4_exit=$?
echo "$result4"
if [[ $result4 =~ tests\ =\ ([0-9]+)/([0-9]+)\ pass ]]; then
  total_tests=$((total_tests + ${BASH_REMATCH[2]}))
  total_passed=$((total_passed + ${BASH_REMATCH[1]}))
fi
echo ""

# Batch 5: Processor Tests (folder version)
echo "=== BATCH 5: Processor Tests (Folder) ==="
result5=$(npx brittle tests/unit/workers/processor_worker/processor-helper.test.js tests/unit/workers/processor_worker/processor-worker.test.js 2>&1)
batch5_exit=$?
echo "$result5"
if [[ $result5 =~ tests\ =\ ([0-9]+)/([0-9]+)\ pass ]]; then
  total_tests=$((total_tests + ${BASH_REMATCH[2]}))
  total_passed=$((total_passed + ${BASH_REMATCH[1]}))
fi
echo ""

# Batch 6: Processor Test (root version, isolated)
echo "=== BATCH 6: Processor Test (Root) ==="
result6=$(npx brittle tests/unit/workers/processor-worker.test.js 2>&1)
batch6_exit=$?
echo "$result6"
if [[ $result6 =~ tests\ =\ ([0-9]+)/([0-9]+)\ pass ]]; then
  total_tests=$((total_tests + ${BASH_REMATCH[2]}))
  total_passed=$((total_passed + ${BASH_REMATCH[1]}))
fi
echo ""

# Batch 7: External Libraries
echo "=== BATCH 7: External Libraries ==="
result7=$(npx brittle hp-svc-facs-net/tests/hyperdht.lookup.test.js hp-svc-facs-store/tests/index.test.js hp-svc-facs-store/tests/compatiblity.test.js 2>&1)
batch7_exit=$?
echo "$result7"
if [[ $result7 =~ tests\ =\ ([0-9]+)/([0-9]+)\ pass ]]; then
  total_tests=$((total_tests + ${BASH_REMATCH[2]}))
  total_passed=$((total_passed + ${BASH_REMATCH[1]}))
fi
echo ""

# Summary
echo "=========================================="
echo "FINAL SUMMARY - ALL TEST FILES PRESERVED"
echo "=========================================="
echo "Total Tests: $total_passed/$total_tests pass"
echo "All test files maintained and executed"
echo ""

# Exit with error if any batch failed
if [ $batch1_exit -ne 0 ] || [ $batch2_exit -ne 0 ] || [ $batch3_exit -ne 0 ] || [ $batch4_exit -ne 0 ] || [ $batch5_exit -ne 0 ] || [ $batch6_exit -ne 0 ] || [ $batch7_exit -ne 0 ]; then
  echo "Some tests failed - check batches above"
  exit 1
else
  echo "All tests passed successfully!"
  exit 0
fi
