#!/bin/bash

# Master Performance Validation Script
# Runs all validation tests for Phases 3-5

set -e

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║         Quiver Performance Validation - Phases 3-5                ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dev server is running
echo "Checking development server..."
if curl -s http://localhost:3000/ > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Dev server is running on port 3000"
else
  echo -e "${RED}✗${NC} Dev server is not running"
  echo ""
  echo "Please start the development server first:"
  echo "  yarn dev"
  echo ""
  exit 1
fi

echo ""

# Track test results
FAILED_TESTS=()
PASSED_TESTS=()

# Function to run test and track result
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo "═══════════════════════════════════════════════════════════════════"
  echo "Running: $test_name"
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""
  
  if eval "$test_command"; then
    echo -e "${GREEN}✓ PASSED${NC}: $test_name"
    PASSED_TESTS+=("$test_name")
  else
    echo -e "${RED}✗ FAILED${NC}: $test_name"
    FAILED_TESTS+=("$test_name")
  fi
  
  echo ""
  sleep 2
}

# Phase 3: API Performance Tests
echo "🔍 Phase 3: Database Optimization Tests"
echo ""

run_test "API Performance Validation" "npx tsx scripts/validate-performance-improvements.ts"

run_test "Legacy Performance Test" "npx tsx scripts/test-recommendations-perf.ts"

# Phase 4: React Performance Tests
echo "🔍 Phase 4: React Performance Tests"
echo ""

run_test "React Performance Validation" "npx tsx scripts/validate-react-performance.ts"

# E2E Tests
echo "🔍 E2E Performance Tests"
echo ""

run_test "Recommendations Performance E2E" "yarn test:e2e e2e/recommendations-performance.spec.ts --reporter=list"

run_test "React Rendering Performance E2E" "yarn test:e2e e2e/react-rendering-performance.spec.ts --reporter=list"

run_test "Home Page Performance E2E" "yarn test:e2e e2e/performance/home-page-performance.spec.ts --reporter=list"

# Generate Summary Report
echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                      VALIDATION SUMMARY                            ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

TOTAL_TESTS=$((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]}))
PASS_RATE=$(( ${#PASSED_TESTS[@]} * 100 / $TOTAL_TESTS ))

echo "Tests Run: $TOTAL_TESTS"
echo "Tests Passed: ${#PASSED_TESTS[@]}"
echo "Tests Failed: ${#FAILED_TESTS[@]}"
echo "Pass Rate: $PASS_RATE%"
echo ""

if [ ${#PASSED_TESTS[@]} -gt 0 ]; then
  echo -e "${GREEN}Passed Tests:${NC}"
  for test in "${PASSED_TESTS[@]}"; do
    echo "  ✓ $test"
  done
  echo ""
fi

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo -e "${RED}Failed Tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo "  ✗ $test"
  done
  echo ""
fi

# Generate timestamp for report
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Save summary to file
SUMMARY_FILE="docs/performance/validation-results-$(date +%Y%m%d-%H%M%S).txt"

cat > "$SUMMARY_FILE" << EOF
Performance Validation Results
Generated: $TIMESTAMP

Summary:
  Total Tests: $TOTAL_TESTS
  Passed: ${#PASSED_TESTS[@]}
  Failed: ${#FAILED_TESTS[@]}
  Pass Rate: $PASS_RATE%

Passed Tests:
EOF

for test in "${PASSED_TESTS[@]}"; do
  echo "  ✓ $test" >> "$SUMMARY_FILE"
done

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo "" >> "$SUMMARY_FILE"
  echo "Failed Tests:" >> "$SUMMARY_FILE"
  for test in "${FAILED_TESTS[@]}"; do
    echo "  ✗ $test" >> "$SUMMARY_FILE"
  done
fi

echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Summary saved to: $SUMMARY_FILE"
echo ""

# Exit with appropriate code
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC} 🎉"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC} Please review the output above."
  exit 1
fi
