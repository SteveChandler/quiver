# Quiver API Documentation

**Version**: 1.0
**Base URL**: `https://www.quiversurf.app/api`
**Last Updated**: November 25, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Conventions](#api-conventions)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [User & Profile](#user--profile-endpoints)
   - [Beaches](#beaches-endpoints)
   - [Sessions](#sessions-endpoints)
   - [Forecasts](#forecasts-endpoints)
   - [Social](#social-endpoints)
   - [Boards](#boards-endpoints)
   - [Admin](#admin-endpoints)
   - [Analytics](#analytics-endpoints)
   - [Utility](#utility-endpoints)

---

## Overview

The Quiver API is a RESTful API built with Next.js API Routes. All endpoints return JSON responses and use standard HTTP status codes.

### Base URL

```
Production:  https://www.quiversurf.app/api
Development: http://localhost:3000/api
```

### API Versioning

Currently, the API is unversioned. Breaking changes will be avoided when possible. A future `/api/v1/` structure is planned for versioned endpoints.

Some endpoints are already under `/api/v1/` namespace for experimental features.

---

## Authentication

### Authentication Methods

The API uses **JWT-based authentication** via Supabase Auth. Tokens are stored in HTTP-only cookies and automatically included in requests.

#### Sign In

```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "surfer123"
  }
}
```

#### Sign Out

```http
POST /api/auth/sign-out
```

**Response:**

```json
{
  "success": true
}
```

### Authenticated Requests

Include the JWT token in the cookie automatically (handled by browser/client SDK).

For API clients:

```http
GET /api/sessions
Cookie: sb-access-token=<jwt-token>
```

Or use the Authorization header:

```http
GET /api/sessions
Authorization: Bearer <jwt-token>
```

### Checking Authentication Status

```http
GET /api/auth/check-session
```

**Response:**

```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

---

## API Conventions

### Request Format

- **Content-Type**: `application/json` for POST/PUT requests
- **Query Parameters**: URL-encoded for GET requests
- **Date Format**: ISO 8601 (`2025-10-28T12:00:00Z`)
- **Coordinates**: Decimal degrees (e.g., `latitude: 33.7701, longitude: -118.1937`)

### Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": {
    /* response data */
  },
  "timestamp": "2025-10-28T12:00:00Z"
}
```

### Pagination

Paginated endpoints use `limit` and `offset` parameters:

```http
GET /api/beaches?limit=20&offset=40
```

**Response:**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 40,
    "total": 150
  }
}
```

### Filtering

Many endpoints support filtering via query parameters:

```http
GET /api/beaches?region=california&is_active=true
GET /api/sessions?user_id=uuid&session_date_gte=2025-01-01
```

### Sorting

Use `order_by` parameter:

```http
GET /api/sessions?order_by=session_date.desc
GET /api/beaches?order_by=name.asc
```

---

## Rate Limiting

**Current Status**: Not implemented (future enhancement)

**Planned Limits**:

- **Authenticated Users**: 100 requests/minute per user
- **Anonymous Users**: 20 requests/minute per IP
- **Admin Users**: 500 requests/minute

**Rate Limit Headers** (future):

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698504000
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "User-friendly error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-10-28T12:00:00Z"
}
```

### HTTP Status Codes

| Status  | Meaning               | Usage                                  |
| ------- | --------------------- | -------------------------------------- |
| **200** | OK                    | Successful GET, PUT, PATCH, DELETE     |
| **201** | Created               | Successful POST (resource created)     |
| **204** | No Content            | Successful DELETE (no body)            |
| **400** | Bad Request           | Invalid input, validation errors       |
| **401** | Unauthorized          | Missing or invalid authentication      |
| **403** | Forbidden             | Authenticated but not authorized       |
| **404** | Not Found             | Resource doesn't exist                 |
| **409** | Conflict              | Duplicate resource (unique constraint) |
| **422** | Unprocessable Entity  | Validation failed                      |
| **429** | Too Many Requests     | Rate limit exceeded                    |
| **500** | Internal Server Error | Unexpected server error                |
| **503** | Service Unavailable   | Temporary service outage               |

### Common Error Codes

| Code                  | Description                      |
| --------------------- | -------------------------------- |
| `UNAUTHORIZED`        | User not authenticated           |
| `FORBIDDEN`           | User not authorized for resource |
| `VALIDATION_ERROR`    | Input validation failed          |
| `NOT_FOUND`           | Resource not found               |
| `DUPLICATE`           | Resource already exists          |
| `RATE_LIMIT_EXCEEDED` | Too many requests                |
| `INTERNAL_ERROR`      | Unexpected server error          |

---

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/sign-in

Sign in with email and password.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "surfer123"
  }
}
```

---

#### POST /api/auth/sign-out

Sign out current user.

**Response:** `200 OK`

```json
{
  "success": true
}
```

---

#### GET /api/auth/check-session

Check if user is authenticated.

**Response:** `200 OK`

```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

---

#### POST /api/auth/refresh-session

Refresh the user's session token.

**Response:** `200 OK`

```json
{
  "success": true
}
```

---

### User & Profile Endpoints

#### GET /api/me

Get current user's profile.

**Authentication**: Required

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "surfer123",
    "email": "user@example.com",
    "full_name": "John Surfer",
    "bio": "Surf enthusiast from California",
    "avatar_url": "https://...",
    "home_beach_id": "uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "stats": {
      "total_sessions": 42,
      "total_xp": 1250,
      "level": 5,
      "beaches_visited": 12
    }
  }
}
```

---

#### PATCH /api/me

Update current user's profile.

**Authentication**: Required

**Request:**

```json
{
  "full_name": "John Doe",
  "bio": "New bio text",
  "home_beach_id": "uuid"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "surfer123",
    "full_name": "John Doe",
    "bio": "New bio text"
  }
}
```

---

#### GET /api/user/:username

Get user profile by username.

**Parameters:**

- `username` (path): Username to fetch

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "surfer123",
    "full_name": "John Surfer",
    "bio": "Surf enthusiast",
    "avatar_url": "https://...",
    "stats": {
      "total_sessions": 42,
      "followers": 120,
      "following": 85
    }
  }
}
```

---

#### GET /api/users/:userId/sessions

Get user's public sessions.

**Parameters:**

- `userId` (path): User ID
- `limit` (query, optional): Max results (default: 20)
- `offset` (query, optional): Pagination offset

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "beach_id": "uuid",
      "beach_name": "Manhattan Beach",
      "session_date": "2025-10-28",
      "rating": 4,
      "wave_height_ft": 3.5,
      "is_public": true,
      "created_at": "2025-10-28T12:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 42
  }
}
```

---

### Beaches Endpoints

#### GET /api/beaches

Get list of beaches.

**Query Parameters:**

- `limit` (optional): Max results (default: 50, max: 100)
- `offset` (optional): Pagination offset
- `region` (optional): Filter by region (e.g., "california")
- `country` (optional): Filter by country
- `search` (optional): Search by beach name
- `lat` (optional): Latitude for nearby search
- `lon` (optional): Longitude for nearby search
- `radius_km` (optional): Radius for nearby search (default: 50)

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Manhattan Beach",
      "description": "Popular beach in Los Angeles",
      "latitude": 33.8847,
      "longitude": -118.4109,
      "region": "Los Angeles",
      "country": "USA",
      "surf_break_info": {
        "type": "beach_break",
        "best_swell_direction": "SW",
        "best_wind_direction": "E"
      },
      "amenities": ["parking", "restrooms", "showers"],
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### GET /api/beaches/:id

Get beach details by ID.

**Parameters:**

- `id` (path): Beach ID

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Manhattan Beach",
    "description": "Popular beach in Los Angeles",
    "latitude": 33.8847,
    "longitude": -118.4109,
    "region": "Los Angeles",
    "country": "USA",
    "surf_break_info": {
      "type": "beach_break",
      "best_swell_direction": "SW",
      "best_wind_direction": "E",
      "crowd_level": "high"
    },
    "amenities": ["parking", "restrooms", "showers"],
    "stats": {
      "total_sessions": 1250,
      "average_rating": 4.2,
      "total_reviews": 85
    }
  }
}
```

---

#### POST /api/beaches

Create a new beach (Admin only).

**Authentication**: Required (Admin)

**Request:**

```json
{
  "name": "New Beach",
  "description": "A great surf spot",
  "latitude": 33.7701,
  "longitude": -118.1937,
  "region": "California",
  "country": "USA",
  "surf_break_info": {
    "type": "point_break",
    "best_swell_direction": "W"
  }
}
```

**Response:** `201 Created`

---

#### GET /api/beaches/favorites

Get current user's favorite beaches.

**Authentication**: Required

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Manhattan Beach",
      "latitude": 33.8847,
      "longitude": -118.4109,
      "favorited_at": "2025-01-15T00:00:00Z"
    }
  ]
}
```

---

#### POST /api/beaches/:id/favorite

Add beach to favorites.

**Authentication**: Required

**Parameters:**

- `id` (path): Beach ID

**Response:** `201 Created`

---

#### DELETE /api/beaches/:id/favorite

Remove beach from favorites.

**Authentication**: Required

**Parameters:**

- `id` (path): Beach ID

**Response:** `204 No Content`

---

### Sessions Endpoints

#### GET /api/sessions

Get list of sessions.

**Query Parameters:**

- `limit` (optional): Max results (default: 20)
- `offset` (optional): Pagination offset
- `user_id` (optional): Filter by user
- `beach_id` (optional): Filter by beach
- `session_date_gte` (optional): Sessions on or after date
- `session_date_lte` (optional): Sessions on or before date
- `is_public` (optional): Filter by public status

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "username": "surfer123",
      "user_avatar": "https://...",
      "beach_id": "uuid",
      "beach_name": "Manhattan Beach",
      "board_id": "uuid",
      "board_name": "Lost Puddle Jumper",
      "session_date": "2025-10-28",
      "start_time": "08:00:00",
      "end_time": "10:30:00",
      "rating": 4,
      "wave_height_ft": 3.5,
      "notes": "Great morning session!",
      "is_public": true,
      "like_count": 12,
      "comment_count": 3,
      "created_at": "2025-10-28T12:00:00Z"
    }
  ]
}
```

---

#### GET /api/sessions/:id

Get session details.

**Parameters:**

- `id` (path): Session ID

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "username": "surfer123",
    "beach_id": "uuid",
    "beach_name": "Manhattan Beach",
    "beach_coordinates": {
      "latitude": 33.8847,
      "longitude": -118.4109
    },
    "board_id": "uuid",
    "board_name": "Lost Puddle Jumper",
    "session_date": "2025-10-28",
    "start_time": "08:00:00",
    "end_time": "10:30:00",
    "rating": 4,
    "wave_height_ft": 3.5,
    "notes": "Great morning session! Waves were clean.",
    "is_public": true,
    "media": [
      {
        "id": "uuid",
        "file_path": "userId/sessionId/photo.jpg",
        "url": "https://storage.supabase.co/...",
        "media_type": "photo"
      }
    ],
    "forecast_snapshot": {
      "wave_height_ft": 3.2,
      "wave_period_s": 12,
      "wind_speed_kts": 5
    },
    "like_count": 12,
    "comment_count": 3,
    "created_at": "2025-10-28T12:00:00Z"
  }
}
```

---

#### POST /api/sessions

Create a new session.

**Authentication**: Required

**Request:**

```json
{
  "beach_id": "uuid",
  "board_id": "uuid",
  "session_date": "2025-10-28",
  "start_time": "08:00:00",
  "end_time": "10:30:00",
  "rating": 4,
  "wave_height_ft": 3.5,
  "notes": "Great morning session!",
  "is_public": true
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "beach_id": "uuid",
    "session_date": "2025-10-28",
    "xp_earned": 75
  }
}
```

---

#### PATCH /api/sessions/:id

Update a session.

**Authentication**: Required (must be session owner)

**Parameters:**

- `id` (path): Session ID

**Request:**

```json
{
  "rating": 5,
  "notes": "Updated notes",
  "is_public": false
}
```

**Response:** `200 OK`

---

#### DELETE /api/sessions/:id

Delete a session.

**Authentication**: Required (must be session owner)

**Parameters:**

- `id` (path): Session ID

**Response:** `204 No Content`

---

### Forecasts Endpoints

#### GET /api/forecasts/:beachId

Get forecast for a beach.

**Parameters:**

- `beachId` (path): Beach ID
- `forecast_at` (query, optional): Forecast valid-time lower bound (default: now)

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "beach_id": "uuid",
    "beach_name": "Manhattan Beach",
    "forecast_at": "2025-10-28T00:00:00Z",
    "forecasts": [
      {
        "forecast_at": "2025-10-28T06:00:00Z",
        "wave_height_ft": 3.2,
        "wave_period_s": 12,
        "wave_direction_deg": 225,
        "wave_direction_text": "SW",
        "wind_speed_kts": 5,
        "wind_direction_deg": 90,
        "wind_direction_text": "E",
        "tide_height_ft": 2.1,
        "rating": 4,
        "summary": "Good conditions"
      }
    ]
  }
}
```

---

#### GET /api/surf/:beachId

Get aggregated surf forecast (multi-source).

**Parameters:**

- `beachId` (path): Beach ID

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "beach_id": "uuid",
    "current": {
      "wave_height_ft": 3.5,
      "wave_period_s": 11,
      "wind_speed_kts": 7,
      "rating": 4
    },
    "forecast_6h": [...],
    "forecast_24h": [...],
    "tide_forecast": [...]
  }
}
```

---

### Social Endpoints

#### POST /api/sessions/:sessionId/like

Like a session.

**Authentication**: Required

**Parameters:**

- `sessionId` (path): Session ID

**Response:** `201 Created`

---

#### DELETE /api/sessions/:sessionId/like

Unlike a session.

**Authentication**: Required

**Parameters:**

- `sessionId` (path): Session ID

**Response:** `204 No Content`

---

#### GET /api/sessions/:sessionId/comments

Get comments for a session.

**Parameters:**

- `sessionId` (path): Session ID

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "user_id": "uuid",
      "username": "commenter",
      "content": "Looks like epic waves!",
      "created_at": "2025-10-28T13:00:00Z"
    }
  ]
}
```

---

#### POST /api/comments

Create a comment.

**Authentication**: Required

**Request:**

```json
{
  "session_id": "uuid",
  "content": "Great session!"
}
```

**Response:** `201 Created`

---

#### POST /api/social/follow/:userId

Follow a user.

**Authentication**: Required

**Parameters:**

- `userId` (path): User ID to follow

**Response:** `201 Created`

---

#### DELETE /api/social/follow/:userId

Unfollow a user.

**Authentication**: Required

**Parameters:**

- `userId` (path): User ID to unfollow

**Response:** `204 No Content`

---

### Boards Endpoints

#### GET /api/boards

Get current user's boards.

**Authentication**: Required

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Lost Puddle Jumper",
      "board_type": "shortboard",
      "length_ft": 5.6,
      "volume_l": 28.5,
      "brand": "Lost",
      "model": "Puddle Jumper",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /api/boards

Create a new board.

**Authentication**: Required

**Request:**

```json
{
  "name": "My New Board",
  "board_type": "shortboard",
  "length_ft": 6.0,
  "volume_l": 30.0,
  "brand": "Firewire",
  "model": "Seaside"
}
```

**Response:** `201 Created`

---

### Admin Endpoints

#### GET /api/admin/buoys

Get all buoys (Admin only).

**Authentication**: Required (Admin)

**Response:** `200 OK`

---

#### POST /api/admin/buoys/sync

Sync buoy data from NOAA (Admin only).

**Authentication**: Required (Admin)

**Response:** `200 OK`

```json
{
  "success": true,
  "synced": 45,
  "updated": 12
}
```

---

### Analytics Endpoints

#### GET /api/analytics/user-stats

Get user statistics.

**Authentication**: Required

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "total_sessions": 42,
    "total_xp": 1250,
    "current_level": 5,
    "beaches_visited": 12,
    "followers": 120,
    "following": 85,
    "session_streak": 7
  }
}
```

---

### Utility Endpoints

#### GET /api/health

Health check endpoint.

**Response:** `200 OK`

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-10-28T12:00:00Z",
  "version": "1.0.0"
}
```

---

## Webhooks (Future)

Planned webhook support for:

- New session created
- User followed
- Comment added
- Badge earned

**Format:**

```json
{
  "event": "session.created",
  "data": {
    /* event data */
  },
  "timestamp": "2025-10-28T12:00:00Z"
}
```

---

## SDK & Client Libraries

### JavaScript/TypeScript

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("https://www.quiversurf.app", "anon-key");

// Get beaches
const { data: beaches } = await supabase.from("beaches").select("*").limit(10);
```

### Curl Examples

```bash
# Get beaches
curl https://www.quiversurf.app/api/beaches

# Create session (authenticated)
curl -X POST https://www.quiversurf.app/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"beach_id": "uuid", "rating": 4}'
```

---

## Best Practices

### Caching

- Public data (beaches, forecasts): Cache for 5 minutes
- User-specific data (sessions, profile): Don't cache or use private cache
- Use `Cache-Control` headers appropriately

### Error Handling

Always check the `success` field in responses:

```typescript
const response = await fetch("/api/sessions");
const json = await response.json();

if (!json.success) {
  console.error("Error:", json.error);
  // Handle error
} else {
  // Process data
  const sessions = json.data;
}
```

### Pagination

For large datasets, always use pagination:

```typescript
async function getAllBeaches() {
  let offset = 0;
  const limit = 100;
  const beaches = [];

  while (true) {
    const response = await fetch(
      `/api/beaches?limit=${limit}&offset=${offset}`
    );
    const json = await response.json();

    beaches.push(...json.data);

    if (json.data.length < limit) break;
    offset += limit;
  }

  return beaches;
}
```

---

## Changelog

### Version 1.0 (October 2025)

- Initial API documentation
- Documented all core endpoints
- Added authentication flow
- Added error handling guide

---

## Support

For API support:

- **Documentation**: https://github.com/quiver/quiver/docs
- **Issues**: https://github.com/quiver/quiver/issues
- **Email**: support@quiversurf.app

---

**Document Version**: 1.0
**Last Updated**: October 28, 2025
**Maintained By**: Quiver Engineering Team
