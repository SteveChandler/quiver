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
| **Full protection (auth + rate + bot)** | `withFullProtection(handler, { auth: { required: true }, rateLimit: { key: "authenticated-default" }, botBlocking: { enabled: true } })` |

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
|       |   |   |   |   +-- YES --> withFullProtection(handler, {
|       |   |   |   |   |             auth: { required: true },
|       |   |   |   |   |             rateLimit: { key: "authenticated-default" },
|       |   |   |   |   |             botBlocking: { enabled: true }
|       |   |   |   |   |           })
|       |   |   |   |   |
|       |   |   |   |   +-- NO  --> withAuthAndRateLimit(handler, {
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

**Or use convenience wrapper:**

```typescript
import { withAuthAndRateLimit } from "@/lib/middleware/api-wrappers";

export const POST = withAuthAndRateLimit(handler, {
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

**Or use convenience wrapper:**

```typescript
import { withFullProtection } from "@/lib/middleware/api-wrappers";

export const POST = withFullProtection(handler, {
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
| `personalized-forecast` | 10 | 100 | Personalized recommendations |
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
  withAuthAndRateLimit,
  withBotBlockingAndRateLimit,
  withFullProtection,
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
  withAuthAndRateLimit,        // Auth + rate limiting
  withFullProtection,          // All protections
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

**For technical architecture details, see `/docs/API_MIDDLEWARE_REFERENCE.md`**
