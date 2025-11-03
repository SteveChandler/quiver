# Common Development Tasks

Quick reference for frequent development operations.

## Table of Contents

- [Creating a New Component](#creating-a-new-component)
- [Adding a Database Migration](#adding-a-database-migration)
- [Creating a New API Route](#creating-a-new-api-route)
- [Adding a Server Action](#adding-a-server-action)
- [Connecting to Supabase](#connecting-to-supabase)
- [Running Tests](#running-tests)
- [Debugging Issues](#debugging-issues)
- [Updating Types](#updating-types)

---

## Creating a New Component

### 1. Create Component File

```bash
# Location: components/<category>/<component-name>.tsx
touch components/profile/user-avatar.tsx
```

### 2. Basic Component Structure

```typescript
'use client';  // If using client features (useState, useEffect, etc.)

import { type ComponentProps } from 'react';

interface UserAvatarProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserAvatar({
  userId,
  size = 'md',
  className
}: UserAvatarProps) {
  return (
    <div className={className}>
      {/* Component JSX */}
    </div>
  );
}
```

### 3. Add Tests

```bash
touch __tests__/components/profile/user-avatar.test.tsx
```

### 4. Document in ARCHITECTURE.md

Update `components/ARCHITECTURE.md` if introducing new patterns.

---

## Adding a Database Migration

### 1. Create Migration File

```bash
# Create new migration (timestamp-based naming)
supabase migration new add_user_preferences

# This creates: supabase/migrations/YYYYMMDDHHMMSS_add_user_preferences.sql
```

### 2. Write Migration SQL

```sql
-- supabase/migrations/20250115120000_add_user_preferences.sql

-- Add new column
ALTER TABLE profiles
ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;

-- Update RLS policy (if needed)
CREATE POLICY "Users can update own preferences"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Add index for performance
CREATE INDEX idx_profiles_preferences
  ON profiles USING GIN (preferences);
```

### 3. Apply Migration Locally

```bash
# Apply migration
supabase db reset

# OR apply just this migration
supabase migration up
```

### 4. Update Types

```bash
# Generate new TypeScript types
yarn db:types
```

### 5. Test Migration

```bash
# Verify in Supabase Studio
open http://127.0.0.1:54323

# Or via SQL
supabase db shell
\d profiles  # Describe profiles table
```

### 6. Deploy to Production

```bash
# Push to remote Supabase
supabase db push
```

---

## Creating a New API Route

### 1. Create Route File

```bash
# app/api/<route-name>/route.ts
touch app/api/user-stats/route.ts
```

### 2. Basic Route Structure

```typescript
import { NextResponse } from 'next/server';
import { createAPIServerClient } from '@/lib/supabase/api-server-client';

// GET /api/user-stats
export async function GET(request: Request) {
  const supabase = createAPIServerClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Fetch data
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

// POST /api/user-stats
export async function POST(request: Request) {
  const supabase = createAPIServerClient();
  const body = await request.json();

  // Validate & process...

  return NextResponse.json({ success: true });
}
```

### 3. Add Tests

```bash
touch __tests__/api/user-stats.test.ts
```

### 4. Test API Route

```bash
# Start dev server
yarn dev

# Test with curl
curl http://localhost:3000/api/user-stats

# Or use REST client extension in VS Code
```

---

## Adding a Server Action

### 1. Create Action File

```bash
# Location: actions/<feature>-actions.ts
touch actions/user-stats-actions.ts
```

### 2. Basic Action Structure

```typescript
'use server';

import { createServerClient } from '@/lib/supabase';

export async function getUserStats(userId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }

  return data;
}

export async function updateUserStats(userId: string, stats: any) {
  const supabase = createServerClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('user_stats')
    .update(stats)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update stats: ${error.message}`);
  }

  return data;
}
```

### 3. Use in Component

```typescript
'use client';

import { getUserStats } from '@/actions/user-stats-actions';
import { useDataFetcher } from '@/hooks/use-data-fetcher';

export function UserStats({ userId }: { userId: string }) {
  const fetchStats = useCallback(async () => {
    return await getUserStats(userId);
  }, [userId]);

  const { data, loading, error } = useDataFetcher(fetchStats);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{/* Render stats */}</div>;
}
```

---

## Connecting to Supabase

See [docs/SUPABASE_SETUP.md](../SUPABASE_SETUP.md) for detailed guide.

### Quick Reference

```typescript
// Client Component
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// Server Component
import { createSupabaseServerClient } from '@/lib/supabase/server';
const supabase = await createSupabaseServerClient();

// API Route
import { createAPIServerClient } from '@/lib/supabase/api-server-client';
const supabase = createAPIServerClient();

// Admin/Service Role
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
const supabase = createSupabaseServiceRoleClient();
```

---

## Running Tests

See [docs/quick-start/RUNNING_TESTS.md](./RUNNING_TESTS.md) for detailed guide.

### Quick Commands

```bash
# Unit tests
yarn test

# E2E tests
npx playwright test

# Watch mode
yarn test --watch

# With UI
npx playwright test --ui
```

---

## Debugging Issues

### Development Server Issues

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
yarn install

# Restart server
yarn dev
```

### Supabase Issues

```bash
# Check status
supabase status

# Restart Supabase
supabase stop
supabase start

# Reset database
supabase db reset

# View logs
supabase logs
```

### Type Errors

```bash
# Regenerate types
yarn db:types

# Check for errors
npx tsc --noEmit

# Full build check
yarn build
```

### Common Problems

See [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for comprehensive guide.

---

## Updating Types

### After Database Changes

```bash
# Generate new types from Supabase schema
yarn db:types

# This updates: types/database.generated.ts
```

### After Package Updates

```bash
# Update TypeScript types
yarn add -D @types/package-name

# Rebuild
yarn build
```

---

## Git Workflow

### Starting New Work

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/user-stats

# Make changes...
# ...

# Stage changes
git add .

# Commit
git commit -m "feat: add user stats component"

# Push
git push origin feature/user-stats
```

### Before Opening PR

```bash
# Run tests
yarn test
npx playwright test

# Check types
npx tsc --noEmit

# Run linter
yarn lint

# Build
yarn build
```

### Commit Message Format

```
type(scope): Brief description

- Detailed change 1
- Detailed change 2

Refs: #issue-number
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

## Performance Optimization

### Check Bundle Size

```bash
# Analyze bundle
ANALYZE=true yarn build

# Opens visualization in browser
```

### Check Performance

```bash
# Lighthouse
yarn lighthouse

# Or use Chrome DevTools
```

---

## Quick Reference Links

- [Supabase Setup](../SUPABASE_SETUP.md)
- [Testing Guide](../TESTING_GUIDE.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
- [Architecture](../../ARCHITECTURE.md)
- [Style Guide](../STYLE_GUIDE.md)
- [Design Principles](../DESIGN_PRINCIPLES.md)

---

**Pro Tip:** Bookmark this file for quick reference during development!
