# Quiver — Claude Code Master Guide

**Last Updated:** November 2025
**Version:** 2.0

---

## 🎯 Mission & Context

**Quiver** is a community-driven surf tracking platform that combines session logging, multi-source forecasting, and social features. Our **growth-first strategy** prioritizes viral mechanics and user engagement over monetization.

### Key Stats
- **Users:** 400+ active surfers (up from 178)
- **Tech Stack:** Next.js 14, TypeScript, Supabase, Capacitor 7
- **Test Coverage:** 95%+ (660+ tests across unit/integration/E2E)
- **Performance:** <150ms API p50, 90+ Lighthouse score

### Growth Priorities (ALWAYS PRIORITIZE)
1. **Personalization** — Learn from user behavior, recommend perfect spots (see [docs/PERSONALIZATION_STRATEGY.md](/docs/PERSONALIZATION_STRATEGY.md))
2. **Social Sharing** — Session summaries, viral content
3. **Session Photos** — Upload, display, social integration
4. **Viral Mechanics** — Referrals, challenges, leaderboards
5. **Community Features** — Crews, buddies, collaborative planning
6. **Forecast Transparency** — Show data sources, confidence indicators

**❌ DO NOT:** Add monetization features without explicit approval

---

## 🚀 Quick Start Workflow

### Standard Development Flow
Tests-first is non-negotiable: capture the behavior in failing unit tests before adding implementation, and only close work after those tests pass green.
```bash
# 1. Read Architecture First
# Always start by reading relevant ARCHITECTURE.md files

# 2. Author Failing Unit Tests
yarn test --watch           # Define expected behavior with unit tests before coding

# 3. Start Development
yarn dev                    # http://localhost:3000

# 4. Validation Loop
yarn test                   # Re-run the suite you authored; everything must pass
yarn typecheck              # TypeScript validation
npx playwright test         # E2E tests
yarn build                  # Production build check

# 5. Database Operations
supabase start              # Local Supabase
supabase db reset           # Reset with migrations
supabase db push            # Push to remote
```

### MCP Server Setup (REQUIRED)

**Playwright MCP** — Browser automation, testing, screenshots
```bash
claude mcp add playwright 'npx @playwright/mcp@latest'
```

**Supabase MCP** — Database operations, queries, migrations
```bash
claude mcp add supabase '@modelcontextprotocol/server-supabase'
```

**Rapid7 MCP** — Security logs, intrusion detection
```bash
# Requires RAPID7_API_KEY in .env
claude mcp add rapid7 'npx @rapid7/mcp-server'
```

### Permissions Configuration
Use `/permissions` in Claude Code to **Always Allow**:
- `mcp__playwright__*` (all Playwright tools)
- `mcp__supabase__*` (all Supabase tools)
- `Bash(npm run dev)`, `Bash(yarn test)`, `Bash(npx playwright test)`

---

## 📐 Core Architectural Patterns (NEVER DEVIATE)

### 1. Data Fetching (REQUIRED)
Always use `useDataFetcher` with memoized `useCallback`:

```tsx
import { useCallback } from 'react';
import { useDataFetcher } from '@/hooks/use-data-fetcher';

const fetchData = useCallback(async () => {
  return await myAction();
}, [dependencies]);

const { data, loading, error, refetch } = useDataFetcher(fetchData);
```

**❌ DON'T:** Inline async logic, manage ad-hoc loading flags, or invent custom patterns

### 2. Server Actions (REQUIRED)
Always use `withAuthenticatedAction` wrapper:

```ts
import { withAuthenticatedAction } from '@/lib/server-action-utils';

export async function doProtectedThing(arg: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw new Error(error.message);
    return data;
  });
}
```

**❌ DON'T:** Skip authentication wrappers or handle auth manually

### 3. API Routes (REQUIRED)
Always use centralized API utilities:

```ts
import { createSuccessResponse, handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const result = await processRequest();
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

**❌ DON'T:** Create custom response formatters or error handlers

### 4. Realtime Subscriptions (REQUIRED)
Create Supabase channels with proper cleanup:

```tsx
useEffect(() => {
  const channel = supabase
    .channel('changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions' },
      handleChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [supabase]);
```

**❌ DON'T:** Forget cleanup or create subscriptions outside useEffect

### 5. Component DRY Patterns (REQUIRED)
Reuse existing components from `components/ui/*`:

```tsx
// ✅ DO: Use existing form components
import { FormLayout, FormField } from '@/components/ui/form-layout';

// ❌ DON'T: Create one-off form implementations
```

---

## 🤖 Specialized Agents

When tasks match specific domains, use these agents via the Task tool:

| Agent | Use When | Example |
|-------|----------|---------|
| **fullstack-engineer** | End-to-end features, growth features | Social sharing, session photos, leaderboards |
| **supabase-db-expert** | Database schema, RLS policies, migrations | Adding tables, optimizing queries |
| **qa-expert** | Test strategy, quality analysis | Test planning, coverage gaps |
| **test-automator** | Building test infrastructure | E2E test frameworks, test automation |
| **nextjs-developer** | Next.js optimization, App Router | Performance tuning, caching strategies |
| **backend-developer** | API design, server-side logic | New endpoints, data processing |
| **frontend-developer** | UI components, interactions | Component libraries, accessibility |
| **architect-reviewer** | System design validation | Architecture reviews, scalability |

**See:** [.claude/agents/](/.claude/agents/) for detailed agent prompts

---

## 📚 Essential Documentation

### Architecture Reference (READ FIRST)
1. **[ARCHITECTURE.md](/ARCHITECTURE.md)** — Root architecture overview
2. **[docs/ARCHITECTURE_REVIEW.md](/docs/ARCHITECTURE_REVIEW.md)** — System-wide review
3. **[docs/DESIGN_PRINCIPLES.md](/docs/DESIGN_PRINCIPLES.md)** — Design philosophy

### Directory Architecture Files
- **[app/ARCHITECTURE.md](/app/ARCHITECTURE.md)** — App Router, API routes
- **[components/ARCHITECTURE.md](/components/ARCHITECTURE.md)** — Component patterns
- **[hooks/ARCHITECTURE.md](/hooks/ARCHITECTURE.md)** — Hook patterns
- **[lib/ARCHITECTURE.md](/lib/ARCHITECTURE.md)** — Utilities, services
- **[supabase/ARCHITECTURE.md](/supabase/ARCHITECTURE.md)** — Database, RLS
- **[e2e/ARCHITECTURE.md](/e2e/ARCHITECTURE.md)** — E2E testing patterns

### Setup & Troubleshooting
- **[docs/SETUP.md](/docs/SETUP.md)** — Environment setup
- **[docs/SUPABASE_SETUP.md](/docs/SUPABASE_SETUP.md)** — Which Supabase client to use
- **[docs/TROUBLESHOOTING.md](/docs/TROUBLESHOOTING.md)** — Common issues

---

## 🧪 Testing Requirements

### Critical Testing Rules

**❌ NEVER expect 500 errors** — They indicate bugs, not proper error handling
```ts
// ❌ DON'T
expect(response.status).toBe(500);

// ✅ DO: Use appropriate status codes
expect(response.status).toBe(400); // Bad Request
expect(response.status).toBe(401); // Unauthorized
expect(response.status).toBe(403); // Forbidden
expect(response.status).toBe(404); // Not Found
```

**❌ NEVER use `test.skip()`** — Fix tests instead of hiding them
```ts
// ❌ DON'T
test.skip('broken test', () => { ... });

// ✅ DO: Fix the test or throw informative errors
test('should work', () => {
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN not set. Run auth setup first.');
  }
  // ... test logic
});
```

### Test Commands
```bash
# Unit Tests
yarn test                           # All unit tests
yarn test --watch                   # Watch mode
yarn test session                   # Tests matching "session"

# E2E Tests
npx playwright test                 # All E2E tests
npx playwright test --headed        # With browser UI
npx playwright test --grep auth     # Tests matching "auth"
npx playwright test e2e/home.spec.ts # Specific file
```

### Testing Patterns
- **Unit:** Utils, hooks, services
- **Integration:** Server actions, API routes
- **Component:** UI components with user interactions
- **E2E:** Critical user flows (auth, session creation, social features)

**See:** [TEST_ARCHITECTURE.md](/TEST_ARCHITECTURE.md), [e2e/ARCHITECTURE.md](/e2e/ARCHITECTURE.md)

---

## 🗄️ Database Safety (CRITICAL)

### Migration Safety Rules

**❌ NEVER in migrations without safeguards:**
- `DELETE FROM auth.users` without WHERE clause
- `DELETE FROM profiles` based on name matching
- `TRUNCATE` on user tables
- `DROP TABLE` for core user tables

**✅ REQUIRED for all migrations:**
1. Test locally first: `supabase db reset`
2. Wrap in transactions: `BEGIN;` ... `COMMIT;`
3. Add existence checks: `WHERE NOT EXISTS`
4. Create rollback migrations
5. Never delete by user-provided strings

### Production Execution Protocol

**Connection/Role:** Use `claude_migrator` role ONLY in production

**Two-Step Approval Protocol:**
1. **PLAN** — Output:
   - Exact SQL
   - Target role (`claude_migrator`)
   - Tables affected
   - Backup artifact name

2. **APPROVAL** — Wait for maintainer reply: `APPROVE: <sha>`

**No approval = No changes**

### Before Running Migrations
```bash
# 1. Create backup
./backup_script.sh

# 2. Test locally
supabase db reset

# 3. Push to production (after approval)
supabase db push
```

**Backup Schedule:**
- Daily automated backups (GitHub Actions)
- Manual backups before major changes
- 30-day backup retention

---

## 🎨 Code Style & Standards

### TypeScript First
```ts
// ✅ DO: Explicit types for public APIs
export function processSession(
  sessionId: string,
  options: ProcessOptions
): Promise<Session> {
  // ...
}

// ❌ DON'T: Implicit any or loose types
export function processSession(sessionId, options) {
  // ...
}
```

### Early Returns
```ts
// ✅ DO: Guard clauses first
export async function getSession(id: string) {
  if (!id) throw new Error('Session ID required');
  if (!user) throw new Error('User not authenticated');

  const session = await fetchSession(id);
  if (!session) throw new Error('Session not found');

  return session;
}

// ❌ DON'T: Nested conditions
export async function getSession(id: string) {
  if (id) {
    if (user) {
      const session = await fetchSession(id);
      if (session) {
        return session;
      }
    }
  }
}
```

### Minimal Comments
```ts
// ✅ DO: Explain WHY when non-obvious
// Using exponential backoff because NOAA API rate limits
// are enforced with increasing delays
await retryWithBackoff(() => fetchForecast());

// ❌ DON'T: Explain WHAT (code already shows this)
// Loop through sessions
sessions.forEach(session => { ... });
```

### Formatting Rules
- **NEVER reformat unrelated code**
- **PRESERVE existing indentation exactly**
- **NO empty catch blocks**
- **NO console.log in production code** (use logger)

---

## 🚫 Critical Don'ts

### Pattern Violations
- ❌ Create new data fetching patterns
- ❌ Skip `withAuthenticatedAction` for protected actions
- ❌ Bypass `lib/api-utils.ts` for API responses
- ❌ Invent custom authentication logic
- ❌ Create custom error handling patterns

### Code Changes
- ❌ Reformat unrelated code
- ❌ Change indentation styles
- ❌ Remove comments without understanding context
- ❌ Create files unless absolutely necessary (prefer editing existing)

### Testing
- ❌ Expect 500 errors in tests
- ❌ Use `test.skip()` to hide failures
- ❌ Skip test writing for new features
- ❌ Reduce test coverage

### Features
- ❌ Add monetization features without approval
- ❌ Implement non-growth features without approval
- ❌ Change database schema without migration

### Database
- ❌ Delete user data without safeguards
- ❌ Run migrations without backups
- ❌ Skip RLS policies on new tables
- ❌ Use user-provided strings in DELETE queries

---

## 📋 Development Checklist

### Before Starting Implementation
- [ ] Read relevant `ARCHITECTURE.md` files
- [ ] Present Implementation Plan
- [ ] Wait for explicit approval
- [ ] Identify which established patterns to use

### During Implementation
- [ ] Use `useDataFetcher` for data fetching
- [ ] Use `withAuthenticatedAction` for server actions
- [ ] Use `lib/api-utils.ts` for API routes
- [ ] Add cleanup for realtime subscriptions
- [ ] Reuse DRY components from `components/ui/*`

### Before Submitting
- [ ] Run `yarn test` (all tests pass)
- [ ] Run `yarn typecheck` (no type errors)
- [ ] Run `npx playwright test` (E2E tests pass)
- [ ] Run `yarn build` (production build succeeds)
- [ ] Update `CHANGELOG.md` under `[Unreleased]`
- [ ] No linting errors introduced
- [ ] No 500 error expectations in tests
- [ ] No `test.skip()` used

### Documentation
- [ ] Update relevant `ARCHITECTURE.md` if patterns changed
- [ ] Add JSDoc comments for public APIs
- [ ] Update README if user-facing features added

---

## 🎯 Growth-First Implementation Strategy

### High Priority Features
1. **Social Sharing**
   - One-click session summary exports
   - Instagram/TikTok optimized graphics
   - Shareable session cards with stats

2. **Session Photos**
   - Photo upload during session creation
   - Gallery view on session details
   - Photo-first session feeds

3. **Viral Mechanics**
   - Referral system with rewards
   - Challenge system (streak tracking, competitions)
   - Dynamic leaderboards (beach, region, global)

4. **Community Features**
   - Crews (surf groups)
   - Buddy system (surf partner matching)
   - Collaborative session planning

5. **Forecast Transparency**
   - Show NOAA vs. fallback data sources
   - Display confidence indicators
   - Highlight nearest buoy data

### Implementation Guidelines
- **Mobile-first** — Optimize for mobile before desktop
- **Performance** — Sub-150ms API responses, 60fps animations
- **Accessibility** — WCAG 2.1 AA compliance
- **Viral Hooks** — Every feature should encourage sharing

---

## 📱 Mobile Development

### Build Commands
```bash
# iOS
yarn build:ios              # Production build
yarn mobile:build:ios:local # Development build
npx cap open ios            # Open Xcode

# Android
yarn build:android              # Production build
yarn mobile:build:android:local # Development build
npx cap open android            # Open Android Studio

# Sync Web Assets
yarn mobile:sync            # Production config
yarn mobile:sync:dev        # Development config
```

### Local Development with Tunneling
```bash
# Start tunnel and sync to iOS
yarn tunnel:ios

# Start tunnel and open Xcode
yarn tunnel:ios:open

# Stop tunnel
yarn tunnel:stop
```

**See:** [docs/MOBILE_LOCAL_DEV.md](/docs/MOBILE_LOCAL_DEV.md)

---

## 🔍 MCP Enhanced Workflows

### Playwright MCP
```bash
# Test specific flow
"Test the session creation flow end-to-end"

# Debug failures
"The onboarding test is failing. Open the trace and diagnose."

# Cross-device testing
"Test the new feature on mobile, tablet, and desktop"

# Performance validation
"Check if my changes affected page load times"
```

### Supabase MCP
```bash
# Query data
"Show me all sessions from the last 7 days"

# Validate RLS
"Test if non-authenticated users can access profiles"

# Check migrations
"What migrations have been applied to production?"

# Performance
"Show me slow queries from the last hour"
```

### Rapid7 MCP
```bash
# Security events
"Query auth failures from the last 24 hours"

# Anomaly detection
"Show unusual API activity patterns"

# Correlation
"Match Rapid7 logs with Supabase events for user X"
```

---

## 📞 Getting Help

### Documentation Resources
- **Architecture:** [ARCHITECTURE.md](/ARCHITECTURE.md)
- **Setup Issues:** [docs/TROUBLESHOOTING.md](/docs/TROUBLESHOOTING.md)
- **Supabase Confusion:** [docs/SUPABASE_SETUP.md](/docs/SUPABASE_SETUP.md)
- **Testing:** [TEST_ARCHITECTURE.md](/TEST_ARCHITECTURE.md)
- **Design System:** [docs/DESIGN_PRINCIPLES.md](/docs/DESIGN_PRINCIPLES.md)

### Common Questions

**Q: Which Supabase client should I use?**
A: See [docs/SUPABASE_SETUP.md](/docs/SUPABASE_SETUP.md)
- Browser: `lib/supabase/client`
- Server Components: `lib/supabase/server`
- API Routes: `lib/supabase/api-server-client`

**Q: How do I run a subset of tests?**
A: `npx playwright test --grep "pattern"` or `yarn test session`

**Q: Migration failed, what do I do?**
A: Rollback with backup, check logs, test locally with `supabase db reset`

**Q: Can I skip writing tests?**
A: No. All behavioral changes require tests.

---

## 🎓 Learning Resources

### Quiver-Specific
- [ARCHITECTURE.md](/ARCHITECTURE.md) — System overview
- [docs/ARCHITECTURE_REVIEW.md](/docs/ARCHITECTURE_REVIEW.md) — Deep dive
- [CHANGELOG.md](/CHANGELOG.md) — Feature history
- [docs/GAMIFICATION.md](/docs/GAMIFICATION.md) — XP, badges, leaderboards

### Technology Guides
- [Next.js 14 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Playwright Docs](https://playwright.dev/docs/intro)

### External Learning
- [Playwright MCP Integration](https://hackernoon.com/playwright-mcp-server-is-here-lets-integrate-it)
- [MCP for Test Automation](https://dev.to/debs_obrien/letting-playwright-mcp-explore-your-site-and-write-your-tests-mf1)

---

## 📊 Success Metrics

Track these when implementing growth features:

### User Growth
- Active users (target: 1000+ by Q2 2025)
- Daily active users (DAU)
- Weekly retention rate (target: 50%+)

### Engagement
- Sessions per user (target: 10+ per month)
- Session completion rate (target: 80%+)
- Social shares per session (target: 20%+)

### Performance
- API response time p50 (target: <150ms)
- Page load time (target: <2s)
- Lighthouse score (target: 90+)

### Quality
- Test coverage (maintain: 95%+)
- Bug rate (target: <5 per week)
- User-reported issues (track in GitHub Issues)

---

## ✅ Quick Reference

### Essential Commands
```bash
yarn dev                    # Start dev server
yarn test                   # Run unit tests
yarn build                  # Production build
npx playwright test         # E2E tests
supabase start              # Start local DB
supabase db reset           # Reset DB with migrations
```

### Essential Patterns
```tsx
// Data Fetching
const fetch = useCallback(async () => await action(), []);
const { data, loading, error } = useDataFetcher(fetch);

// Server Actions
withAuthenticatedAction(async (user, supabase) => { ... });

// API Routes
createSuccessResponse(data) / handleApiError(error);
```

### Essential Files
- [ARCHITECTURE.md](/ARCHITECTURE.md) — Start here
- [docs/CLAUDE.md](/docs/CLAUDE.md) — Detailed guide
- [CHANGELOG.md](/CHANGELOG.md) — Update always

---

**Remember:** Growth-first, patterns-first, tests-first. Read architecture, propose plan, implement with established patterns, validate with tests, document changes.

**Built with ❤️ by surfers, for surfers** 🏄‍♂️🌊
