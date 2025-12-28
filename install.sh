#!/bin/bash

# Quiver Surf App - Setup Script
# Run this script to set up the project in a new environment

set -e  # Exit on any error

echo "🌊 Setting up Quiver Surf App..."
echo "=================================="

# Check Node.js version
echo "📋 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20.18 or higher."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="20.18.1"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION detected. Please upgrade to Node.js $REQUIRED_VERSION or higher."
    exit 1
fi

echo "✅ Node.js $NODE_VERSION detected"

# Ensure Yarn is available (via Corepack or standalone install)
echo "📋 Checking Yarn..."
if ! command -v yarn &> /dev/null; then
    if command -v corepack &> /dev/null; then
        echo "🔧 Enabling Yarn via Corepack..."
        corepack enable
    fi
fi

if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn is not installed. Please install Yarn 1.22 or enable it with Corepack."
    echo "   Visit: https://classic.yarnpkg.com/lang/en/docs/install/"
    exit 1
fi

YARN_VERSION=$(yarn --version)
echo "✅ Yarn $YARN_VERSION detected"

# Install dependencies
echo "📦 Installing dependencies..."
echo "This may take a few minutes..."
yarn install --frozen-lockfile

echo ""
echo "🔧 Setting up environment..."

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        echo "📝 Creating .env.local from .env.example..."
        cp .env.example .env.local
        echo "⚠️  Please edit .env.local with your Supabase credentials"
    else
        echo "📝 Creating .env.local template..."
        cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Optional: Analytics & Monitoring
NEXT_PUBLIC_VERCEL_URL=your_deployment_url_here
EOF
        echo "⚠️  Please edit .env.local with your actual Supabase credentials"
    fi
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Supabase credentials"
echo "2. Set up your Supabase database (run migrations from scripts/migrations/)"
echo "3. Start development server: yarn dev"
echo ""
echo "📚 Documentation:"
echo "- Setup guide: SETUP.md"
echo "- Architecture: docs/ARCHITECTURE.md"
echo "- Component usage: docs/DRY_COMPONENT_USAGE.md"
echo ""
echo "🚀 Ready to surf the code! 🏄‍♂️" 
