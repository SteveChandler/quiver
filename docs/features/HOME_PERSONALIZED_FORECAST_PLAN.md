# Personalized Home Forecast Plan

## Goals & Outcomes
- **Best spot for you today**: Surface one beach recommendation that aligns with the rider’s preferences, recent behavior, and today’s conditions. Should feel like a coach pick, not a static home beach card.
- **Best time for you today**: Highlight a concrete 2–3 hour window that balances wave quality, tide stage, and daylight for the chosen beach.
- **Ideal conditions summary**: Summarize why the recommendation is a match (wave range, tide, wind, crowd fit, board pick) in a single glance card to boost trust.
- **Success metrics**: Increase home-to-session flows (+X% clicks on `Plan Session`, +Y% visits to beach detail) and collect feedback on recommendation accuracy.

## Experience Blueprint
- Position the Personalized Forecast card at the top of the Forecast tab (`components/home-screen/index.tsx`) directly under the welcome text so it is visible before browsing tabs.
- Card layout (mobile-first grid that collapses to rows on desktop):
  1. **Header**: “Best spot for you today” + `PersonalizedBadge` to reinforce tailored logic.
  2. **Beach snapshot**: beach name, distance (if `useGeo` has coords), quick CTA linking to `/beach/[slug]`.
  3. **Best surf window**: display `todayWindow.start`–`end` with icons showing tide trend and wind arrows. Provide fallback text (“Need more data? Update preferences.”) if unable to compute.
  4. **Ideal conditions pills**: 3–4 chips (wave height, crowd fit, wind, tide) plus reasons string (e.g., “Matches your favorite board + left point preference”).
  5. **Mini session CTA row**: `Plan Session` + `Log Session` buttons reuse existing handlers for continuity.
- Empty/error states:
  - **Not logged in**: reuse `HomeBeachBanner` to prompt onboarding/prefs.
  - **No preferences yet**: Show educational copy with a “Update surf profile” CTA -> `/profile`.
  - **API failure**: degrade to showing current home beach forecast or hide the card entirely while logging to Sentry.

## Data & Scoring Strategy
1. **Candidate beach pool**
   - Start with `(homeBeach || favorites || nearby chips)` combinations; fallback to `coach picks` to guarantee at least one beach.
   - Include user’s last 3 logged beaches (from `sessions` table via `/api/sessions` or supabase view) to reflect recency bias.
2. **Personalized scoring**
   - Reuse `lib/services/personalized-scoring-service.ts` to blend base coach score, onboarding prefs, learned prefs (`user_surf_preferences`), and `user_beach_affinity`.
   - Normalize scores 0–100, keep breakdown for explanation copy.
3. **Forecast inputs**
   - For each candidate fetch next 24 hours of enhanced forecasts via `/api/forecasts/update-enhanced?beachId=...`.
   - Collapse forecast points into dayparts (early/late AM, mid-day, PM) and compute:
     - Weighted wave rating (height within personal min/max, favorable period).
     - Wind comfort (offshore/side).
     - Tide alignment with learned preference band.
   - Pick the time window with highest combined score. Persist a JSON blob with: `start`, `end`, `wave_height`, `wind`, `tide`, `confidence`.
4. **Ideal conditions summary**
   - Compose summary sentences using data from scoring breakdown plus window metrics (e.g., “3-4 ft, light offshore wind, mid tide rising — matches your preferred wave size and favorite board”).
   - Provide metadata fields for UI chips: `primary_reason`, `secondary_reason`, `board_hint`, `crowd_hint`.

## Technical Implementation Plan

### Phase 1 – Service & API (Backend)
1. **Create service module** `lib/services/personalized-home-forecast-service.ts`
   - Input: `userId`, optional `geo` (lat/lng), optional override `beachId`.
   - Responsibilities:
     - Build candidate list (home beach, favorites from `favorite_beaches`, recent sessions, high-affinity beaches).
     - Fetch/calc forecasts in parallel (rate-limit aware) and enrich with sunrise/sunset metadata.
     - Score beaches using `personalized-scoring-service` and select best.
     - Produce DTO: `{ beach, window, summary, reasons[], diagnostics, generated_at }`.
   - Cache results in-memory (LRU keyed by `userId` for 5 minutes) to avoid hitting Supabase/forecast API repeatedly while the dashboard stays open.
2. **API route** `app/api/home/personalized-forecast/route.ts`
   - Auth required; use `createRouteHandlerClient`.
   - Calls service, returns 200 payload or 204 when no personalized data available (allow client to degrade).
   - Logs telemetry (duration, candidate count, winning beach id, errors).
   - Enforce rate-limit via middleware (e.g., existing `lib/server/rate-limit` if available) to protect forecast endpoint.

### Phase 2 – Frontend Data Layer
1. **Hook** `hooks/use-personalized-home-forecast.ts`
   - Wraps `useDataFetcher` / `useSWR` with `/api/home/personalized-forecast`.
   - Accepts optional `coords` from `useGeo` to pass down.
   - Exposes `{ recommendation, loading, error, refetch }`.
   - Handles stale data by comparing `generated_at` vs now and auto-refreshing if >30 minutes old or when `homeBeach` changes.
2. **Type definitions**
   - Add `PersonalizedHomeForecast` interface under `types/forecast.ts` or new `types/personalization.ts`.
   - Provide union for UI states (e.g., `"loading" | "ready" | "needs_prefs" | "error"`).
3. **Storybook/fixtures**
   - Create mocked JSON payloads under `components/home-screen/__fixtures__/personalized-forecast.ts` to aid development and tests.

### Phase 3 – UI Integration
1. **New component** `components/home-screen/personalized-forecast-card.tsx`
   - Receives `recommendation`, skeleton flag, error fallback.
   - Uses existing `Card`, `Badge`, `KpiTile`, `Button`.
   - Chips/pills treated as `Badge` variants.
   - Provide `onPlanSession`, `onViewBeach` callbacks for analytics reuse.
2. **Home screen wiring**
   - In `components/home-screen/index.tsx`:
     - Invoke `usePersonalizedHomeForecast` near `useGeo`.
     - Render skeleton version while loading.
     - Insert card inside Forecast tab, before `NearbyBeachChips`.
     - Pass `profile`, `homeBeach`, `coords` for context.
   - Keep logic isolated so Forecast tab continues to function even if personalized service fails (guard inside `TabsContent`).
3. **Copy & formatting**
   - Content guidelines stored in `docs/copy/home-personalized-forecast.md` (optional) to align design/product review.

### Phase 4 – Analytics, Feedback, & Controls
1. Instrument events:
   - `personalized_forecast_impression`, `personalized_forecast_click_plan`, `personalized_forecast_click_view_beach`, `personalized_forecast_dismissed`, `personalized_forecast_feedback_submitted`.
   - Payload fields: `beach_id`, `score`, `window_start/end`, `reasons`, `personalized` boolean.
2. Optional `Was this helpful?` micro-feedback button writing to Supabase table `personalized_forecast_feedback`.
3. Feature flag via existing config (e.g., `utils/feature-flags.ts`) to roll out gradually or disable quickly from remote config.

## Testing & Validation
- **Unit tests**
  - Service scoring: mock Supabase + forecast data to ensure best window logic.
  - Hook fallback states & caching.
  - UI snapshot tests to confirm skeleton, ready, error states.
- **Integration tests**
  - Playwright scenario ensuring Home Forecast card appears for seeded user with preferences (update `.env.playwright` fixtures if needed).
  - API route tests verifying auth guard, 204 path, telemetry logging.
- **Load testing**
  - Script hitting `/api/home/personalized-forecast` with 100 concurrent requests to verify forecast fetch batching and caching behave.
- **Manual QA checklist**
  - With/without home beach, no preferences, limited data, offline mode, GEO permission denied, user toggling favorites.

## Dependencies & Risks
- **Supabase data freshness**: `user_surf_preferences` must be populated; add migration/backfill task if coverage is low.
- **Forecast API latency**: Need caching and concurrency guard (Promise.allSettled + abort if API >5s). Consider storing last best recommendation nightly.
- **Privacy**: Only expose data for authenticated user; ensure API route validates session before hitting service role.
- **Design alignment**: Need Figma for card layout; schedule review with product/design before implementation begins.
- **Edge cases**: If best window occurs before sunrise or after sunset, either clamp to daylight or mention “dawn patrol” label.

## Rollout Plan
1. Develop behind feature flag `home_personalized_forecast`.
2. Internal dogfood with seeded QA users (enable flag).
3. Monitor logs + KPIs for 48h.
4. Gradually expand to 10%, 50%, 100% cohorts while comparing session creation rate vs control.

---  
**Owner**: TBD (Home team)  
**Supporting**: Data platform (for preference enrichment), Infra (caching)  
**ETA**: ~2 sprints once dependencies (preferences backfill, caching) are ready.
