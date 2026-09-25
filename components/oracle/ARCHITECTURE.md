# Signed-in Home (`components/oracle`)

The authenticated `/` route. `components/landing-page/auth-aware-landing-wrapper.tsx` loads `OracleHomeScreen` for signed-in users. The native counterpart is `quiver-native/src/screens/home.tsx` with `src/components/home/beach-hero.tsx`. The two should read as one product, so the rules below mirror native wherever the same concept exists.

## Data flow

```
useOracleData (hooks/use-oracle-data.ts)
  ├─ useProfileContext        profile + home beach
  ├─ useGeolocation           explicit GPS only (autoRequest: false)
  ├─ useSurfDiscovery ×2      primary + San Diego fallback, /api/surf/discover
  └─ heroPhotoUrl             real photo of the hero beach, or null
OracleHomeScreen
  ├─ canonical gate           hero only when sessionDecision.selection matches topRecommendation
  ├─ /api/beaches/:id/sources cam availability for the hero media card
  ├─ getHomeAskCounts()       sessions + follows for the ask card (actions/oracle-actions.ts)
  └─ getLocalActivity()       activity at the hero beach
```

Discovery is projected to the canonical selection on the client (`lib/recommendations/canonical-decision/client-projection.ts`). `recommendations` then holds only the hero, so `NearbySpots` is usually empty. It renders no heading over an empty rail and keeps only the "Use my location" action. Surfacing more spots needs a data source that has its own safety gating (native uses a separate ranked rail). Don't just relax the projection.

## Layout

Everything renders inside `HomeZineShell`: cream paper on the Deep Twilight stage, one shell for every state so a state change swaps content rather than the page.

- **Below `lg`:** a single stack of hero → home-beach card (when the hero isn't home) → ask card → Today's Windows → nearby → activity.
- **At `lg` and up:** two panes (`lg:grid-cols-[minmax(0,1fr)_360px]`). Left: the hero and ask card. Right: a sticky aside (`lg:sticky lg:top-24`) with windows, nearby and activity. Place and plan sit side by side, the way Surfline and AllTrails do it on desktop.

## Hero media card

`zine/home-call-plate.tsx` wraps `zine/home-hero-media.tsx`.

- **Viewpoints:** Swell, Sat, Photo and Cam, in native's order, with native's labels and native's default (swell); see `quiver-native/src/lib/hero-viewpoints.ts`.
  - **Swell:** a Mapbox outdoors tile plus canvas streaks travelling with the swell. Lines move faster at longer periods and fade out toward the beach so they read as water. With reduced motion they draw once, still.
  - **Sat:** a Mapbox satellite-streets tile.
  - **Photo:** only a real photo of the hero beach. No stock ocean.
  - **Cam:** only when `/sources` returns a `camera_url`. Renders `CamsSection variant="hero"`.
- **Choosing a viewpoint:**
  - Only available viewpoints are offered; the switcher hides when fewer than two are available.
  - The choice is remembered in `localStorage` (`quiver:home-hero-viewpoint`). It's read after mount, so SSR and first paint match.
  - If the remembered viewpoint isn't available, the card falls back to the first available one.
- **Overlays:** beach name, drive context (`hero-drive-subtitle`), the call (`hero-decision-badge`, h1 = tier word), and one line giving *when* plus the recommendation's own reason. Map views carry a visible Mapbox/OSM attribution.
- **Below the card:** the regional call as a small handwritten note, then the condition strip (swell, wind, tide, water).

### Photo rule

`heroPhotoUrl` must be a photo of the beach the hero names. Home-beach photos (the curated name map, or `getBestBeachPhotosAction`) only apply while the hero *is* the home beach. A regional best elsewhere uses its own `photo_url`. With no photo the value is `null`, and the card shows the map rather than an image that isn't this beach.

## The call vocabulary

`getCanonicalVerdictCall(verdict, score, tense)` in `components/forecast/score-band-call.ts` is the web twin of native `decisionLabelForCandidate` + `getSurfActionPhrase`. The canonical verdict picks the band and the recommendation score picks the tier inside it, so a label can never contradict the call:

| Verdict | Score band | Tier → phrase (now) | Upcoming |
|---|---|---|---|
| go | 70–100 | EPIC → "Go now!", GOOD → "Go surf!" | "Don't miss it", "Worth planning" |
| maybe | 40–69 | FAIR → "Worth a look", RIDEABLE → "Slim pickings" | unchanged |
| no | 0–39 | MEH → "Skip it" | unchanged |

`go` / `maybe` / `no` are internal verdicts; users never see them as copy. "Upcoming" means the selected window starts later than now (including tomorrow). The tier word stays sentence case in the DOM and is uppercased by CSS, so its accessible name reads "Fair".

Zine headings need the `zine-display` class, because `globals.css` forces `--font-heading` onto every h1 with `!important`.

## Ask card (`contextual-cta.tsx`)

The first match wins:

1. No home beach → "Set your home beach".
2. Session logged today → "Share your session" (`hasSessionToday` isn't wired yet; it's always false).
3. A `go` call → "Paddle out — log a session".
4. A `no` call → "Set alarm".
5. No sessions logged → "Log a session. We'll sharpen the forecast." (native `FirstSessionCTA`).
6. 5+ sessions and following nobody → "Invite a friend" (native `selectHomeAsk` invite rule).
7. Anything else → "Log a session".

Counts come from `getHomeAskCounts()`: the `get_profile_stats` totals and the caller's `user_follows` rows, the same sources native uses. While the counts are unknown, the count-gated asks (5 and 6) don't fire.

## Waiting states

Both waiting states render the home beach's media card with the call withheld, inside the same two-pane frame as the resolved page, so the call lands without a layout jump. Neither restates a verdict or its numbers.

- **Cold load (`HomeZineLoading`):** shows native's "Checking the buoy" once the profile has produced a home beach. The map image downloads during the discovery wait. Before the profile resolves, it falls back to skeleton bars.
- **Recheck (`HomeZineRechecking`):** `useSurfDiscovery` drops the call when the surfer comes back to a *hidden* tab. Window blur/focus alone doesn't count, because the page stays on screen. That's the safety contract: a hold activated while they were away must beat the stale positive call. This state shows native's "Updating surf call".
- **Expiry while hidden:** when the decision's 15-minute expiry fires in a hidden tab, the call is dropped rather than refetched. The return recheck fetches it, so background tabs no longer poll discovery.

## Metrics

- **`home_discovery_request`:** one per discovery request, carrying `home_load_id` and `request_number`.
- **`home_call_rendered`:** one per call that becomes visible, with `ms_since_request`, `ms_since_navigation`, `recheck` and the same `home_load_id`. This is the time-to-call metric.
- **Consent and names:** both events are consent-gated client PostHog events (`captureClientPostHogEventAfterConsent`), not part of the `user_events` taxonomy.
- **Server side:** `/api/surf/discover` sends `Server-Timing` per stage. See `docs/performance/SIGNED_IN_HOME_20260924.md`.

## Tests

- `__tests__/components/oracle/`: `oracle-home-screen`, `home-hero-media`, `contextual-cta`, `nearby-spots`, `todays-windows`.
- `__tests__/components/forecast/score-band-call.test.ts`: the call vocabulary.
- `__tests__/hooks/use-oracle-data.hero-photo.test.tsx`: the photo rule.
- `__tests__/hooks/use-surf-discovery*.test.tsx`: resume and hold behavior.
- E2E (opt-in, live backend): `e2e/home.spec.ts` and `e2e/home-perf-probe.spec.ts`.

jsdom has no canvas, so suites that render the hero stub `HTMLCanvasElement.prototype.getContext`.
