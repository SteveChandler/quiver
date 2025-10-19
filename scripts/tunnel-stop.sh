#!/bin/bash

# Stop the Cloudflare tunnel and clean up

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TUNNEL_PID_FILE=".tunnel-pid"
TUNNEL_URL_FILE=".tunnel-url"

echo -e "${YELLOW}🛑 Stopping Cloudflare Tunnel...${NC}"
echo ""

# Kill tunnel process if PID file exists
if [[ -f "$TUNNEL_PID_FILE" ]]; then
    TUNNEL_PID=$(cat "$TUNNEL_PID_FILE")
    if ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
        echo "Killing tunnel process (PID: $TUNNEL_PID)..."
        kill "$TUNNEL_PID" 2>/dev/null || true
        echo -e "${GREEN}✅ Tunnel stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  Tunnel process not found (may have already stopped)${NC}"
    fi
    rm -f "$TUNNEL_PID_FILE"
else
    echo -e "${YELLOW}⚠️  No tunnel PID file found${NC}"
fi

# Kill any remaining cloudflared processes
REMAINING=$(pgrep -f "cloudflared tunnel" | wc -l | tr -d ' ')
if [[ "$REMAINING" -gt 0 ]]; then
    echo ""
    echo "Found $REMAINING remaining cloudflared process(es)..."
    pkill -f "cloudflared tunnel"
    echo -e "${GREEN}✅ Cleaned up remaining processes${NC}"
fi

# Clean up URL file
if [[ -f "$TUNNEL_URL_FILE" ]]; then
    rm -f "$TUNNEL_URL_FILE"
    echo -e "${GREEN}✅ Removed tunnel URL file${NC}"
fi

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"



