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
- No type changes needed — metadata is `Record<string, unknown>` in the JSONB column
- No changes to `ANONYMOUS_ALLOWED_EVENTS` — `page_view` is already listed
- Additive change, no breaking impact on existing queries

## Gap 2: Fire `profile_update` on successful profile save

### Problem

When users edit their profile (name, bio, experience level, etc.), no event fires. We can't measure profile completion rates or which fields users actually fill in.

### File

`components/profile/basic-profile-form.tsx`

### Change

After the successful `updateProfile()` call (around line 92), fire a `profile_update` event with metadata about which fields changed.

```ts
// After result.success check, before toast (line ~93)
const changedFields = Object.keys(data).filter((key) => {
  const original = profile?.[key as keyof Profile];
  const current = data[key as keyof ProfileFormValues];
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
- Authenticated-only event — no `ANONYMOUS_ALLOWED_EVENTS` change needed
- Only fires when fields actually changed (not on no-op saves)
- Avatar changes happen separately via `AvatarUpload` (persisted immediately) — not tracked here

## Gap 3: Track bottom nav tab switches

### Problem

`tab_view` events only fire on beach detail page tab switches (overview/forecast/reviews/intel). The bottom navigation bar (Home, Discover, Sessions, Profile) has no tracking. We can't measure which primary navigation paths users take on mobile.

### File

`components/home-screen/bottom-nav.tsx`

### Change

Add an `onClick` handler to each nav `<Link>` that fires `tab_view` with `source: "bottom_nav"` to distinguish from beach detail tab views.

```ts
// Add useTrackEvent hook
const { track } = useTrackEvent();

// Add onClick to each Link (inside navItems.map)
<Link
  href={item.href}
  onClick={() => {
    track("tab_view", {
      metadata: {
        tab: item.label.toLowerCase(),
        source: "bottom_nav",
      },
      debounceMs: 300,
    });
  }}
  // ... existing props
>
```

### Notes

- `tab_view` already exists in `ImplicitEventType` and `ANONYMOUS_ALLOWED_EVENTS`
- `<Link>` supports `onClick` — the handler fires before navigation
- 300ms debounce matches the existing beach detail tab_view debounce
- No need to track `previous_tab` — `page_view` events already provide navigation sequence
- The `source: "bottom_nav"` field lets us distinguish from beach detail tab switches in queries

## Gap 4: Track beach discovery card actions

### Problem

Beach discovery cards show ranked surf recommendations with "Plan Session" and "View Beach" buttons. Neither fires an event. We can't measure which recommendations users act on, blocking implicit preference learning (`discovery_click` has weight 3.0 in `EVENT_WEIGHTS`).

### File

`components/discover/beach-discovery-card.tsx`

### Change

Fire `discovery_click` when either CTA button is clicked, with metadata capturing the action type, rank, score, and match quality.

```ts
// Add useTrackEvent hook
const { track } = useTrackEvent();

// "Plan Session" button onClick (line 247)
onClick={() => {
  track("discovery_click", {
    beachId: beach.id,
    metadata: {
      action: "plan_session",
      rank,
      score: displayScore,
      match_quality: matchQuality,
    },
  });
  onPlanSession(beach.id);
}}

// "View Beach" link — wrap in onClick handler
<Link
  href={beachUrl}
  onClick={() => {
    track("discovery_click", {
      beachId: beach.id,
      metadata: {
        action: "view_beach",
        rank,
        score: displayScore,
        match_quality: matchQuality,
      },
    });
  }}
  // ... existing props
>
```

### Notes

- `discovery_click` already exists in `ImplicitEventType` with `EVENT_WEIGHTS` of 3.0 (high preference signal)
- Authenticated-only — beach discovery requires login. No `ANONYMOUS_ALLOWED_EVENTS` change needed
- `<Link>` `onClick` fires before navigation — event will be sent with `keepalive: true` (handled by `useTrackEvent`)
- Metadata matches the `DiscoveryClickMetadata` interface: `position` maps to `rank`, `score_shown` maps to `score`
- Default 1000ms debounce from `useTrackEvent` is fine for button clicks

## Infrastructure Changes

**None required.**

- All 4 event types already exist in `ImplicitEventType`
- No new entries needed in `ANONYMOUS_ALLOWED_EVENTS`
- No database migrations
- No API route changes
- No new hooks or utilities

## Testing Strategy

- **Unit tests:** Not needed — these are fire-and-forget tracking calls with no business logic impact
- **Verification:** After deployment, run the `/app-stats` dashboard queries filtering for each new event type over 24h to confirm events are flowing
- **Manual smoke test:** Navigate through each flow in dev, check browser dev tools Network tab for `/api/events` calls with correct payloads

## Dashboard Query Updates

After deployment, the existing `/app-stats` queries will automatically pick up new events since they query by `event_type` dynamically. The `page_view` pathname data can be queried with:

```sql
SELECT
  metadata->>'pathname' AS landing_page,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS unique_visitors
FROM user_events
WHERE event_type = 'page_view'
  AND created_at >= NOW() - INTERVAL '7 days'
  AND (bot_flagged IS NULL OR bot_flagged = false)
  AND metadata->>'pathname' IS NOT NULL
GROUP BY metadata->>'pathname'
ORDER BY views DESC
LIMIT 20;
```
