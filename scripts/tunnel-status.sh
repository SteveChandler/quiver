#!/bin/bash

# Show the status of the Cloudflare tunnel

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TUNNEL_PID_FILE=".tunnel-pid"
TUNNEL_URL_FILE=".tunnel-url"

echo -e "${BLUE}🌊 Cloudflare Tunnel Status${NC}"
echo "============================"
echo ""

# Check if tunnel is running
if [[ -f "$TUNNEL_PID_FILE" ]]; then
    TUNNEL_PID=$(cat "$TUNNEL_PID_FILE")
    if ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Tunnel is RUNNING${NC}"
        echo "   PID: $TUNNEL_PID"
        
        if [[ -f "$TUNNEL_URL_FILE" ]]; then
            TUNNEL_URL=$(cat "$TUNNEL_URL_FILE")
            echo -e "   URL: ${BLUE}${TUNNEL_URL}${NC}"
        fi
    else
        echo -e "${RED}❌ Tunnel is STOPPED${NC}"
        echo "   (PID file exists but process is not running)"
    fi
else
    # Check for any cloudflared processes
    RUNNING=$(pgrep -f "cloudflared tunnel" | wc -l | tr -d ' ')
    if [[ "$RUNNING" -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Cloudflared process running but not managed by script${NC}"
        echo "   Found $RUNNING process(es)"
    else
        echo -e "${RED}❌ Tunnel is NOT RUNNING${NC}"
    fi
fi

echo ""

# Check if dev server is running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ Next.js dev server is running on port 3000${NC}"
else
    echo -e "${RED}❌ Next.js dev server is NOT running${NC}"
fi

echo ""

# Show iOS config status
IOS_CONFIG="ios/App/App/capacitor.config.json"
if [[ -f "$IOS_CONFIG" ]]; then
    CURRENT_URL=$(jq -r '.server.url' "$IOS_CONFIG" 2>/dev/null)
    echo -e "iOS Config URL: ${BLUE}${CURRENT_URL}${NC}"
    
    if [[ -f "$TUNNEL_URL_FILE" ]]; then
        TUNNEL_URL=$(cat "$TUNNEL_URL_FILE")
        if [[ "$CURRENT_URL" == "$TUNNEL_URL" ]]; then
            echo -e "${GREEN}✅ Config matches active tunnel${NC}"
        else
            echo -e "${YELLOW}⚠️  Config does not match active tunnel${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  iOS config not found${NC}"
fi

echo ""



