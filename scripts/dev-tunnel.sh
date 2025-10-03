#!/bin/bash

# Local Mobile Development Helper Script
# Starts Next.js dev server and Cloudflare tunnel

set -e

echo "🌊 Quiver Local Mobile Development"
echo "=================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed"
    echo ""
    echo "Install with:"
    echo "  macOS: brew install cloudflare/cloudflare/cloudflared"
    echo "  Linux: wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb"
    echo ""
    echo "Alternatively, use ngrok:"
    echo "  macOS: brew install ngrok"
    echo "  Then run: ngrok http 3000"
    echo ""
    exit 1
fi

# Check if dev server is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Next.js dev server already running on port 3000"
else
    echo "🚀 Starting Next.js dev server (bound to 0.0.0.0)..."
    echo ""
    npx next dev -H 0.0.0.0 -p 3000 &
    DEV_PID=$!
    
    # Wait for dev server to start
    echo "⏳ Waiting for dev server to be ready..."
    for i in {1..30}; do
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
            echo "✅ Dev server ready!"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "🔒 Starting Cloudflare Tunnel..."
echo "=================================="
echo ""
echo "Copy the HTTPS URL below and add it to capacitor.config.dev.ts"
echo "Or set it as: export CAPACITOR_DEV_URL='https://...'"
echo ""

# Start tunnel (this will run in foreground)
cloudflared tunnel --url http://localhost:3000

# Cleanup on exit
trap "echo ''; echo '🛑 Stopping dev server...'; kill $DEV_PID 2>/dev/null; exit" INT TERM







