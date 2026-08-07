# Surf Briefing Enrichments

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Web (quiver/) + Native (quiver-native/)

## Problem

The oracle home screen has all the data to tell surfers where and when to surf, but presents it as a dashboard — ranked cards with numbers. It doesn't synthesize conditions into a briefing: why one spot beats another, what the regional pattern is, or what to avoid. Surfers checking at 8pm see today's dying conditions instead of tomorrow's plan.

## Solution

Enrich existing components with three data-driven additions. No new sections or layout changes.

1. **Regional call** — data-driven one-liner replacing the generic hero tagline
2. **Strategy tags** — one standout-trait badge per Nearby Spots card
3. **Evening transition** — sunset-driven switch to tomorrow's briefing with condensed "Rest of Today"

All logic lives in the discovery engine (`surf-discovery-orchestrator.ts`). Both web and native consume the same API response.

---

## 1. Data Model

### New fields on `SurfDiscoveryRecommendation`

```ts
strategyTag?: {
  type: 'biggest_waves' | 'cleanest' | 'sleep_in' | 'low_crowd' | 'skip';
  label: string;    // "Biggest waves", "Cleanest", etc.
  reason: string;   // "Offshore at 8am · 13s SSW"
}
```

- One tag per recommendation, or none
- Hero (index 0) does not get a tag
- Each tag type assigned at most once (except `skip` — multiple allowed)

### New fields on `SurfDiscoveryResponse`

```ts
regionalCall: string;

eveningTransition?: {
  active: boolean;
  restOfToday: {
    summary: string;      // "Evening glass-off possible"
    conditions: string;   // "5pm · 5 mph offshore · 2-3ft · Falling tide"
    waveHeight: string;   // "2-3ft"
  };
  // Tomorrow's windows come through the existing slotForecasts field
  // on the hero recommendation (index 0). No separate array needed.
  tomorrowRegionalCall: string;
}
```

---

## 2. Strategy Tag Assignment

Computed in the orchestrator after all recommendations are scored and sorted. Only non-hero recommendations (index 1+) get tags.

### Tag definitions

| Tag | Condition | Color |
|-----|-----------|-------|
| `biggest_waves` | Highest `waveHeightFit` subscore AND wave height > hero's wave height | `#F78E42` (Charming Orange) |
| `cleanest` | Highest `windAlignment` subscore AND windAlignment >= 16/20 | `#22C55E` |
| `sleep_in` | Re-score with 9am+ time filter; retains >= 70% of original score | `#8B5CF6` |
| `low_crowd` | `crowd_level` is `light` or `moderate` AND score >= 40 | `#06B6D4` |
| `skip` | Score < 40 (existing `recommendationLabel` logic) | `#EF4444` |

### Assignment rules

- Each beach gets at most one tag
- Each tag type assigned at most once (except `skip`)
- Priority when multiple tags qualify: `biggest_waves` > `cleanest` > `low_crowd` > `sleep_in` > `skip`
- If no beach qualifies for a tag type, that tag doesn't appear

### Sleep-in check

Call `selectBestWindow` a second time for candidate beaches with a `timeSlot: 'late_morning'` filter. If the resulting score is >= 70% of the original best-window score, the beach qualifies as sleep-in friendly.

---

## 3. Regional Call Generation

Deterministic template from the top 3-5 recommendations' forecast data. No LLM.

### Pattern detection

1. **Dominant swell** — most common swell direction + period across top recs
   - e.g., 4/5 have SSW at 12-13s → "SSW swell at 13s"
2. **Aspect advantage** — if top recs skew toward a common beach aspect
   - e.g., top 3 face south → "favoring south-facing breaks"
3. **Wind trend** — compare wind at dawn slot vs. midday slot for the hero beach
   - e.g., 0 mph at 5am, 10 mph at 11am → "Glassy at dawn, onshore by 11am"

### Template

`"{swell} {aspect} · {wind_trend}"`

Example: "SSW swell at 13s favoring south-facing breaks · Glassy at dawn, onshore by 11am"

### Fallbacks

- No clear dominant swell → omit swell clause
- No clear aspect skew → omit aspect clause
- No wind change → "Light winds all morning" or "Onshore all day"
- Flat everywhere → "Small surf, pick your spot for fun"

**Copy refinement:** Use `/clarify` skill during implementation to polish template strings.

---

## 4. Evening Transition

### Trigger

Current local time > sunset time for the hero beach's timezone. Uses existing sun times cache in the discovery engine.

### Behavior

1. Compute tomorrow's recommendations using the same orchestrator (same location, skill, preferences; `horizonHours: 24` anchored to tomorrow 5am local)
2. Build `restOfToday`:
   - Find last remaining window today with score > 0
   - If none → `summary: "Done for today"`
   - If one exists → summarize with time, wind, height, tide
3. Swap the response:
   - `recommendations` → tomorrow's ranked beaches
   - `regionalCall` → tomorrow's pattern
   - Hero → tomorrow's #1 beach
   - Strategy tags → computed from tomorrow's set
   - `eveningTransition.active = true`
   - `eveningTransition.restOfToday` = condensed today summary

### Edge case

Between sunset and midnight, the entire home screen (hero, nearby spots, windows) reflects tomorrow. Intentional — the surfer is planning tomorrow.

### Before sunset

Zero behavioral change. Everything works exactly as it does now.

---

## 5. UI Changes — Web

### `NearbySpots` / `SpotCard` (`components/oracle/nearby-spots.tsx`)

- Add optional `strategyTag` to `NearbySpot` interface
- Render colored pill badge top-left of photo area
- Skip cards (score < 40) get `opacity: 0.6`
- `conditions` text swaps to `strategyTag.reason` when tag is present

### `OracleHero` (`components/oracle/oracle-hero.tsx`)

- Existing tagline reads from `regionalCall` instead of current generic generation

### `TodaysWindows` (`components/oracle/todays-windows.tsx`)

- When `eveningTransition.active`, render "Rest of Today" condensed card above Tomorrow's Windows
- Single-line card: summary, conditions, wave height
- Subdued styling (muted heading, smaller than Tomorrow's section)

### `oracle-home-screen.tsx`

- Pass `strategyTag` through to NearbySpots from discovery data
- Pass `eveningTransition` data to TodaysWindows

---

## 6. UI Changes — Native

### `NearbySpotCard` (`src/components/home/nearby-spot-card.tsx`)

- Same `strategyTag` prop, pill badge over photo, same color mapping
- Skip cards get reduced opacity
- `conditions` swaps to `strategyTag.reason` when present

### `BeachHero` (`src/components/home/beach-hero.tsx`)

- Hero tagline reads from `regionalCall`

### `ForecastTimeline` (`src/components/home/forecast-timeline.tsx`)

- When `eveningTransition.active`, render condensed "Rest of Today" row above tomorrow's timeline

### `home.tsx` (`src/screens/home.tsx`)

- Pass `strategyTag` from discovery data to NearbySpots
- Pass `eveningTransition` to ForecastTimeline

---

## 7. Testing

### Unit tests

- Strategy tag assignment: verify priority ordering, one-tag-per-beach, skip handling
- Regional call generation: test each template clause independently, verify fallbacks
- Evening transition trigger: mock sun times, verify swap behavior at sunset boundary
- Sleep-in re-scoring: verify 70% threshold logic

### E2E tests

- Web: verify tag pills render on nearby spots cards
- Web: verify hero tagline updates from regionalCall
- Web: verify evening transition renders "Rest of Today" + tomorrow
- Native: same coverage for tag pills, hero tagline, forecast timeline

---

## Non-goals

- No new sections or layout changes
- No LLM-generated copy
- No changes to scoring weights or discovery ranking
- No changes to the hero selection logic (still picks #1 by score)
