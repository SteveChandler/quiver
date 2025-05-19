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
vercel env pull .env.vercel --environment=production 

if [ -f .env.vercel ]; then
    echo "✅ Successfully fetched environment variables from Vercel"
    
    # Extract Supabase variables
    SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.vercel 2>/dev/null | cut -d '=' -f2)
    SUPABASE_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.vercel 2>/dev/null | cut -d '=' -f2)
    
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
        echo "❌ Could not find Supabase variables in the Vercel environment"
        exit 1
    fi
    
    # Run verification script
    echo "Running verification script with Vercel credentials..."
    SUPABASE_URL="$SUPABASE_URL" SUPABASE_KEY="$SUPABASE_KEY" node verify-tables.mjs
    
    # Clean up
    rm .env.vercel
else
    echo "❌ Failed to pull environment variables from Vercel"
    echo "Please run the verification script manually with your Supabase credentials:"
    echo "SUPABASE_URL=https://your-project.supabase.co SUPABASE_KEY=your-anon-key node verify-tables.mjs"
    exit 1
fi 