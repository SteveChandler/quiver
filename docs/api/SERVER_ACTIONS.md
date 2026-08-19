# Server Actions Reference

> Complete reference for Quiver's Next.js Server Actions.

## Overview

Server Actions are async functions that execute on the server, providing type-safe data mutations and authenticated database operations without exposing API endpoints.

**Location:** `/actions/` directory

## Architecture

### Design Principles

1. **Single Entry Point**: Actions are the single entry point for database mutations
2. **Authentication Enforcement**: Use wrappers that enforce auth automatically
3. **Consistent Response Shape**: All actions return `{ success, data?, error? }`
4. **Cache Revalidation**: Actions trigger `revalidatePath()` after mutations

### Wrapper Utilities

All actions use utilities from `lib/server-action-utils.ts`:

```typescript
// Basic server action wrapper
withServerAction(async () => { /* ... */ });

// Authenticated action (requires user session)
withAuthenticatedAction(async (user, supabase) => { /* ... */ });

// Simple database operation
withDatabaseOperation<T>(async (supabase) => { /* ... */ });
```

### Response Shape

```typescript
interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## City Actions

**Location:** `actions/city/city-editorial-actions.ts`

### getCityEditorialContent

Fetch editorial content for city landing pages.

```typescript
async function getCityEditorialContent(
  citySlug: string,
  stateSlug: string = "ca",
  countrySlug: string = "usa"
): Promise<CityEditorialContent | null>
```

**Parameters:**
- `citySlug` - City slug (e.g., "san-diego")
- `stateSlug` - State slug (e.g., "ca")
- `countrySlug` - Country slug (e.g., "usa")

**Returns:** `CityEditorialContent | null`

**Example:**
```typescript
const content = await getCityEditorialContent("san-diego", "ca", "usa");

if (content) {
  console.log(content.description);      // string[]
  console.log(content.session_timing);   // SessionTimingModule[]
  console.log(content.quick_links);      // QuickLink[]
  console.log(content.planning_checklist); // string[]
}
```

### hasCityEditorialContent

Check if a city has editorial content (lighter query).

```typescript
async function hasCityEditorialContent(
  citySlug: string,
  stateSlug: string = "ca",
  countrySlug: string = "usa"
): Promise<boolean>
```

---

## Beach Actions

**Location:** `actions/beach-actions.ts`, `actions/beach/*.ts`

### getBeaches

List all beaches with selective field query.

```typescript
async function getBeaches(): Promise<ActionResponse<Beach[]>>
```

**Returns:** Array of beaches with fields: `id, name, slug, city, lat, lon, state, created_at, is_private`

### getBeachById

Get full beach details by ID.

```typescript
async function getBeachById(id: string): Promise<ActionResponse<Beach>>
```

### getBeachBySlug

Get beach by URL slug.

```typescript
async function getBeachBySlug(slug: string): Promise<ActionResponse<Beach>>
```

**Note:** Slugs are case-insensitive; input is normalized to lowercase.

### getNearbyBeaches

Find beaches within a radius of coordinates.

**Location:** `actions/beach/beach-location-actions.ts`

```typescript
async function getNearbyBeaches(
  lat: number,
  lon: number,
  radiusMiles?: number,
  limit?: number
): Promise<ActionResponse<Beach[]>>
```

**Parameters:**
- `lat` - Latitude coordinate
- `lon` - Longitude coordinate
- `radiusMiles` - Search radius (default: 30)
- `limit` - Max results (default: 20)

---

## Session Actions

**Location:** `actions/session-actions.ts`

### getUserSessions

Get user's surf sessions with related data.

```typescript
async function getUserSessions(
  userId: string,
  limit?: number
): Promise<ActionResponse<SessionWithDetails[]>>
```

**Returns:** Sessions with nested `beach`, `board`, and `user` data.

### createPlannedSession

Create a planned future session.

```typescript
async function createPlannedSession(
  data: SessionFormState,
  userId: string
): Promise<ActionResponse<Session>>
```

**Authentication:** Required (validates user ownership)

**Side Effects:**
- Triggers XP tracking
- Calls `revalidatePath("/sessions")`

### createLoggedSession

Log a completed surf session.

```typescript
async function createLoggedSession(
  data: SessionFormState,
  userId: string
): Promise<ActionResponse<Session>>
```

### updateSession

Update an existing session.

```typescript
async function updateSession(
  sessionId: string,
  data: Partial<SessionFormState>,
  userId: string
): Promise<ActionResponse<Session>>
```

### deleteSession

Delete a session.

```typescript
async function deleteSession(
  sessionId: string,
  userId: string
): Promise<ActionResponse<void>>
```

---

## Profile Actions

**Location:** `actions/profile-actions.ts`

### getProfile

Get user profile by ID.

```typescript
async function getProfile(userId: string): Promise<{
  success: boolean;
  data?: Profile;
  error?: string;
  isConnectionError?: boolean;
}>
```

**Note:** Creates profile automatically if none exists.

### fetchProfile

Cached profile fetching for server components.

```typescript
async function fetchProfile(userId: string): Promise<Profile | null>
```

**Caching:** 5-minute TTL with `profile` cache tag.

### updateProfile

Update user profile fields.

```typescript
async function updateProfile(
  userId: string,
  updates: Partial<Profile>
): Promise<ActionResponse<Profile>>
```

**Validation:** Zod schema validates all fields (see schema in source).

**Updatable Fields:**
- Basic: `full_name`, `bio`, `avatar_url`, `website_url`, `instagram`, `location`
- Surf: `skill_level`, `experience_years`, `board_types`, `surf_styles`
- Settings: `home_beach_id`, `privacy_level`, `share_sessions`, `show_stats`
- Notifications: `notif_push_enabled`, `notif_email_enabled`, `notif_inapp_enabled`, `notif_likes`, `notif_follows`

---

## Forecast Actions

**Location:** `actions/forecast-actions.ts`

### getBeachForecasts

Get forecast data for a beach.

```typescript
async function getBeachForecasts(beachId: string): Promise<ActionResponse<Forecast[]>>
```

**Returns:** Future forecasts (from today) ordered by date/time.

### getLatestBeachForecast

Get most recent forecast entries.

```typescript
async function getLatestBeachForecast(beachId: string): Promise<ActionResponse<Forecast[]>>
```

### getEnhancedForecast

Get enhanced forecast with metadata.

```typescript
async function getEnhancedForecast(beachId: string): Promise<ActionResponse<{
  forecast: EnhancedForecastEntity;
  metadata: ForecastMetadata;
}>>
```

**Metadata includes:**
- `primarySource`: "NOAA_NWS" | "CDIP" | "FALLBACK"
- `confidenceScore`: 0-100
- `isRealTimeData`: boolean
- `isStaleData`: boolean
- `cdipStation`: Station ID (if applicable)

---

## Social Actions

**Location:** `actions/social-actions.ts`

### followUser

Follow another user.

```typescript
async function followUser(followeeId: string): Promise<ActionResponse<void>>
```

### unfollowUser

Unfollow a user.

```typescript
async function unfollowUser(followeeId: string): Promise<ActionResponse<void>>
```

### getFollowers

Get user's followers.

```typescript
async function getFollowers(userId: string): Promise<ActionResponse<Profile[]>>
```

### getFollowing

Get users that a user follows.

```typescript
async function getFollowing(userId: string): Promise<ActionResponse<Profile[]>>
```

---

## Like Actions

**Location:** `actions/like-actions.ts`

### likeSession

Like a surf session.

```typescript
async function likeSession(sessionId: string): Promise<ActionResponse<void>>
```

### unlikeSession

Remove like from a session.

```typescript
async function unlikeSession(sessionId: string): Promise<ActionResponse<void>>
```

### getSessionLikes

Get like count and user's like status.

```typescript
async function getSessionLikes(sessionId: string): Promise<ActionResponse<{
  count: number;
  userHasLiked: boolean;
}>>
```

---

## Intel Actions

**Location:** `actions/intel-actions.ts`

### createIntel

Create a community intel post.

```typescript
async function createIntel(data: {
  beach_id: string;
  intel_type: IntelType;
  content: string;
  tags?: string[];
}): Promise<ActionResponse<Intel>>
```

**Intel Types:** `parking`, `hazard`, `crowd`, `conditions`, `access`, `other`

### confirmIntel

Confirm an intel post (community validation).

```typescript
async function confirmIntel(intelId: string): Promise<ActionResponse<void>>
```

### getBeachIntel

Get active intel for a beach.

```typescript
async function getBeachIntel(beachId: string): Promise<ActionResponse<Intel[]>>
```

---

## Board Actions

**Location:** `actions/board-actions.ts`

### createBoard

Create a new surfboard.

```typescript
async function createBoard(data: BoardInput): Promise<ActionResponse<Board>>
```

### getUserBoards

Get user's surfboards.

```typescript
async function getUserBoards(userId: string): Promise<ActionResponse<Board[]>>
```

### updateBoard

Update surfboard details.

```typescript
async function updateBoard(
  boardId: string,
  data: Partial<BoardInput>
): Promise<ActionResponse<Board>>
```

---

## Session Analytics Module (API-only)

**Location:** `lib/analytics/session-analytics.ts`

This module is consumed by the session analytics and journal export API routes. It
is not a server action and receives the already-authenticated Supabase client.

### getSessionAnalytics

Get session analytics for a user.

```typescript
async function getSessionAnalytics(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { success: true; data: SessionAnalytics }
  | { success: false; error: string }
>
```

The successful result includes `type`, `userId`, session counts, total hours,
average rating and wave height, favorite beach, frequent boards, monthly stats,
wave-height trend, condition ratings, and `generatedAt`.

### getCalendarHeatmapData

Get session data for a calendar month.

```typescript
async function getCalendarHeatmapData(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number,
): Promise<
  | { success: true; data: CalendarHeatmapData[] }
  | { success: false; error: string }
>
```

Each calendar entry contains the date, session count, average wave height,
average rating, and the matching session summaries.

---

## Onboarding Actions

**Location:** `actions/onboarding-actions.ts`

### completeOnboardingStep

Mark an onboarding step as complete.

```typescript
async function completeOnboardingStep(
  step: OnboardingStep
): Promise<ActionResponse<void>>
```

### saveOnboardingProfile

Save profile data from onboarding.

```typescript
async function saveOnboardingProfile(
  data: OnboardingProfileData
): Promise<ActionResponse<Profile>>
```

---

## Admin Actions

**Location:** `actions/admin/*.ts`

> Admin actions require admin role verification.

### Admin Beach Actions

```typescript
// actions/admin/beaches.ts
async function updateBeachDetails(beachId: string, data: Partial<Beach>)
async function toggleBeachPrivacy(beachId: string)
```

### Admin Session Actions

```typescript
// actions/admin/sessions.ts
async function deleteSessionAdmin(sessionId: string)
async function flagSessionForReview(sessionId: string)
```

### Admin Photo Actions

```typescript
// actions/admin/photos.ts
async function approvePhoto(photoId: string)
async function rejectPhoto(photoId: string, reason: string)
```

---

## Error Handling

### Catching Action Errors

```typescript
const result = await getBeachById(beachId);

if (!result.success) {
  console.error("Error:", result.error);
  // Handle error in UI
  return;
}

// Use result.data safely
const beach = result.data;
```

### Error Types

| Error | Meaning |
|-------|---------|
| "User not authenticated" | Missing or invalid session |
| "User ID mismatch" | Trying to access another user's data |
| "Not found" | Resource doesn't exist |
| "Database error" | Supabase operation failed |
| "Validation error" | Input failed Zod validation |

---

## Best Practices

### 1. Always Check Success

```typescript
// ✅ Good
const { success, data, error } = await getProfile(userId);
if (!success) return handleError(error);

// ❌ Bad - assumes success
const { data } = await getProfile(userId);
```

### 2. Use Proper Wrappers

```typescript
// ✅ Good - uses wrapper for consistent error handling
export async function myAction() {
  return withAuthenticatedAction(async (user, supabase) => {
    // ... implementation
  });
}

// ❌ Bad - manual try/catch loses consistency
export async function myAction() {
  try {
    const supabase = await createSupabaseServerClient();
    // ...
  } catch (e) {
    return { success: false, error: e.message };
  }
}
```

### 3. Revalidate After Mutations

```typescript
export async function updateProfile(userId: string, data: ProfileUpdate) {
  return withAuthenticatedAction(async (user, supabase) => {
    // ... update logic

    // ✅ Revalidate affected paths
    revalidatePath(`/profile/${userId}`);
    revalidatePath('/dashboard');

    return profile;
  });
}
```

### 4. Validate Ownership

```typescript
// ✅ Always verify ownership even with RLS
export async function updateSession(sessionId: string, userId: string, data: SessionUpdate) {
  return withAuthenticatedAction(async (user, supabase) => {
    if (user.id !== userId) {
      throw new Error("User ID mismatch");
    }
    // ... proceed with update
  });
}
```

---

## Related Documentation

- [API Overview](README.md) - API architecture overview
- [RPC Functions](RPC_FUNCTIONS.md) - Supabase stored procedures
- [Actions Architecture](/actions/ARCHITECTURE.md) - Detailed patterns
- [Supabase Setup](/docs/SUPABASE_SETUP.md) - Database client usage

---

**Last Updated:** December 2025
