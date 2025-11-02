# Social Sharing: Security & Performance Guide

**Date**: October 31, 2025
**Feature**: QuiverSurf Session Sharing
**Audience**: Engineering Team, DevOps, Security

---

## Table of Contents

1. [Security Guidelines](#security-guidelines)
2. [Performance Optimization](#performance-optimization)
3. [Monitoring & Alerting](#monitoring--alerting)
4. [Cost Management](#cost-management)
5. [Incident Response](#incident-response)

---

## Security Guidelines

### 1. Rate Limiting

#### 🔴 **CRITICAL - Must Implement Before Production**

**Problem**: Image generation is CPU-intensive and vulnerable to abuse.

**Solution**: Implement IP-based rate limiting using Upstash Redis.

#### Implementation

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const imageLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
  analytics: true,
  prefix: "ratelimit:share-image",
});

export const shareLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 d"), // 100 shares per day
  analytics: true,
  prefix: "ratelimit:share-action",
});
```

```typescript
// app/api/sessions/[id]/share-image/route.ts
import { imageLimiter } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Rate limit check
  const identifier = request.ip ?? "anonymous";
  const { success, limit, reset, remaining } = await imageLimiter.limit(identifier);

  if (!success) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
        "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    });
  }

  // Continue with image generation...
}
```

#### Configuration

**Environment Variables** (`.env.local`):
```env
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

#### Rate Limit Tiers

| User Type | Image Generation | Share Actions | Notes |
|-----------|-----------------|---------------|-------|
| **Anonymous** | 10/minute | N/A | IP-based |
| **Authenticated** | 30/minute | 100/day | User ID-based |
| **Premium** | 100/minute | Unlimited | Future tier |

#### Monitoring

```typescript
// Track rate limit hits
track("rate_limit_exceeded", {
  identifier: request.ip,
  endpoint: "/api/sessions/[id]/share-image",
  limit: 10,
  window: "1m",
});
```

---

### 2. Input Validation

#### Type Guards (Runtime Validation)

```typescript
// types/session-share.ts
export function isShareVariant(value: unknown): value is ShareVariant {
  return typeof value === "number" && value >= 1 && value <= 6;
}

export function isAspectRatio(value: unknown): value is AspectRatio {
  const validRatios: AspectRatio[] = ["1:1", "4:5", "9:16"];
  return typeof value === "string" && validRatios.includes(value as AspectRatio);
}
```

#### API Route Validation

```typescript
// app/api/sessions/[id]/share-image/route.ts
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const variantParam = searchParams.get("variant");
  const ratioParam = searchParams.get("ratio");

  // Validate variant
  const variantNum = variantParam ? parseInt(variantParam, 10) : 1;
  if (!isShareVariant(variantNum)) {
    return NextResponse.json(
      { error: "Invalid variant. Must be 1-6." },
      { status: 400 }
    );
  }

  // Validate aspect ratio
  const aspectRatio = (ratioParam as AspectRatio) || "1:1";
  if (!isAspectRatio(aspectRatio)) {
    return NextResponse.json(
      { error: "Invalid aspect ratio. Must be '1:1', '4:5', or '9:16'." },
      { status: 400 }
    );
  }

  // Continue...
}
```

#### Database Constraints

```sql
-- supabase/migrations/XXXXXX_session_shares_constraints.sql
ALTER TABLE session_shares
  ADD CONSTRAINT session_shares_variant_check
    CHECK (variant IN ('1', '2', '3', '4', '5', '6'));

ALTER TABLE session_shares
  ADD CONSTRAINT session_shares_aspect_ratio_check
    CHECK (aspect_ratio IN ('1:1', '4:5', '9:16'));

ALTER TABLE session_shares
  ADD CONSTRAINT session_shares_platform_check
    CHECK (platform IN ('instagram', 'x', 'facebook', 'generic', 'download'));
```

---

### 3. Authentication & Authorization

#### Two Endpoints: Public vs Authenticated

The social sharing feature has **TWO separate endpoints** for image generation:

**1. Public OG Image Endpoint** (`/api/og/session/[sessionId]`)
- **Purpose**: Social media crawlers (Facebook, Twitter, LinkedIn)
- **Authentication**: ❌ None required
- **Access**: Only public sessions (`is_public = true`)
- **Rate Limiting**: ❌ None (crawlers need unrestricted access)
- **Tracking**: ❌ No tracking
- **Cache**: 1 hour (`max-age=3600`)
- **Aspect Ratio**: Fixed 1:1 (1200x630 for OG images)
- **Usage**: Set in `og:image` and `twitter:image` metadata tags

**2. Authenticated Share Image Endpoint** (`/api/sessions/[id]/share-image`)
- **Purpose**: User-initiated image downloads
- **Authentication**: ✅ Required
- **Access**: Public sessions OR user's private sessions
- **Rate Limiting**: ✅ 10/min, 100/hour per user
- **Tracking**: ✅ Records to `session_shares` table
- **Cache**: 7 days (`max-age=604800`)
- **Aspect Ratio**: All ratios (1:1, 4:5, 9:16)
- **Usage**: Direct user downloads via ShareBar component

#### Critical: Use the Correct Endpoint

**✅ Correct - Public Page Metadata**:
```typescript
// app/s/[sessionId]/page.tsx
export async function generateMetadata({ params }) {
  return buildPageMetadata({
    image: `/api/og/session/${params.sessionId}?variant=1`, // ✅ Public endpoint
  });
}
```

**❌ Incorrect - Would cause 401 errors for crawlers**:
```typescript
// DON'T DO THIS
image: `/api/sessions/${params.sessionId}/share-image?variant=1&ratio=1:1`, // ❌ Requires auth
```

**Why this matters**: Social media crawlers (Facebook, Twitter, LinkedIn) are unauthenticated. If the `og:image` points to an authenticated endpoint, crawlers get 401 errors and social cards won't display images.

#### Public vs Private Sessions

**Decision Matrix**:

| Session State | Image Generation | Share Tracking | Public Page |
|--------------|------------------|----------------|-------------|
| `is_public = true` | ✅ Allow | ✅ Allow (if authenticated) | ✅ Show |
| `is_public = false` | ❌ 403 Forbidden | ✅ Allow (owner only) | ❌ 403 Forbidden |

**Implementation**:

```typescript
// Check public flag
const { data: session, error } = await supabase
  .from("sessions")
  .select("*, is_public")
  .eq("id", sessionId)
  .single();

if (!session.is_public) {
  return new NextResponse(
    JSON.stringify({ error: "Session is not public" }),
    { status: 403 }
  );
}
```

#### Row Level Security (RLS)

```sql
-- session_shares table: Only authenticated users can insert
CREATE POLICY "Users can insert own shares"
  ON session_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- sessions table: Public sessions readable by all
CREATE POLICY "Public sessions readable"
  ON sessions
  FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);
```

---

### 4. SQL Injection Prevention

#### ✅ Safe Pattern (Supabase Query Builder)

```typescript
// SAFE: Parameterized query
const { data } = await supabase
  .from("sessions")
  .select("*")
  .eq("id", sessionId); // Automatically escaped

// SAFE: RPC with typed parameters
await supabase.rpc("increment_session_share_count", {
  session_id: sessionId, // UUID type enforced
});
```

#### ❌ Unsafe Pattern (Never Do This)

```typescript
// UNSAFE: String interpolation
const query = `SELECT * FROM sessions WHERE id = '${sessionId}'`;
// Vulnerable to SQL injection!
```

---

### 5. CORS Configuration

#### Current Setup (Permissive)

```typescript
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Allow all origins
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
```

**Rationale**: Social media crawlers need access to images.

#### Alternative (Restrictive)

```typescript
// Only allow QuiverSurf domains
"Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app"
```

**Trade-off**: More secure, but may break embedding on other sites.

---

### 6. Secret Management

#### Environment Variables

**Never commit secrets to Git!**

```.env.local (gitignored)
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...public-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...secret-service-key

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Rate Limiting
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=secret-token-here

# Image Generation (Optional)
SOCIAL_SHARE_SECRET=random-secret-for-signed-urls
```

#### Vercel Environment Variables

1. **Development**: `.env.local`
2. **Preview**: Vercel Dashboard → Settings → Environment Variables → Preview
3. **Production**: Vercel Dashboard → Settings → Environment Variables → Production

**Sensitive Variables**: Check "Encrypted" checkbox in Vercel.

---

### 7. Error Message Security

#### ✅ Safe Error Messages (Production)

```typescript
// User-friendly, no sensitive info
return NextResponse.json(
  { error: "Failed to generate image" },
  { status: 500 }
);
```

#### ❌ Unsafe Error Messages (Avoid)

```typescript
// Exposes stack trace, file paths
return NextResponse.json(
  { error: error.message, stack: error.stack },
  { status: 500 }
);
```

#### Logging Strategy

```typescript
try {
  const image = await renderSessionCardImage(...);
  return new NextResponse(image.png, ...);
} catch (error) {
  // Log detailed error server-side
  console.error("Image generation failed:", {
    sessionId,
    variant,
    aspectRatio,
    error: error.message,
    stack: error.stack,
  });

  // Send to error tracking (Sentry)
  Sentry.captureException(error, {
    tags: { feature: "social-share", variant, aspectRatio },
  });

  // Return generic error to client
  return NextResponse.json(
    { error: "Failed to generate image" },
    { status: 500 }
  );
}
```

---

## Performance Optimization

### 1. Image Generation Performance

#### Current Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Generation Time | <2s | 900ms - 2.5s | ✅ Pass |
| File Size (1:1/4:5) | <350KB | 150-304KB | ✅ Pass |
| File Size (9:16) | <500KB | 226-377KB | ✅ Pass |

#### Optimization Strategies

**1. Font Loading Optimization**

```typescript
// Current: Load all fonts on every request
const fonts = await loadFonts();

// Optimized: Lazy load fonts per variant
const fontsForVariant = {
  1: ["NotoSans"],
  2: ["NotoSans"],
  3: ["Roboto"],
  4: ["OpenSans"],
  5: ["Montserrat"],
  6: ["Inter"],
};

const fonts = await loadFonts(fontsForVariant[variant]);
```

**2. Font Subsetting**

```bash
# Install pyftsubset
pip install fonttools

# Extract only used glyphs
pyftsubset NotoSans-Regular.ttf \
  --text="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ⭐•°-ft/mph" \
  --output-file=NotoSans-Regular.subset.ttf
```

**Benefit**: 560KB → ~100KB (82% reduction)

**3. Image Compression**

```typescript
import { Resvg } from "@resvg/resvg-js";

// Add compression options
const resvg = new Resvg(svg, {
  fitTo: {
    mode: "width",
    value: dimensions.width,
  },
  font: {
    loadSystemFonts: false,
  },
  // Add compression
  imageRendering: 1, // 0 = optimizeSpeed, 1 = optimizeQuality
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

// Future: Add sharp for additional compression
import sharp from "sharp";

const optimized = await sharp(pngBuffer)
  .png({ quality: 85, compressionLevel: 9 })
  .toBuffer();
```

---

### 2. Caching Strategy

#### Multi-Layer Cache

```
Request Flow:
  User → Browser Cache (7 days)
       → CDN/Edge Cache (7 days)
       → Origin (API Route)
       → Image Generation (1-2s)
```

#### Cache Headers

```typescript
return new NextResponse(image.png, {
  status: 200,
  headers: {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=604800, immutable",
    "Content-Length": image.png.byteLength.toString(),
    "X-Content-Type-Options": "nosniff",
  },
});
```

#### Cache Invalidation

**Current**: No invalidation needed (immutable URLs)

**Future**: If session data changes, URL stays same but image is stale
- Option 1: Add version query param (`?v=2`)
- Option 2: Purge CDN cache via Vercel API

---

### 3. Pre-Generation Strategy

#### Current: On-Demand Generation

```
User requests image → Generate → Cache → Return
First request: 1-2s
Subsequent: <50ms (CDN cache hit)
```

#### Future: Pre-Generation (Recommended)

```typescript
// After session creation
async function onSessionCreated(sessionId: string) {
  const popularVariants = [
    { variant: 3, ratio: "9:16" }, // Most popular for Instagram Stories
    { variant: 1, ratio: "1:1" },  // Default OG image
  ];

  // Pre-generate in background
  await Promise.allSettled(
    popularVariants.map(({ variant, ratio }) =>
      fetch(`/api/sessions/${sessionId}/share-image?variant=${variant}&ratio=${ratio}`)
    )
  );
}
```

**Benefits**:
- First share is instant (already cached)
- Reduces peak load (distributed over time)
- Better user experience

**Implementation**: Use Inngest, BullMQ, or Vercel Cron Job

---

### 4. Async Job Queue (Scalability)

#### Problem

Synchronous image generation blocks HTTP request for 1-2 seconds.

**Issues**:
- Poor perceived performance
- API gateway timeout risk (30s limit)
- Difficult to scale horizontally

#### Solution: Async Job Queue

```typescript
// 1. User clicks share → Create job → Return immediately
const { jobId } = await queue.enqueue("generate-share-image", {
  sessionId,
  variant,
  aspectRatio,
});

return NextResponse.json({
  jobId,
  statusUrl: `/api/jobs/${jobId}/status`,
});

// 2. Background worker generates image → Upload to S3
async function generateShareImage({ sessionId, variant, aspectRatio }) {
  const image = await renderSessionCardImage(...);

  // Upload to S3/R2
  const key = `shares/${sessionId}/${variant}/${aspectRatio}.png`;
  await s3.putObject({ Bucket: "quiver-shares", Key: key, Body: image.png });

  return { url: `https://cdn.quiversurf.app/${key}` };
}

// 3. Client polls status → Redirect when ready
const { status, url } = await fetch(`/api/jobs/${jobId}/status`);
if (status === "completed") {
  window.location.href = url;
}
```

**Tools**:
- [Inngest](https://www.inngest.com/) - Serverless job queue
- [BullMQ](https://docs.bullmq.io/) - Redis-based queue
- [Vercel Queues](https://vercel.com/docs/functions/queues) - Native integration

---

### 5. Database Query Optimization

#### Indexes

```sql
-- Already created in migration
CREATE INDEX idx_session_shares_analytics
  ON session_shares(platform, variant, aspect_ratio, created_at);

-- Additional indexes for common queries
CREATE INDEX idx_sessions_public ON sessions(is_public) WHERE is_public = true;
CREATE INDEX idx_sessions_share_count ON sessions(share_count DESC);
```

#### Query Patterns

**Optimized** (uses index):
```typescript
const { data } = await supabase
  .from("session_shares")
  .select("*")
  .eq("platform", "instagram")
  .gte("created_at", startDate)
  .lte("created_at", endDate);
```

**Slow** (full table scan):
```typescript
const { data } = await supabase
  .from("session_shares")
  .select("*")
  .ilike("share_url", "%instagram%"); // No index on share_url
```

---

## Monitoring & Alerting

### 1. Key Metrics to Track

#### Application Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Image generation time (p95) | <2s | >3s |
| Image generation error rate | <1% | >5% |
| File size (p95) | <400KB | >500KB |
| API response time (p95) | <100ms (cached) | >500ms |
| Share conversion rate | >20% | <15% |

#### Infrastructure Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| CDN cache hit rate | >80% | <70% |
| Serverless function cold starts | <10% | >20% |
| Database connection pool usage | <80% | >90% |
| Memory usage (image gen) | <512MB | >800MB |

#### Business Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Daily shares | 100+ | <50 |
| Share rate (% of sessions) | 20% | <10% |
| Shares per user | 3+ | <1 |
| Variant 3 popularity | 30% | <20% |

---

### 2. Error Tracking

#### Sentry Integration

```typescript
// app/api/sessions/[id]/share-image/route.ts
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  try {
    // Image generation
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        feature: "social-share",
        endpoint: "share-image",
        variant: variantNum,
        aspectRatio,
      },
      extra: {
        sessionId,
        userAgent: request.headers.get("user-agent"),
        ip: request.ip,
      },
    });

    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
```

#### Error Categories

1. **Font Loading Errors**: Missing font files
2. **Satori Rendering Errors**: Invalid React elements
3. **Resvg Conversion Errors**: SVG parsing failures
4. **Database Errors**: Connection timeouts, constraint violations
5. **Rate Limit Errors**: Exceeded quota (not a failure, but tracked)

---

### 3. Performance Monitoring

#### Vercel Analytics

Enable in `next.config.js`:
```javascript
module.exports = {
  analytics: {
    id: process.env.VERCEL_ANALYTICS_ID,
  },
};
```

Tracks:
- Real User Monitoring (RUM)
- Core Web Vitals (LCP, FID, CLS)
- API route performance

#### Custom Performance Tracking

```typescript
import { track } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const image = await renderSessionCardImage(...);
    const duration = Date.now() - startTime;

    // Track generation time
    track("image_generation_time", {
      duration,
      variant: variantNum,
      aspectRatio,
      fileSize: image.png.byteLength,
    });

    return new NextResponse(image.png, ...);
  } catch (error) {
    const duration = Date.now() - startTime;

    track("image_generation_error", {
      duration,
      error: error.message,
    });

    throw error;
  }
}
```

---

### 4. Alerting Rules

#### PagerDuty / Opsgenie Configuration

**Critical Alerts** (P1 - Immediate Response):
- Image generation error rate >10% for 5 minutes
- API downtime >1 minute
- Database connection failures

**High Priority Alerts** (P2 - Response within 1 hour):
- Image generation time p95 >3s for 15 minutes
- CDN cache hit rate <60% for 30 minutes
- Share conversion rate <10% for 1 day

**Medium Priority Alerts** (P3 - Response within 4 hours):
- File sizes >500KB for 50+ images
- Font loading errors >5% for 1 hour

**Low Priority Alerts** (P4 - Review weekly):
- Variant popularity shifts (track trends)
- Share count anomalies

---

## Cost Management

### 1. Cost Breakdown

#### Current Costs (Estimated per 1,000 shares)

| Service | Cost | Notes |
|---------|------|-------|
| **Vercel Serverless Functions** | $0.50 | 1.5s avg × 1,000 invocations |
| **Vercel Edge Network (CDN)** | $0.10 | 300KB avg × 1,000 requests |
| **Supabase Database** | $0.05 | 1,000 inserts to session_shares |
| **Upstash Redis (Rate Limit)** | $0.02 | 1,000 rate limit checks |
| **Total per 1,000 shares** | **$0.67** | **$0.67 CPM** |

#### Projected Monthly Costs

| Shares/Month | Serverless | CDN | Database | Total |
|--------------|------------|-----|----------|-------|
| 10,000 | $5.00 | $1.00 | $0.50 | $6.50 |
| 100,000 | $50.00 | $10.00 | $5.00 | $65.00 |
| 1,000,000 | $500.00 | $100.00 | $50.00 | $650.00 |

---

### 2. Cost Optimization Strategies

#### 1. Cache Hit Rate Optimization

**Current**: 7-day cache → ~80% hit rate (estimated)

**Improvement**: Pre-generate popular variants → 95% hit rate

**Savings**: $500 → $100 (80% reduction in serverless costs)

#### 2. Image Compression

**Current**: 150-377KB per image

**Optimized**: 100-250KB per image (33% reduction)

**Savings**: $10 CDN cost → $7 per 100k shares

#### 3. Font Subsetting

**Current**: Load 9 full fonts (2.5MB total)

**Optimized**: Load subsetted fonts (500KB total)

**Benefit**: Faster cold starts, lower memory usage

#### 4. Async Job Queue

**Current**: Synchronous generation (1-2s serverless duration)

**Optimized**: Async generation → batch processing → cheaper workers

**Savings**: $500 → $200 (60% reduction via cheaper compute tier)

---

### 3. Cost Monitoring

#### Vercel Usage Dashboard

Monitor:
- Serverless function execution time (seconds)
- Bandwidth usage (GB)
- Edge requests (count)

#### Alerts

```typescript
// Alert if costs exceed budget
if (monthlyServerlessCost > 100) {
  sendAlert("Serverless costs exceeding $100/month");
}

if (cdnBandwidth > 100_000_000_000) { // 100 GB
  sendAlert("CDN bandwidth exceeding 100GB/month");
}
```

---

## Incident Response

### 1. Incident Runbook

#### Incident: Image Generation Failures (>10% error rate)

**Symptoms**:
- Users report "Failed to generate image" errors
- Sentry shows spike in errors
- API returns 500 status codes

**Investigation Steps**:

1. **Check Sentry** for error details
   - Look for common error pattern (font loading? Satori crash?)

2. **Check Vercel Logs** for serverless function errors
   ```bash
   vercel logs --follow
   ```

3. **Check Font Files** in `/public/fonts/`
   ```bash
   ls -lh public/fonts/*/
   ```

4. **Test Image Generation Locally**
   ```bash
   curl http://localhost:3000/api/sessions/[test-id]/share-image?variant=1&ratio=1:1
   ```

**Resolution**:

- **If font loading error**: Re-run `node scripts/fetch-fonts.mjs`
- **If Satori error**: Check for invalid React elements in variant renderers
- **If Resvg error**: Check SVG validity, update @resvg/resvg-js version

**Rollback Plan**:
```bash
vercel rollback
```

---

#### Incident: Rate Limit Exceeded (429 responses)

**Symptoms**:
- Users report "Too Many Requests" errors
- High 429 response rate in metrics

**Investigation Steps**:

1. **Check Upstash Redis** for rate limit metrics
   ```bash
   redis-cli GET ratelimit:share-image:192.168.1.1
   ```

2. **Identify source** (IP address, user ID)

3. **Determine if legitimate** (viral share? bot attack?)

**Resolution**:

- **If bot attack**: Block IP at edge (Vercel Firewall)
- **If legitimate traffic**: Increase rate limit temporarily
  ```typescript
  const limiter = new Ratelimit({
    limiter: Ratelimit.slidingWindow(50, "1 m"), // Increase to 50
  });
  ```

---

#### Incident: High CDN Costs

**Symptoms**:
- Vercel bill shows high bandwidth usage
- >100 GB/month for images

**Investigation Steps**:

1. **Check top URLs** in Vercel Analytics
2. **Check cache hit rate** (should be >80%)
3. **Check for bot crawling** (user agents)

**Resolution**:

- **If cache misconfigured**: Verify `Cache-Control` headers
- **If bot crawling**: Add robots.txt, block user agents
- **If legitimate growth**: Optimize file sizes (see Performance section)

---

### 2. Health Check Endpoint

```typescript
// app/api/health/share/route.ts
export async function GET() {
  const checks = {
    fonts: await checkFonts(),
    database: await checkDatabase(),
    redis: await checkRedis(),
  };

  const healthy = Object.values(checks).every((c) => c.healthy);

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}

async function checkFonts() {
  try {
    const fonts = await loadFonts();
    return {
      healthy: fonts.length > 0,
      available: fonts.length,
      expected: 9,
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

**Monitoring**: Ping this endpoint every 5 minutes, alert if unhealthy.

---

### 3. Feature Flags

```typescript
// lib/feature-flags.ts
export const FEATURE_FLAGS = {
  SOCIAL_SHARING_ENABLED: process.env.NEXT_PUBLIC_ENABLE_SOCIAL_SHARING === "true",
  PRE_GENERATION_ENABLED: process.env.ENABLE_PRE_GENERATION === "true",
  ASYNC_QUEUE_ENABLED: process.env.ENABLE_ASYNC_QUEUE === "true",
};

// Usage
if (!FEATURE_FLAGS.SOCIAL_SHARING_ENABLED) {
  return NextResponse.json(
    { error: "Social sharing is temporarily disabled" },
    { status: 503 }
  );
}
```

**Kill Switch**: Disable feature immediately via environment variable.

---

## Appendix

### A. Security Checklist

- [ ] Rate limiting implemented (Upstash Redis)
- [ ] Input validation (type guards + DB constraints)
- [ ] Authentication checks (is_public flag)
- [ ] SQL injection prevention (query builder only)
- [ ] CORS configured (permissive or restrictive)
- [ ] Secrets in environment variables (not committed)
- [ ] Error messages sanitized (no stack traces to client)
- [ ] Sentry error tracking configured
- [ ] Row Level Security (RLS) policies enabled

### B. Performance Checklist

- [ ] Cache headers configured (7-day max-age)
- [ ] Image file sizes meet targets (<350KB/500KB)
- [ ] Generation time meets target (<2s)
- [ ] Font loading optimized (lazy loading or subsetting)
- [ ] Database indexes created (analytics queries)
- [ ] CDN cache hit rate >80%
- [ ] Pre-generation strategy (optional but recommended)

### C. Monitoring Checklist

- [ ] Vercel Analytics enabled
- [ ] Sentry error tracking configured
- [ ] Custom performance metrics tracked
- [ ] Alerts configured (PagerDuty/Opsgenie)
- [ ] Health check endpoint deployed
- [ ] Cost monitoring alerts set

### D. Useful Commands

```bash
# Check font availability
ls -lh public/fonts/*/

# Download fonts
node scripts/fetch-fonts.mjs

# Test image generation locally
curl http://localhost:3000/api/sessions/[id]/share-image?variant=3&ratio=9:16 > test.png

# Check database migrations
npx supabase db push --dry-run

# View Vercel logs
vercel logs --follow

# Deploy to production
vercel deploy --prod

# Rollback deployment
vercel rollback
```

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Owner**: Engineering Team
**Next Review**: December 1, 2025 (30 days post-launch)
