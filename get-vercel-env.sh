#!/bin/bash

# Check if the Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI is not installed. Installing..."
    npm install -g vercel
fi

# Log in to Vercel if not already logged in
if ! vercel whoami &> /dev/null; then
    echo "Please log in to Vercel:"
    vercel login
fi

# Fetch environment variables
echo "Fetching Supabase environment variables from Vercel..."
SUPABASE_URL=$(vercel env pull .env.vercel --environment=production 2>/dev/null && grep NEXT_PUBLIC_SUPABASE_URL .env.vercel | cut -d '=' -f2)
SUPABASE_KEY=$(vercel env pull .env.vercel --environment=production 2>/dev/null && grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.vercel | cut -d '=' -f2)

# Check if variables were successfully retrieved
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ Failed to retrieve Supabase environment variables from Vercel."
    echo "Please manually run the test with your Supabase credentials:"
    echo "SUPABASE_URL=https://your-project.supabase.co SUPABASE_KEY=your-anon-key node test-supabase.mjs"
    exit 1
fi

# Run the test with the fetched environment variables
echo "Running Supabase tests with fetched credentials..."
SUPABASE_URL="$SUPABASE_URL" SUPABASE_KEY="$SUPABASE_KEY" node test-supabase.mjs 