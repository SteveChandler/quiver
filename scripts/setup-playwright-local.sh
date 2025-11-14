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

# Check if .env.playwright exists
if [ ! -f ".env.playwright" ]; then
    echo "📝 Creating .env.playwright from template..."
    cp .env.playwright.example .env.playwright
    echo "✅ Created .env.playwright"
    echo ""
    echo "⚠️  Please edit .env.playwright and set:"
    echo "   - TEST_USER_EMAIL"
    echo "   - TEST_USER_PASSWORD"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY (from 'supabase status')"
    echo ""
    read -p "Press Enter after updating .env.playwright..."
fi

# Check if Supabase is running
echo "🔍 Checking Supabase status..."
if command -v supabase &> /dev/null; then
    if supabase status &> /dev/null; then
        echo "✅ Supabase is running"
        SUPABASE_RUNNING=true
    else
        echo "⚠️  Supabase is not running"
        echo ""
        echo "To start Supabase:"
        echo "  supabase start"
        echo ""
        read -p "Start Supabase now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            supabase start
            SUPABASE_RUNNING=true
        else
            SUPABASE_RUNNING=false
        fi
    fi
else
    echo "⚠️  Supabase CLI not found. Install it with:"
    echo "  brew install supabase/tap/supabase"
    SUPABASE_RUNNING=false
fi

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
echo "1. Ensure test user exists in Supabase:"
echo "   - Go to http://127.0.0.1:54323 (Supabase Studio)"
echo "   - Navigate to Authentication → Users"
echo "   - Create user with email/password from .env.playwright"
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


