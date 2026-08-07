# API Documentation

> Complete reference for Quiver's REST API, Server Actions, and Supabase RPC functions.

## Overview

Quiver uses a layered API architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                          │
│   React Components, Hooks, Mobile App                       │
└─────────────────────────────────┬───────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│ Server Actions│      │   REST API      │      │  Supabase RPC │
│  (Next.js)    │      │  (/app/api)     │      │  Functions    │
│               │      │                 │      │               │
│ • Type-safe   │      │ • Public APIs   │      │ • Complex DB  │
│ • Form handling│     │ • External calls│      │ • Triggers    │
│ • Internal ops│      │ • Cron jobs     │      │ • Bulk ops    │
└───────┬───────┘      └────────┬────────┘      └───────┬───────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL                        │
│           (with Row Level Security policies)                │
└─────────────────────────────────────────────────────────────┘
```

## API Reference Documents

| Document | Location | Description |
|----------|----------|-------------|
| **REST API Architecture** | [`/app/api/ARCHITECTURE.md`](/app/api/ARCHITECTURE.md) | Complete REST API reference |
| **Server Actions** | [`/docs/api/SERVER_ACTIONS.md`](SERVER_ACTIONS.md) | Server action function reference |
| **RPC Functions** | [`/docs/api/RPC_FUNCTIONS.md`](RPC_FUNCTIONS.md) | Supabase stored procedures |
| **Rate Limiting** | [`/docs/architecture/RATE_LIMITING_ARCHITECTURE.md`](/docs/architecture/RATE_LIMITING_ARCHITECTURE.md) | API rate limiting strategy |
| **API Security** | [`/docs/architecture/API_SECURITY.md`](/docs/architecture/API_SECURITY.md) | Authentication & authorization |

## Authentication

All API endpoints use Supabase authentication:

### Authentication Levels

| Level | Description | Example Routes |
|-------|-------------|----------------|
| **Public** | No authentication required | `/api/health`, `/api/beaches/featured` |
| **User** | Valid user session required | `/api/sessions`, `/api/profile` |
| **Admin** | Admin role required | `/api/admin/*` |
| **Cron** | Vercel cron header or token | `/api/cron/*` |

### Authenticating Requests

**Client-side (hooks):**
```typescript
// Authentication handled automatically by useSupabase hook
const { data } = await supabase
  .from('sessions')
  .select('*');
```

**Server-side (API routes):**
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... continue
}
```

**Server Actions:**
```typescript
'use server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function myAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // ... continue
}
```

## Common Response Formats

### Success Response

```typescript
{
  success: true,
  data: { /* response data */ },
  timestamp: "2025-12-03T10:00:00.000Z"
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input",
    details: { field: "beachId", reason: "Must be a valid UUID" }
  },
  timestamp: "2025-12-03T10:00:00.000Z"
}
```

### Paginated Response

```typescript
{
  success: true,
  data: [ /* items */ ],
  pagination: {
    total: 150,
    page: 1,
    pageSize: 20,
    hasMore: true
  }
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET, PATCH |
| `201` | Created | Successful POST (resource created) |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation errors, malformed input |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Error | Server-side error |

### Error Codes

```typescript
type ErrorCode =
  | 'VALIDATION_ERROR'     // Invalid input data
  | 'AUTH_ERROR'           // Authentication failed
  | 'FORBIDDEN'            // Insufficient permissions
  | 'NOT_FOUND'            // Resource not found
  | 'RATE_LIMITED'         // Too many requests
  | 'DATABASE_ERROR'       // Database operation failed
  | 'EXTERNAL_API_ERROR'   // Third-party API failure
  | 'INTERNAL_ERROR';      // Unexpected server error
```

## Rate Limiting

API requests are rate-limited to ensure fair usage:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public APIs | 60 requests | Per minute |
| Authenticated APIs | 120 requests | Per minute |
| Search APIs | 30 requests | Per minute |
| Admin APIs | 60 requests | Per minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1701600000
```

## Key API Endpoints

### Beach Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/beaches` | GET | List all beaches |
| `/api/beaches/search` | GET | Search beaches by name |
| `/api/beaches/nearby` | GET | Find beaches near coordinates |
| `/api/beaches/featured` | GET | Featured beaches for landing page |
| `/api/beaches/[id]` | GET | Single beach details |

### Forecasts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/surf` | GET | Surf forecast by beach or coordinates |
| `/api/home/personalized-forecast` | GET | Personalized recommendation |
| `/api/buoys/conditions` | GET | Real-time buoy data |

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET, POST | Session CRUD |
| `/api/sessions/[id]` | GET, PATCH, DELETE | Single session |
| `/api/sessions/public` | GET | Public session feed |

### User Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/profile/[id]` | GET, PATCH | User profile |
| `/api/user/beach-affinity` | GET | User's beach preferences |
| `/api/analytics/sessions` | GET | Session analytics |

## Server Actions vs REST API

Use this guide to choose the right approach:

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| Form submissions | Server Action | Type-safe, automatic revalidation |
| Complex queries | Server Action | Direct DB access, no serialization |
| External integrations | REST API | Webhook support, CORS |
| Mobile app | REST API | Standard HTTP, offline caching |
| Real-time updates | Supabase Subscription | Built-in realtime |
| Cron jobs | REST API | Vercel cron integration |

## Quick Start Examples

### Fetching Beach Data

```typescript
// Using React Query (recommended)
import { useQuery } from '@tanstack/react-query';

function BeachList() {
  const { data } = useQuery({
    queryKey: ['beaches', 'featured'],
    queryFn: () => fetch('/api/beaches/featured').then(r => r.json())
  });

  return data?.data.map(beach => <BeachCard key={beach.id} beach={beach} />);
}
```

### Using Server Actions

```typescript
// In component
import { getBeachById } from '@/actions/beach-actions';

async function BeachPage({ beachId }: { beachId: string }) {
  const beach = await getBeachById(beachId);
  return <BeachDetail beach={beach} />;
}
```

### Calling RPC Functions

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Note: createSupabaseServerClient is async (Next.js 15+ compatibility)
const supabase = await createSupabaseServerClient();

// Call RPC function
const { data, error } = await supabase.rpc('get_city_editorial', {
  p_city_name: 'San Diego',
  p_state_code: 'CA'
});
```

## Related Documentation

- [System Architecture](/docs/ARCHITECTURE.md) - Overall system design
- [Database Schema](/docs/diagrams/database-schema.md) - ERD and table definitions
- [Coordinate Conventions](/docs/COORDINATE_CONVENTIONS.md) - Lat/lon naming standards
- [Coverage Areas](/docs/COVERAGE_AREAS.md) - Geographic coverage

---

**Last Updated:** December 2025
