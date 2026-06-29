---
type: quiver-dev-pm-plan
target: web
status: proposed
risk: low
backend_owner: codex
frontend_owner: claude
approval_required: no
---

# Last-Mile Legibility — Web UI surfacing (integration slice)

## Objective
Surface the deterministic legible call (built in `lib/surf/legible-call.ts`, committed
`35d86d9b5`) on the web beach-detail surf-call card — the grounded, skill-aware "why this call"
line a surfer reads before paddling out. Flag-gated (`LAST_MILE_CALL_ENABLED`, default off),
graceful fallback to today's copy when off. This is the user-facing turn of half (a).

**Surface correction (recon finding):** the spec (§6) names `PersonalSurfCallCard` / `match-mega-card`
— **neither exists on web**; they're forward-references. The real web surface is **`TodaySurfCall`**
(`components/beach-detail/zine/today-surf-call.tsx`, rendered by `zine-overview-body.tsx`). Native's
`PersonalSurfCallCard` is a separate follow-up (see Cross-app parity).

## Non-goals
- Native surfacing (separate slice — composer must be ported; repos don't share packages).
- Correction narrative (b) — blocked on SZI Phase A.
- Changing the served forecast number, the verdict math, or the match score.
- New analytics beyond a single gated view event (optional, see Analytics).

## Why an integration slice (not pure frontend)
`composeLegibleCall` needs **per-hour** inputs (`LegibleHourInput[]`: faceHeight, isCalibrated, the
`computeHourScore` breakdown, swellDir/wind/tide per hour). The component only receives the
**summarized** `SurfCallResult` (best-window aggregate; the hourly breakdown is computed inside
`computeSurfCall` and discarded). So a small backend step must assemble the hours and call the
composer where the forecasts + beach + scoring already live, then attach the result to the report.

## Current evidence (recon, committed `main`)
- Surface: `TodaySurfCall` (verdict stamp · best-window trail · tier callout · `whySentence` · SWELL/WIND/TIDE strip · printer's-mark). Props: `{ beach: Beach; surfCallReport?: SurfCallResult | null; beachTimezone?: string | null }`.
- Data path: `actions/spot/spot-surf-report-actions.ts` → `getSpotSurfReport(beach, boardClass?, authCtx?)` → `computeSurfCall()` (+ `computeSurfCallTiers`) → `SurfCallResult`. Cached (`unstable_cache`, 15-min). Auth refetch via `GET /app/api/surf/call/route.ts`; public via `getSpotSurfReportPublic`.
- `computeSurfCall` already iterates the hourly `EnhancedForecastEntity[]` and runs per-hour scoring internally — **the inputs the composer needs are already in scope there**, just not returned.
- Skill band already resolved: `resolveVerdictSkill(profileSkill, boardClass)` (profile > board prior > default) → exposed as `SurfCallResult.userTier` + `skillSource`. **Reuse directly** as the composer's `skillBand`.
- `isCalibrated` already on `SurfCallResult` (beach-level). Beach geometry (window, tide band, terrain arrays) is on the `beach` row the action already loads.
- Flag pattern: `lib/flags/app-first-landing.ts` (`import "server-only"`). `isLastMileCallEnabled()` already exists in `legible-call.ts`.

## Backend plan (Codex)
In the surf-report path (`actions/spot/spot-surf-report-actions.ts`, alongside `computeSurfCall`):
1. Assemble `LegibleHourInput[]` for the day's **daytime** forecast hours from the same
   `EnhancedForecastEntity[]` + `beach` `computeSurfCall` already uses: per hour set `faceHeightFt`
   (served face), `isCalibrated`, `breakdown` (`computeHourScoreBreakdown`), `swellDirDeg`,
   `windKts`, `windDirDeg`, `tideFt`, `tideStatus`. Factor a shared helper if `computeSurfCall`
   already computes the per-hour breakdown (avoid double-scoring).
2. Resolve `skillBand` from the existing `resolveVerdictSkill` result (the same value behind `userTier`).
3. **Timezone:** the composer's `formatHour` reads `getUTCHours()`. Pass each hour's `tsISO` as the
   **beach-local wall-clock** instant (shift by `beachTimezone`) so headline times read local, OR add
   a `tz` param to the composer. Prefer shifting in the assembly (keeps the composer pure/UTC-naive).
4. Call `composeLegibleCall({ beach, skillBand, hours })` **only when** `isLastMileCallEnabled()`.
5. Attach `legibleCall?: LegibleCall | null` to `SurfCallResult` (additive, optional — no consumer
   breaks). Keep it out of the cache key logic except via the flag.
6. Do **not** change verdict/score math or `whySentence`.

Contract delta (additive):
```ts
// lib/utils/surf-call-logic.ts — SurfCallResult
legibleCall?: import("@/lib/surf/legible-call").LegibleCall | null;
```

## Frontend plan (Claude)
In `TodaySurfCall` (and only there):
- When `surfCallReport.legibleCall` is present (flag on), render the **headline as the grounded
  "why" line** in place of the editorial `whySentence` (the legible headline *is* the better why),
  keeping the verdict stamp, best-window trail, and SWELL/WIND/TIDE strip as the data backing.
- Render the limiting/positive clauses (`legibleCall.clauses`, already ordered by the composer) as a
  short stack of **Space Mono** data lines under the headline (matches the wind/tide cell treatment);
  uncalibrated clauses (`estimated`) get the muted/`~` treatment.
- **Fallback:** flag off OR `legibleCall == null` → render exactly today's `whySentence` (no regression).
- Zine discipline: handwritten tone for the headline, Space Mono for the clause values, **one new
  decorative sticker** (do not reuse the existing stamp/squiggle on this card), honor
  `prefers-reduced-motion`, test mobile + desktop. Times shown beach-local (`beachTimezone`).

## API / data contract
`SurfCallResult` gains optional `legibleCall`. `GET /api/surf/call` and `getSpotSurfReportPublic`
pass it through unchanged (already return the full `report`). No new route. No request-shape change.

## Database / migration notes
None. No schema change; reads existing forecast + beach data.

## Analytics / event notes
Optional: one allowlisted `last_mile_call_view` event when the legible call renders (not a pre-auth
funnel event; fine for authed + anon). Defer if it complicates the slice — not required for v1.

## Cross-app parity notes
**Flag now, build later:** native `PersonalSurfCallCard` is the parity follow-up. The composer is pure
TS but lives in the web repo — native needs a port or an API consumption path. Track via
`quiver-product-unity`; do not edit native in this slice. The `LegibleCall` shape is the shared contract.

## Test plan
- **Backend (Codex):** unit-test the hour-assembly + flag gate in `__tests__/actions/spot/` or
  `__tests__/lib/utils/surf-call-logic.test.ts` — flag off → `legibleCall` absent/null; flag on →
  populated, skill band matches `userTier`, times beach-local. Don't duplicate composer tests
  (covered by `legible-call.test.ts`).
- **Frontend (Claude):** extend `__tests__/components/beach-detail/zine/today-surf-call.test.tsx` —
  legible headline renders when present; falls back to `whySentence` when null; clauses render with
  mono/`~` treatment; reduced-motion respected.
- **E2E:** smoke the existing `e2e/auth-spot-surf-report.spec.ts` + `e2e/guest-spot-surf-report.spec.ts`
  with the flag on (env) to confirm no regression and the line appears. Keep them green with flag off.

## Acceptance criteria
- Flag on: `TodaySurfCall` shows the grounded legible headline + clauses, skill-relative, times
  beach-local, on calibrated and generic beaches (generic → `~`, no terrain clause).
- Flag off / `legibleCall == null`: pixel-identical to today (no regression).
- Served number, verdict, score, and match score unchanged. No new DB/route/migration.
- `yarn typecheck` (Node 22) · `npx jest` for the touched test files · scoped eslint — all green.
- Targeted Playwright (`auth-spot-surf-report`, `guest-spot-surf-report`) green flag-on and flag-off.

## Approval gates
None tripped (no deploy, DB mutation, outbound, entitlement). Do not commit without being asked; do
not push/promote. Enabling the flag in any deployed env is a separate explicit decision.

## Rollback / failure plan
Additive + flag-gated: rollback = leave `LAST_MILE_CALL_ENABLED` unset (default off) → today's UI.
Code rollback = revert the two slice commits. No data risk.

## PM decision log
- 2026-06-24 — Web surface is `TodaySurfCall`, not `PersonalSurfCallCard` (doesn't exist on web). Spec §6 is a forward-reference; recorded here.
- 2026-06-24 — Assemble `LegibleHourInput[]` **server-side** (where forecasts+scoring already are) and attach `legibleCall` to `SurfCallResult` — over client-side recompute or a new endpoint. Minimal, cached, no extra round-trip.
- 2026-06-24 — Legible headline **replaces** the editorial `whySentence` when present (it's the better, grounded why); condition strip stays as data backing. [Adjustable — flag if you want augment-not-replace.]
- 2026-06-24 — Reuse `resolveVerdictSkill`/`userTier` for the skill band; shift hour timestamps to beach-local in assembly so the composer's UTC `formatHour` reads local.
- 2026-06-24 — Backend wiring = Codex; `TodaySurfCall` render = Claude. Sequence: Codex contract+assembly → review diff → Claude render → integration review → flag-on/off E2E.
