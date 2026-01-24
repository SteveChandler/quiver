# Email Core Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the 3-email engagement loop (welcome, daily digest, heads-up alert) with preference capture and session logging.

**Architecture:** Resend for email delivery, Supabase Edge Functions for scheduled sends, signed JWT tokens for passwordless email actions, pg_cron for timezone-safe scheduling.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL + Edge Functions), Resend, jose (JWT library)

---

## Phase 1: Infrastructure Setup

### Task 1.1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Resend and jose**

```bash
yarn add resend jose
```

**Step 2: Verify installation**

```bash
yarn list resend jose
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add resend and jose dependencies for email core loop"
```

---

### Task 1.2: Add Environment Variables

**Files:**
- Modify: `.env.local` (local only, don't commit)
- Modify: `.env.example`

**Step 1: Add to .env.example**

Add these lines to `.env.example`:

```
# Email Core Loop
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_TOKEN_SECRET=your-32-char-secret-here
EMAIL_FROM_ADDRESS=surf@quiver.surf
```

**Step 2: Add actual values to .env.local**

```
RESEND_API_KEY=<your-resend-api-key>
EMAIL_TOKEN_SECRET=<generate-with: openssl rand -hex 32>
EMAIL_FROM_ADDRESS=surf@quiver.surf
```

**Step 3: Commit .env.example only**

```bash
git add .env.example
git commit -m "chore: add email core loop env vars to .env.example"
```

---

### Task 1.3: Database Migration - user_email_prefs

**Files:**
- Create: `supabase/migrations/20260120100000_create_user_email_prefs.sql`

**Step 1: Create migration file**

```sql
-- Migration: Create user_email_prefs table for email preferences
-- Part of Email Core Loop feature

-- Create the table
create table if not exists public.user_email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_frequency text not null default 'daily'
    check (email_frequency in ('daily', 'only_good', 'off')),
  min_good_score numeric not null default 6.0,
  skill_level text not null default 'beginner'
    check (skill_level in ('beginner', 'intermediate', 'advanced')),
  pref_time_bucket text not null default 'dawn'
    check (pref_time_bucket in ('dawn', 'after_work', 'weekends')),
  timezone text not null default 'America/Los_Angeles',
  home_beach_id uuid null references public.beaches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add comment
comment on table public.user_email_prefs is 'User preferences for email notifications';

-- Enable RLS
alter table public.user_email_prefs enable row level security;

-- RLS Policies
create policy "Users can view their own email prefs"
  on public.user_email_prefs for select
  using (auth.uid() = user_id);

create policy "Users can update their own email prefs"
  on public.user_email_prefs for update
  using (auth.uid() = user_id);

create policy "Users can insert their own email prefs"
  on public.user_email_prefs for insert
  with check (auth.uid() = user_id);

-- Service role can do everything (for Edge Functions)
create policy "Service role has full access to email prefs"
  on public.user_email_prefs for all
  using (auth.role() = 'service_role');

-- Updated_at trigger
create or replace function public.update_user_email_prefs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_email_prefs_updated_at
  before update on public.user_email_prefs
  for each row execute function public.update_user_email_prefs_updated_at();

-- Index for timezone-based queries (daily email scheduling)
create index idx_user_email_prefs_timezone on public.user_email_prefs(timezone);
create index idx_user_email_prefs_frequency on public.user_email_prefs(email_frequency);
```

**Step 2: Apply migration locally**

```bash
supabase db reset
```

Or if using remote:
```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260120100000_create_user_email_prefs.sql
git commit -m "feat(db): add user_email_prefs table for email preferences"
```

---

### Task 1.4: Database Migration - email_send_log

**Files:**
- Create: `supabase/migrations/20260120100100_create_email_send_log.sql`

**Step 1: Create migration file**

```sql
-- Migration: Create email_send_log table for tracking sent emails
-- Part of Email Core Loop feature

create table if not exists public.email_send_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in ('welcome', 'daily_best_window', 'heads_up_alert')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  subject text not null,
  best_score numeric null,
  best_beach_id uuid null references public.beaches(id) on delete set null,
  meta jsonb not null default '{}'::jsonb
);

comment on table public.email_send_log is 'Log of all emails sent to users for deduplication and analytics';

-- Enable RLS
alter table public.email_send_log enable row level security;

-- Users can view their own email logs
create policy "Users can view their own email logs"
  on public.email_send_log for select
  using (auth.uid() = user_id);

-- Service role has full access (for Edge Functions)
create policy "Service role has full access to email logs"
  on public.email_send_log for all
  using (auth.role() = 'service_role');

-- Unique constraint: one email type per user per day
create unique index uniq_email_per_user_per_type_per_day
  on public.email_send_log(user_id, email_type, local_date);

-- Index for finding users who haven't been sent today
create index idx_email_send_log_type_date on public.email_send_log(email_type, local_date);
```

**Step 2: Apply migration**

```bash
supabase db reset
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260120100100_create_email_send_log.sql
git commit -m "feat(db): add email_send_log table for email tracking"
```

---

### Task 1.5: Database Migration - saved_windows

**Files:**
- Create: `supabase/migrations/20260120100200_create_saved_windows.sql`

**Step 1: Create migration file**

```sql
-- Migration: Create saved_windows table for user-saved surf windows
-- Part of Email Core Loop feature

create table if not exists public.saved_windows (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  beach_id uuid not null references public.beaches(id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  source text not null default 'email' check (source in ('email', 'app')),
  created_at timestamptz not null default now()
);

comment on table public.saved_windows is 'Surf windows saved by users from emails or app';

-- Enable RLS
alter table public.saved_windows enable row level security;

-- Users can view their own saved windows
create policy "Users can view their own saved windows"
  on public.saved_windows for select
  using (auth.uid() = user_id);

-- Users can insert their own saved windows
create policy "Users can insert their own saved windows"
  on public.saved_windows for insert
  with check (auth.uid() = user_id);

-- Users can delete their own saved windows
create policy "Users can delete their own saved windows"
  on public.saved_windows for delete
  using (auth.uid() = user_id);

-- Service role has full access
create policy "Service role has full access to saved windows"
  on public.saved_windows for all
  using (auth.role() = 'service_role');

-- Prevent duplicate saves of same window
create unique index uniq_saved_window
  on public.saved_windows(user_id, beach_id, start_ts, end_ts);

-- Index for finding user's recent windows
create index idx_saved_windows_user_created
  on public.saved_windows(user_id, created_at desc);
```

**Step 2: Apply migration**

```bash
supabase db reset
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260120100200_create_saved_windows.sql
git commit -m "feat(db): add saved_windows table for surf window bookmarks"
```

---

### Task 1.6: Database Migration - session_logs

**Files:**
- Create: `supabase/migrations/20260120100300_create_session_logs.sql`

**Step 1: Create migration file**

```sql
-- Migration: Create session_logs table for user session feedback
-- Part of Email Core Loop feature (the "memory" component)

create table if not exists public.session_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  beach_id uuid not null references public.beaches(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz null,
  rating text not null check (rating in ('skip', 'good', 'fired')),
  notes text null,
  source text not null default 'email' check (source in ('email', 'app', 'manual')),
  predicted_score numeric null,
  created_at timestamptz not null default now()
);

comment on table public.session_logs is 'User feedback on surf sessions - used to personalize future recommendations';

-- Enable RLS
alter table public.session_logs enable row level security;

-- Users can view their own session logs
create policy "Users can view their own session logs"
  on public.session_logs for select
  using (auth.uid() = user_id);

-- Users can insert their own session logs
create policy "Users can insert their own session logs"
  on public.session_logs for insert
  with check (auth.uid() = user_id);

-- Users can update their own session logs
create policy "Users can update their own session logs"
  on public.session_logs for update
  using (auth.uid() = user_id);

-- Service role has full access
create policy "Service role has full access to session logs"
  on public.session_logs for all
  using (auth.role() = 'service_role');

-- Index for user session history
create index idx_session_logs_user_created
  on public.session_logs(user_id, created_at desc);

-- Index for analyzing prediction accuracy
create index idx_session_logs_rating_score
  on public.session_logs(rating, predicted_score)
  where predicted_score is not null;
```

**Step 2: Apply migration**

```bash
supabase db reset
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260120100300_create_session_logs.sql
git commit -m "feat(db): add session_logs table for surf session feedback"
```

---

### Task 1.7: Generate TypeScript Types

**Files:**
- Modify: `types/supabase.ts` (auto-generated)

**Step 1: Generate types**

```bash
yarn db:types
```

**Step 2: Verify new tables appear in types**

Check that `user_email_prefs`, `email_send_log`, `saved_windows`, and `session_logs` are in the generated types.

**Step 3: Commit**

```bash
git add types/supabase.ts
git commit -m "chore: regenerate supabase types with email tables"
```

---

## Phase 2: Token Utility

### Task 2.1: Create Email Token Utility

**Files:**
- Create: `lib/utils/email-token.ts`
- Create: `__tests__/lib/utils/email-token.test.ts`

**Step 1: Write failing tests**

Create `__tests__/lib/utils/email-token.test.ts`:

```typescript
import { signEmailToken, verifyEmailToken, EmailTokenPayload } from '@/lib/utils/email-token';

describe('email-token', () => {
  const TEST_SECRET = 'test-secret-key-that-is-at-least-32-chars';

  describe('signEmailToken', () => {
    it('creates a valid JWT token', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-123',
        purpose: 'prefs',
      };

      const token = await signEmailToken(payload, TEST_SECRET);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('includes expiration by default (7 days)', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-123',
        purpose: 'prefs',
      };

      const token = await signEmailToken(payload, TEST_SECRET);
      const decoded = await verifyEmailToken(token, TEST_SECRET);

      expect(decoded).not.toBeNull();
      expect(decoded!.exp).toBeDefined();
      // Expiration should be ~7 days from now
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expMs = decoded!.exp! * 1000;
      const diff = expMs - Date.now();
      expect(diff).toBeGreaterThan(sevenDaysMs - 60000); // Within 1 minute
      expect(diff).toBeLessThan(sevenDaysMs + 60000);
    });
  });

  describe('verifyEmailToken', () => {
    it('returns payload for valid token', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-456',
        purpose: 'save_window',
      };

      const token = await signEmailToken(payload, TEST_SECRET);
      const decoded = await verifyEmailToken(token, TEST_SECRET);

      expect(decoded).not.toBeNull();
      expect(decoded!.user_id).toBe('user-456');
      expect(decoded!.purpose).toBe('save_window');
    });

    it('returns null for invalid token', async () => {
      const decoded = await verifyEmailToken('invalid.token.here', TEST_SECRET);
      expect(decoded).toBeNull();
    });

    it('returns null for wrong secret', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-789',
        purpose: 'log_session',
      };

      const token = await signEmailToken(payload, TEST_SECRET);
      const decoded = await verifyEmailToken(token, 'wrong-secret-key-that-is-32-chars');

      expect(decoded).toBeNull();
    });

    it('returns null for expired token', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-expired',
        purpose: 'prefs',
      };

      // Create token with 0 expiration (already expired)
      const token = await signEmailToken(payload, TEST_SECRET, 0);

      // Wait a tiny bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const decoded = await verifyEmailToken(token, TEST_SECRET);
      expect(decoded).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
yarn jest __tests__/lib/utils/email-token.test.ts --no-coverage
```

Expected: FAIL - module not found

**Step 3: Implement the utility**

Create `lib/utils/email-token.ts`:

```typescript
/**
 * Email Token Utility
 *
 * Creates and verifies signed JWT tokens for email actions.
 * These tokens allow users to perform actions (set preferences, save windows)
 * directly from email links without requiring login.
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';

export type EmailTokenPurpose = 'prefs' | 'save_window' | 'log_session';

export interface EmailTokenPayload extends JWTPayload {
  user_id: string;
  purpose: EmailTokenPurpose;
}

const DEFAULT_EXPIRATION_DAYS = 7;

/**
 * Sign a JWT token for email actions
 *
 * @param payload - Token payload with user_id and purpose
 * @param secret - Secret key for signing (from EMAIL_TOKEN_SECRET env var)
 * @param expirationDays - Days until expiration (default 7)
 * @returns Signed JWT token string
 */
export async function signEmailToken(
  payload: EmailTokenPayload,
  secret: string,
  expirationDays: number = DEFAULT_EXPIRATION_DAYS
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const jwt = await new SignJWT({
    user_id: payload.user_id,
    purpose: payload.purpose,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirationDays}d`)
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode an email token
 *
 * @param token - JWT token string from email link
 * @param secret - Secret key for verification
 * @returns Decoded payload or null if invalid/expired
 */
export async function verifyEmailToken(
  token: string,
  secret: string
): Promise<EmailTokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jwtVerify(token, secretKey);

    // Validate required fields
    if (!payload.user_id || !payload.purpose) {
      return null;
    }

    return payload as EmailTokenPayload;
  } catch {
    // Token invalid, expired, or wrong signature
    return null;
  }
}

/**
 * Get the secret from environment variables
 * Throws if not configured
 */
export function getEmailTokenSecret(): string {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (!secret) {
    throw new Error('EMAIL_TOKEN_SECRET environment variable is not set');
  }
  return secret;
}
```

**Step 4: Run tests to verify they pass**

```bash
yarn jest __tests__/lib/utils/email-token.test.ts --no-coverage
```

Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add lib/utils/email-token.ts __tests__/lib/utils/email-token.test.ts
git commit -m "feat: add email token utility for passwordless email actions"
```

---

## Phase 3: Preference Routes

### Task 3.1: Create Prefs Set Route

**Files:**
- Create: `app/prefs/set/route.ts`
- Create: `__tests__/app/prefs/set/route.test.ts`

**Step 1: Write failing tests**

Create `__tests__/app/prefs/set/route.test.ts`:

```typescript
/**
 * Tests for /prefs/set route
 *
 * This route handles 1-tap preference updates from email buttons.
 * It verifies the token and updates the user's preferences.
 */

import { GET } from '@/app/prefs/set/route';
import { NextRequest } from 'next/server';
import { signEmailToken } from '@/lib/utils/email-token';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// Mock environment
const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;

describe('GET /prefs/set', () => {
  it('returns error for missing token', async () => {
    const request = new NextRequest('http://localhost:3000/prefs/set?time=dawn');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Missing token');
  });

  it('returns error for invalid token', async () => {
    const request = new NextRequest(
      'http://localhost:3000/prefs/set?time=dawn&token=invalid'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Invalid or expired');
  });

  it('updates time preference with valid token', async () => {
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/prefs/set?time=dawn&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('updates skill level with valid token', async () => {
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/prefs/set?level=intermediate&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('updates email frequency with valid token', async () => {
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/prefs/set?frequency=only_good&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('rejects invalid preference values', async () => {
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/prefs/set?time=invalid_value&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Invalid');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
yarn jest __tests__/app/prefs/set/route.test.ts --no-coverage
```

Expected: FAIL - module not found

**Step 3: Implement the route**

Create `app/prefs/set/route.ts`:

```typescript
/**
 * GET /prefs/set
 *
 * Handles 1-tap preference updates from email buttons.
 * Query params: token (required), time/level/frequency (one required)
 *
 * Returns an HTML page showing success or error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';
import { createClient } from '@/lib/supabase/server';

// Valid values for each preference
const VALID_TIME_BUCKETS = ['dawn', 'after_work', 'weekends'] as const;
const VALID_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const VALID_FREQUENCIES = ['daily', 'only_good'] as const;

type TimeBucket = typeof VALID_TIME_BUCKETS[number];
type SkillLevel = typeof VALID_SKILL_LEVELS[number];
type Frequency = typeof VALID_FREQUENCIES[number];

function renderPage(title: string, message: string, isError: boolean = false) {
  const bgColor = isError ? '#fef2f2' : '#f0fdf4';
  const textColor = isError ? '#dc2626' : '#16a34a';
  const icon = isError ? '❌' : '✓';

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - Quiver</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: ${bgColor};
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: ${textColor};
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
    }
    p {
      color: #666;
      margin: 0 0 1.5rem;
    }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
    }
    .btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Open Quiver</a>
  </div>
</body>
</html>`,
    {
      status: isError ? 400 : 200,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const time = searchParams.get('time') as TimeBucket | null;
  const level = searchParams.get('level') as SkillLevel | null;
  const frequency = searchParams.get('frequency') as Frequency | null;

  // Validate token is present
  if (!token) {
    return renderPage('Missing Token', 'Missing token parameter. Please use the link from your email.', true);
  }

  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return renderPage('Configuration Error', 'Email system not configured properly.', true);
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload) {
    return renderPage('Invalid Link', 'Invalid or expired link. Please check your most recent email.', true);
  }

  // Validate at least one preference is being set
  if (!time && !level && !frequency) {
    return renderPage('No Preference', 'No preference specified to update.', true);
  }

  // Validate preference values
  if (time && !VALID_TIME_BUCKETS.includes(time)) {
    return renderPage('Invalid Value', `Invalid time value: ${time}`, true);
  }
  if (level && !VALID_SKILL_LEVELS.includes(level)) {
    return renderPage('Invalid Value', `Invalid level value: ${level}`, true);
  }
  if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
    return renderPage('Invalid Value', `Invalid frequency value: ${frequency}`, true);
  }

  // Build update object
  const updates: Record<string, string> = {
    user_id: payload.user_id,
  };

  if (time) updates.pref_time_bucket = time;
  if (level) updates.skill_level = level;
  if (frequency) updates.email_frequency = frequency;

  // Update database
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_email_prefs')
    .upsert(updates, { onConflict: 'user_id' });

  if (error) {
    console.error('Failed to update email prefs:', error);
    return renderPage('Update Failed', 'Failed to save your preference. Please try again.', true);
  }

  // Success message based on what was updated
  let successMessage = 'Your preference has been saved.';
  if (time) {
    const timeLabels: Record<TimeBucket, string> = {
      dawn: 'Dawn patrol',
      after_work: 'After work',
      weekends: 'Weekends',
    };
    successMessage = `Surf time set to "${timeLabels[time]}"`;
  } else if (level) {
    successMessage = `Skill level set to "${level}"`;
  } else if (frequency) {
    const freqLabels: Record<Frequency, string> = {
      daily: 'Daily (even if flat)',
      only_good: 'Only when it\'s good',
    };
    successMessage = `Email frequency set to "${freqLabels[frequency]}"`;
  }

  return renderPage('Saved', successMessage);
}
```

**Step 4: Run tests to verify they pass**

```bash
yarn jest __tests__/app/prefs/set/route.test.ts --no-coverage
```

Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add app/prefs/set/route.ts __tests__/app/prefs/set/route.test.ts
git commit -m "feat: add /prefs/set route for email preference updates"
```

---

### Task 3.2: Create Home Beach Picker Page

**Files:**
- Create: `app/prefs/home-beach/page.tsx`
- Create: `app/prefs/home-beach/actions.ts`

**Step 1: Create the server action**

Create `app/prefs/home-beach/actions.ts`:

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';
import { revalidatePath } from 'next/cache';

export interface SaveHomeBeachResult {
  success: boolean;
  error?: string;
}

export async function saveHomeBeach(
  token: string,
  beachId: string
): Promise<SaveHomeBeachResult> {
  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return { success: false, error: 'Email system not configured' };
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload) {
    return { success: false, error: 'Invalid or expired link' };
  }

  // Update database
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_email_prefs')
    .upsert(
      {
        user_id: payload.user_id,
        home_beach_id: beachId,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Failed to save home beach:', error);
    return { success: false, error: 'Failed to save. Please try again.' };
  }

  revalidatePath('/prefs/home-beach');
  return { success: true };
}

export async function searchBeaches(query: string, limit: number = 10) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('beaches')
    .select('id, name, city, state_province, country')
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (error) {
    console.error('Beach search error:', error);
    return [];
  }

  return data || [];
}

export async function getNearbyBeaches(lat: number, lon: number, limit: number = 5) {
  const supabase = await createClient();

  // Use PostGIS to find nearby beaches
  const { data, error } = await supabase.rpc('get_nearby_beaches', {
    user_lat: lat,
    user_lon: lon,
    limit_count: limit,
  });

  if (error) {
    console.error('Nearby beaches error:', error);
    // Fall back to popular San Diego beaches
    const { data: fallback } = await supabase
      .from('beaches')
      .select('id, name, city, state_province, country')
      .in('name', ['La Jolla Shores', 'Scripps', 'Blacks Beach', 'Pacific Beach', 'Ocean Beach'])
      .limit(limit);
    return fallback || [];
  }

  return data || [];
}
```

**Step 2: Create the page component**

Create `app/prefs/home-beach/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { saveHomeBeach, searchBeaches, getNearbyBeaches } from './actions';

interface Beach {
  id: string;
  name: string;
  city: string;
  state_province: string;
  country: string;
}

export default function HomeBeachPicker() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Beach[]>([]);
  const [nearbyBeaches, setNearbyBeaches] = useState<Beach[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load nearby beaches on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const beaches = await getNearbyBeaches(
            position.coords.latitude,
            position.coords.longitude
          );
          setNearbyBeaches(beaches);
        },
        async () => {
          // Geolocation denied, show popular defaults
          const beaches = await getNearbyBeaches(32.7157, -117.1611); // San Diego
          setNearbyBeaches(beaches);
        }
      );
    } else {
      // Load popular defaults
      getNearbyBeaches(32.7157, -117.1611).then(setNearbyBeaches);
    }
  }, []);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const beaches = await searchBeaches(q);
    setResults(beaches);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = async (beach: Beach) => {
    if (!token) {
      setError('Missing token. Please use the link from your email.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await saveHomeBeach(token, beach.id);

    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error || 'Failed to save');
    }

    setIsSaving(false);
  };

  // No token error
  if (!token) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-red-600 mb-2">Missing Token</h1>
          <p className="text-gray-600">Please use the link from your email.</p>
        </div>
      </div>
    );
  }

  // Success state
  if (saved) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-semibold text-green-600 mb-2">Done!</h1>
          <p className="text-gray-600 mb-6">Your home beach has been saved.</p>
          <a
            href="/"
            className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Open Quiver
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-8">
          Pick your home break
        </h1>
        <p className="text-gray-600 mb-6">
          We&apos;ll prioritize this beach in your daily emails.
        </p>

        {/* Search input */}
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search beaches..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {isSearching && (
            <div className="absolute right-3 top-3 text-gray-400">
              Searching...
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Search results */}
        {results.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Search Results
            </h2>
            <ul className="bg-white rounded-lg shadow divide-y">
              {results.map((beach) => (
                <li key={beach.id}>
                  <button
                    onClick={() => handleSelect(beach)}
                    disabled={isSaving}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <div className="font-medium">{beach.name}</div>
                    <div className="text-sm text-gray-500">
                      {beach.city}, {beach.state_province}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nearby suggestions */}
        {nearbyBeaches.length > 0 && query.length < 2 && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Nearby Suggestions
            </h2>
            <ul className="bg-white rounded-lg shadow divide-y">
              {nearbyBeaches.map((beach) => (
                <li key={beach.id}>
                  <button
                    onClick={() => handleSelect(beach)}
                    disabled={isSaving}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <div className="font-medium">{beach.name}</div>
                    <div className="text-sm text-gray-500">
                      {beach.city}, {beach.state_province}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/prefs/home-beach/
git commit -m "feat: add home beach picker page for email preferences"
```

---

### Task 3.3: Create Save Window Route

**Files:**
- Create: `app/window/save/route.ts`
- Create: `__tests__/app/window/save/route.test.ts`

**Step 1: Write failing tests**

Create `__tests__/app/window/save/route.test.ts`:

```typescript
import { GET } from '@/app/window/save/route';
import { NextRequest } from 'next/server';
import { signEmailToken } from '@/lib/utils/email-token';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;

describe('GET /window/save', () => {
  it('returns error for missing token', async () => {
    const request = new NextRequest(
      'http://localhost:3000/window/save?beach_id=123&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Missing');
  });

  it('returns error for missing beach_id', async () => {
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'save_window' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Missing');
  });

  it('saves window with valid params', async () => {
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'save_window' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&beach_id=beach-456&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
yarn jest __tests__/app/window/save/route.test.ts --no-coverage
```

Expected: FAIL - module not found

**Step 3: Implement the route**

Create `app/window/save/route.ts`:

```typescript
/**
 * GET /window/save
 *
 * 1-tap window saving from email links.
 * Query params: token, beach_id, start, end
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';
import { createClient } from '@/lib/supabase/server';

function renderPage(title: string, message: string, isError: boolean = false) {
  const bgColor = isError ? '#fef2f2' : '#f0fdf4';
  const textColor = isError ? '#dc2626' : '#16a34a';
  const icon = isError ? '❌' : '✓';

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - Quiver</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: ${bgColor};
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: ${textColor}; margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { color: #666; margin: 0 0 1.5rem; }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Open Quiver</a>
  </div>
</body>
</html>`,
    {
      status: isError ? 400 : 200,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const beachId = searchParams.get('beach_id');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  // Validate required params
  if (!token || !beachId || !start || !end) {
    return renderPage(
      'Missing Info',
      'Missing required parameters. Please use the link from your email.',
      true
    );
  }

  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return renderPage('Configuration Error', 'Email system not configured.', true);
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload) {
    return renderPage('Invalid Link', 'Invalid or expired link.', true);
  }

  // Parse dates
  const startTs = new Date(start);
  const endTs = new Date(end);

  if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
    return renderPage('Invalid Dates', 'Invalid date format in link.', true);
  }

  // Save to database
  const supabase = await createClient();
  const { error } = await supabase.from('saved_windows').insert({
    user_id: payload.user_id,
    beach_id: beachId,
    start_ts: startTs.toISOString(),
    end_ts: endTs.toISOString(),
    source: 'email',
  });

  if (error) {
    // Duplicate is OK - just show success
    if (error.code === '23505') {
      return renderPage('Saved', 'This window is already saved.');
    }
    console.error('Failed to save window:', error);
    return renderPage('Save Failed', 'Failed to save window. Please try again.', true);
  }

  return renderPage('Saved', "We'll remind you before this window starts.");
}
```

**Step 4: Run tests**

```bash
yarn jest __tests__/app/window/save/route.test.ts --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/window/save/route.ts __tests__/app/window/save/route.test.ts
git commit -m "feat: add /window/save route for 1-tap window saving"
```

---

### Task 3.4: Create Session Log Route

**Files:**
- Create: `app/session/log/page.tsx`
- Create: `app/session/log/actions.ts`

**Step 1: Create server action**

Create `app/session/log/actions.ts`:

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';

export interface LogSessionResult {
  success: boolean;
  error?: string;
}

export async function logSession(
  token: string,
  beachId: string,
  windowStart: string,
  rating: 'skip' | 'good' | 'fired',
  notes?: string,
  predictedScore?: number
): Promise<LogSessionResult> {
  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return { success: false, error: 'Email system not configured' };
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload) {
    return { success: false, error: 'Invalid or expired link' };
  }

  // Save to database
  const supabase = await createClient();
  const { error } = await supabase.from('session_logs').insert({
    user_id: payload.user_id,
    beach_id: beachId,
    window_start: windowStart,
    rating,
    notes: notes || null,
    predicted_score: predictedScore || null,
    source: 'email',
  });

  if (error) {
    console.error('Failed to log session:', error);
    return { success: false, error: 'Failed to save. Please try again.' };
  }

  return { success: true };
}
```

**Step 2: Create the page component**

Create `app/session/log/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { logSession } from './actions';

type Rating = 'skip' | 'good' | 'fired';

const RATING_OPTIONS: { value: Rating; label: string; emoji: string }[] = [
  { value: 'skip', label: 'Skipped it', emoji: '👎' },
  { value: 'good', label: 'Good sesh', emoji: '👍' },
  { value: 'fired', label: 'Fired!', emoji: '🔥' },
];

export default function SessionLogPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const beachId = searchParams.get('beach_id');
  const windowStart = searchParams.get('window_start');
  const beachName = searchParams.get('beach_name') || 'your session';
  const score = searchParams.get('score');

  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  if (!token || !beachId || !windowStart) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-red-600 mb-2">Missing Info</h1>
          <p className="text-gray-600">Please use the link from your email.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedRating) return;

    setIsSaving(true);
    setError(null);

    const result = await logSession(
      token,
      beachId,
      windowStart,
      selectedRating,
      notes || undefined,
      score ? parseFloat(score) : undefined
    );

    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error || 'Failed to save');
    }

    setIsSaving(false);
  };

  // Success state
  if (saved) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-semibold text-green-600 mb-2">Logged!</h1>
          <p className="text-gray-600 mb-6">
            Thanks for the feedback. This helps us get smarter.
          </p>
          <a
            href="/"
            className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Open Quiver
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-8">
          How was it?
        </h1>
        <p className="text-gray-600 mb-6">
          {beachName}
        </p>

        {/* Rating buttons */}
        <div className="flex gap-3 mb-6">
          {RATING_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedRating(option.value)}
              className={`flex-1 py-4 px-2 rounded-lg border-2 transition-all ${
                selectedRating === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-1">{option.emoji}</div>
              <div className="text-sm font-medium text-gray-700">
                {option.label}
              </div>
            </button>
          ))}
        </div>

        {/* Notes (optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How were the waves? Crowd? Conditions?"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selectedRating || isSaving}
          className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/session/log/
git commit -m "feat: add session logging page for surf feedback"
```

---

## Phase 4: Email Templates & Sending

### Task 4.1: Create Resend Client

**Files:**
- Create: `lib/email/resend-client.ts`
- Create: `__tests__/lib/email/resend-client.test.ts`

**Step 1: Write failing tests**

Create `__tests__/lib/email/resend-client.test.ts`:

```typescript
import { getResendClient, sendEmail } from '@/lib/email/resend-client';

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    },
  })),
}));

process.env.RESEND_API_KEY = 'test-api-key';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

describe('resend-client', () => {
  describe('getResendClient', () => {
    it('creates a Resend client', () => {
      const client = getResendClient();
      expect(client).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    it('sends an email successfully', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('email-123');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
yarn jest __tests__/lib/email/resend-client.test.ts --no-coverage
```

**Step 3: Implement the client**

Create `lib/email/resend-client.ts`:

```typescript
/**
 * Resend Email Client
 *
 * Wrapper around Resend SDK for sending emails.
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getFromAddress(): string {
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!from) {
    throw new Error('EMAIL_FROM_ADDRESS environment variable is not set');
  }
  return from;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const client = getResendClient();
    const from = getFromAddress();

    const { data, error } = await client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}
```

**Step 4: Run tests**

```bash
yarn jest __tests__/lib/email/resend-client.test.ts --no-coverage
```

**Step 5: Commit**

```bash
git add lib/email/resend-client.ts __tests__/lib/email/resend-client.test.ts
git commit -m "feat: add Resend email client wrapper"
```

---

### Task 4.2: Create Welcome Email Template

**Files:**
- Create: `lib/email/templates/welcome-email.ts`

**Step 1: Create the template**

Create `lib/email/templates/welcome-email.ts`:

```typescript
/**
 * Welcome Email Template
 *
 * Sent immediately after signup. Captures user preferences via email buttons.
 */

import { signEmailToken } from '@/lib/utils/email-token';

export interface WelcomeEmailProps {
  userId: string;
  userEmail: string;
  baseUrl: string;
}

export async function generateWelcomeEmail(
  props: WelcomeEmailProps,
  secret: string
): Promise<{ subject: string; html: string; text: string }> {
  const { userId, baseUrl } = props;

  // Generate token for preference links (7 day expiry)
  const token = await signEmailToken({ user_id: userId, purpose: 'prefs' }, secret);

  const timeButtons = [
    { label: 'Dawn patrol', value: 'dawn' },
    { label: 'After work', value: 'after_work' },
    { label: 'Weekends', value: 'weekends' },
  ];

  const levelButtons = [
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' },
  ];

  const frequencyButtons = [
    { label: 'Daily (even if flat)', value: 'daily' },
    { label: 'Only when it\'s good', value: 'only_good' },
  ];

  const buttonStyle = `
    display: inline-block;
    padding: 12px 20px;
    margin: 4px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
  `;

  const subject = 'Welcome to Quiver — set your surf defaults (10 seconds)';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: #1e40af; font-size: 24px; margin-bottom: 8px;">🌊 Welcome to Quiver</h1>

  <p style="font-size: 18px; color: #666; margin-bottom: 24px;">
    Quiver emails you one thing: the best yes/no surf call.
  </p>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">When do you usually surf?</h2>
    ${timeButtons.map(b => `
      <a href="${baseUrl}/prefs/set?time=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>
    `).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">What's your level?</h2>
    ${levelButtons.map(b => `
      <a href="${baseUrl}/prefs/set?level=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>
    `).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">How often should we email?</h2>
    ${frequencyButtons.map(b => `
      <a href="${baseUrl}/prefs/set?frequency=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>
    `).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">Home break?</h2>
    <a href="${baseUrl}/prefs/home-beach?token=${token}" style="${buttonStyle}">Set home beach →</a>
  </div>

  <p style="color: #999; font-size: 14px; margin-top: 32px;">
    Or just reply with your home break name.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();

  const text = `
Welcome to Quiver

Quiver emails you one thing: the best yes/no surf call.

Set your preferences:
- Time: ${baseUrl}/prefs/set?time=dawn&token=${token}
- Level: ${baseUrl}/prefs/set?level=intermediate&token=${token}
- Frequency: ${baseUrl}/prefs/set?frequency=daily&token=${token}
- Home beach: ${baseUrl}/prefs/home-beach?token=${token}

Or just reply with your home break name.
  `.trim();

  return { subject, html, text };
}
```

**Step 2: Commit**

```bash
git add lib/email/templates/welcome-email.ts
git commit -m "feat: add welcome email template with preference buttons"
```

---

### Task 4.3: Create Daily Email Template

**Files:**
- Create: `lib/email/templates/daily-best-window-email.ts`

**Step 1: Create the template**

Create `lib/email/templates/daily-best-window-email.ts`:

```typescript
/**
 * Daily "Best Window" Email Template
 *
 * Sent each morning with the day's surf call.
 */

import { signEmailToken } from '@/lib/utils/email-token';

export interface BeachWindow {
  beachId: string;
  beachName: string;
  score: number;
  startTime: string; // "6:30"
  endTime: string;   // "8:00"
  isHomeBeach?: boolean;
}

export interface DailyEmailProps {
  userId: string;
  userEmail: string;
  baseUrl: string;
  isWorthIt: boolean;
  decision: 'YES' | 'NO';
  decisionReason: string;  // "worth it if you can go by 6:30"
  chips: string[];         // ["Offshore", "Tide rising", "Medium period"]
  bestWindow: BeachWindow;
  backups: BeachWindow[];
  nextGoodDate?: string;   // "Thu Jan 22" - only for NO days
}

export async function generateDailyEmail(
  props: DailyEmailProps,
  secret: string
): Promise<{ subject: string; html: string; text: string }> {
  const { userId, baseUrl, isWorthIt, decision, decisionReason, chips, bestWindow, backups, nextGoodDate } = props;

  // Generate token for save window link
  const token = await signEmailToken({ user_id: userId, purpose: 'save_window' }, secret);

  // Build subject
  const subject = isWorthIt
    ? `⚡ Today: ${bestWindow.score.toFixed(1)}/10 at ${bestWindow.beachName} (${bestWindow.startTime}–${bestWindow.endTime})`
    : `🌊 Not worth it today — next window ${nextGoodDate}`;

  // Build save window URL
  const saveWindowUrl = `${baseUrl}/window/save?token=${token}&beach_id=${bestWindow.beachId}&start=${encodeURIComponent(bestWindow.startTime)}&end=${encodeURIComponent(bestWindow.endTime)}`;

  const chipStyle = `
    display: inline-block;
    padding: 6px 12px;
    margin: 2px;
    background: #e0f2fe;
    color: #0369a1;
    border-radius: 16px;
    font-size: 13px;
  `;

  const buttonStyle = `
    display: inline-block;
    padding: 12px 24px;
    margin: 8px 4px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
  `;

  const decisionColor = isWorthIt ? '#16a34a' : '#dc2626';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">

  <div style="text-align: center; margin-bottom: 24px;">
    <div style="font-size: 48px; font-weight: bold; color: ${decisionColor};">
      ${decision}
    </div>
    <div style="font-size: 18px; color: #666;">
      ${decisionReason}
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    ${chips.map(chip => `<span style="${chipStyle}">${chip}</span>`).join('')}
  </div>

  ${isWorthIt ? `
    <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
      <div style="font-weight: 600; font-size: 16px;">
        ${bestWindow.beachName} — ${bestWindow.score.toFixed(1)}/10 (${bestWindow.startTime}–${bestWindow.endTime})
        ${bestWindow.isHomeBeach ? '<span style="color: #3b82f6;"> ← your home break</span>' : ''}
      </div>
    </div>

    ${backups.length > 0 ? `
      <div style="color: #666; font-size: 14px; margin-bottom: 24px;">
        <strong>Backups:</strong><br>
        ${backups.map(b => `${b.beachName} — ${b.score.toFixed(1)}/10 (${b.startTime}–${b.endTime})`).join('<br>')}
      </div>
    ` : ''}

    <div style="text-align: center;">
      <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
      <a href="${saveWindowUrl}" style="${buttonStyle}">Save this window</a>
    </div>
  ` : `
    <div style="text-align: center; margin-bottom: 24px; color: #666;">
      Next good window: <strong>${nextGoodDate}</strong>
    </div>

    <div style="text-align: center;">
      <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
    </div>
  `}

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();

  const text = `
${decision} — ${decisionReason}

${chips.join(' · ')}

${isWorthIt ? `
Best: ${bestWindow.beachName} — ${bestWindow.score.toFixed(1)}/10 (${bestWindow.startTime}–${bestWindow.endTime})
${backups.map(b => `${b.beachName} — ${b.score.toFixed(1)}/10 (${b.startTime}–${b.endTime})`).join('\n')}

Open Quiver: ${baseUrl}
Save window: ${saveWindowUrl}
` : `
Next good window: ${nextGoodDate}

Open Quiver: ${baseUrl}
`}
  `.trim();

  return { subject, html, text };
}
```

**Step 2: Commit**

```bash
git add lib/email/templates/daily-best-window-email.ts
git commit -m "feat: add daily best window email template"
```

---

### Task 4.4: Create Heads-Up Alert Template

**Files:**
- Create: `lib/email/templates/heads-up-alert-email.ts`

**Step 1: Create the template**

Create `lib/email/templates/heads-up-alert-email.ts`:

```typescript
/**
 * Heads-Up Alert Email Template
 *
 * Sent 2-3 hours before a good window starts.
 */

import { signEmailToken } from '@/lib/utils/email-token';

export interface HeadsUpEmailProps {
  userId: string;
  userEmail: string;
  baseUrl: string;
  beachId: string;
  beachName: string;
  score: number;
  startTime: string;
  endTime: string;
  hoursUntil: number;
  conditionNote: string; // "Light winds holding, tide about to turn."
}

export async function generateHeadsUpEmail(
  props: HeadsUpEmailProps,
  secret: string
): Promise<{ subject: string; html: string; text: string }> {
  const { userId, baseUrl, beachId, beachName, score, startTime, endTime, hoursUntil, conditionNote } = props;

  // Generate token for log session link
  const token = await signEmailToken({ user_id: userId, purpose: 'log_session' }, secret);

  const subject = `⏰ Surf in ~${hoursUntil} hours: ${score.toFixed(1)}/10 at ${beachName} (${startTime}–${endTime})`;

  const logSessionUrl = `${baseUrl}/session/log?token=${token}&beach_id=${beachId}&window_start=${encodeURIComponent(startTime)}&beach_name=${encodeURIComponent(beachName)}&score=${score}`;

  const buttonStyle = `
    display: inline-block;
    padding: 12px 24px;
    margin: 8px 4px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">

  <div style="text-align: center; margin-bottom: 16px;">
    <div style="font-size: 48px;">⏰</div>
  </div>

  <h1 style="text-align: center; font-size: 24px; color: #1e40af; margin-bottom: 8px;">
    ${beachName}
  </h1>

  <div style="text-align: center; font-size: 32px; font-weight: bold; color: #16a34a; margin-bottom: 8px;">
    ${score.toFixed(1)}/10
  </div>

  <div style="text-align: center; font-size: 16px; color: #666; margin-bottom: 24px;">
    ${startTime}–${endTime}
  </div>

  <p style="text-align: center; color: #666; margin-bottom: 24px;">
    ${conditionNote}
  </p>

  <div style="text-align: center;">
    <a href="${baseUrl}" style="${buttonStyle}">Open in Quiver</a>
    <a href="${logSessionUrl}" style="${buttonStyle}">Log this session</a>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();

  const text = `
Surf in ~${hoursUntil} hours!

${beachName} — ${score.toFixed(1)}/10 (${startTime}–${endTime})

${conditionNote}

Open Quiver: ${baseUrl}
Log session: ${logSessionUrl}
  `.trim();

  return { subject, html, text };
}
```

**Step 2: Commit**

```bash
git add lib/email/templates/heads-up-alert-email.ts
git commit -m "feat: add heads-up alert email template"
```

---

## Phase 5: Welcome Email Trigger

### Task 5.1: Trigger Welcome Email on Signup

**Files:**
- Modify: Find the signup flow and add welcome email trigger

**Note:** This depends on your existing auth setup. The implementation will hook into wherever user signup completes. Common patterns:

**Option A: Supabase Auth Hook (Edge Function)**
Create `supabase/functions/on-auth-user-created/index.ts`

**Option B: Next.js API Route callback**
Modify the auth callback to send welcome email

**Option C: Database Trigger**
Create a trigger on `auth.users` insert

For this plan, we'll use Option A (recommended for Supabase):

**Step 1: Create the Edge Function**

Create `supabase/functions/on-auth-user-created/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_TOKEN_SECRET = Deno.env.get('EMAIL_TOKEN_SECRET')!;
const EMAIL_FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://quiver.surf';

// Simple JWT signing for Deno
async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
  const body = btoa(JSON.stringify({ ...payload, exp }));

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${body}`)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${header}.${body}.${sig}`;
}

serve(async (req) => {
  const { record } = await req.json();

  if (!record?.email || !record?.id) {
    return new Response('Missing user data', { status: 400 });
  }

  const userId = record.id;
  const userEmail = record.email;

  // Generate token
  const token = await signToken({ user_id: userId, purpose: 'prefs' }, EMAIL_TOKEN_SECRET);

  // Build email HTML (simplified version)
  const timeButtons = ['dawn', 'after_work', 'weekends'];
  const levelButtons = ['beginner', 'intermediate', 'advanced'];
  const frequencyButtons = ['daily', 'only_good'];

  const html = `
    <h1>Welcome to Quiver</h1>
    <p>Quiver emails you one thing: the best yes/no surf call.</p>
    <h2>When do you usually surf?</h2>
    ${timeButtons.map(t => `<a href="${APP_URL}/prefs/set?time=${t}&token=${token}">${t}</a>`).join(' ')}
    <h2>What's your level?</h2>
    ${levelButtons.map(l => `<a href="${APP_URL}/prefs/set?level=${l}&token=${token}">${l}</a>`).join(' ')}
    <h2>How often should we email?</h2>
    ${frequencyButtons.map(f => `<a href="${APP_URL}/prefs/set?frequency=${f}&token=${token}">${f}</a>`).join(' ')}
    <h2>Home break?</h2>
    <a href="${APP_URL}/prefs/home-beach?token=${token}">Set home beach</a>
  `;

  // Send via Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM_ADDRESS,
      to: userEmail,
      subject: 'Welcome to Quiver — set your surf defaults (10 seconds)',
      html,
    }),
  });

  if (!res.ok) {
    console.error('Failed to send welcome email:', await res.text());
    return new Response('Email send failed', { status: 500 });
  }

  // Log the send
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  await supabase.from('email_send_log').insert({
    user_id: userId,
    email_type: 'welcome',
    local_date: new Date().toISOString().split('T')[0],
    subject: 'Welcome to Quiver — set your surf defaults (10 seconds)',
  });

  return new Response('OK', { status: 200 });
});
```

**Step 2: Configure the webhook in Supabase Dashboard**

Go to Database → Webhooks → Create new webhook:
- Name: `on-auth-user-created`
- Table: `auth.users`
- Events: `INSERT`
- URL: Your Edge Function URL

**Step 3: Commit**

```bash
git add supabase/functions/on-auth-user-created/
git commit -m "feat: add welcome email Edge Function trigger"
```

---

## Phase 6: Future Tasks (Outline)

The remaining tasks follow the same TDD pattern. Here's the outline:

### Task 6.1: Daily Email Edge Function
- Create `supabase/functions/daily-best-window/index.ts`
- Query eligible users by timezone
- Compute best windows
- Send emails
- Log sends

### Task 6.2: Heads-Up Alert Edge Function
- Create `supabase/functions/heads-up-alert/index.ts`
- Find windows starting in 2-3 hours
- Check frequency cap
- Send alerts
- Log sends

### Task 6.3: pg_cron Setup
- Create migration for pg_cron schedules
- Schedule daily email function (every 15 min)
- Schedule heads-up function (every 15 min)

### Task 6.4: Skill-Level Personalization
- Modify window scoring to adjust by skill level
- Add beginner-friendly beach tags
- Update daily email to use personalized thresholds

### Task 6.5: Metrics & Monitoring
- Add email open tracking
- Add click tracking
- Dashboard for email performance

---

## Summary

This plan covers the core email loop implementation in 5 phases:

1. **Infrastructure** — Dependencies, env vars, 4 database tables
2. **Token Utility** — JWT sign/verify for passwordless email actions
3. **Preference Routes** — /prefs/set, /prefs/home-beach, /window/save, /session/log
4. **Email Templates** — Welcome, Daily, Heads-Up (HTML + plain text)
5. **Welcome Trigger** — Edge Function on user signup

Each task follows TDD: write failing tests → implement → verify → commit.

Total estimated tasks: ~15 atomic commits
