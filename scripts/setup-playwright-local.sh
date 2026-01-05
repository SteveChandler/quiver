#!/bin/bash

# Playwright Local Setup Script
# This script helps set up Playwright tests to run locally

set -e

echo "🎭 Playwright Local Setup"
echo "========================="
echo ""

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js first."
    exit 1
fi

# Prefer `.env.playwright.local` for local runs (no copy step needed).
if [ -f ".env.playwright.local" ]; then
    echo "✅ Found .env.playwright.local (will be loaded automatically by Playwright config)"
else
    echo "⚠️  .env.playwright.local not found."
    echo "   Create it to pin BASE_URL=http://localhost:3000 and local-only toggles."
    echo "   Note: Playwright loads env in this order: CLI/OS > .env.playwright.local > .env.playwright > .env"
fi

# Ensure `.env.playwright` exists for shared/default settings (optional but recommended).
if [ ! -f ".env.playwright" ]; then
    echo ""
    echo "📝 Creating .env.playwright from template (shared defaults)..."
    cp .env.playwright.example .env.playwright
    echo "✅ Created .env.playwright"
fi

# Note: local E2E runs can point at prod DB (via `.env.playwright`), so Supabase
# may not be running locally. We keep this script focused on Playwright + localhost.

# Install Playwright browsers
echo ""
echo "🌐 Installing Playwright browsers..."
npx playwright install chromium

# Create auth directory if it doesn't exist
mkdir -p e2e/.auth

# Check if dev server is running
echo ""
echo "🔍 Checking if dev server is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Dev server is running on http://localhost:3000"
    DEV_SERVER_RUNNING=true
else
    echo "⚠️  Dev server is not running"
    echo ""
    echo "The dev server will start automatically when you run tests,"
    echo "or you can start it manually with:"
    echo "  yarn dev"
    DEV_SERVER_RUNNING=false
fi

# Summary
echo ""
echo "========================="
echo "✅ Setup Complete!"
echo "========================="
echo ""
echo "Next steps:"
echo ""
echo "1. Ensure the test user exists in the Supabase environment configured in .env.playwright"
echo "   (Localhost runs may point at prod DB; there is no local Supabase Studio requirement.)"
echo ""
echo "2. Generate authentication state:"
echo "   yarn test:e2e:auth:setup"
echo ""
echo "3. Run tests:"
echo "   yarn test:e2e              # All tests"
echo "   yarn test:e2e:headed      # With browser visible"
echo "   yarn test:e2e:ui          # Interactive UI"
echo ""
echo "For more information, see: e2e/README.md"
echo ""






