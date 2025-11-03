# New Developer Setup Guide

Welcome to Quiver! This guide will get you up and running in ~15 minutes.

## Prerequisites

Before you start, make sure you have:

- [x] **Node.js 20+** installed ([Download](https://nodejs.org/))
- [x] **Yarn 1.22+** installed (`npm install -g yarn`)
- [x] **Git** installed
- [x] **Supabase CLI** installed (`npm install -g supabase`)

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/quiver.git
cd quiver
```

## Step 2: Install Dependencies

```bash
yarn install
```

This will take 2-3 minutes to install all packages.

## Step 3: Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Open .env.local in your editor
code .env.local  # or vim .env.local
```

**For now, leave everything as is** - we'll configure it properly in the next step.

## Step 4: Start Local Supabase

```bash
# Start Supabase (this will download Docker images the first time)
supabase start
```

**First time?** This will take 5-10 minutes to download Docker images.

When complete, you'll see output like:

```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: your-super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 5: Configure Environment Variables

Copy the values from the `supabase start` output to your `.env.local`:

```bash
# Update these lines in .env.local:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy anon key from output>
SUPABASE_SERVICE_ROLE_KEY=<copy service_role key from output>
```

## Step 6: Run Database Migrations

```bash
supabase db reset
```

This applies all database migrations and seeds test data.

## Step 7: Start Development Server

```bash
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) - you should see the Quiver home page!

## Step 8: Create a Test Account

1. Go to [http://localhost:3000](http://localhost:3000)
2. Click **"Log In"**
3. Click **"Sign Up"**
4. Use any email (doesn't need to be real for local development)
5. Password: anything with 6+ characters
6. Click **"Create Account"**

You're now logged in to your local Quiver instance!

## Verification Checklist

Make sure everything works:

- [ ] **Home page loads** at http://localhost:3000
- [ ] **You can log in/sign up**
- [ ] **Beach list appears** on the map
- [ ] **Supabase Studio accessible** at http://127.0.0.1:54323
- [ ] **No errors in terminal** (warnings are OK)

## Next Steps

### Learn the Codebase

1. **[Supabase Setup Guide](../SUPABASE_SETUP.md)** - How to connect to Supabase correctly
2. **[Testing Guide](../TESTING_GUIDE.md)** - How to run and write tests
3. **[ARCHITECTURE.md](../../ARCHITECTURE.md)** - System architecture overview
4. **[docs/](../)** - Browse all documentation

### Try Common Tasks

See [COMMON_TASKS.md](./COMMON_TASKS.md) for:
- Adding a new component
- Creating a database migration
- Running tests
- Debugging issues

### Get Coding!

Pick a task from the issue tracker or explore the codebase. Don't hesitate to ask questions!

---

## Troubleshooting

### "Port 54321 is already allocated"

**Solution:** Another Supabase instance is running
```bash
supabase stop
supabase start
```

### "Cannot find module '@/lib/...'"

**Solution:** Restart the development server
```bash
# Kill the server (Ctrl+C)
rm -rf .next
yarn dev
```

### "Supabase not running"

**Solution:** Check Supabase status
```bash
supabase status

# If not running:
supabase start
```

### Build/Type Errors

**Solution:** Clear cache and rebuild
```bash
rm -rf .next node_modules
yarn install
yarn dev
```

### Still Having Issues?

See the full [Troubleshooting Guide](../TROUBLESHOOTING.md) or ask for help!

---

## Quick Reference Commands

```bash
# Development
yarn dev                  # Start dev server
yarn build               # Build for production
yarn lint                # Lint code

# Supabase
supabase start           # Start local Supabase
supabase stop            # Stop Supabase
supabase status          # Check status
supabase db reset        # Reset database

# Testing
yarn test                # Run unit tests
npx playwright test      # Run E2E tests

# Database
yarn db:types            # Generate TypeScript types
yarn db:reset            # Reset local database
```

---

Welcome to the Quiver team! 🏄‍♂️
