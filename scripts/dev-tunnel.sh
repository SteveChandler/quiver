#!/bin/bash

# Automated Cloudflare Tunnel Setup for Mobile Development
# Starts tunnel, extracts URL, and updates Capacitor config automatically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌊 Quiver Mobile Dev Tunnel Automation${NC}"
echo "========================================"
echo ""

# Paths
TUNNEL_URL_FILE=".tunnel-url"
IOS_CONFIG="ios/App/App/capacitor.config.json"
TUNNEL_PID_FILE=".tunnel-pid"

# Parse command line arguments
AUTO_SYNC_IOS=false
AUTO_OPEN_XCODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --sync-ios)
      AUTO_SYNC_IOS=true
      shift
      ;;
    --open-xcode)
      AUTO_OPEN_XCODE=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --sync-ios       Automatically sync iOS after updating config"
      echo "  --open-xcode     Open Xcode after syncing (implies --sync-ios)"
      echo "  --help           Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

if [[ "$AUTO_OPEN_XCODE" == true ]]; then
  AUTO_SYNC_IOS=true
fi

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared is not installed${NC}"
    echo ""
    echo "Install with:"
    echo "  macOS: ${GREEN}brew install cloudflare/cloudflare/cloudflared${NC}"
    echo "  Linux: wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb"
    echo ""
    exit 1
fi

# Check if jq is installed (for JSON manipulation)
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is not installed (needed for JSON config updates)${NC}"
    echo ""
    echo "Install with:"
    echo "  macOS: ${GREEN}brew install jq${NC}"
    echo "  Linux: ${GREEN}sudo apt-get install jq${NC}"
    echo ""
    exit 1
fi

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Cleaning up...${NC}"
    
    # Kill tunnel if running
    if [[ -f "$TUNNEL_PID_FILE" ]]; then
        TUNNEL_PID=$(cat "$TUNNEL_PID_FILE")
        if ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
            echo "Stopping tunnel (PID: $TUNNEL_PID)..."
            kill "$TUNNEL_PID" 2>/dev/null || true
        fi
        rm -f "$TUNNEL_PID_FILE"
    fi
    
    # Kill any remaining cloudflared processes
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM EXIT

# Check if dev server is running
if ! lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Next.js dev server is not running on port 3000${NC}"
    echo ""
    echo "Please start it in another terminal:"
    echo "  ${GREEN}npm run dev${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Next.js dev server detected on port 3000${NC}"
echo ""

# Start Cloudflare tunnel in background and capture output
echo -e "${BLUE}🔒 Starting Cloudflare Tunnel...${NC}"
echo ""

# Create a temporary file for tunnel output
TUNNEL_LOG=$(mktemp)

# Start tunnel in background
cloudflared tunnel --url http://localhost:3000 > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > "$TUNNEL_PID_FILE"

echo "Tunnel PID: $TUNNEL_PID"
echo "Waiting for tunnel URL..."
echo ""

# Wait for and extract tunnel URL
TUNNEL_URL=""
MAX_WAIT=30
for i in $(seq 1 $MAX_WAIT); do
    if grep -q "https://.*\.trycloudflare\.com" "$TUNNEL_LOG"; then
        TUNNEL_URL=$(grep -o "https://.*\.trycloudflare\.com" "$TUNNEL_LOG" | head -1)
        break
    fi
    sleep 1
    echo -n "."
done
echo ""
echo ""

if [[ -z "$TUNNEL_URL" ]]; then
    echo -e "${RED}❌ Failed to extract tunnel URL${NC}"
    echo ""
    echo "Tunnel log:"
    cat "$TUNNEL_LOG"
    rm -f "$TUNNEL_LOG"
    exit 1
fi

rm -f "$TUNNEL_LOG"

echo -e "${GREEN}✅ Tunnel URL extracted: ${TUNNEL_URL}${NC}"
echo ""

# Save tunnel URL to file
echo "$TUNNEL_URL" > "$TUNNEL_URL_FILE"
echo -e "${GREEN}✅ Tunnel URL saved to ${TUNNEL_URL_FILE}${NC}"

# Update iOS Capacitor config
if [[ -f "$IOS_CONFIG" ]]; then
    echo ""
    echo -e "${BLUE}📱 Updating iOS Capacitor config...${NC}"
    
    # Update the URL in the JSON file using jq
    TMP_FILE=$(mktemp)
    jq --arg url "$TUNNEL_URL" '.server.url = $url' "$IOS_CONFIG" > "$TMP_FILE"
    mv "$TMP_FILE" "$IOS_CONFIG"
    
    echo -e "${GREEN}✅ iOS config updated: ${IOS_CONFIG}${NC}"
else
    echo -e "${YELLOW}⚠️  iOS config not found: ${IOS_CONFIG}${NC}"
fi

# Auto-sync iOS if requested
if [[ "$AUTO_SYNC_IOS" == true ]]; then
    echo ""
    echo -e "${BLUE}🔄 Syncing iOS project...${NC}"
    npx cap sync ios
    echo -e "${GREEN}✅ iOS sync complete${NC}"
fi

# Open Xcode if requested
if [[ "$AUTO_OPEN_XCODE" == true ]]; then
    echo ""
    echo -e "${BLUE}📱 Opening Xcode...${NC}"
    npx cap open ios
fi

# Display summary
echo ""
echo -e "${GREEN}=================================="
echo "✅ Tunnel Setup Complete!"
echo -e "==================================${NC}"
echo ""
echo -e "Tunnel URL: ${BLUE}${TUNNEL_URL}${NC}"
echo ""
echo "Your mobile app will now connect to your local dev server!"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "  • Keep this terminal window open"
echo "  • The tunnel will stop when you press Ctrl+C"
echo "  • Tunnel URLs are temporary and change each time"
echo ""

if [[ "$AUTO_SYNC_IOS" == false ]]; then
    echo "Next steps:"
    echo "  1. Run: ${GREEN}npx cap sync ios${NC}"
    echo "  2. Open Xcode and run the app"
    echo ""
    echo "Or use: ${GREEN}npm run tunnel:ios:open${NC} next time to automate this"
    echo ""
fi

echo "To stop the tunnel, press ${YELLOW}Ctrl+C${NC}"
echo ""

# Keep script running and show tunnel logs
echo -e "${BLUE}📡 Tunnel is running... (showing logs below)${NC}"
echo "=================================="
echo ""

# Wait for tunnel process
wait "$TUNNEL_PID"
