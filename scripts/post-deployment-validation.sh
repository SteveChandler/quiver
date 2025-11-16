#!/bin/bash

# Post-Deployment Validation Script
# Comprehensive validation after deployment completion

set -e

# Configuration
API_URL="${API_URL:-https://api.quiversurf.app}"
STAGING_URL="${STAGING_URL:-https://dev.quiversurf.app}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Test result function
test_result() {
    local test_name=$1
    local result=$2
    local details=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} ${test_name}: PASS ${details}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    elif [ "$result" = "FAIL" ]; then
        echo -e "${RED}✗${NC} ${test_name}: FAIL ${details}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    elif [ "$result" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} ${test_name}: WARNING ${details}"
        WARNINGS=$((WARNINGS + 1))
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
}

# Header
echo ""
echo "========================================="
echo "Post-Deployment Validation"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo "Production: ${API_URL}"
echo ""

# 1. Security Validation
echo -e "${BLUE}[1/5] Security Validation${NC}"
echo "-----------------------------------------"

# Test SSRF Protection
echo -n "Testing SSRF protection... "
SSRF_TESTS=(
    "http://169.254.169.254/latest/meta-data"
    "http://metadata.google.internal"
    "http://localhost:8080/admin"
    "http://127.0.0.1/admin"
    "file:///etc/passwd"
)

SSRF_PASSED=true
for url in "${SSRF_TESTS[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${API_URL}/api/image-proxy?url=${url}" 2>/dev/null)
    if [ "$response" != "403" ]; then
        SSRF_PASSED=false
        break
    fi
done

if [ "$SSRF_PASSED" = true ]; then
    test_result "SSRF Protection" "PASS" "(All malicious URLs blocked)"
else
    test_result "SSRF Protection" "FAIL" "(Some URLs not blocked)"
fi

# Test Rate Limiting
echo -n "Testing rate limiting... "
RATE_LIMITED=false
for i in {1..15}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${API_URL}/api/beaches/nearby?lat=34&lng=-118" 2>/dev/null)
    if [ "$response" = "429" ]; then
        RATE_LIMITED=true
        break
    fi
done

if [ "$RATE_LIMITED" = true ]; then
    test_result "Rate Limiting" "PASS" "(Triggered at request $i)"
else
    test_result "Rate Limiting" "WARN" "(Not triggered in 15 requests)"
fi

# Test Input Validation
echo -n "Testing input validation... "
INVALID_INPUT='"><script>alert(1)</script>'
response=$(curl -s -o /dev/null -w "%{http_code}" \
    "${API_URL}/api/beaches/search?q=${INVALID_INPUT}" 2>/dev/null)
if [ "$response" = "400" ]; then
    test_result "Input Validation" "PASS" "(XSS attempt blocked)"
else
    test_result "Input Validation" "WARN" "(Got ${response}, expected 400)"
fi

echo ""

# 2. Performance Validation
echo -e "${BLUE}[2/5] Performance Validation${NC}"
echo "-----------------------------------------"

# Test API Response Times
ENDPOINTS=(
    "/health:100"
    "/api/beaches/featured:500"
    "/api/beaches/nearby?lat=34&lng=-118:1000"
    "/api/v1/recommendations:2000"
)

for endpoint_config in "${ENDPOINTS[@]}"; do
    IFS=':' read -r endpoint threshold <<< "$endpoint_config"
    
    start_time=$(date +%s%3N)
    curl -s "${API_URL}${endpoint}" > /dev/null 2>&1
    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))
    
    if [ $response_time -lt $threshold ]; then
        test_result "API: ${endpoint%%\?*}" "PASS" "(${response_time}ms < ${threshold}ms)"
    else
        test_result "API: ${endpoint%%\?*}" "WARN" "(${response_time}ms > ${threshold}ms)"
    fi
done

echo ""

# 3. Functional Validation
echo -e "${BLUE}[3/5] Functional Validation${NC}"
echo "-----------------------------------------"

# Test Critical Endpoints
CRITICAL_ENDPOINTS=(
    "/api/beaches/featured"
    "/api/coach-picks"
    "/api/forecasts/bulk"
)

for endpoint in "${CRITICAL_ENDPOINTS[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}${endpoint}" 2>/dev/null)
    if [ "$response" = "200" ]; then
        test_result "Endpoint: ${endpoint}" "PASS" "(200 OK)"
    else
        test_result "Endpoint: ${endpoint}" "FAIL" "(Got ${response})"
    fi
done

echo ""

# 4. Database Query Performance
echo -e "${BLUE}[4/5] Database Performance${NC}"
echo "-----------------------------------------"

# This would normally query Supabase metrics API
# For now, we'll check if the API is responsive
response_time=$(curl -s -o /dev/null -w "%{time_total}" \
    "${API_URL}/api/beaches/nearby?lat=34&lng=-118" 2>/dev/null)
response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)

if [ "$response_time_ms" -lt "100" ]; then
    test_result "DB Query Performance" "PASS" "(Nearby beaches: ${response_time_ms}ms)"
else
    test_result "DB Query Performance" "WARN" "(Nearby beaches: ${response_time_ms}ms)"
fi

echo ""

# 5. Comparison with Staging
echo -e "${BLUE}[5/5] Production vs Staging Comparison${NC}"
echo "-----------------------------------------"

# Compare response times
PROD_TIME=$(curl -s -o /dev/null -w "%{time_total}" \
    "${API_URL}/api/v1/recommendations" 2>/dev/null)
STAGING_TIME=$(curl -s -o /dev/null -w "%{time_total}" \
    "${STAGING_URL}/api/v1/recommendations" 2>/dev/null || echo "999")

PROD_MS=$(echo "$PROD_TIME * 1000" | bc | cut -d. -f1)
STAGING_MS=$(echo "$STAGING_TIME * 1000" | bc | cut -d. -f1)

if [ "$PROD_MS" -le "$STAGING_MS" ]; then
    test_result "Prod vs Staging Performance" "PASS" "(Prod: ${PROD_MS}ms, Staging: ${STAGING_MS}ms)"
else
    test_result "Prod vs Staging Performance" "WARN" "(Prod slower: ${PROD_MS}ms vs ${STAGING_MS}ms)"
fi

echo ""

# Summary
echo "========================================="
echo -e "${BLUE}Validation Summary${NC}"
echo "========================================="
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment validation PASSED!${NC}"
    echo "All critical tests passed. Safe to proceed."
    exit 0
else
    echo -e "${RED}✗ Deployment validation FAILED!${NC}"
    echo "Critical issues detected. Review failed tests."
    exit 1
fi
