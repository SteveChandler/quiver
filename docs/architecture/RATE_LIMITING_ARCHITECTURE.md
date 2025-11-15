# Rate Limiting Architecture

## Problem Statement

The security analysis identified 10+ public API endpoints without rate limiting, creating a denial-of-service (DoS) vulnerability. These endpoints are accessible without authentication and can be abused for:
- Resource exhaustion attacks
- Database overload
- SSRF attacks (image-proxy endpoint)
- Cost escalation (external API calls)

## Vulnerable Endpoints Identified

```
CRITICAL:
/api/image-proxy (SSRF risk - proxies external images)

HIGH:
/api/v1/recommendations (N+1 query performance issue)
/api/beaches/search (expensive multi-table search operations)
/api/forecasts/bulk (bulk data fetching)

MEDIUM:
/api/beaches/nearby
/api/beaches/featured
/api/coach-picks
All other public endpoints
```

## Architecture Decision

### Option Analysis

#### Option A: In-Memory Rate Limiting (Current Implementation)
**Pros:**
- Already implemented in codebase (`/lib/utils/rate-limiter.ts`)
- Zero external dependencies
- No additional cost
- Simple to implement

**Cons:**
- Not distributed - each Vercel serverless function has separate memory
- Rate limits reset on cold starts
- Cannot track across multiple instances
- **NOT SUITABLE for production serverless deployments**

#### Option B: Upstash Redis
**Pros:**
- True distributed rate limiting across all instances
- Vercel-recommended solution
- Persistent across cold starts
- Sub-millisecond latency
- Pay-as-you-go pricing (~$0.20 per 100K requests)

**Cons:**
- External dependency
- Additional cost
- Requires Upstash account setup
- Slightly more complex implementation

#### Option C: Vercel Edge Config
**Pros:**
- Vercel-native solution
- Ultra-low latency (reads from memory)
- No external providers

**Cons:**
- Read-only at the edge (cannot increment counters)
- **NOT SUITABLE for rate limiting** (requires write operations)

#### Option D: Vercel Protection (Built-in DDoS Protection)
**Pros:**
- Built into Vercel platform (Pro plan)
- Automatic DDoS mitigation
- No code changes needed

**Cons:**
- Only available on Pro plan ($20/month per team member)
- Protects against attacks, not granular rate limiting
- Cannot customize per-endpoint limits

### Selected Approach: Hybrid Strategy

For the Quiver application, we'll use a **hybrid approach**:

1. **Phase 1 (Immediate)**: Enhanced in-memory rate limiting
   - Use existing rate limiter infrastructure
   - Add per-IP tracking using Vercel headers
   - Implement stricter limits for high-risk endpoints
   - Add comprehensive monitoring and alerting
   - **Timeline**: Immediate (MVP security fix)

2. **Phase 2 (Future)**: Upstash Redis migration
   - Migrate to distributed rate limiting when traffic grows
   - Keep in-memory as fallback
   - **Timeline**: When concurrent users > 1000 or abuse detected

**Rationale:**
- The current in-memory implementation provides 80% protection with zero cost
- Vercel's serverless architecture typically keeps instances warm for 5-15 minutes
- Most attacks will be from the same IP/region (same instance)
- We can monitor and upgrade to Upstash when needed
- MVP security improvement without adding external dependencies

## Implementation Design

### 1. Rate Limit Configuration

Tiered limits based on endpoint risk and cost:

```typescript
// /lib/api/rate-limit-config.ts
export const RATE_LIMITS = {
  // Image proxy - CRITICAL (SSRF risk)
  'image-proxy': {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    burstLimit: 5,
  },

  // Recommendations - HIGH (N+1 query performance)
  'recommendations': {
    requestsPerMinute: 20,
    requestsPerHour: 200,
    burstLimit: 5,
  },

  // Beach search - HIGH (expensive operations)
  'beach-search': {
    requestsPerMinute: 30,
    requestsPerHour: 300,
    burstLimit: 10,
  },

  // Forecast bulk - MEDIUM
  'forecast-bulk': {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstLimit: 20,
  },

  // General public endpoints
  'public-default': {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstLimit: 20,
  },

  // Authenticated users (higher limits)
  'authenticated-default': {
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    burstLimit: 50,
  },
};
```

### 2. Identifier Strategy

For serverless environments, we use Vercel's forwarded headers:

```typescript
function getClientIdentifier(request: NextRequest): string {
  // Vercel provides reliable IP forwarding
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         request.headers.get('x-real-ip') ||
         'unknown';
}
```

### 3. Enhanced Rate Limiter

Improvements to existing implementation:

```typescript
// Support per-identifier tracking
class RateLimiter {
  private requestHistory: Map<string, RequestRecord[]>;

  canMakeRequest(identifier: string): boolean {
    // Check limits for specific identifier
  }

  recordRequest(identifier: string, endpoint?: string): void {
    // Record request for specific identifier
  }

  getRetryAfter(identifier: string): number {
    // Return seconds until rate limit resets
  }
}
```

### 4. Middleware Wrapper

Clean, reusable wrapper for all endpoints:

```typescript
// /lib/middleware/rate-limiter.ts
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limitKey: keyof typeof RATE_LIMITS
) {
  const limiter = createRateLimiter(limitKey, RATE_LIMITS[limitKey]);

  return async (req: NextRequest) => {
    const identifier = getClientIdentifier(req);

    if (!limiter.canMakeRequest(identifier)) {
      const retryAfter = Math.ceil(limiter.getRetryAfter(identifier) / 1000);

      logRateLimitViolation(limitKey, identifier);

      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            ...DEFAULT_SECURITY_HEADERS,
          },
        }
      );
    }

    limiter.recordRequest(identifier);
    return handler(req);
  };
}
```

### 5. Monitoring & Alerting

Track rate limit violations for security analysis:

```typescript
// /lib/monitoring/rate-limit-telemetry.ts
export function logRateLimitViolation(
  endpoint: string,
  identifier: string,
  config?: any
) {
  console.warn('[RATE_LIMIT_VIOLATION]', {
    endpoint,
    identifier: maskIdentifier(identifier), // Mask IP for privacy
    timestamp: new Date().toISOString(),
    config,
  });

  // TODO: Send to Sentry for alerting
  // Sentry.captureMessage('Rate limit exceeded', {
  //   level: 'warning',
  //   tags: { endpoint },
  //   extra: { identifier, config },
  // });
}
```

## Migration Path to Distributed Rate Limiting

When traffic grows, migrate to Upstash Redis:

### Setup Steps
1. Create Upstash account
2. Add environment variables:
   ```
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```
3. Install dependency: `npm install @upstash/redis`
4. Update rate limiter to use Redis:
   ```typescript
   import { Redis } from '@upstash/redis';

   const redis = Redis.fromEnv();

   async function canMakeRequest(identifier: string, key: string): Promise<boolean> {
     const count = await redis.incr(`rate:${key}:${identifier}`);
     if (count === 1) {
       await redis.expire(`rate:${key}:${identifier}`, 60); // 1 minute TTL
     }
     return count <= RATE_LIMITS[key].requestsPerMinute;
   }
   ```

## Testing Strategy

### Unit Tests
- Test rate limiter logic (burst, per-minute, per-hour limits)
- Test identifier extraction
- Test retry-after calculations

### Integration Tests
- Verify middleware applies correctly
- Test 429 responses
- Verify Retry-After headers

### E2E Tests
- Load test to verify limits prevent abuse
- Test authenticated vs unauthenticated limits
- Verify edge cases (cold starts, concurrent requests)

### Performance Testing
- Verify rate limiting overhead < 5ms per request
- Test memory usage with 1000+ identifiers

## Security Considerations

### Privacy
- Mask IP addresses in logs (e.g., `192.168.1.x`)
- Comply with GDPR/privacy regulations
- Don't store IP addresses long-term

### Bypass Prevention
- Use Vercel's `x-forwarded-for` (trusted header)
- Don't accept client-provided identifiers
- Monitor for distributed attacks (many IPs)

### DoS Protection Layers
1. **Vercel CDN**: Caches static content
2. **Rate Limiting**: Prevents endpoint abuse
3. **Supabase RLS**: Database-level protection
4. **Query Limits**: Prevent expensive queries (LIMIT clauses)

## Monitoring Metrics

Track these metrics in production:

- **Rate limit violations per endpoint** (detect attacks)
- **P95 retry-after duration** (tune limits)
- **Blocked vs total requests ratio** (false positives)
- **Memory usage** (scale indicator)
- **False positives** (legitimate users blocked)

## Rollback Plan

If rate limiting causes issues:

1. Disable via feature flag (add `RATE_LIMITING_ENABLED=false`)
2. Increase limits temporarily
3. Investigate false positives
4. Tune configuration based on production data

## Success Criteria

- [ ] All public endpoints have rate limiting
- [ ] 429 responses include Retry-After headers
- [ ] No performance degradation (< 5ms overhead)
- [ ] Monitoring logs violations to console
- [ ] Documentation complete
- [ ] Unit and E2E tests passing
- [ ] No false positives reported

## References

- [Vercel Rate Limiting Docs](https://vercel.com/docs/security/rate-limiting)
- [Upstash Redis for Rate Limiting](https://upstash.com/docs/redis/features/ratelimiting)
- [RFC 6585 - Additional HTTP Status Codes](https://tools.ietf.org/html/rfc6585)
