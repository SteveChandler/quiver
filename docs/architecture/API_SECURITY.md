# API Security Documentation

## Overview

This document provides comprehensive security documentation for Quiver's API endpoints, including rate limiting policies, authentication requirements, and best practices for API consumers.

## Rate Limiting

All public API endpoints are protected by rate limiting to prevent abuse and ensure fair resource allocation.

### Rate Limit Policies

| Endpoint Category                               | Requests/Minute | Requests/Hour | Burst Limit | Notes                        |
| ----------------------------------------------- | --------------- | ------------- | ----------- | ---------------------------- |
| **Image Proxy** (`/api/image-proxy`)            | 10              | 100           | 5           | CRITICAL: SSRF protection    |
| **Recommendations** (`/api/v1/recommendations`) | 20              | 200           | 5           | Expensive N+1 queries        |
| **Beach Search** (`/api/beaches/search`)        | 30              | 300           | 10          | Complex search operations    |
| **Forecast Bulk** (`/api/forecasts/bulk`)       | 60              | 1000          | 20          | Bulk data fetching           |
| **Coach Picks** (`/api/coach-picks`)            | 60              | 1000          | 20          | RPC function calls           |
| **Public Endpoints** (general)                  | 60              | 1000          | 20          | Standard public access       |
| **Authenticated Endpoints**                     | 120             | 5000          | 50          | Higher limits for auth users |

### Understanding Rate Limits

#### Requests Per Minute

The maximum number of requests allowed in any 60-second rolling window.

#### Requests Per Hour

The maximum number of requests allowed in any 1-hour rolling window.

#### Burst Limit

The maximum number of rapid consecutive requests allowed. Prevents sudden spikes.

### Rate Limit Headers

All API responses include rate limit information in headers:

```http
X-RateLimit-Limit: 60          # Maximum requests per minute
X-RateLimit-Remaining: 45      # Requests remaining in current window
X-RateLimit-Reset: 2025-11-14T10:30:00Z  # When limit resets
```

### 429 Too Many Requests Response

When rate limit is exceeded, you'll receive:

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait before making more requests.",
  "retryAfter": 42, // Seconds until you can retry
  "timestamp": "2025-11-14T10:15:00Z"
}
```

**HTTP Headers:**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-11-14T10:16:00Z
```

### Best Practices for API Consumers

#### 1. Respect Rate Limits

Always check `X-RateLimit-Remaining` header and throttle requests accordingly:

```typescript
async function makeRequest(url: string) {
  const response = await fetch(url);

  // Check rate limit headers
  const remaining = parseInt(
    response.headers.get("X-RateLimit-Remaining") || "0"
  );

  if (remaining < 5) {
    // Approaching limit - slow down
    await delay(1000);
  }

  return response;
}
```

#### 2. Handle 429 Responses Gracefully

Implement exponential backoff when rate limited:

```typescript
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "60");
      console.log(`Rate limited. Retrying after ${retryAfter}s`);
      await delay(retryAfter * 1000);
      continue;
    }

    return response;
  }

  throw new Error("Max retries exceeded");
}
```

#### 3. Cache Responses

Many endpoints return cacheable data. Use ETags and Cache-Control headers:

```typescript
// Cache GET requests
const cache = new Map();

async function cachedFetch(url: string) {
  const cached = cache.get(url);

  const headers: HeadersInit = {};
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    // Not modified - use cached data
    return cached.data;
  }

  const etag = response.headers.get("ETag");
  const data = await response.json();

  if (etag) {
    cache.set(url, { data, etag });
  }

  return data;
}
```

#### 4. Batch Requests When Possible

Use bulk endpoints to reduce request count:

```typescript
// Bad: Multiple individual requests
for (const beachId of beachIds) {
  await fetch(`/api/forecasts/${beachId}`);
}

// Good: Single bulk request
const beachIdsParam = beachIds.join(",");
await fetch(`/api/forecasts/bulk?beachIds=${beachIdsParam}`);
```

## Endpoint Security Details

### Critical Endpoints

#### Image Proxy (`/api/image-proxy`)

**Risk:** Server-Side Request Forgery (SSRF)

**Protections:**

- Strict rate limiting (10 req/min)
- Domain whitelist (only approved image sources)
- No redirects followed
- User agent filtering

**Usage:**

```typescript
// Only whitelisted domains allowed
const allowedDomains = [
  "api.openverse.org",
  "upload.wikimedia.org",
  "live.staticflickr.com",
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
  "files.wordpress.com",
];

// Example: Proxy an image
const imageUrl = encodeURIComponent("https://api.openverse.org/image.jpg");
const proxyUrl = `/api/image-proxy?url=${imageUrl}`;
```

**Do NOT:**

- Try to proxy internal URLs (127.0.0.1, localhost, etc.)
- Use for non-image content
- Bypass domain whitelist

#### Recommendations (`/api/v1/recommendations`)

**Risk:** N+1 query performance issue

**Protections:**

- Rate limiting (20 req/min)
- Limited to 25 beaches per request
- Query timeout enforcement

**Usage:**

```typescript
// Get recommendations for location
const response = await fetch(
  "/api/v1/recommendations?lat=33.7701&lon=-118.1937&skill=intermediate"
);
```

**Do NOT:**

- Poll this endpoint continuously
- Make parallel requests
- Use for real-time updates (data updates hourly)

### Public Endpoints

All public endpoints follow these security principles:

1. **Input Validation:** All parameters validated and sanitized
2. **SQL Injection Protection:** Parameterized queries via Supabase
3. **XSS Protection:** Content-Security-Policy headers
4. **CSRF Protection:** SameSite cookies, CORS policies
5. **RLS Policies:** Row-level security in database

## Authentication

### Unauthenticated Access

Public endpoints allow anonymous access with standard rate limits.

### Authenticated Access

Authenticated users get higher rate limits. Include session token:

```typescript
const response = await fetch("/api/endpoint", {
  headers: {
    Cookie: "sb-access-token=...",
  },
});
```

**Benefits:**

- 2x higher rate limits
- Access to private data
- Personalized responses

## Security Headers

All API responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: geolocation=(self), camera=(), microphone=()
```

## CORS Policy

### Allowed Origins

Development: `http://localhost:3000`
Production: `https://www.quiversurf.app`, `https://*.vercel.app`

### Preflight Requests

OPTIONS requests are handled automatically. Include credentials:

```typescript
fetch("/api/endpoint", {
  credentials: "include", // Include cookies
});
```

## Monitoring & Abuse Detection

### Violation Logging

Rate limit violations are logged for security monitoring:

```json
{
  "endpoint": "beach-search",
  "identifier": "192.168.1.x", // IP masked for privacy
  "timestamp": "2025-11-14T10:15:00Z",
  "limits": {
    "perMinute": 30,
    "perHour": 300,
    "burst": 10
  }
}
```

### Attack Detection

Automated attack detection triggers on:

- 5+ violations within 5 minutes
- Distributed attacks from multiple IPs
- Unusual traffic patterns

**Response:**

- Critical alerts sent to security team
- Automatic IP blocking (future)
- Incident investigation

## Requesting Higher Limits

For legitimate use cases requiring higher limits:

1. Contact: `support@quiver.surf`
2. Provide:
   - Use case description
   - Expected request volume
   - Business/research justification
3. We'll review and may provide:
   - API key with custom limits
   - Dedicated quota
   - SLA guarantees

## Migration to Distributed Rate Limiting

Currently using in-memory rate limiting. Future improvements:

### Phase 2: Upstash Redis (Planned)

When traffic grows beyond serverless constraints:

**Benefits:**

- True distributed rate limiting
- Persistent across cold starts
- Accurate counts across all instances

**Timeline:** When concurrent users > 1000 or abuse detected

## Error Responses

### Common Error Codes

| Code | Meaning               | Action                                 |
| ---- | --------------------- | -------------------------------------- |
| 400  | Bad Request           | Check request parameters               |
| 401  | Unauthorized          | Authenticate or refresh session        |
| 403  | Forbidden             | Access denied (check permissions)      |
| 404  | Not Found             | Endpoint or resource doesn't exist     |
| 429  | Too Many Requests     | Wait and retry (check `Retry-After`)   |
| 500  | Internal Server Error | Retry with backoff, report if persists |
| 503  | Service Unavailable   | Temporary outage, retry with backoff   |

### Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": {
    // Optional, only in development
    "field": "specific error details"
  },
  "timestamp": "2025-11-14T10:15:00Z"
}
```

## Changelog

### 2025-11-14: Initial Rate Limiting Implementation

- Added rate limiting to 10+ public endpoints
- Implemented tiered limits based on risk
- Added monitoring and telemetry
- Created security documentation

## Support

For security issues or questions:

- **Security Issues:** `security@quiver.surf` (urgent)
- **General Support:** `support@quiver.surf`
- **Documentation:** `docs/architecture/`

## References

- [Rate Limiting Architecture](./RATE_LIMITING_ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [RFC 6585 - HTTP Status Code 429](https://tools.ietf.org/html/rfc6585)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
