# API Middleware Developer Guide

**Status:** Documentation
**Created:** 2026-01-04
**Purpose:** Complete guide for protecting Next.js API routes with composable middleware

---

## TL;DR

**One location, one import, complete protection:**

```typescript
import { withProtection } from "@/lib/middleware/api-wrappers";

export const GET = withProtection(handler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" },
  botBlocking: { enabled: true }
});
```

---

## Quick Start by Goal

| Goal | Code |
|------|------|
| **Protect a public endpoint** | `withProtection(handler, { rateLimit: { key: "public-default" }, botBlocking: { enabled: true } })` |
| **Require authentication** | `withProtection(handler, { auth: { required: true } })` |
| **Require auth + rate limiting** | `withProtection(handler, { auth: { required: true }, rateLimit: { key: "authenticated-default" } })` |
| **Full protection (auth + rate + bot)** | `withProtection(handler, { auth: { required: true }, rateLimit: { key: "authenticated-default" }, botBlocking: { enabled: true } })` |

---

## Decision Tree

Use this flowchart to select the right middleware pattern:

```
START: New API route
|
+-- Does it require authentication?
|   |
|   +-- NO (Public endpoint)
|   |   |
|   |   +-- Does it need bot protection?
|   |   |   |
|   |   |   +-- YES --> withProtection(handler, {
|   |   |   |             rateLimit: { key: "public-default" },
|   |   |   |             botBlocking: { enabled: true }
|   |   |   |           })
|   |   |   |
|   |   |   +-- NO  --> withProtection(handler, {
|   |   |                 rateLimit: { key: "public-default" }
|   |   |               })
|   |   |
|   |   +-- What type of endpoint?
|   |       +-- Search        --> key: "beach-search"
|   |       +-- AI/ML         --> key: "recommendations" | "surf-discovery" | "surf-insights"
|   |       +-- Image proxy   --> key: "image-proxy"
|   |       +-- Bulk data     --> key: "forecast-bulk"
|   |       +-- Standard      --> key: "public-default"
|   |
|   +-- YES (Authenticated endpoint)
|       |
|       +-- Is auth required or optional?
|       |   |
|       |   +-- REQUIRED
|       |   |   |
|       |   |   +-- Need rate limiting?
|       |   |   |   |
|       |   |   |   +-- YES --> Need bot blocking too?
|       |   |   |   |   |
|       |   |   |   |   +-- YES --> withProtection(handler, {
|       |   |   |   |   |             auth: { required: true },
|       |   |   |   |   |             rateLimit: { key: "authenticated-default" },
|       |   |   |   |   |             botBlocking: { enabled: true }
|       |   |   |   |   |           })
|       |   |   |   |   |
|       |   |   |   |   +-- NO  --> withProtection(handler, {
|       |   |   |   |               auth: { required: true },
|       |   |   |   |               rateLimit: { key: "authenticated-default" }
|       |   |   |   |             })
|       |   |   |   |
|       |   |   |   +-- NO  --> withAuth(handler)
|       |   |   |
|       |   |   +-- What method?
|       |   |       +-- GET/READ           --> key: "authenticated-default"
|       |   |       +-- POST/PUT/DELETE    --> Consider stricter limits
|       |   |
|       |   +-- OPTIONAL
|       |       |
|       |       +-- Need different rate limits for authed vs public?
|       |       |   |
|       |       |   +-- YES --> withProtection(handler, {
|       |       |   |             auth: { required: false },
|       |       |   |             rateLimit: {
|       |       |   |               authAware: {
|       |       |   |                 publicLimitKey: "public-default",
|       |       |   |                 authenticatedLimitKey: "authenticated-default"
|       |       |   |               }
|       |       |   |             }
|       |       |   |           })
|       |       |   |
|       |       |   +-- NO  --> withProtection(handler, {
|       |       |               auth: { required: false },
|       |       |               rateLimit: { key: "public-default" }
|       |       |             })
|       |       |
|       |       +-- Need bot blocking?
|       |           +-- YES --> Add: botBlocking: { enabled: true }
|       |           +-- NO  --> Omit botBlocking
|       |
|       +-- Handler receives:
|           +-- Required auth: AuthenticatedContext (user guaranteed)
|           +-- Optional auth: user | null (must check before use)
```

---

## Common Patterns (8 Patterns)

### Pattern 1: Public Endpoint (Bot Blocking + Rate Limiting)

```typescript
import { withProtection } from "@/lib/middleware/api-wrappers";

async function handler(request: NextRequest) {
  // business logic
  return createSuccessResponse({ data });
}

export const GET = withProtection(handler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true }
});
```

**Or use convenience wrapper:**

```typescript
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

export const GET = withBotBlockingAndRateLimit(handler, { key: "public-default" });
```

---

### Pattern 2: Public Endpoint (Rate Limiting Only, No Bots)

```typescript
import { withProtection } from "@/lib/middleware/api-wrappers";

async function handler(request: NextRequest) {
  // business logic
  return createSuccessResponse({ data });
}

export const GET = withProtection(handler, {
  rateLimit: { key: "public-default" }
  // No botBlocking = disabled
});
```

**Or use single wrapper:**

```typescript
import { withRateLimit } from "@/lib/middleware/api-wrappers";

export const GET = withRateLimit(handler, { key: "public-default" });
```

---

### Pattern 3: Authenticated Endpoint (Auth + Rate Limiting)

```typescript
import { withProtection, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

async function handler(req: NextRequest, { user, supabase }: AuthenticatedContext) {
  // user guaranteed to exist
  const { data } = await supabase.from("boards").select("*").eq("user_id", user.id);
  return createSuccessResponse({ boards: data });
}

export const POST = withProtection(handler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
});
```

---

### Pattern 4: Authenticated Endpoint (Full Protection)

```typescript
import { withProtection, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

async function handler(req: NextRequest, { user, supabase }: AuthenticatedContext) {
  // user guaranteed to exist
  return createSuccessResponse({ data });
}

export const POST = withProtection(handler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" },
  botBlocking: { enabled: true }
});
```

---

### Pattern 5: Optional Auth (Different Rate Limits)

```typescript
import { withProtection } from "@/lib/middleware/api-wrappers";

async function handler(req: NextRequest, { user, supabase, params }) {
  // user MAY be null
  const isOwner = user?.id === params.id;

  // Show more data to owner
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", params.id)
    .limit(isOwner ? 100 : 10);

  return createSuccessResponse({ sessions: data, isOwner });
}

export const GET = withProtection(handler, {
  auth: { required: false }, // optional auth
  rateLimit: {
    authAware: {
      publicLimitKey: "public-default",        // 60/min unauthenticated
      authenticatedLimitKey: "authenticated-default" // 120/min authenticated
    }
  }
});
```

**Note:** `authAware` requires checking authentication status (Supabase `getUser()`) to choose the key, which adds overhead and partially defeats the “rate limit before auth” optimization. Use it only when you truly need adaptive limits.

---

### Pattern 6: Auth Only (No Rate Limiting)

```typescript
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

export const DELETE = withAuth(async (req, { user, supabase }: AuthenticatedContext) => {
  // user guaranteed to exist
  // No rate limiting applied
  return createSuccessResponse({ deleted: true });
});
```

**Or use unified wrapper:**

```typescript
export const DELETE = withProtection(handler, {
  auth: { required: true }
  // No rateLimit = no rate limiting
});
```

---

### Pattern 7: Method-Specific Protection (Different per Method)

```typescript
import { withProtection, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

// GET: Public with protections
async function getHandler(req: NextRequest) {
  // public read logic
  return createSuccessResponse({ data });
}

export const GET = withProtection(getHandler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true }
});

// POST: Authenticated with rate limiting
async function postHandler(req: NextRequest, { user, supabase }: AuthenticatedContext) {
  // authenticated write logic
  return createSuccessResponse({ created: true });
}

export const POST = withProtection(postHandler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
});
```

---

### Pattern 8: Dynamic Routes (Params Available)

```typescript
import { withProtection, validateUuidParam, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

// Handler receives params in context
async function sessionHandler(
  req: NextRequest,
  { user, supabase, params }: AuthenticatedContext
) {
  const uuidResult = validateUuidParam(params.id, "session");
  if ("error" in uuidResult) return uuidResult.error;

  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", uuidResult.value)
    .eq("user_id", user.id)
    .single();

  return createSuccessResponse({ session: data });
}

// Clean, no inline wrapper creation
export const GET = withProtection(sessionHandler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
});
```

---

## Rate Limit Keys (Single Source of Truth)

From `/lib/api/rate-limit-config.ts`:

| Key | Requests/Min | Requests/Hour | Use Case |
|-----|--------------|---------------|----------|
| `image-proxy` | 60 | 600 | Image proxy (SSRF risk) |
| `recommendations` | 20 | 200 | AI recommendations (expensive) |
| `beach-search` | 30 | 300 | Full-text search |
| `forecast-bulk` | 60 | 1000 | Bulk forecast data |
| `coach-picks` | 60 | 1000 | Coach picks RPC |
| `public-default` | 60 | 1000 | Standard public endpoints |
| `public-showcase` | 120 | 2000 | Marketing/featured content |
| `authenticated-default` | 120 | 5000 | Authenticated endpoints |
| `surf-discovery` | 10 | 100 | Surf spot discovery |
| `surf-insights` | 10 | 100 | Surf insights algorithm |

### Rate Limit Key Selection Logic

```
What is the computational cost?
+-- Very High (AI, complex algorithms) --> Use specific strict key
+-- High (search, RPC)                 --> Use beach-search or coach-picks
+-- Medium (standard queries)          --> Use public-default or authenticated-default
+-- Low (simple reads)                 --> Use public-default or authenticated-default

What is the security risk?
+-- SSRF/Proxy risk     --> Use image-proxy (very strict)
+-- Abuse potential     --> Use stricter limits
+-- Low risk            --> Use default limits

Is user authenticated?
+-- YES --> authenticated-default (120/min, 5000/hour)
+-- NO  --> public-default (60/min, 1000/hour)
```

---

## Migration Guide

### Migration Strategy

**No Forced Migration Required.** The new pattern is 100% backward compatible.

You can migrate:
- **Immediately:** For new routes
- **Opportunistically:** When modifying existing routes
- **Never:** If the current pattern works fine

### Migration Pattern: Public Endpoint with Bot Blocking

**Before:**

```typescript
import { withBotBlockingAndRateLimit } from "@/lib/middleware/rate-limiter";

async function beachesHandler(request: NextRequest) {
  return createSuccessResponse({ beaches: data });
}

export const GET = withBotBlockingAndRateLimit(beachesHandler, "public-default");
```

**After (Option 1: Update import only - backward compatible):**

```typescript
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

async function beachesHandler(request: NextRequest) {
  return createSuccessResponse({ beaches: data });
}

// Old signature still works
export const GET = withBotBlockingAndRateLimit(beachesHandler, "public-default");
```

**After (Option 2: Use new signature):**

```typescript
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

async function beachesHandler(request: NextRequest) {
  return createSuccessResponse({ beaches: data });
}

// New signature with options object
export const GET = withBotBlockingAndRateLimit(beachesHandler, {
  key: "public-default"
});
```

**After (Option 3: Use unified wrapper - recommended):**

```typescript
import { withProtection } from "@/lib/middleware/api-wrappers";

async function beachesHandler(request: NextRequest) {
  return createSuccessResponse({ beaches: data });
}

export const GET = withProtection(beachesHandler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true }
});
```

### Migration Pattern: Adding Rate Limiting to Auth-Only Endpoint

**Before:**

```typescript
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

async function createSessionHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext
) {
  return createSuccessResponse({ session: newSession });
}

export const POST = withAuth(createSessionHandler);
```

**After:**

```typescript
import { withProtection, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

async function createSessionHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext
) {
  return createSuccessResponse({ session: newSession });
}

export const POST = withProtection(createSessionHandler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
});
```

### Migration Pattern: Fix Inline Wrapper Anti-Pattern

**Before (Anti-pattern):**

```typescript
// BAD: Creates wrapper on every request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(async (req, { user, supabase }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "session");
    // ...
  })(request); // Inline invocation
}
```

**After (Correct pattern):**

```typescript
// GOOD: Handler defined once, receives params in context
async function sessionHandler(
  request: NextRequest,
  { user, supabase, params }: AuthenticatedContext
) {
  const uuidResult = validateUuidParam(params.id, "session");
  if ("error" in uuidResult) return uuidResult.error;
  // business logic
  return createSuccessResponse({ session: data });
}

// Wrapper created once at module load
export const GET = withProtection(sessionHandler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
});
```

### Import Changes

**Old Imports:**

```typescript
import { withBotBlockingAndRateLimit } from "@/lib/middleware/rate-limiter";
import { withAuth } from "@/lib/middleware/api-wrappers";
```

**New Imports (Single Location):**

```typescript
import {
  withProtection,
  withAuth,
  withBotBlockingAndRateLimit,
  type AuthenticatedContext,
  type OptionalAuthHandler,
  createSuccessResponse,
  validateUuidParam,
} from "@/lib/middleware/api-wrappers";
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Inline Wrapper Creation in Dynamic Routes

**Problem:**

```typescript
// BAD: Creates wrapper on every request
export async function GET(req: NextRequest, { params }) {
  return withAuth(async (req, { user, supabase }) => {
    // ...
  })(req);
}
```

**Solution:**

```typescript
// GOOD: Wrapper created once at module load
async function handler(req, { user, supabase, params }) {
  // params available in context
}
export const GET = withProtection(handler, { auth: { required: true } });
```

### Pitfall 2: Wrong Wrapper Order (Manual Nesting)

**Problem:**

```typescript
// BAD: Wrong order - auth before rate limiting
export const GET = withAuth(
  withRateLimit(handler, { key: "public-default" })
);
```

**Solution:**

```typescript
// GOOD: Correct order guaranteed by withProtection
export const GET = withProtection(handler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
});
```

### Pitfall 3: Missing Rate Limiting on Public Endpoints

**Problem:**

```typescript
// BAD: No rate limiting = vulnerable to abuse
export async function GET(req: NextRequest) {
  // business logic
}
```

**Solution:**

```typescript
// GOOD: Always add rate limiting for public endpoints
export const GET = withProtection(handler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true }
});
```

### Pitfall 4: Wrong Rate Limit Key

**Problem:**

```typescript
// BAD: Generic limit for expensive operation
export const GET = withProtection(searchHandler, {
  rateLimit: { key: "public-default" } // Too lenient for search
});
```

**Solution:**

```typescript
// GOOD: Use specific limit for search
export const GET = withProtection(searchHandler, {
  rateLimit: { key: "beach-search" } // Strict search limits
});
```

---

## Best Practices

### DO

```typescript
// Define handler separately for clarity
async function handler(req: NextRequest, { user, supabase }: AuthenticatedContext) {
  // business logic
}

export const GET = withProtection(handler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
});
```

### DO

```typescript
// Use type imports for better tree-shaking
import { withProtection } from "@/lib/middleware/api-wrappers";
import type { AuthenticatedContext } from "@/lib/middleware/api-wrappers";
```

### DO

```typescript
// Use specific rate limit keys for different endpoint types
export const GET = withProtection(beachSearchHandler, {
  rateLimit: { key: "beach-search" } // Specific key for search
});
```

### DO

```typescript
// Always protect public endpoints
export const GET = withProtection(handler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true }
});
```

### DON'T

```typescript
// Don't create inline wrappers in dynamic routes
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async (req, { user, supabase }) => {
    // BAD - creates new wrapper on every request
  })(req);
}
```

### DON'T

```typescript
// Don't manually nest wrappers
export const POST = withBotBlocking(
  withRateLimit(
    withAuth(handler),
    { key: "public-default" }
  )
);
// Use withProtection instead
```

### DON'T

```typescript
// Don't use generic rate limits when specific ones exist
export const GET = withProtection(searchHandler, {
  rateLimit: { key: "public-default" } // BAD - use "beach-search"
});
```

### DON'T

```typescript
// Don't leave public endpoints unprotected
export async function GET(req: NextRequest) {
  // BAD - no protection at all
}
```

---

## Bot Blocking Decision Guide

### When to Enable Bot Blocking

```
Enable bot blocking if:
  [x] Endpoint is public (no authentication required)
  [x] Endpoint has computational cost
  [x] Endpoint returns valuable data
  [x] Endpoint could be scraped

Skip bot blocking if:
  [ ] Endpoint requires authentication (authenticated users unlikely to be bots)
  [ ] Endpoint is intentionally for bots (e.g., sitemap, robots.txt)
  [ ] Endpoint needs to support legitimate automation (webhooks, etc.)
```

### Example Decision

```typescript
// Public beach list --> Enable bot blocking
export const GET = withProtection(handler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true }
});

// Authenticated user dashboard --> Skip bot blocking
export const GET = withProtection(handler, {
  auth: { required: true },
  rateLimit: { key: "authenticated-default" }
  // No botBlocking needed
});
```

---

## Testing Protected Routes

```typescript
import { withProtection } from "@/lib/middleware/api-wrappers";
import { NextRequest } from "next/server";

describe("Protected API route", () => {
  it("blocks bots when enabled", async () => {
    const handler = withProtection(mockHandler, {
      botBlocking: { enabled: true }
    });

    const request = new NextRequest("http://localhost", {
      headers: { "User-Agent": "Googlebot" }
    });

    const response = await handler(request);
    expect(response.status).toBe(403);
  });

  it("enforces rate limits", async () => {
    const handler = withProtection(mockHandler, {
      rateLimit: { key: "public-default" }
    });

    // Make requests until rate limit exceeded
    // Verify 429 response with Retry-After header
  });

  it("requires authentication when configured", async () => {
    const handler = withProtection(mockHandler, {
      auth: { required: true }
    });

    const request = new NextRequest("http://localhost");
    const response = await handler(request);
    expect(response.status).toBe(401);
  });

  it("allows unauthenticated when auth is optional", async () => {
    const handler = withProtection(mockHandler, {
      auth: { required: false }
    });

    const request = new NextRequest("http://localhost");
    const response = await handler(request);
    expect(response.status).toBe(200);
  });
});
```

---

## FAQ

### Q: Do I need to migrate all routes immediately?

**A:** No. The new pattern is backward compatible. Migrate new routes immediately, existing routes opportunistically.

### Q: Will the old pattern stop working?

**A:** No. Old imports and signatures will continue to work indefinitely. We may add deprecation warnings in the future, but breaking changes are not planned.

### Q: What's the benefit of migrating?

**A:**
- Single import location (simpler)
- Support for all protection combinations
- Better type safety
- Easier to add new protections
- More maintainable code

### Q: Should I use `withProtection` or specific wrappers?

**A:** For new code, prefer `withProtection` for flexibility. Specific wrappers like `withAuth` are fine if you only need one protection.

### Q: How do I choose the right rate limit key?

**A:** See the "Rate Limit Keys" table above. Use specific keys for expensive operations, generic keys for standard endpoints.

### Q: Can I still use `withAuth` without rate limiting?

**A:** Yes! `withAuth` works exactly as before. Rate limiting is optional.

### Q: Should I enable bot blocking?

**A:** Enable for public endpoints that could be scraped. Skip for authenticated endpoints.

### Q: Which rate limit key should I use?

**A:**
- Search --> `beach-search`
- AI/ML --> `recommendations`, `surf-discovery`, `surf-insights`
- Image proxy --> `image-proxy`
- Bulk data --> `forecast-bulk`
- Public read --> `public-default`
- Authenticated --> `authenticated-default`
- Not sure --> `public-default` or `authenticated-default`

### Q: Should auth be required or optional?

**A:**
- Can the endpoint work without a user? NO --> Required auth
- Better with auth but works without? --> Optional auth
- Completely public? --> No auth

### Q: How do I test protected routes?

**A:** Use the same testing patterns. Mock authentication, simulate rate limit exceeded, test bot user agents. See the Testing section above.

---

## Complete Function Reference

### Individual Wrappers (Building Blocks)

```typescript
import {
  withAuth,           // Authentication only
  withErrorHandler,   // Error handling only
  withBotBlocking,    // Bot blocking only
  withRateLimit,      // Rate limiting only
} from "@/lib/middleware/api-wrappers";
```

### Convenience Composites (Pre-composed Patterns)

```typescript
import {
  withBotBlockingAndRateLimit, // Bot blocking + rate limiting
} from "@/lib/middleware/api-wrappers";
```

### Unified Wrapper (Maximum Flexibility)

```typescript
import {
  withProtection // Compose any combination declaratively
} from "@/lib/middleware/api-wrappers";
```

### Type Helpers

```typescript
import type {
  RouteHandler,         // Standard Next.js handler
  RouteContext,         // Route context with params
  AuthenticatedContext, // Context with user + supabase
  AuthenticatedHandler, // Handler receiving authenticated context
  OptionalAuthHandler,  // Handler with optional user
} from "@/lib/middleware/api-wrappers";
```

---

## Protection Layer Order

**Request Flow (Outer to Inner):**

```
1. Bot Blocking      <-- Fastest, no state lookup
   |
2. Rate Limiting     <-- State lookup, client identification
   |
3. Authentication    <-- Supabase auth check
   |
4. Error Handling    <-- Catch-all wrapper
   |
5. Your Handler      <-- Business logic
```

**Why this order?**
- Bot blocking first: Rejects bots immediately, no resources wasted
- Rate limiting second: Prevents bots from consuming quota
- Auth third: Only check auth for legitimate clients
- Error handling wraps everything for consistent responses

---

**Technical architecture details are in the [Technical Reference Appendix](#technical-reference-appendix) below.**

## Technical Reference Appendix

This appendix consolidates the former API middleware technical reference into
the developer guide. The guide above remains the day-to-day entry point; this
section records implementation, typing, performance, security, compatibility,
and extension details.

### Architecture principles

The middleware system uses composable higher-order functions (HOFs) to wrap
Next.js route handlers with protection layers:

1. Single responsibility: each HOF handles one concern.
2. Composability: protections can be combined declaratively.
3. Backward compatibility: existing `withAuth` signatures continue to work.
4. Type safety: handler context is fully typed.
5. Developer experience: the API has clear defaults and readable usage.
6. Performance: failed checks exit early with minimal overhead.

### Next.js 15+ route-param compatibility

In Next.js 15+, route-handler `params` is a Promise. Accessing `params.id`
before awaiting it returns an undefined value. The `withAuth`,
`createApiHandler`, and `withProtection` wrappers resolve params before passing
them to handlers.

The route context accepts both forms:

~~~typescript
interface RouteContext {
  params: Record<string, string> | Promise<Record<string, string>>;
}
~~~

Handler context always receives resolved params:

~~~typescript
interface AuthenticatedContext {
  params: Record<string, string>;
  user: User;
  supabase: SupabaseClient<Database>;
}
~~~

Correct usage:

~~~typescript
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

async function handler(
  request: NextRequest,
  { user, supabase, params }: AuthenticatedContext
) {
  const sessionId = params.id;
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  return createSuccessResponse({ session: data });
}

export const GET = withAuth(handler);
~~~

Do not access params outside the wrapper or manually await and re-wrap the
handler; both patterns duplicate or bypass the wrapper's resolution logic.

The implementation points are `lib/middleware/api-wrappers/types.ts`,
`auth-wrapper.ts`, and `index.ts`, which define and export `ResolvedParams` and
`OptionalAuthContext`.

### Protection combinations

| Pattern | Bot blocking | Rate limiting | Auth | Error handling | Example |
| --- | --- | --- | --- | --- | --- |
| Public read | Yes | Yes | No | Yes | Beach list, forecast data |
| Public search | Yes | Yes (strict) | No | Yes | Beach search |
| Auth required | No | Yes (lenient) | Required | Yes | Dashboard, settings |
| Auth write | No | Yes (strict) | Required | Yes | Session, comment |
| Optional auth | Yes | Yes (adaptive) | Optional | Yes | Public profile |
| Image proxy | Yes | Yes (very strict) | No | Yes | SSRF-sensitive proxy |
| AI endpoint | Yes | Yes (strict) | Optional | Yes | Recommendations |

### Type definitions

The shared types are defined in `lib/middleware/api-wrappers/types.ts`:

~~~typescript
export type RouteHandler = (
  request: NextRequest,
  context?: RouteContext
) => Promise<NextResponse>;

export interface RouteContext {
  params: Record<string, string> | Promise<Record<string, string>>;
}

export type ResolvedParams = Record<string, string>;

export interface AuthenticatedContext {
  params: ResolvedParams;
  user: User;
  supabase: SupabaseClient<Database>;
}

export interface OptionalAuthContext {
  params: ResolvedParams;
  user: User | null;
  supabase: SupabaseClient<Database>;
}
~~~

The option types expose required or optional auth, a rate-limit key or
auth-aware keys, bot blocking, and error-handling configuration. The wrapper
signatures are:

~~~typescript
withAuth(handler, options?): RouteHandler
withErrorHandler(handler, options?): RouteHandler
withBotBlocking(handler, options?): RouteHandler
withRateLimit(handler, options): RouteHandler
withBotBlockingAndRateLimit(handler, optionsOrKey): RouteHandler
withProtection(handler, options?): RouteHandler
~~~

### Internal composition

`withProtection` applies wrappers from the inside out so requests execute in
this order:

~~~text
Request -> Bot Blocking -> Rate Limiting -> Authentication
        -> Error Handling -> Handler
~~~

The implementation first wraps the handler with error handling, then auth,
then rate limiting, and finally bot blocking as the outermost layer. This
ensures bots are rejected without state lookup, rate limits are checked before
auth, and the handler receives resolved context.

### Performance characteristics

| Layer | Typical latency | Early exit |
| --- | --- | --- |
| Bot blocking | ~0.1ms | 403 |
| Rate limiting | ~1ms | 429 |
| Params resolution | ~0ms | No |
| Authentication | ~5-10ms | 401 |
| Error handling | Negligible | No |
| Total overhead | ~6-11ms | — |

Optimization strategies are early exits, cached rate-limiters, Supabase client
caching, lazy evaluation for disabled protections, and awaiting params only
when the context actually contains a Promise.

### Context and error flow

Authenticated context contains a guaranteed user, a Supabase client, and
resolved params. Optional-auth context contains a nullable user and the same
resolved params. Any layer can return its standard status: authentication
failure 401, rate limit 429, bot detection 403, or handler failure 500 through
the error handler. Standard error responses include a success flag, a
user-facing error, and a timestamp.

### Rate-limiting architecture

Client identification checks `x-vercel-forwarded-for`, then `x-real-ip`, then
`x-forwarded-for`, and finally uses `unknown`. A cached singleton is selected
per rate-limit key. The limiter checks burst, per-minute, and per-hour windows;
allowed requests are recorded, and rejected requests return 429 with
`Retry-After`.

The failure policy is fail closed: an unexpected limiter or infrastructure
error returns 503 Service Unavailable with a `Retry-After` header rather than
silently bypassing protection.

Auth-aware rate limiting selects a public or authenticated key after checking
auth status:

~~~typescript
export const GET = withProtection(handler, {
  auth: { required: false },
  rateLimit: {
    authAware: {
      publicLimitKey: "public-default",
      authenticatedLimitKey: "authenticated-default"
    }
  }
});
~~~

### Bot-blocking architecture

Bot blocking lowercases the User-Agent and matches known substrings such as
bot, crawler, spider, scraper, googlebot, bingbot, yandexbot, curl, wget, and
python-requests. It returns 403 immediately for a match. It is fastest when
first, prevents bots from consuming rate-limit quota, and reduces downstream
load.

Enable bot blocking for public, computationally expensive, valuable, or
scrapeable endpoints. Skip it for authenticated endpoints, intentional bot
endpoints such as sitemap/robots, and legitimate automation such as webhooks.

### Type safety

Required-auth handlers receive `AuthenticatedContext`, where `user.id` is
non-null. Optional-auth handlers receive `OptionalAuthContext`, where callers
must null-check `user?.id`. No-auth handlers receive the base route context.
Params are always resolved at the handler boundary.

### Security considerations

The protection stack is defense in depth:

1. Bot blocking rejects automated traffic.
2. Rate limiting prevents abuse and resource exhaustion.
3. Authentication establishes identity and permissions.
4. Error handling avoids leaking implementation details.

The reference implementation documents these response headers:

~~~text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
Retry-After (on 429)
~~~

### Backward compatibility

The migration path is intentionally gradual:

1. Dual support: old imports and signatures work while new imports are
   preferred.
2. Soft deprecation: add JSDoc deprecation tags and warnings after callers are
   migrated.
3. Hard deprecation: remove old imports and overloads only after all routes are
   migrated.

`withBotBlockingAndRateLimit` accepts both the legacy string key and the new
options object:

~~~typescript
withBotBlockingAndRateLimit(handler, "public-default");
withBotBlockingAndRateLimit(handler, { key: "public-default" });
~~~

### Testing architecture

Unit coverage should verify each wrapper independently:

- `withAuth`: required/optional access, context injection, auth errors, Promise
  params, and non-Promise params.
- `withRateLimit`: allowed requests, exceeded limits, Retry-After, and reset.
- `withBotBlocking`: known bots, legitimate agents, and 403 responses.
- `withProtection`: composition order, enabled protections, context propagation,
  and dynamic route params.

Integration coverage should exercise public full protection, authenticated
rate-limited routes, optional auth with adaptive limits, consistent errors, and
dynamic route params.

### File organization

~~~text
lib/middleware/
  api-wrappers/
    index.ts
    types.ts
    auth-wrapper.ts
    error-handler.ts
    rate-limit-wrapper.ts
    protection-wrappers.ts
    validation-helpers.ts
    ownership-helpers.ts
    response-utils.ts
  bot-blocker.ts
  rate-limiter.ts
~~~

`rate-limiter.ts` is the compatibility layer that re-exports the canonical
wrapper implementation. The wrapper index is the preferred import location.

### Future extensibility

Potential wrapper types are CORS, request validation, response caching,
logging/telemetry, feature flags, and A/B testing. New wrappers should accept
a handler and options, preserve the same context/response contracts, and be
added to the unified wrapper only when the behavior is well-defined.

Open questions are whether to enforce maximum wrapper depth, add wrapper usage
telemetry, and warn in development for deprecated signatures or suboptimal
wrapper order.
