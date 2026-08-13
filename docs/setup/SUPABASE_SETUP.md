# Supabase Setup & Connection Guide

## 🎯 Purpose

This guide eliminates confusion about connecting to Supabase in different contexts. There is ONE correct way to create Supabase clients for each scenario.

## 🚨 Common Confusion Points

**Q: Should I use `lib/supabase` or `utils/supabase`?**
**A:** ALWAYS use `lib/supabase`. The `utils/supabase` folder has been removed (was deprecated legacy code).

**Q: Which client should I import?**
**A:** See the decision tree below based on your context.

**Q: How do I test against local vs production Supabase?**
**A:** See the "Testing" section below.

---

## 📊 Supabase Client Decision Tree

```
Where am I coding?
├─ Client Component (Browser)
│  └─ import { createClient } from '@/lib/supabase/client'
│
├─ Server Component (SSR)
│  └─ import { createSupabaseServerClient } from '@/lib/supabase/server'
│
├─ API Route (app/api/*)
│  ├─ Read-only operations
│  │  └─ import { createAPIServerClient } from '@/lib/supabase/api-server-client'
│  │
│  ├─ Auth operations (setting cookies)
│  │  └─ import { createAPIServerClientWithResponse } from '@/lib/supabase/api-server-client'
│  │
│  └─ Admin operations (bypass RLS)
│     └─ import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
│
└─ Server Action
   └─ import { createServerClient } from '@/lib/supabase'
```

---

## 🔧 Client Implementation Details

### 1. Browser Client (Client Components)

**File:** `lib/supabase/client.ts`

**When to use:**
- React components that run in the browser
- Client-side hooks
- Client-side data fetching

**Example:**
```typescript
'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export function SessionList() {
  const [sessions, setSessions] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchSessions = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .limit(10);

      setSessions(data || []);
    };

    fetchSessions();
  }, []);

  return <div>{/* render sessions */}</div>;
}
```

**Features:**
- Singleton pattern (one instance per page load)
- Automatic token refresh
- Persistent session
- Real-time subscriptions

---

### 2. Server Client (Server Components)

**File:** `lib/supabase/server.ts`

**When to use:**
- React Server Components
- Server-side data fetching
- Initial page loads

**Example:**
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function BeachPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const { data: beach } = await supabase
    .from('beaches')
    .select('*')
    .eq('id', params.id)
    .single();

  return <div>{beach?.name}</div>;
}
```

**Features:**
- Cookie-based session management
- SSR-compatible
- No client-side JavaScript needed

**Important:** Cannot modify cookies in Server Components (use API routes for auth operations)

---

### 3. API Route Client

**File:** `lib/supabase/api-server-client.ts`

**When to use:**
- Next.js API routes (`app/api/*`)
- Backend operations
- Authenticated API endpoints

#### 3a. Read-Only Operations

```typescript
import { createAPIServerClient } from '@/lib/supabase/api-server-client';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createAPIServerClient();

  // Get authenticated user
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch user data
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user.id);

  return NextResponse.json({ sessions: data });
}
```

#### 3b. Auth Operations (Cookie Modifications)

```typescript
import { createAPIServerClientWithResponse } from '@/lib/supabase/api-server-client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const supabase = createAPIServerClientWithResponse(request, response);

  // Auth operation that sets cookies
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'user@example.com',
    password: 'password123',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return response; // Returns with cookies set
}
```

#### 3c. Helper for Authenticated API Calls

```typescript
import { getAuthenticatedAPIClient } from '@/lib/supabase/api-server-client';
import { NextResponse } from 'next/server';

export async function POST() {
  const { supabase, user, error } = await getAuthenticatedAPIClient();

  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  // user is guaranteed to be authenticated here
  // ... your API logic

  return NextResponse.json({ success: true });
}
```

---

### 4. Service Role Client (Admin Operations)

**File:** `lib/supabase/server.ts`

**When to use:**
- Admin operations
- Bypassing Row Level Security
- Background jobs
- Data migrations

**Example:**
```typescript
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function syncBeachData() {
  const supabase = createSupabaseServiceRoleClient();

  // This bypasses RLS policies
  const { data } = await supabase
    .from('beaches')
    .update({ verified: true })
    .eq('status', 'pending');

  return data;
}
```

**⚠️ Warning:** Service role key bypasses ALL security policies. Use with extreme caution!

---

## 🌐 Environment Configuration

### Local Development

```bash
# .env or .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
```

**Setup:**
```bash
# Start local Supabase
supabase start

# Get your local keys
supabase status

# Copy keys to .env.local
```

### Production/Staging

```bash
# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
```

**Get from:** Supabase Dashboard → Project Settings → API

## Local database bootstrap

Use the committed production-derived snapshot to boot local Supabase:

```bash
yarn db:local
```

`yarn db:local` runs `scripts/db-local-from-snapshot.mjs`. It checks for
`supabase/snapshots/schema.sql`, `catalog.sql`, and `storage-policies.sql`,
temporarily disables migration replay in `supabase/config.toml`, points the
seed list at those three files in schema/storage/catalog order, stops any
existing local stack, and starts Supabase. It restores the original
`supabase/config.toml` on success, failure, or an interrupt; the committed
config must not be left patched.

This intentionally does not replay `supabase/migrations/`. Replay is
structurally broken: production has 346 beaches, but only 239 are created by
migrations; 107 exist only in production, and several data migrations assert
against or update rows that are present only in production. The snapshot is the
working local bootstrap until the migration chain is repaired.

To test a new migration, boot the snapshot first and apply the migration
directly to that local database:

```bash
yarn db:local
psql "$(supabase status -o json | jq -r .DB_URL)" \
  -f supabase/migrations/<migration-file>.sql
```

Do not use a full migration replay as the test setup. The direct `psql`
command above targets the local `DB_URL`; it is not a production migration
path.

Two snapshot restore requirements are easy to miss:

- `supabase/roles.sql` must create the `posthog_readonly` role. The committed
  schema snapshot contains grants to that role, so restore fails when the role
  is absent.
- `supabase/snapshots/catalog.sql` is committed and generated from an explicit
  table allowlist, currently `beaches`, rather than from a broad data dump. Its
  generator has a column-name PII guard and refuses columns that look like
  email, phone, password, token, secret, user ID, device, or similar user data.

Regenerate the snapshots from the linked production project with:

```bash
yarn db:snapshot
```

This runs the linked schema dump and `scripts/db-snapshot-catalog.mjs`, which
reads the production catalog with the service-role client from `.env.local` and
also refreshes the storage-policy snapshot. Review the generated files before
committing them.

### Environment Variable Validation

The application automatically validates environment variables at build time using `lib/env-validation.ts`.

**What's validated:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Required, must be valid URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Required, must match key format
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` - Warns if missing (required for admin operations)
- ⚠️ `NEXT_PUBLIC_SITE_URL` - Warns if missing (needed for OAuth redirects)

**How it works:**
```typescript
// Runs automatically in next.config.mjs at build time
import { validateEnvironmentOrThrow } from './lib/env-validation.ts';
validateEnvironmentOrThrow();
```

**Behavior:**
- **Development:** Throws error and prevents build if required variables missing
- **Production:** Logs errors but doesn't crash (allows graceful degradation)
- **Always:** Shows warnings for optional but recommended variables

**If validation fails:**
1. Check your `.env.local` file exists
2. Ensure it has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Run `supabase status` to get local development keys
4. See `.env.example` for complete variable list

---

## 🧪 Testing with Supabase

### Unit Tests (Jest)

**Always mock Supabase in unit tests:**

```typescript
// __tests__/components/my-component.test.tsx
jest.mock('@/lib/supabase/client');

import { createClient } from '@/lib/supabase/client';

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      data: [{ id: 1, name: 'Test' }],
      error: null
    }))
  }))
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);
```

**Why?** Unit tests should be fast and not depend on external services.

### E2E Tests (Playwright)

**Use real Supabase (local or dev environment):**

```bash
# .env.playwright
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

**Setup:**
```bash
# Start local Supabase
supabase start

# Run E2E tests
npx playwright test
```

**Why?** E2E tests verify the entire stack works together.

### Test Decision Matrix

| Test Type | Supabase Connection | Speed | Use Case |
|-----------|---------------------|-------|----------|
| Unit Test | ❌ Mocked | Fast (ms) | Component logic, utilities |
| Integration Test | ❌ Mocked | Medium (seconds) | Component interactions |
| E2E Test | ✅ Real (local) | Slow (minutes) | User flows, critical paths |

---

## 🚫 Deprecated Patterns (DO NOT USE)

### ❌ Don't Use utils/supabase (REMOVED)

```typescript
// ❌ WRONG - This folder has been removed
import { createClient } from '@/utils/supabase/client';
import { createClient } from '@/utils/supabase/server';
```

**Why removed?**
- Was legacy code from early development
- Replaced by more robust `lib/supabase` implementation
- Removed as of November 2025 refactoring

### ❌ Don't Create Multiple Clients

```typescript
// ❌ WRONG - Creates multiple clients
function MyComponent() {
  const supabase1 = createClient();
  const supabase2 = createClient(); // Unnecessary!

  // ...
}
```

```typescript
// ✅ CORRECT - Reuse single client
function MyComponent() {
  const supabase = createClient();

  // Use same client for all operations
  // ...
}
```

### ❌ Don't Import from Base Module

```typescript
// ❌ WRONG - Too low-level
import { getClientBrowserClient } from '@/lib/supabase';
```

```typescript
// ✅ CORRECT - Use high-level exports
import { createClient } from '@/lib/supabase/client';
```

---

## 🔍 Troubleshooting

### Problem: "Supabase URL or Anon Key is missing"

**Solution:**
1. Check `.env.local` exists and has correct variables
2. Restart development server: `yarn dev`
3. Verify environment variables are loaded:
   ```typescript
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
   ```

### Problem: "Failed to fetch" in Client Components

**Solution:**
- Check Supabase URL is accessible
- Verify CORS settings in Supabase dashboard
- Check browser console for network errors

### Problem: "Session not found" in Server Components

**Solution:**
- Ensure cookies are being passed correctly
- Check middleware is not blocking cookies
- Verify authentication flow is complete

### Problem: E2E Tests Failing with 401 Errors

**Solution:**
1. Check `.env.playwright` has correct credentials
2. Verify test user exists in database
3. Check global-setup.ts authentication logic
4. Review e2e/.auth/state.json for saved session

---

## 📚 Further Reading

- [lib/supabase/ARCHITECTURE.md](../lib/supabase/ARCHITECTURE.md) - Detailed implementation docs
- [docs/TESTING_GUIDE.md](./TESTING_GUIDE.md) - Comprehensive testing guide (coming soon)
- [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common development issues
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs) - Official documentation

---

## ✅ Quick Reference Checklist

When adding a new feature, ask:

- [ ] Am I in a Client Component? → Use `lib/supabase/client`
- [ ] Am I in a Server Component? → Use `lib/supabase/server`
- [ ] Am I in an API Route? → Use `lib/supabase/api-server-client`
- [ ] Do I need to bypass RLS? → Use `createSupabaseServiceRoleClient`
- [ ] Am I writing a test? → Mock for unit tests, real for E2E
- [ ] Have I avoided `utils/supabase`? → Yes!

---

**Last Updated:** November 2025
**Status:** Canonical reference for Supabase connections
**Maintainer:** Quiver Development Team
