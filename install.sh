#!/bin/bash

# Quiver Surf App - Setup Script
# Run this script to set up the project in a new environment

set -e  # Exit on any error

echo "🌊 Setting up Quiver Surf App..."
echo "=================================="

# Check Node.js version
echo "📋 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION detected. Please upgrade to Node.js 18 or higher."
    exit 1
fi

echo "✅ Node.js $NODE_VERSION detected"

# Check npm
echo "📋 Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm $NPM_VERSION detected"

# Install dependencies
echo "📦 Installing dependencies..."
echo "This may take a few minutes..."
npm install

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
echo "3. Start development server: npm run dev"
echo ""
echo "📚 Documentation:"
echo "- Setup guide: SETUP.md"
echo "- Architecture: docs/ARCHITECTURE_REVIEW.md"
echo "- Component usage: docs/DRY_COMPONENT_USAGE.md"
echo ""
echo "🚀 Ready to surf the code! 🏄‍♂️" 