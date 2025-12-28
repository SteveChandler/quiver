# Quiver: Feature Gaps & Implementation Plan

**Generated**: December 10, 2025  
**Status**: Active - Prioritized gaps with implementation recommendations  
**Methodology**: Static code analysis, architecture review, research doc cross-reference

---

## Executive Summary

This document identifies functionality that is incomplete, looks functional but isn't, or has backend implementations without corresponding UI. Each gap includes severity, user impact, and actionable implementation recommendations.

### Priority Overview

| Priority | Issue                                   | Effort   | User Impact                         |
| -------- | --------------------------------------- | -------- | ----------------------------------- |
| 🟠 P1    | Push notifications: incomplete coverage | 1 day    | Medium - key notifications may not arrive |
| 🟠 P1    | Intel cleanup not scheduled             | 1h       | Low - data bloat                    |
| 🟠 P1    | GPS Discovery stubbed                   | 2-3 days | Medium - feature gap                |
| 🟡 P2    | Photo quota client-side only            | 2h       | Low - security risk                 |
| 🟡 P2    | Personalization scores not shown widely | 2-4h     | Low - missed value                  |
| 🟡 P2    | Coordinate naming inconsistency         | 1 day    | Low - bug risk                      |

---

## 🔴 Critical Gaps (Broken Promises)

_No current P0 gaps in this doc after removing the referral feature from the product surface._

## 🟠 Features With Backend But No UI

### 3. GPS-Based Beach Discovery (Stubbed)

**Location**: `lib/services/surf-discovery-service.ts:290-306`

**Problem**: The discover feature has types and parameters for GPS-based "nearby beaches" but the implementation is stubbed out.

**Evidence**:

```typescript
// GPS Phase (stubbed for Phase 2)
if (options.userLocation && options.radiusMiles) {
  console.warn("⚠️ GPS discovery not yet implemented (Phase 2)");
  // TODO Phase 2: Query get_nearby_beaches RPC function
}
```

**Database function exists**: `get_nearby_beaches` RPC is defined in migrations.

**Fix**: Uncomment and implement the GPS discovery logic:

```typescript
if (options.userLocation && options.radiusMiles) {
  const { data: nearby } = await supabase.rpc("get_nearby_beaches", {
    user_lat: options.userLocation.lat,
    user_lon: options.userLocation.lon,
    radius_miles: options.radiusMiles,
  });
  if (nearby) {
    for (const beach of nearby) {
      if (!candidates.find((c) => c.id === beach.id)) {
        candidates.push(beach);
      }
    }
  }
}
```

**Files to modify**:

- `lib/services/surf-discovery-service.ts`
- `hooks/use-surf-discovery.ts` (to pass user location)

---

### 4. Personalization Scores Not Widely Shown

**Backend exists (sophisticated)**:

- `lib/services/preference-learning-service.ts` - learns from 5+ rated sessions
- `lib/services/personalized-scoring-service.ts` - calculates match scores
- `/api/beach/personalized-score` - API endpoint
- `/api/cron/update-user-preferences` - nightly computation

**Problem**: The `PersonalizedBadge` component exists and is wired to `BeachCard`, but most callers don't pass personalization data.

**Fix**: Create shared hook for consistent usage:

```typescript
// hooks/use-beach-personalization.ts
export function useBeachPersonalization(beachId: string | null) {
  const { user } = useAuth();
  const [data, setData] = useState<{
    score: PersonalizedScore | null;
    loading: boolean;
  }>({ score: null, loading: false });

  useEffect(() => {
    if (!user || !beachId) return;
    setData((prev) => ({ ...prev, loading: true }));

    fetch(`/api/beach/personalized-score?beachId=${beachId}`)
      .then((res) => res.json())
      .then((response) => setData({ score: response.data, loading: false }))
      .catch(() => setData({ score: null, loading: false }));
  }, [user, beachId]);

  return data;
}
```

Then integrate in `components/discover/beach-discovery-card.tsx` and map views.

---

## 🟡 Features That May Not Work in Production

### 5. Push Notifications: No Sending Logic

**Problem**: The app registers device tokens and **can** send pushes, but coverage is still incomplete (only certain flows send).

**What exists**:

- `lib/web/push-notifications.ts` - Web FCM registration ✅
- `lib/mobile/push-notifications.ts` - Capacitor registration ✅
- `public/firebase-messaging-sw.js` - Service worker ✅
- `/api/devices/upsert` - Token storage ✅
- `components/analytics/pwa-and-push-listeners.tsx` - Integration ✅
- `lib/services/push-notifications.ts` - Server-side sending + invalid token pruning ✅
- `/api/admin/test-push` - Admin-only end-to-end verification ✅
- `/api/cron/forecast-alerts` - Forecast threshold push alerts (home beach) ✅

**What's missing**: Productized notification coverage (trigger points + UX consistency)

**Recommended next integration points** (add notification calls):

- `actions/social-actions.ts` - follow, like, comment
- `actions/session-invite-actions.ts` - session invitations
- `actions/intel-actions.ts` - confirmation of user's intel

**Routing note**: Push payloads can include `data.url` and both mobile + web handlers fall back to navigating to it (useful for new notification types).

---

### 6. Intel 7-Day Auto-Expiration (Not Scheduled)

**Problem**: Database function `cleanup_old_beach_intel()` exists but no cron job calls it.

**Evidence**: `vercel.json` has 6 cron jobs, none for intel cleanup:

```json
{
  "path": "/api/cron/enhanced-forecast-sync", "schedule": "0 6 * * *"
},
// ... no intel cleanup
```

**Fix**:

1. Create `/app/api/cron/cleanup-intel/route.ts`:

```typescript
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  // Soft-delete expired intel posts
  const { count } = await supabase
    .from("intel_posts")
    .update({ is_active: false })
    .lt("expires_at", new Date().toISOString())
    .eq("is_active", true);

  // Run database cleanup function
  await supabase.rpc("cleanup_old_beach_intel");

  return NextResponse.json({
    success: true,
    cleaned: count,
    message: `Marked ${count} expired intel posts as inactive`,
  });
}
```

2. Add to `vercel.json`:

```json
{
  "path": "/api/cron/cleanup-intel",
  "schedule": "0 4 * * *"
}
```

---

### 7. Photo Quota (Client-Side Only)

**Problem**: The 100MB storage limit is checked in `lib/supabase/storage.ts` but only client-side. A malicious client could bypass it.

**Evidence**:

```typescript
// lib/supabase/storage.ts:151
const remainingBytes = Math.max(0, 100 * 1024 * 1024 - totalBytes); // 100MB per user limit
```

**Fix Option A**: Add check in upload API route before storing

**Fix Option B**: Add database trigger (stronger):

```sql
CREATE OR REPLACE FUNCTION check_user_storage_quota()
RETURNS TRIGGER AS $$
DECLARE
  total_size BIGINT;
  max_size BIGINT := 104857600; -- 100MB
BEGIN
  SELECT COALESCE(SUM(file_size), 0) INTO total_size
  FROM session_photos
  WHERE user_id = NEW.user_id;

  IF total_size + COALESCE(NEW.file_size, 0) > max_size THEN
    RAISE EXCEPTION 'Storage quota exceeded (100MB limit)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_storage_quota
BEFORE INSERT ON session_photos
FOR EACH ROW EXECUTE FUNCTION check_user_storage_quota();
```

---

## 🔵 Architecture/Data Gaps

### 8. Coordinate Naming Inconsistency

**Problem**: Three naming conventions exist for longitude:

| Layer    | Property     | Example              |
| -------- | ------------ | -------------------- |
| Database | `center_lng` | `beaches.center_lng` |
| Types    | `lon`        | `Coordinates.lon`    |
| Mapbox   | `lng`        | `LngLat.lng`         |

**Evidence**:

```typescript
// lib/utils/beach-to-surfspot-transformer.ts:7-10
 * CRITICAL COORDINATE MAPPING:
 * - Database uses: lat, lon
 * - SurfSpot uses: coordinates.lat, coordinates.lng
 * - This transformer explicitly maps lon → lng
```

**Risk areas found**:

- `lib/services/ndbc-service.ts:46` - `lon: Number(s.lon ?? s.lng)` (fallback)
- `lib/services/noaa-tide-service.ts:35` - `lon: Number(s.lng ?? s.lon)` (opposite order!)

**Fix**:

1. **Create normalizer utility** in `lib/types/coordinates.ts`:

```typescript
export function normalizeCoordinates(
  coords: any
): { lat: number; lon: number } | null {
  const lat = coords.lat ?? coords.latitude ?? coords.center_lat;
  const lon = coords.lon ?? coords.lng ?? coords.longitude ?? coords.center_lng;

  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!isFinite(lat) || !isFinite(lon)) return null;

  return { lat, lon };
}
```

2. **Document convention** in `lib/types/ARCHITECTURE.md`:

   - Internal code: use `lat`, `lon`
   - Database: `center_lat`, `center_lng` (legacy)
   - Mapbox APIs: `lat`, `lng` (external requirement)

3. **(Optional)** Add ESLint rule to warn on `lng` usage in non-Mapbox contexts.

---

### 9. `checkUserExists()` Not Implemented

**Location**: `lib/auth/auth-utils.ts:213-219`

**Problem**: Function always returns `false`, making it useless.

```typescript
export async function checkUserExists(email: string): Promise<boolean> {
  console.log("[auth-utils] User existence check not yet implemented");
  return false;
}
```

**Impact**: Low - appears unused in critical paths, but documentation suggests future use.

**Fix**: Either implement via Supabase admin API or remove the function.

---

## Implementation Checklist

### Week 1 (Critical Fixes)

- [ ] Add intel cleanup cron job (1h)
- [ ] Update CHANGELOG.md

### Week 2 (Production Safety)

- [ ] Implement push notification sender service (4-6h)
- [ ] Integrate notifications in social actions (2h)
- [ ] Add server-side photo quota enforcement (2h)

### Week 3 (Feature Completion)

- [ ] Implement GPS discovery (uncomment + test) (4h)
- [ ] Create `useBeachPersonalization` hook (2h)
- [ ] Wire personalization to discovery cards (2h)
- [ ] Add coordinate normalization utility (2h)

### Backlog

- [ ] Beginner Fit Badges (research-planned, not built) (1-2 days)
- [ ] Share card Wave/Equipment variants (2-4 days)
- [ ] ESLint rule for coordinate naming (4h)
- [ ] Mobile app store deployment (multi-day)

---

## Testing Requirements

For each fix, add corresponding tests:

### Referral XP

_(Referral XP removed along with the referral feature.)_

### Intel Cleanup

```typescript
// __tests__/api/cron/cleanup-intel.test.ts
it("should mark expired intel as inactive", async () => {
  // Setup: Create intel with expires_at in past
  // Action: Call POST /api/cron/cleanup-intel
  // Assert: Intel now has is_active = false
});
```

### Photo Quota

```typescript
// __tests__/lib/supabase/storage.test.ts
it("should reject upload when quota exceeded", async () => {
  // Mock: User at 99MB usage
  // Action: Attempt 5MB upload
  // Assert: Error thrown with quota message
});
```

---

## Related Documents

- `docs/CODEBASE_ASSESSMENT_2025-12-08.md` - Overall health assessment
- `docs/research/IMPLEMENTATION_STATUS_REPORT.md` - Research feature tracking
- `docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md` - Personalization details
- `CHANGELOG.md` - Track fixes as they're implemented

---

_Document created: December 10, 2025_  
_Last updated: December 10, 2025_









