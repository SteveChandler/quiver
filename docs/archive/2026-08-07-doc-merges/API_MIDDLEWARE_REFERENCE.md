> Merged into [API Middleware](../../API_MIDDLEWARE.md#technical-reference-appendix).

# API Middleware Technical Reference

**Status:** Documentation
**Created:** 2026-01-04
**Updated:** 2026-01-30
**Purpose:** Technical architecture and type definitions for API middleware system

---

## Architecture Overview

The API middleware system is built on a **composable Higher-Order Function (HOF) pattern** that wraps Next.js API route handlers with protection layers.

### Design Principles

1. **Single Responsibility:** Each HOF handles one concern
2. **Composability:** HOFs can be chained in any order
3. **Backward Compatibility:** Existing `withAuth` signature must not break
4. **Type Safety:** Full TypeScript support with proper context typing
5. **Developer Experience:** Clear, readable API with good defaults
6. **Performance:** Minimal overhead, early exits for failed checks

---

## Next.js 15+ Compatibility (CRITICAL)

### Breaking Change: Route Params are Promises

In Next.js 15+, the `params` object in route handlers is a **Promise** that must be awaited before accessing its properties. This is a breaking change from Next.js 14.

**Problem:**
```typescript
// Next.js 14 - params was synchronous
export async function GET(request: NextRequest, { params }: RouteContext) {
  const id = params.id; // Worked fine
}

// Next.js 15+ - params is a Promise
export async function GET(request: NextRequest, { params }: RouteContext) {
  const id = params.id; // UNDEFINED! params is a Promise, not an object
}
```

### How the Wrappers Handle This

The `withAuth`, `createApiHandler`, and `withProtection` wrappers automatically resolve params before passing to your handler. This means:

1. **RouteContext type accepts both formats** (for Next.js compatibility):
   ```typescript
   interface RouteContext {
     params: Record<string, string> | Promise<Record<string, string>>;
   }
   ```

2. **Handler context always has resolved params**:
   ```typescript
   interface AuthenticatedContext {
     params: ResolvedParams; // Record<string, string> - already resolved
     user: User;
     supabase: SupabaseClient<Database>;
   }
   ```

3. **Resolution logic in the wrappers**:
   ```typescript
   // In withAuth and createApiHandler (lib/middleware/api-wrappers/auth-wrapper.ts)
   const resolvedParams = context?.params
     ? typeof context.params === "object" && "then" in context.params
       ? await context.params
       : (context.params as Record<string, string>)
     : {};
   ```

### Correct Usage Pattern

```typescript
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

// Handler receives already-resolved params
async function handler(
  request: NextRequest,
  { user, supabase, params }: AuthenticatedContext
) {
  // Safe to use params.id directly - already resolved by wrapper
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
```

### What NOT to Do

```typescript
// WRONG: Accessing params outside the wrapper
export async function GET(request: NextRequest, { params }: RouteContext) {
  const id = params.id; // UNDEFINED in Next.js 15+
  // ...
}

// WRONG: Manually awaiting params then using wrapper
export async function GET(request: NextRequest, { params }: RouteContext) {
  const resolvedParams = await params;
  return withAuth(async (req, { user, supabase }) => {
    // This works but is redundant - wrapper already resolves params
  })(request, { params: resolvedParams });
}
```

### Files Changed for Next.js 15+ Support

- `lib/middleware/api-wrappers/types.ts` - Added `ResolvedParams` type, updated `RouteContext` to accept Promise params, `AuthenticatedContext` and `OptionalAuthContext` use `ResolvedParams`
- `lib/middleware/api-wrappers/auth-wrapper.ts` - Added params resolution in `withAuth` and `createApiHandler`
- `lib/middleware/api-wrappers/index.ts` - Exports `ResolvedParams` and `OptionalAuthContext` types

---

## Layer Architecture Diagram

```
+-------------------------------------------------------------+
|                      CLIENT REQUEST                          |
+-------------------------------------------------------------+
                            |
+-------------------------------------------------------------+
|  Layer 1: BOT BLOCKING                                       |
|  +-- Check User-Agent header                                 |
|  +-- Match against known bot patterns                        |
|  +-- Return 403 if bot detected                              |
|                                                              |
|  Performance: ~0.1ms (string matching only)                  |
|  Early exit: Yes (blocks immediately)                        |
+-------------------------------------------------------------+
                            |
+-------------------------------------------------------------+
|  Layer 2: RATE LIMITING                                      |
|  +-- Extract client IP from headers                          |
|  +-- Check request count against limits                      |
|  +-- Return 429 if exceeded (with Retry-After)               |
|  +-- Record request in history                               |
|                                                              |
|  Performance: ~1ms (in-memory lookup)                        |
|  Early exit: Yes (before auth check)                         |
+-------------------------------------------------------------+
                            |
+-------------------------------------------------------------+
|  Layer 3: AUTHENTICATION                                     |
|  +-- Create Supabase server client                           |
|  +-- Validate JWT token from cookies                         |
|  +-- Resolve route params (await if Promise)   <-- NEW       |
|  +-- Return 401 if invalid/missing (when required)           |
|  +-- Inject user + supabase + resolved params into context   |
|                                                              |
|  Performance: ~5-10ms (Supabase auth check)                  |
|  Early exit: Yes (if auth required and not authenticated)    |
+-------------------------------------------------------------+
                            |
+-------------------------------------------------------------+
|  Layer 4: ERROR HANDLING                                     |
|  +-- Wrap handler in try-catch                               |
|  +-- Catch all unhandled exceptions                          |
|  +-- Return standardized error responses                     |
|                                                              |
|  Performance: Negligible overhead                            |
|  Early exit: No (wraps handler)                              |
+-------------------------------------------------------------+
                            |
+-------------------------------------------------------------+
|  Layer 5: BUSINESS LOGIC (Your Handler)                      |
|  +-- Receives clean context with resolved params             |
|  +-- No boilerplate needed                                   |
|  +-- Returns NextResponse                                    |
+-------------------------------------------------------------+
                            |
+-------------------------------------------------------------+
|                      CLIENT RESPONSE                         |
+-------------------------------------------------------------+
```

---

## Protection Combinations Matrix

| Pattern | Bot Blocking | Rate Limiting | Auth | Error Handling | Example Use Case |
|---------|--------------|---------------|------|----------------|------------------|
| **Public Read** | Yes | Yes | No | Yes | Beach list, forecast data |
| **Public Search** | Yes | Yes (strict) | No | Yes | Beach search, user search |
| **Auth Required** | No | Yes (lenient) | Required | Yes | User dashboard, settings |
| **Auth Write** | No | Yes (strict) | Required | Yes | Create session, post comment |
| **Optional Auth** | Yes | Yes (adaptive) | Optional | Yes | Public profile (owner sees more) |
| **Image Proxy** | Yes | Yes (very strict) | No | Yes | Image proxy (SSRF risk) |
| **AI Endpoints** | Yes | Yes (strict) | Optional | Yes | Recommendations, personalization |

---

## Type Definitions

### Core Handler Types

```typescript
import type { NextRequest, NextResponse } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { RateLimitKey } from "@/lib/api/rate-limit-config";

/**
 * Standard Next.js route handler signature
 */
export type RouteHandler = (
  request: NextRequest,
  context?: RouteContext
) => Promise<NextResponse>;

/**
 * Route context with typed params as received from Next.js
 *
 * Note: In Next.js 15+, params is a Promise that must be awaited.
 * We accept both for compatibility with the Next.js handler signature.
 */
export interface RouteContext {
  params: Record<string, string> | Promise<Record<string, string>>;
}

/**
 * Resolved params type (after awaiting the Promise)
 */
export type ResolvedParams = Record<string, string>;

/**
 * Extended context provided to authenticated handlers.
 * Params are always resolved (not a Promise) at this point.
 */
export interface AuthenticatedContext {
  params: ResolvedParams;
  user: User;
  supabase: SupabaseClient<Database>;
}

/**
 * Handler that receives authenticated context
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthenticatedContext
) => Promise<NextResponse>;

/**
 * Context for optional auth handlers (user may be null).
 * Params are always resolved (not a Promise) at this point.
 */
export interface OptionalAuthContext {
  params: ResolvedParams;
  user: User | null;
  supabase: SupabaseClient<Database>;
}

/**
 * Handler that receives optional auth (user may be null)
 */
export type OptionalAuthHandler = (
  request: NextRequest,
  context: OptionalAuthContext
) => Promise<NextResponse>;
```

### Middleware Options Types

```typescript
/**
 * Options for withProtection wrapper (unified approach)
 */
export interface ProtectionOptions {
  /** Authentication configuration */
  auth?: {
    /** Require authentication (default: false) */
    required: boolean;
    /** Custom error message for failed authentication */
    errorMessage?: string;
  };

  /** Rate limiting configuration */
  rateLimit?: WithRateLimitOptions;

  /** Bot blocking configuration */
  botBlocking?: {
    /** Enable bot blocking (default: false) */
    enabled: boolean;
    /** Custom error message for blocked bots */
    errorMessage?: string;
  };

  /** Error handling configuration */
  errorHandling?: WithErrorHandlerOptions;
}

/**
 * Backward-compatible options for withAuth
 */
export interface WithAuthOptions {
  /** Custom error message for failed authentication */
  authErrorMessage?: string;
  /** Custom error message for caught exceptions */
  errorMessage?: string;
  /** Allow unauthenticated access (user will be null) */
  optional?: boolean;
}

/**
 * Options for withRateLimit wrapper
 */
export interface WithRateLimitOptions {
  /** Rate limit key from rate-limit-config.ts */
  key?: RateLimitKey;
  /** Check authentication and use different limits for authenticated users */
  authAware?: {
    publicLimitKey: RateLimitKey;
    authenticatedLimitKey: RateLimitKey;
  };
}

/**
 * Options for withBotBlocking wrapper
 */
export interface WithBotBlockingOptions {
  /** Custom error message for blocked bots */
  errorMessage?: string;
}

/**
 * Options for withErrorHandler wrapper
 */
export interface WithErrorHandlerOptions {
  /** Custom error message for caught exceptions */
  errorMessage?: string;
  /** Include original error details in response (dev only) */
  includeDetails?: boolean;
}
```

### Wrapper Function Signatures

```typescript
// Individual wrappers (building blocks)
export function withAuth(
  handler: AuthenticatedHandler | OptionalAuthHandler,
  options?: WithAuthOptions
): RouteHandler;

export function withErrorHandler(
  handler: RouteHandler,
  options?: WithErrorHandlerOptions
): RouteHandler;

export function withBotBlocking(
  handler: RouteHandler,
  options?: WithBotBlockingOptions
): RouteHandler;

export function withRateLimit(
  handler: RouteHandler,
  options: WithRateLimitOptions
): RouteHandler;

// Convenience composite
export function withBotBlockingAndRateLimit(
  handler: RouteHandler,
  options: WithRateLimitOptions | RateLimitKey // backward compatible
): RouteHandler;

// Unified wrapper
export function withProtection(
  handler: RouteHandler | AuthenticatedHandler | OptionalAuthHandler,
  options?: ProtectionOptions
): RouteHandler;
```

---

## Internal Composition Implementation

### How `withProtection` Composes Layers

```typescript
export function withProtection(
  handler: RouteHandler,
  options?: ProtectionOptions
): RouteHandler {
  let wrappedHandler = handler;

  // Apply wrappers in reverse order (innermost to outermost)
  // This ensures correct execution order during request processing

  // Step 1: Wrap in error handler (innermost)
  if (options?.errorHandling !== false) {
    wrappedHandler = withErrorHandler(wrappedHandler, options?.errorHandling);
  }

  // Step 2: Add authentication (if needed)
  if (options?.auth) {
    wrappedHandler = withAuth(wrappedHandler, {
      optional: !options.auth.required,
      authErrorMessage: options.auth.errorMessage,
      errorMessage: options.errorHandling?.errorMessage
    });
  }

  // Step 3: Add rate limiting (if needed)
  if (options?.rateLimit) {
    wrappedHandler = withRateLimit(wrappedHandler, options.rateLimit);
  }

  // Step 4: Add bot blocking (outermost)
  if (options?.botBlocking?.enabled) {
    wrappedHandler = withBotBlocking(wrappedHandler, options.botBlocking);
  }

  return wrappedHandler;
}
```

**Execution Order During Request:**

```
Request --> Bot Blocking --> Rate Limiting --> Auth --> Error Handler --> Handler
            (outer)                                     (inner)
```

**Why Reverse Order in Code?**
- Function composition wraps inner functions first
- `withBotBlocking(withRateLimit(withAuth(handler)))` means:
  - Bot blocking executes FIRST (outermost wrapper)
  - Auth executes LAST before handler (innermost wrapper)

---

## Performance Characteristics

### Latency Budget per Layer

| Layer | Typical Latency | Cache Hit | Cache Miss | Early Exit |
|-------|-----------------|-----------|------------|------------|
| Bot Blocking | ~0.1ms | N/A | N/A | Yes (403) |
| Rate Limiting | ~1ms | ~0.5ms | ~2ms | Yes (429) |
| Params Resolution | ~0ms | N/A | ~0.1ms | No |
| Authentication | ~5-10ms | ~3ms | ~15ms | Yes (401) |
| Error Handling | Negligible | N/A | N/A | No |
| **Total Overhead** | **~6-11ms** | **~3.6ms** | **~17.2ms** | - |

### Optimization Strategies

1. **Early Exit Pattern:**
   - Bot blocking rejects immediately (no state lookup)
   - Rate limiting rejects before auth (saves 5-10ms)
   - Auth rejects before handler (saves business logic time)

2. **Caching:**
   - Rate limiters are cached (singleton pattern)
   - Supabase client caching (reduces auth latency)

3. **Lazy Evaluation:**
   - Wrappers only execute if options enabled
   - No overhead for unused protections

4. **Params Resolution:**
   - Only awaits if params is actually a Promise
   - Type check (`"then" in context.params`) is O(1)

---

## Context Propagation

### Handler Context Types

```typescript
// Base context (always available) - from Next.js
interface RouteContext {
  params: Record<string, string> | Promise<Record<string, string>>;
}

// Resolved params (after wrapper processing)
type ResolvedParams = Record<string, string>;

// Authenticated context (when auth enabled)
interface AuthenticatedContext {
  params: ResolvedParams;           // Always resolved, never a Promise
  user: User;                       // Guaranteed non-null if auth required
  supabase: SupabaseClient;         // Authenticated client
}

// Optional auth context (when auth optional)
interface OptionalAuthContext {
  params: ResolvedParams;           // Always resolved, never a Promise
  user: User | null;                // May be null
  supabase: SupabaseClient;         // Client (may be unauthenticated)
}
```

### Context Flow Diagram

```
+------------------------------------------+
|  withProtection Options                   |
|  +-- auth: { required: true }             |
|  +-- ...                                  |
+------------------------------------------+
                |
+------------------------------------------+
|  withAuth creates context:                |
|  +-- supabase = createSupabaseClient()    |
|  +-- user = await getUser()               |
|  +-- params = await context.params        |  <-- NEW: Resolves Promise
|       (if params is Promise, await it)    |
+------------------------------------------+
                |
+------------------------------------------+
|  Handler receives typed context:          |
|  +-- user: User (guaranteed)              |
|  +-- supabase: SupabaseClient             |
|  +-- params: ResolvedParams (not Promise) |  <-- Always resolved
+------------------------------------------+
```

---

## Error Handling Flow

### Error Propagation

```
+-----------------------------------------------------------+
|  Any Layer Throws Error                                    |
|  +-- Authentication failure --> 401 (handled by withAuth)  |
|  +-- Rate limit exceeded --> 429 (handled by withRateLimit)|
|  +-- Bot detected --> 403 (handled by withBotBlocking)     |
|  +-- Business logic error --> 500 (caught by error handler)|
+-----------------------------------------------------------+
                            |
+-----------------------------------------------------------+
|  withErrorHandler Catches Unhandled Errors                 |
|  +-- Logs error with context                               |
|  +-- Returns standardized JSON response                    |
|  +-- Includes timestamp, success flag, error message       |
+-----------------------------------------------------------+
                            |
+-----------------------------------------------------------+
|  Client Receives Consistent Error Format                   |
|  {                                                         |
|    success: false,                                         |
|    error: "User-friendly message",                         |
|    timestamp: "2026-01-04T12:00:00Z"                       |
|  }                                                         |
+-----------------------------------------------------------+
```

---

## Rate Limiting Architecture

### Client Identification

```
+------------------------------------------+
|  Extract Client IP                        |
|  +-- Check x-vercel-forwarded-for         |
|  +-- Fallback to x-real-ip                |
|  +-- Fallback to x-forwarded-for          |
|  +-- Fallback to "unknown"                |
+------------------------------------------+
                |
+------------------------------------------+
|  Get Rate Limiter Instance                |
|  +-- Cached singleton per limit key       |
|  +-- Configured from rate-limit-config.ts |
+------------------------------------------+
                |
+------------------------------------------+
|  Check Request Limits                     |
|  +-- Burst limit (recent requests)        |
|  +-- Per-minute limit                     |
|  +-- Per-hour limit                       |
+------------------------------------------+
                |
+------------------------------------------+
|  Allow or Reject                          |
|  +-- Allowed --> Record request           |
|  +-- Rejected --> Return 429 + Retry-After|
+------------------------------------------+
```

### Failure Policy (Fail Closed)

If the rate limiter throws unexpectedly (e.g., infrastructure/runtime error), the wrapper **fails closed** and returns **503 Service Unavailable** with a `Retry-After` header. This prevents silent bypass of rate limiting during partial failures.

### Auth-Aware Rate Limiting

```typescript
// Different limits based on authentication status
export const GET = withProtection(handler, {
  auth: { required: false }, // optional auth
  rateLimit: {
    authAware: {
      publicLimitKey: "public-default",        // 60/min
      authenticatedLimitKey: "authenticated-default" // 120/min
    }
  }
});
```

**Flow:**

```
Request --> Check Auth Status
            |
        Authenticated?
        +-- YES --> Use authenticated-default limits
        +-- NO  --> Use public-default limits
            |
        Apply Selected Limit
```

---

## Bot Blocking Architecture

### Detection Strategy

```typescript
// Known bot patterns (User-Agent substrings)
const BOT_PATTERNS = [
  'bot', 'crawler', 'spider', 'scraper',
  'googlebot', 'bingbot', 'yandexbot',
  'curl', 'wget', 'python-requests',
  // ... more patterns
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}
```

### Blocking Flow

```
+------------------------------------------+
|  Extract User-Agent Header                |
+------------------------------------------+
                |
+------------------------------------------+
|  Check Against Bot Patterns               |
|  +-- Case-insensitive matching            |
|  +-- Substring search (fast)              |
+------------------------------------------+
                |
          +-----+-----+
          |  Is Bot?  |
          +-----+-----+
          +-- YES: Return 403 immediately
          +-- NO:  Continue to next layer
```

**Why Bot Blocking First?**
- Fastest check (no I/O, no state)
- Blocks malicious traffic early
- Prevents bots from consuming rate limit quota
- Reduces load on downstream layers

---

## Type Safety Architecture

### Handler Type Inference

```typescript
// Required auth --> handler receives AuthenticatedContext
export const GET = withProtection(
  async (req, { user, supabase, params }: AuthenticatedContext) => {
    user.id // TypeScript knows user exists
    params.id // TypeScript knows params are resolved
  },
  { auth: { required: true } }
);

// Optional auth --> handler receives optional user
export const GET = withProtection(
  async (req, { user, supabase, params }) => {
    user?.id // TypeScript enforces null check
    params.id // TypeScript knows params are resolved
  },
  { auth: { required: false } }
);

// No auth --> handler receives base context
export const GET = withProtection(
  async (req, context?) => {
    // No user available
  }
);
```

### Type Guards

```typescript
// Type narrowing based on options
function withProtection<T extends ProtectionOptions>(
  handler: T['auth'] extends { required: true }
    ? AuthenticatedHandler
    : T['auth'] extends { required: false }
    ? OptionalAuthHandler
    : RouteHandler,
  options?: T
): RouteHandler;
```

---

## Security Considerations

### Defense in Depth

1. **Bot Blocking:** First line of defense against automated abuse
2. **Rate Limiting:** Prevents DoS and resource exhaustion
3. **Authentication:** Ensures user identity and permissions
4. **Error Handling:** Prevents information leakage in errors

### Security Headers

```typescript
// Applied to all responses
const DEFAULT_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

### Rate Limit Response Headers

```typescript
// Informational headers for clients
response.headers.set('X-RateLimit-Limit', '60');
response.headers.set('X-RateLimit-Remaining', '45');
response.headers.set('X-RateLimit-Reset', '2026-01-04T12:01:00Z');
response.headers.set('Retry-After', '15'); // Only on 429
```

---

## Backward Compatibility Strategy

### Deprecation Path

```
Phase 1 (Current): Dual Support
+-- Old imports work: lib/middleware/rate-limiter.ts
+-- New imports preferred: lib/middleware/api-wrappers.ts
+-- Old signatures work with overloads

Phase 2 (Future): Soft Deprecation
+-- Add JSDoc @deprecated tags
+-- TypeScript warnings for old patterns
+-- Migration guide in documentation

Phase 3 (Far Future): Hard Deprecation
+-- Remove old imports (after all routes migrated)
+-- Remove overloaded signatures
+-- Single canonical API
```

### Signature Compatibility

```typescript
// Old signature (string key)
withBotBlockingAndRateLimit(handler, "public-default")

// New signature (options object)
withBotBlockingAndRateLimit(handler, { key: "public-default" })

// Implementation uses overload:
export function withBotBlockingAndRateLimit(
  handler: RouteHandler,
  options: WithRateLimitOptions | RateLimitKey // Union type for compatibility
): RouteHandler {
  // Normalize to options object
  const opts = typeof options === 'string'
    ? { key: options }
    : options;

  return withBotBlocking(withRateLimit(handler, opts));
}
```

---

## Testing Architecture

### Unit Test Coverage

```typescript
// Test each wrapper independently
describe("withAuth", () => {
  it("rejects unauthenticated requests when required");
  it("allows unauthenticated requests when optional");
  it("injects user and supabase into context");
  it("handles auth errors gracefully");
  it("resolves Promise params before passing to handler"); // NEW
  it("handles non-Promise params correctly"); // NEW
});

describe("withRateLimit", () => {
  it("allows requests within limits");
  it("blocks requests exceeding limits");
  it("returns Retry-After header on 429");
  it("resets limits after time window");
});

describe("withBotBlocking", () => {
  it("blocks known bot user agents");
  it("allows legitimate user agents");
  it("returns 403 for bots");
});

describe("withProtection", () => {
  it("composes wrappers in correct order");
  it("applies only enabled protections");
  it("passes context through layers");
  it("resolves params for dynamic routes"); // NEW
});
```

### Integration Test Coverage

```typescript
// Test full request lifecycle
describe("Protected API routes", () => {
  it("handles public endpoint with full protection");
  it("handles authenticated endpoint with rate limiting");
  it("handles optional auth with adaptive rate limits");
  it("returns consistent error responses");
  it("handles dynamic route params correctly"); // NEW
});
```

---

## File Organization

```
lib/middleware/
+-- api-wrappers/
|   +-- index.ts              # Re-exports all wrappers and types
|   +-- types.ts              # Type definitions (RouteContext, AuthenticatedContext, etc.)
|   +-- auth-wrapper.ts       # withAuth, createApiHandler (includes params resolution)
|   +-- error-handler.ts      # withErrorHandler
|   +-- rate-limit-wrapper.ts # withRateLimit, withBotBlockingAndRateLimit
|   +-- protection-wrappers.ts # withProtection
|   +-- validation-helpers.ts # validateUuidParam, validateRequiredParams
|   +-- ownership-helpers.ts  # requireOwnership
|   +-- response-utils.ts     # Re-exports from api-utils
+-- bot-blocker.ts            # Bot detection logic (imported by api-wrappers)
+-- rate-limiter.ts           # DEPRECATED - re-exports from api-wrappers
```

---

## Future Extensibility

### Planned Wrapper Types

1. **CORS Wrapper:** `withCORS(handler, corsOptions)`
2. **Request Validation:** `withValidation(handler, zodSchema)`
3. **Response Caching:** `withCache(handler, cacheOptions)`
4. **Logging/Telemetry:** `withLogging(handler, logOptions)`
5. **Feature Flags:** `withFeatureFlag(handler, flagKey)`
6. **A/B Testing:** `withExperiment(handler, experimentId)`

### Extension Pattern

```typescript
// New wrappers follow same pattern
export function withCORS(
  handler: RouteHandler,
  options: CORSOptions
): RouteHandler {
  return async (request, context) => {
    // CORS logic
    const response = await handler(request, context);
    // Add CORS headers
    return response;
  };
}

// Integrates with unified wrapper
export const GET = withProtection(handler, {
  auth: { required: true },
  rateLimit: { key: "public-default" },
  cors: { origins: ["https://example.com"] } // Future
});
```

### Open Questions for Future Development

1. **Should we enforce a maximum wrapper depth?**
   - Risk: deeply nested wrappers could impact performance
   - Mitigation: unified wrapper prevents manual nesting

2. **Should we add telemetry to track wrapper usage?**
   - Could help identify migration progress
   - Could identify performance bottlenecks

3. **Should we add development-mode warnings?**
   - Warn when using deprecated signatures
   - Warn when wrapper order is suboptimal

---

**For usage examples and daily development guide, see `/docs/API_MIDDLEWARE.md`**
