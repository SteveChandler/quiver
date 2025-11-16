#!/bin/bash

# Deployment Monitoring Script
# Continuously monitors key metrics during deployment

set -e

# Configuration
API_URL="${API_URL:-https://api.quiversurf.app}"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"  # seconds
ALERT_WEBHOOK="${SLACK_WEBHOOK:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Thresholds
ERROR_RATE_THRESHOLD=0.5  # 0.5%
RESPONSE_TIME_THRESHOLD=1000  # ms
SSRF_BLOCKS_THRESHOLD=50  # per minute

# Function to send alert
send_alert() {
    local level=$1
    local message=$2
    
    echo -e "${RED}[ALERT] ${message}${NC}"
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST $ALERT_WEBHOOK \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"🚨 Deployment Alert (${level}): ${message}\"}" \
            2>/dev/null || true
    fi
}

# Function to check API health
check_api_health() {
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "\n%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    local http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" != "200" ]; then
        send_alert "CRITICAL" "Health check failed with code ${http_code}"
        return 1
    fi
    
    if [ $response_time -gt $RESPONSE_TIME_THRESHOLD ]; then
        send_alert "WARNING" "Response time ${response_time}ms exceeds threshold"
    fi
    
    echo -e "${GREEN}✓${NC} Health check: ${response_time}ms"
}

# Function to check SSRF protection
check_ssrf_protection() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${API_URL}/api/image-proxy?url=http://169.254.169.254" 2>/dev/null)
    
    if [ "$response" != "403" ]; then
        send_alert "CRITICAL" "SSRF protection not working! Got ${response} instead of 403"
        return 1
    fi
    
    echo -e "${GREEN}✓${NC} SSRF protection: Active (403)"
}

# Function to check rate limiting
check_rate_limiting() {
    local count=0
    local rate_limited=false
    
    for i in {1..15}; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" \
            "${API_URL}/api/beaches/nearby?lat=34&lng=-118" 2>/dev/null)
        
        if [ "$response" = "429" ]; then
            rate_limited=true
            count=$i
            break
        fi
    done
    
    if [ "$rate_limited" = false ]; then
        send_alert "WARNING" "Rate limiting may not be working correctly"
    else
        echo -e "${GREEN}✓${NC} Rate limiting: Active (triggered at request ${count})"
    fi
}

# Function to check performance metrics
check_performance() {
    # Test recommendations endpoint (most complex)
    local start_time=$(date +%s%3N)
    curl -s "${API_URL}/api/v1/recommendations" > /dev/null 2>&1
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [ $response_time -gt 5000 ]; then
        send_alert "CRITICAL" "Recommendations API taking ${response_time}ms (>5s)"
        return 1
    elif [ $response_time -gt 1000 ]; then
        send_alert "WARNING" "Recommendations API slow: ${response_time}ms"
    fi
    
    echo -e "${GREEN}✓${NC} Recommendations API: ${response_time}ms"
}

# Function to display metrics summary
display_summary() {
    echo ""
    echo "========================================="
    echo "Deployment Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================="
    echo "API URL: ${API_URL}"
    echo "Check Interval: ${CHECK_INTERVAL}s"
    echo ""
}

# Main monitoring loop
main() {
    echo "Starting deployment monitoring..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    local iteration=0
    
    while true; do
        iteration=$((iteration + 1))
        
        display_summary
        echo "Check #${iteration}"
        echo "-----------------------------------------"
        
        # Run all checks
        check_api_health
        check_ssrf_protection
        check_rate_limiting
        check_performance
        
        echo ""
        echo "Next check in ${CHECK_INTERVAL} seconds..."
        echo ""
        
        sleep $CHECK_INTERVAL
    done
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

# Run main function
main
