# Authentication Implementation - Server Actions

## Overview

This document describes the authentication implementation for Quiver's server actions, specifically focusing on the social sharing and session privacy features.

## Authentication Wrapper

### withAuthenticatedAction

Location: [lib/server-action-utils.ts:45-68](/Users/stevenchandler/Desktop/quiver/quiver/lib/server-action-utils.ts#L45-L68)

All mutation server actions that modify user data MUST be wrapped with `withAuthenticatedAction` to ensure:
- User is authenticated before executing the action
- User data is properly scoped to the authenticated user
- Consistent error handling for authentication failures

```typescript
export async function withAuthenticatedAction<T>(
  action: (user: User, supabase: SupabaseClient) => Promise<T>
): Promise<ServerActionResponse<T>>
```

**Features:**
- Automatically retrieves authenticated user from Supabase session
- Returns standardized error responses for unauthenticated requests
- Provides both `user` and `supabase` client to the action
- Wraps all errors in consistent ServerActionResponse format

## Protected Server Actions

### 1. Session Privacy Toggle (updateSession)

**File:** [actions/session-actions.ts:357-490](/Users/stevenchandler/Desktop/quiver/quiver/actions/session-actions.ts#L357-L490)

**Purpose:** Updates session data including privacy settings (`is_public` field)

**Auth Requirements:**
- ✅ Requires authentication via `withAuthenticatedAction`
- ✅ Automatically gets user ID from authenticated session
- ✅ Validates user owns the session via `.eq("user_id", user.id)`
- ✅ Returns 401 error if user not authenticated
- ✅ Returns error if session not found or not owned by user

**Usage:**
```typescript
// BEFORE (INSECURE - accepted userId as parameter)
await updateSession(sessionId, userId, { is_public: true })

// AFTER (SECURE - gets userId from authenticated session)
await updateSession(sessionId, { is_public: true })
```

**Security Improvements:**
- Removed unsafe `userId` parameter that allowed caller to potentially impersonate other users
- User ID is now sourced from authenticated session only
- All database queries filter by authenticated user ID

### 2. Share Image Generation (generateShareImageUrl)

**File:** [actions/social-share-actions.ts:120-143](/Users/stevenchandler/Desktop/quiver/quiver/actions/social-share-actions.ts#L120-L143)

**Purpose:** Generates signed URLs for sharing session images

**Auth Strategy:**
- Uses HMAC-SHA256 signature instead of authentication
- Signature prevents unauthorized access to private session images
- API route validates signature OR checks `is_public` flag
- Does NOT require user to be logged in (supports public sharing)

**Why Not Authenticated:**
This action doesn't use `withAuthenticatedAction` because:
1. Public sessions should be shareable without login
2. Private sessions are protected via cryptographic signature
3. Signature verification happens in the API route, not the action

**Security Model:**
```typescript
// Generate signed URL
const canonical = `${sessionId}:${variant}`;
const signature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");

// API route verifies signature
if (!isPublic && !verifySignature({sessionId, variant}, t, secret)) {
  return new Response("Forbidden", { status: 403 });
}
```

### 3. Share Tracking (trackSessionShare)

**File:** [actions/social-share-actions.ts:27-95](/Users/stevenchandler/Desktop/quiver/quiver/actions/social-share-actions.ts#L27-L95)

**Purpose:** Records when a user shares a session to social media

**Auth Requirements:**
- ✅ Requires authentication via `withAuthenticatedAction`
- ✅ Validates session exists and user can share it
- ✅ Only allows sharing if session is public OR owned by user
- ✅ Tracks XP for the authenticated user

**Authorization Logic:**
```typescript
// Must be public OR owned by authenticated user
if (!session.is_public && session.user_id !== user.id) {
  throw new Error("Cannot share private session");
}
```

### 4. Upload Session Media (uploadSessionMedia)

**File:** [actions/session-actions.ts:834-892](/Users/stevenchandler/Desktop/quiver/quiver/actions/session-actions.ts#L834-L892)

**Purpose:** Uploads photos/videos for a session

**Auth Requirements:**
- ✅ Requires authentication via `withAuthenticatedAction`
- ✅ Verifies user owns the session
- ✅ Only allows uploads to user's own sessions
- ✅ Tracks XP for authenticated user

## Error Responses

All authenticated actions return consistent error responses:

### Authentication Failures

**Status:** Returns `{ success: false, error: string }` (not HTTP status)

**Error Messages:**
- `"Authentication error: ${error.message}"` - Auth check failed
- `"User not authenticated"` - No valid session
- `"Session not found or access denied"` - Session doesn't exist or user doesn't own it
- `"Cannot share private session"` - Attempted to share someone else's private session

### Client-Side Error Handling

```typescript
const result = await updateSession(sessionId, { is_public: true });

if (!result.success) {
  // Show error to user
  toast({
    title: "Failed to update session",
    description: result.error,
    variant: "destructive",
  });
  return;
}

// Success - use result.data
```

## Testing Auth Boundaries

### Unit Tests

All authenticated actions have unit tests that:
1. Mock `supabase.auth.getUser()` to return a user
2. Verify user ID is used in database queries
3. Test error cases (no user, wrong user, etc.)

**Example:**
```typescript
it("should update session successfully", async () => {
  // Mock auth
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: mockUser },
    error: null,
  });

  const result = await updateSession("session-123", { rating: 10 });

  expect(result.success).toBe(true);
});
```

### Manual Testing Checklist

- [ ] Try updating session privacy without being logged in
- [ ] Try updating someone else's session
- [ ] Verify error messages are user-friendly
- [ ] Test share flow from private → public transition
- [ ] Verify signed URLs work for both public and private sessions
- [ ] Test media upload to owned vs. non-owned sessions

## Security Best Practices

### ✅ DO

1. **Always use `withAuthenticatedAction` for mutations**
   ```typescript
   export async function myAction(data) {
     return withAuthenticatedAction(async (user, supabase) => {
       // Use user.id, not a parameter
     });
   }
   ```

2. **Filter all queries by authenticated user**
   ```typescript
   await supabase
     .from("sessions")
     .update(data)
     .eq("id", sessionId)
     .eq("user_id", user.id)  // CRITICAL!
   ```

3. **Validate ownership before mutations**
   ```typescript
   const { data: session } = await supabase
     .from("sessions")
     .select("id")
     .eq("id", sessionId)
     .eq("user_id", user.id)
     .single();

   if (!session) {
     throw new Error("Session not found or access denied");
   }
   ```

### ❌ DON'T

1. **Don't accept user IDs as parameters**
   ```typescript
   // INSECURE - caller can impersonate
   export async function myAction(userId, data) {
     await supabase.from("sessions").update(data).eq("user_id", userId);
   }
   ```

2. **Don't skip user validation**
   ```typescript
   // INSECURE - no ownership check
   await supabase.from("sessions").update(data).eq("id", sessionId);
   ```

3. **Don't mix auth strategies**
   ```typescript
   // CONFUSING - pick one strategy per action
   if (signature || user) { /* ... */ }
   ```

## Migration Guide

If you need to add auth to an existing action:

### Before
```typescript
export async function myAction(userId: string, data: any) {
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("table")
    .update(data)
    .eq("user_id", userId);
}
```

### After
```typescript
export async function myAction(data: any) {
  return withAuthenticatedAction(async (user, supabase) => {
    await supabase
      .from("table")
      .update(data)
      .eq("user_id", user.id)  // Use authenticated user
      .single();

    return data;  // Return value wrapped in ServerActionResponse
  });
}
```

### Update Callers
```typescript
// BEFORE
await myAction(user.id, { ... })

// AFTER
await myAction({ ... })
```

### Update Tests
```typescript
// Add auth mock
mockSupabaseClient.auth.getUser.mockResolvedValue({
  data: { user: mockUser },
  error: null,
});

// Remove userId parameter
const result = await myAction({ ... });
```

## Related Documentation

- [lib/server-action-utils.ts](/Users/stevenchandler/Desktop/quiver/quiver/lib/server-action-utils.ts) - Wrapper implementations
- [lib/auth/ARCHITECTURE.md](/Users/stevenchandler/Desktop/quiver/quiver/lib/auth/ARCHITECTURE.md) - Overall auth architecture
- [Social Sharing Implementation](./SOCIAL_SHARING.md) - Share feature docs

## Changelog

### 2025-11-01 - Authentication Hardening
- ✅ Wrapped `updateSession` with `withAuthenticatedAction`
- ✅ Removed unsafe `userId` parameter from `updateSession`
- ✅ Wrapped `uploadSessionMedia` with `withAuthenticatedAction`
- ✅ Updated all callers (ShareBar, ShareModal, SessionAnnotationModal)
- ✅ Updated unit tests to mock authentication
- ✅ Verified `trackSessionShare` already properly wrapped
- ✅ Documented authentication strategy for `generateShareImageUrl`
