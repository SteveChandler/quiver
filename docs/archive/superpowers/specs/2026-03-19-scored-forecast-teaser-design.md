# Scored Forecast Teaser — Web-to-App Funnel

## Problem

~432 anonymous sessions/week browse beach detail pages from search. They see 7 generic CTAs ("Get Alerts", "Match: ???", "Sign Up", horizon upsell) ~4x per session. CTR is 0.5%. Users get the answer they came for (water temp, wave height) and leave. There's no "whoa" moment that earns a signup.

Meanwhile, the Living Timeline — the "whoa" feature — lives exclusively in the native app (quiver-native), which isn't in the App Store yet. The scored forecast API endpoint (`/api/forecasts/scored/[beachId]`) already exists in the web repo but isn't exposed to anonymous users.

## Goal

Replace the generic CTAs with a single progressive-reveal flow: show eerily specific scored forecast data for free (golden windows, waves/hr, score timeline), then ask for the signup AFTER the user has seen the value. The CTA positions the signup as joining the waitlist for the native app experience.

When the app ships, all signed-up users get the launch email. No separate waitlist table — the signup IS the waitlist.

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| CTA strategy | Progressive reveal — data first, CTA after | 0.5% CTR means gate-first isn't working |
| How much data for free | Headline + score timeline + conditions chips | Enough to create "whoa", session briefing stays app-exclusive |
| Layout | Integrated hero → data → CTA flow | One continuous narrative, not separate sections |
| CTA action | Open existing auth modal | Reuses infra, creates real user (can send digests, re-engagement) |
| Waitlist mechanism | None — every user gets app launch email | Simpler, no new tables |
| Platform detection | UA sniff for CTA copy | "coming to iOS" vs "coming to Android" |

## What Changes

### Removed (6 CTAs killed for anonymous users on beach detail)

1. **MatchScoreTeaser** — `components/recommendations/match-score-teaser.tsx` — hide on beach detail when scored forecast data is available
2. **InlineSignupCta** — `components/seo/inline-signup-cta.tsx` — remove from beach detail
3. **StickySignupBar** — `components/ui/sticky-signup-bar.tsx` — remove from beach detail (rendered in `app/[intent]/[city]/[beachSlug]/page.tsx`, not `beach-detail.tsx`)
4. **PersonalizedForecastTeaser** — `components/beach-detail/personalized-forecast-teaser.tsx` — remove from forecast tab
5. **PublicContentGate** on Best Surf Window — `components/ui/public-content-gate.tsx` — remove blur gate (data is free now)
6. **Horizon Strip Upsell** — the `publicMode`-only `motion.button` + auth modal block in `beach-detail.tsx` (~lines 616-652) — remove, since the scored forecast teaser already shows the timeline data

These components still exist and may be used on other pages. We only remove them from beach detail pages when scored forecast data is available.

### Added

#### `ScoredForecastTeaser` component

**Location:** `components/beach-detail/scored-forecast-teaser.tsx`

**Data source:** Create a shared hook `useScoredForecast(beachId)` that wraps `useDataFetcher` to fetch from `/api/forecasts/scored/[beachId]`. The hook returns `{ data, loading, error }` and is called from `beach-detail.tsx` (not inside `ScoredForecastTeaser`). This way the parent knows whether data loaded and can conditionally hide the old CTAs. The hook result is passed to `ScoredForecastTeaser` as a prop.

**Loading state:** Renders nothing while loading (no skeleton). Reserve `min-height: 0` — component grows into place to minimize CLS.

**Renders (top to bottom):**

1. **Golden Window Banner**
   - Pulse dot (respects `prefers-reduced-motion` — static dot when enabled) + "BEST WINDOW TODAY" label (golden `#FFD639`)
   - Headline: "6am – 9am" + "~18 waves/hr for 3 hours" (teal `#00D4AA`)
   - If no golden window exists (all scores < 60): show "No prime windows today" with the highest-scoring slot instead

2. **Score Timeline Bars**
   - One bar per returned time slot, colored by composite score:
     - >= 70: teal `#00D4AA`
     - >= 50: golden `#FFD639`
     - >= 30: orange `#FF8C42`
     - < 30: danger `#FF5C5C`
   - Golden window bars (slots with `compositeScore >= 60`) full opacity, others 0.5
   - Hour labels below each bar
   - Each bar has `aria-label` with time + score (e.g., "6am-9am: score 72, good conditions")
   - If fewer than 2 slots returned (e.g., late at night), treat as no data — render nothing

3. **Conditions Chips**
   - 4 chips showing data from the peak golden window slot (or first slot if no golden window):
     - **Height** (pink `#FF3B8B` label): `timeSlot.surfHeight.min`-`timeSlot.surfHeight.max` + "ft"
     - **Swell** (teal `#00D4AA` label): `timeSlot.swells[0].compass` + `timeSlot.swells[0].height`ft @ `timeSlot.swells[0].period`s
     - **Wind** (teal if `timeSlot.isOffshore`, golden `#FFD639` if onshore): "Offshore/Onshore" + `timeSlot.windSpeed` mph
     - **Water** (muted `#9AABC6` label): `timeSlot.waterTemp`

4. **App CTA Card** (anonymous users only)
   - "This is a snapshot."
   - Platform-aware body copy:
     - iOS (detected via `navigator.userAgent`): "The full Living Timeline is coming to iOS — scrub through time, feel the swell with haptics, get session briefings like 'be here at 6:47am.'"
     - Android: same but "coming to Android"
     - Desktop/unknown: "coming to your phone"
   - Pink button: "Join the Waitlist"
   - Sub-text: "We'll email you when it drops. No spam."
   - `onClick`: `useState` boolean opens inline `<UnifiedAuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />` (same pattern as all other CTA components in the codebase)
   - Component self-guards with `useAuth()` — hides CTA card entirely for authenticated users

**Fallback:** If the scored API returns an error or empty data, the component renders nothing and the existing beach detail page shows through unchanged (existing CTAs remain active as fallback).

### Modified

#### Route file (`app/[intent]/[city]/[beachSlug]/page.tsx`)

- Remove `StickySignupBar` unconditionally from this route (it's a server component — can't conditionally check client-side scored data). The `ScoredForecastTeaser` CTA card replaces it as the sole signup trigger on beach detail pages.

#### Beach Detail Page (`components/beach-detail.tsx`)

- Call `useScoredForecast(beach.id)` — gets `{ data: scoredData, loading, error }`
- Pass `scoredData` to `<ScoredForecastTeaser data={scoredData} beachId={beach.id} />` between the hero and stats grid
- Use `const hasScoredData = !!scoredData && scoredData.timeSlots.length >= 2` to conditionally hide old CTAs
- When `hasScoredData` and user is anonymous:
  - Hide `MatchScoreTeaser`
  - Hide `InlineSignupCta`
  - Hide Horizon Strip Upsell
- When `hasScoredData` and user is authenticated:
  - Still show the scored data (golden window, bars, chips) — it's useful!
  - CTA card is hidden (component self-guards)
  - Hide `MatchScoreTeaser` and `InlineSignupCta` (redundant)
- When `!hasScoredData` (API error, empty, late night):
  - `ScoredForecastTeaser` renders nothing
  - Old CTAs remain visible as fallback

#### Forecast Tab (`components/beach-detail/tabs/forecast-tab.tsx`)

- Remove `PersonalizedForecastTeaser` when scored data is available
- Remove `PublicContentGate` blur on Best Surf Window — the data is free now

#### Event type registration (`types/implicit-preferences.ts` + `app/api/events/route.ts`)

- Add `scored_forecast_view`, `scored_forecast_cta_view`, and `scored_forecast_cta_click` to:
  - `ImplicitEventType` union type in `types/implicit-preferences.ts`
  - `EVENT_WEIGHTS` record (weight `0` — these are funnel events, not preference signals)
  - `VALID_EVENTS` array in `app/api/events/route.ts`
  - `ANONYMOUS_ALLOWED_EVENTS` array in `app/api/events/route.ts`
  - `PRE_AUTH_ONLY_EVENTS` array in `app/api/events/route.ts` (defense-in-depth)

### Platform Detection

Simple UA-based detection — no library needed:

```typescript
function getPlatformCopy(): string {
  if (typeof navigator === 'undefined') return 'coming to your phone';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'coming to iOS';
  if (/Android/.test(ua)) return 'coming to Android';
  return 'coming to your phone';
}
```

This runs client-side only. Server-rendered HTML uses the generic fallback.

## Data Flow

```
Beach Detail Page
  ├─ useScoredForecast(beachId)
  │    ├─ Fetches: GET /api/forecasts/scored/{beachId}
  │    └─ Returns: { data, loading, error }
  │         data: { timeSlots[], goldenWindows[], beach }
  │           timeSlots[n]: { forecastAt, surfHeight: {min,max}, swells[], windSpeed,
  │                           windDirection, isOffshore, tideHeight, waterTemp, airTemp,
  │                           compositeScore, rideableWavesPerHour, waveFrequencyConfidence }
  │           goldenWindows[n]: { startTime, endTime, peakTime, peakScore,
  │                              durationMinutes, peakWavesPerHour }
  ├─ hasScoredData? → hide old CTAs : show old CTAs as fallback
  └─ ScoredForecastTeaser (data prop)
       ├─ Renders: golden window banner + score bars + conditions chips
       └─ CTA card (anon only)
            └─ onClick → UnifiedAuthModal (useState pattern)
                 └─ Signup → user in profiles table → gets app launch email eventually
```

## Event Tracking

New events for the scored forecast teaser (anonymous only):

| Event | When | Metadata |
|-------|------|----------|
| `scored_forecast_view` | Teaser enters viewport | `{ beachId, hasGoldenWindow, peakScore }` |
| `scored_forecast_cta_view` | CTA card enters viewport | `{ beachId, platform }` |
| `scored_forecast_cta_click` | "Join the Waitlist" tapped | `{ beachId, platform }` |

These replace the existing `signup_cta_view` and `signup_cta_click` events on beach detail pages (since we're removing those CTAs). Pre-auth event guard applies — none fire for authenticated users. Server-side blocklist in `app/api/events/route.ts` must also be updated.

## What We're NOT Building

- No waitlist table or flag — every user gets the app launch email
- No smart app banner — app isn't in the store yet
- No web version of the Living Timeline animation — native-only
- No session briefing narrative on web — app-exclusive hook
- No changes to non-beach-detail pages — other pages keep their existing CTAs

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| CTA click rate on beach detail | 0.5% (12/2225) | >2% |
| Auth modal open rate | 237/week | Maintain or increase |
| Signup completion rate | 6/week | >10/week |
| Bounce rate on beach detail | 23% (226/994) | <20% |

## Testing

- **Unit tests:** ScoredForecastTeaser renders golden window data, handles no-data gracefully, hides CTA for authenticated users, platform detection returns correct copy
- **E2E:** Anonymous user on beach detail sees scored forecast, clicks waitlist, auth modal opens
- **Visual:** Playwright screenshot on mobile viewport to verify layout matches mockup
