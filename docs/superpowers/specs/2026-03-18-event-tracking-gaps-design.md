# Event Tracking Gaps — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Wire up 4 tracking gaps where features already exist but events don't fire

## Context

An audit of the Quiver event tracking system revealed ~40 event types actively firing and ~60 defined but unused. Most unused events correspond to features that don't exist yet (social, product tours, location GPS). However, 4 gaps exist where the feature UI is live but tracking is missing or incomplete.

### What's NOT in scope

- Events for features that don't exist yet (`social_*`, `product_tour_*`, `location_update`)
- Events that are redundant with existing tracking (`session_action` — covered by `session_log_start/submit`, `forecast_check` — covered by `forecast_interaction`)
- Post-session share tracking (`session_share_opened/closed_post_save` — already firing)
- Map zoom/pan tracking (`map_interaction` with zoom_level — already firing)
- Surfer discover page tracking (feature is half-built, suggested users disabled)

## Type Changes Required

Several metadata interfaces in `types/implicit-preferences.ts` need updates to support the new use cases. All changes are additive (new optional fields).

### `PageViewMetadata` — add `pathname`

```ts
export interface PageViewMetadata {
  page: string;
  pathname?: string;  // NEW: full URL path e.g. "/ca/san-diego/blacks"
  referrer?: string;
  browser_session_id?: string;
}
```

### `ProfileUpdateMetadata` — add `fields_changed` array

```ts
export interface ProfileUpdateMetadata {
  field?: 'home_beach' | 'experience' | 'preferences' | 'board' | 'avatar' | 'name' | 'other';
  fields_changed?: string[];  // NEW: array of changed field names
  email_changed?: boolean;    // NEW: whether email was updated
}
```

The existing `field` stays for backward compat; new callers use `fields_changed`.

### `TabViewMetadata` — make `previous_tab` and `time_on_previous_ms` optional

```ts
export interface TabViewMetadata {
  tab: string;
  previous_tab?: string;          // Was required, now optional
  time_on_previous_ms?: number;   // Was required, now optional
  source?: string;                // NEW: "bottom_nav" or "beach_detail"
}
```

Beach detail tab tracking already passes these fields, so existing callers are unaffected.

### `DiscoveryClickMetadata` — add `action` and `match_quality`

```ts
export interface DiscoveryClickMetadata {
  position: number;
  score_shown: number;
  alternatives_count?: number;    // Was required, now optional
  action?: string;                // NEW: "plan_session" or "view_beach"
  match_quality?: string;         // NEW: "perfect" | "excellent" | "good" | "fair"
}
```

### Type guard updates — `isDiscoveryClickMetadata` / `isDiscoverySkipMetadata`

Making `alternatives_count` optional breaks the existing type guards at lines 605-628 of `types/implicit-preferences.ts`. The guards use `'alternatives_count' in metadata` to discriminate between click and skip events. With `alternatives_count` now optional on clicks, a click without it would be misclassified as a skip.

**Fix:** Use `chosen_beach_id` (only present on skip events) as the discriminator instead:

```ts
// Before
export function isDiscoveryClickMetadata(metadata: EventMetadata | null): metadata is DiscoveryClickMetadata {
  if (!metadata) return false;
  return 'position' in metadata && 'score_shown' in metadata && 'alternatives_count' in metadata;
}

export function isDiscoverySkipMetadata(metadata: EventMetadata | null): metadata is DiscoverySkipMetadata {
  if (!metadata) return false;
  return 'position' in metadata && 'score_shown' in metadata && !('alternatives_count' in metadata);
}

// After
export function isDiscoveryClickMetadata(metadata: EventMetadata | null): metadata is DiscoveryClickMetadata {
  if (!metadata) return false;
  return 'position' in metadata && 'score_shown' in metadata && !('chosen_beach_id' in metadata);
}

export function isDiscoverySkipMetadata(metadata: EventMetadata | null): metadata is DiscoverySkipMetadata {
  if (!metadata) return false;
  return 'position' in metadata && 'score_shown' in metadata && 'chosen_beach_id' in metadata;
}
```

`chosen_beach_id` is unique to `DiscoverySkipMetadata` and provides a stable discriminator.

## Gap 1: Add full URL path to `page_view` events

### Problem

`page_view` events store a simplified `page` label (e.g., `"ca"`, `"home"`, `"discover"`) but not the full URL path. We can't determine which landing pages drive traffic — viewing `"ca"` could be `/ca/san-diego/blacks` or `/ca/ventura/mondos-beach`.

### File

`components/page-tracker.tsx`

### Change

Add `pathname` to the metadata object alongside the existing `page` field. The `page` field stays for backward compatibility and human-readable grouping.

```ts
// Before (line 95-101)
track("page_view", {
  metadata: {
    page,
    referrer: prevPathname.current || "",
    browser_session_id: sessionId,
  },
  debounceMs: 500,
});

// After
track("page_view", {
  metadata: {
    page,
    pathname,
    referrer: prevPathname.current || "",
    browser_session_id: sessionId,
  },
  debounceMs: 500,
});
```

### Notes

- `pathname` is already available from the `usePathname()` hook (line 78)
- Requires `PageViewMetadata` type update (see Type Changes section)
- No changes to `ANONYMOUS_ALLOWED_EVENTS` — `page_view` is already listed
- Additive change, no breaking impact on existing queries

## Gap 2: Fire `profile_update` on successful profile save

### Problem

When users edit their profile (name, bio, experience level, etc.), no event fires. We can't measure profile completion rates or which fields users actually fill in.

### File

`components/profile/basic-profile-form.tsx`

### Change

After the successful `updateProfile()` call (around line 92), fire a `profile_update` event with metadata about which fields changed. Normalize null vs empty string to avoid false positives (form defaults coerce `null` to `""` via `profile?.field || ""`).

```ts
// Import useTrackEvent
const { track } = useTrackEvent();

// After result.success check, before toast (line ~93)
const changedFields = Object.keys(data).filter((key) => {
  const original = profile?.[key as keyof Profile] ?? "";
  const current = data[key as keyof ProfileFormValues] ?? "";
  return original !== current;
});

if (changedFields.length > 0) {
  track("profile_update", {
    metadata: {
      fields_changed: changedFields,
      email_changed: emailChanged,
    },
  });
}
```

### Notes

- Import `useTrackEvent` hook
- `profile_update` already exists in `ImplicitEventType` (line 26 of `types/implicit-preferences.ts`)
- Requires `ProfileUpdateMetadata` type update (see Type Changes section)
- Authenticated-only event — no `ANONYMOUS_ALLOWED_EVENTS` change needed
- Only fires when fields actually changed (not on no-op saves)
- Null-safe comparison: `?? ""` normalizes both sides to prevent `null !== ""` false positives
- Avatar changes happen separately via `AvatarUpload` (persisted immediately) — not tracked here

## Gap 3: Track bottom nav tab switches

### Problem

`tab_view` events only fire on beach detail page tab switches (overview/forecast/reviews/intel). The bottom navigation bar (Home, Discover, Sessions, Profile) has no tracking. We can't measure which primary navigation paths users take on mobile.

### File

`components/home-screen/bottom-nav.tsx`

### Change

Add an `onClick` handler to each nav `<Link>` that fires `tab_view` with `source: "bottom_nav"` to distinguish from beach detail tab views. Guard against firing on the already-active tab.

```ts
// Add imports
import { useTrackEvent } from "@/hooks/use-track-event";

// Inside BottomNav component
const { track } = useTrackEvent();

// Add onClick to each Link (inside navItems.map), guarded by !active
<Link
  href={item.href}
  onClick={() => {
    if (!active) {
      track("tab_view", {
        metadata: {
          tab: item.label.toLowerCase(),
          source: "bottom_nav",
        },
        debounceMs: 300,
      });
    }
  }}
  // ... existing props
>
```

### Notes

- `tab_view` already exists in `ImplicitEventType` and `ANONYMOUS_ALLOWED_EVENTS`
- Requires `TabViewMetadata` type update (see Type Changes section)
- `<Link>` supports `onClick` — the handler fires before navigation
- 300ms debounce matches the existing beach detail tab_view debounce
- Guard with `if (!active)` to avoid noisy "Home to Home" events when user taps current tab
- `previous_tab` omitted — `page_view` events already capture navigation sequence
- The `source: "bottom_nav"` field distinguishes from beach detail tab switches in queries
- Note: tapping Home (`/`) fires `tab_view` but no `page_view` (PageTracker skips `/`). This is expected — the landing page has its own tracking.

## Gap 4: Track beach discovery card actions

### Problem

Beach discovery cards show ranked surf recommendations with "Plan Session" and "View Beach" buttons. Neither fires an event. We can't measure which recommendations users act on, blocking implicit preference learning (`discovery_click` has weight 3.0 in `EVENT_WEIGHTS`).

### File

`components/discover/beach-discovery-card.tsx`

### Import collision

This component already imports `import { track } from "@/lib/analytics"` (line 24) for GA4 tracking. The `useTrackEvent` hook also provides a function called `track`. Resolve by renaming the hook's return:

```ts
const { track: trackEvent } = useTrackEvent();
```

Use `trackEvent()` for user_events tracking and keep `track()` for existing GA4 calls.

### Change

Fire `discovery_click` when either CTA button is clicked. Use the existing `DiscoveryClickMetadata` field names (`position`, `score_shown`) with new optional fields (`action`, `match_quality`).

```ts
// Import and rename to avoid collision with GA4 track
import { useTrackEvent } from "@/hooks/use-track-event";
const { track: trackEvent } = useTrackEvent();

// "Plan Session" button onClick (line 247)
onClick={() => {
  trackEvent("discovery_click", {
    beachId: beach.id,
    metadata: {
      position: rank,
      score_shown: displayScore,
      action: "plan_session",
      match_quality: matchQuality,
    },
  });
  onPlanSession(beach.id);
}}

// "View Beach" link — add onClick handler
<Link
  href={beachUrl}
  onClick={() => {
    trackEvent("discovery_click", {
      beachId: beach.id,
      metadata: {
        position: rank,
        score_shown: displayScore,
        action: "view_beach",
        match_quality: matchQuality,
      },
    });
  }}
  // ... existing props
>
```

### Notes

- `discovery_click` already exists in `ImplicitEventType` with `EVENT_WEIGHTS` of 3.0 (high preference signal)
- Requires `DiscoveryClickMetadata` type update (see Type Changes section)
- GA4 `track` import collision resolved with rename: `const { track: trackEvent } = useTrackEvent()`
- Uses existing field names (`position`, `score_shown`) from `DiscoveryClickMetadata`, plus new optional `action` and `match_quality`
- `alternatives_count` made optional — not readily available in this context
- Authenticated-only — beach discovery requires login. No `ANONYMOUS_ALLOWED_EVENTS` change needed
- `<Link>` `onClick` fires before navigation — event will be sent with `keepalive: true` (handled by `useTrackEvent`)
- Default 1000ms debounce from `useTrackEvent` is fine for button clicks

## Infrastructure Changes

**Minimal — type updates only.**

- Update 4 metadata interfaces in `types/implicit-preferences.ts` (see Type Changes section)
- Update 2 type guards (`isDiscoveryClickMetadata`, `isDiscoverySkipMetadata`) to use `chosen_beach_id` discriminator
- All 4 event types already exist in `ImplicitEventType`
- No new entries needed in `ANONYMOUS_ALLOWED_EVENTS`
- No database migrations
- No API route changes
- No new hooks or utilities

## Testing Strategy

- **TypeScript compilation:** Run `tsc --noEmit` to verify metadata payloads match updated interfaces
- **Unit tests:** Not needed — these are fire-and-forget tracking calls with no business logic impact
- **Verification:** After deployment, run the `/app-stats` dashboard queries filtering for each new event type over 24h to confirm events are flowing
- **Manual smoke test:** Navigate through each flow in dev, check browser dev tools Network tab for `/api/events` calls with correct payloads

## Dashboard Query Updates

After deployment, the existing `/app-stats` queries will automatically pick up new events since they query by `event_type` dynamically. The `page_view` pathname data can be queried with:

```sql
SELECT
  metadata->>'pathname' AS landing_page,
  COUNT(*) AS views,
  COUNT(DISTINCT COALESCE(user_id::text, session_id::text)) AS unique_visitors
FROM user_events
WHERE event_type = 'page_view'
  AND created_at >= NOW() - INTERVAL '7 days'
  AND (bot_flagged IS NULL OR bot_flagged = false)
  AND metadata->>'pathname' IS NOT NULL
GROUP BY metadata->>'pathname'
ORDER BY views DESC
LIMIT 20;
```
