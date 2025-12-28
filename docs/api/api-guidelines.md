# Quiver API Guidelines

This document outlines the design principles, naming conventions, and implementation standards for the Quiver API and Server Actions.

---

## 🏗️ Architectural Overview

Quiver uses a **Hybrid API Architecture**:

1.  **Next.js API Routes (`app/api/`)**: Used for public data access, mobile app integrations, cron jobs, and high-performance data fetching (Edge runtime).
2.  **Server Actions (`actions/`)**: Used for the primary web application for mutations and authenticated reads.

Both layers should share the same business logic and validation schemas whenever possible.

---

## 📋 Response Standards

### API Response Envelope (REST)

All API responses must follow the standard envelope defined in `lib/api-utils.ts`:

**Success Response (200 OK, 201 Created)**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2023-10-27T10:00:00Z",
  "meta": { "totalCount": 100 } // Optional
}
```

**Error Response (4xx, 5xx)**
```json
{
  "success": false,
  "error": "Human readable error message",
  "details": { ... }, // Optional: validation details or original error
  "timestamp": "2023-10-27T10:00:00Z"
}
```

### Server Action Envelope

Server actions must return the following shape via the `withServerAction` wrapper:

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 🔤 Naming Conventions

### URL Paths
- Use **lowercase with hyphens** (kebab-case).
- Resource names should be **plural** (e.g., `/api/beaches`, `/api/sessions`).
- Sub-resources should follow the parent (e.g., `/api/sessions/{id}/comments`).

### JSON Keys
- **Database-mapped fields**: Use `snake_case` (e.g., `user_id`, `created_at`, `is_public`).
- **System/Envelope fields**: Use `camelCase` (e.g., `timestamp`, `totalCount`).
- **Query Parameters**: Generally use `camelCase`, except for legacy coordinate params (`lat`, `lon`, `lng`).

---

## 🔐 Authentication & Authorization

### Schemes
- **User Auth**: Bearer JWT via Supabase (`Authorization: Bearer <token>`).
- **Cron Auth**: `x-vercel-cron` header OR `Authorization: Bearer <CRON_SECRET>`.
- **Admin Auth**: Enforced via `isAdmin(user)` check in the route handler.

### Middleware
- Use `withBotBlockingAndRateLimit` for public GET endpoints to prevent scraping and abuse.
- Use `withRateLimit` for authenticated endpoints.

---

## 🧪 Validation

- Use **Zod** for all input validation.
- Store shared schemas in `lib/validation/schemas.ts`.
- Use the `validateOrError` helper in API routes to return consistent 400 Bad Request responses.

---

## 💾 Caching & Performance

### REST API Caching
- Use `ETag` and `If-None-Match` for conditional GETs.
- Use `Cache-Control` headers via `createCachedResponse`.
- Default to `CacheDuration.MEDIUM` (5m cache + 1h SWR) for public data.

### Server Side
- Use `unstable_cache` with specific tags (e.g., `["profile"]`) for expensive reads in Server Components and Actions.

---

## ⚠️ Common Pitfalls

1.  **Double Nesting**: Avoid wrapping `success: true` or `data` inside the `data` key of `createSuccessResponse`.
    *   ❌ `createSuccessResponse({ success: true, data: beach })`
    *   ✅ `createSuccessResponse(beach)`
2.  **Missing Error Context**: Always provide a custom message to `handleApiError` for better debugging.
3.  **Direct DB Access**: Avoid raw Supabase calls in routes; use shared helpers or actions to ensure RLS and business logic consistency.

