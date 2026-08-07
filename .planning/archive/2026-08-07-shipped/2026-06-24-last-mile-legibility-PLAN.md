---
type: quiver-dev-pm-plan
target: web
status: proposed
risk: low
backend_owner: codex
frontend_owner: claude
approval_required: no
---

# Last-Mile Legibility Composer — half (a), v1 (Codex handoff)

## Objective
Build the **deterministic legibility composer** as a pure, flag-gated `lib/` module that turns the
signals Quiver already computes into a skill-aware, grounded, plain-English surf call — the
"says what the scorer already knows, out loud, for this surfer" layer from the spec. **No runtime
LLM, no new ML, served forecast number unchanged.** This slice ships the **engine + tests only**.
UI surfacing (web cards, native `PersonalSurfCallCard`) is a separate Claude follow-up.

Spec: `docs/superpowers/specs/2026-06-24-last-mile-translation-runtime-spec.md` (half (a) "Legibility").
Spike results (read this — it has the real examples + the two corrections): `…-spike-results.md`.

## Non-goals
- **(b) correction narrative** ("we run ~1.3 ft low on WNW") — blocked on SZI Phase A. Do not build.
- **UI / components** — no JSX, no card edits. Engine is headless; UI is the Claude follow-up.
- **Native parity** — later.
- **Skill-band resolution plumbing** — the composer takes a resolved skill band as a *parameter*
  (keeps it pure + sync + testable). Wiring it to `compute_user_match_score_core` is the UI follow-up.
- No served-number change, no migration, no new analytics events in this slice.

## Current evidence (from the spike — already verified against real prod data)
- Ran real `computeHourScore` over 4 beaches × ~18 real `enhanced_forecasts` hours. Skill-relativity,
  tide clauses, and generic-beach degradation all hold; a provenance audit (no clause without a
  backing value) passes.
- **The scorer is size-blind** — `computeHourScore` has no height term (`heightScore`/`periodScore`
  reserved = 0). Size/"too big/small for you" must come from served face height + skill band, and the
  **verdict must be size-gated** (otherwise a 1.7 ft day reads "Might work" for an advanced surfer).
- **`computeSwellDirScore` was broken** (returned 0 for every direction) — **now fixed** in
  `lib/surf/scoring.ts` (this session). So the swell-window fit is usable again; re-pull after rebasing.

## Read-first files (Codex: read before writing)
- `AGENTS.md`, `CLAUDE.md` (repo root), and the **nearest `ARCHITECTURE.md`** to `lib/surf/` and `lib/personalization/`.
- `lib/surf/scoring.ts` — `computeHourScore` / `computeHourScoreBreakdown` (the `HourScoreBreakdown` struct: `windScore`, `tideScore`, `swellDirScore`, `total0to100`, `windExposure?`, `swellAccess?`).
- `lib/utils/wave-height-transformer.ts` — `transformToFaceHeightWithMetadata` → `{ faceHeightFt, isCalibrated }`.
- `lib/utils/surf-call-logic.ts` — `computeSurfCall` / `SurfCallResult` (verdict thresholds, tide phase, character gating — mirror its gating posture, don't duplicate it).
- `lib/personalization/match-score.ts` + `supabase/migrations/20260612123000_match_score_skill_aware_band.sql` — the skill-band capability ceiling mapping (≤3 ft beginner / ≤5 int / ≤8 adv) and cold-start prior. The composer consumes a *resolved* band; do not call the RPC here.
- `types/terrain.ts` — `toBin5`, `TERRAIN_BINS`, `useTerrainFactors`.
- `__tests__/lib/surf/terrain-scoring.test.ts` — fixture/style reference.

## Existing patterns to follow
- Pure TS module, explicit exported types on every public function (TS-first, strict).
- Early returns; minimal comments (explain *why*). Match the formatting in `lib/surf/`.
- Reuse, don't reinvent: `computeHourScoreBreakdown` for fits, `transformToFaceHeightWithMetadata`
  for size+calibration, `types/terrain` for binning. Do **not** re-implement scoring math.

## Backend plan (Codex)
Create **`lib/surf/legible-call.ts`** (pure, sync, no I/O, no React). Suggested shape — adjust names to
local conventions, but keep the contract below stable (the UI follow-up will code to it):

```ts
export type SkillBand = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type ClauseKind = 'size' | 'swell_angle' | 'wind' | 'tide' | 'tide_window';

export interface LegibleClause {
  kind: ClauseKind;
  text: string;            // the surfer-facing fragment, e.g. "tide filling into the zone (1.9ft, rising)"
  signal: string;          // backing signal name, e.g. "swell_access" | "wave_height" | "tideScore"
  value: number | string;  // the backing value (grounding rule #1 — never null/undefined when emitted)
  estimated?: boolean;     // true → uncalibrated, rendered muted with a `~` (rule #2)
}

export interface LegibleCall {
  verdict: 'YES' | 'MAYBE' | 'NO';
  verdictLabel: string;          // "Worth it" | "Might work" | "Skip"
  headline: string;              // one-liner assembled from the 2–4 most decision-relevant clauses
  clauses: LegibleClause[];
  skillBand: SkillBand | null;   // null → "for you" framing dropped (anon/unknown)
}

// Per-hour input, assembled by the caller from data Quiver already has:
export interface LegibleHourInput {
  tsISO: string;
  faceHeightFt: number | null;       // served face height (transformToFaceHeight…)
  isCalibrated: boolean;             // beach.shoaling_factors != null
  breakdown: HourScoreBreakdown;     // from computeHourScoreBreakdown
  swellDirDeg: number | null;
  windKts: number | null; windDirDeg: number | null;
  tideFt: number | null; tideStatus: 'Rising' | 'Falling' | null;
}

export interface LegibleCallParams {
  beach: BeachGeometry;              // swell window, tide band + preferred dir, break_type, offshore, terrain arrays
  skillBand: SkillBand | null;       // resolved upstream; null → drop "for you"
  hours: LegibleHourInput[];         // the day's daytime series (for temporal tide-window + wind-crossover)
}

export function composeLegibleCall(params: LegibleCallParams): LegibleCall;
```

### Clause builders (each returns a clause **or null**; null = omit, never invent)
1. **size / "for you"** — skill-relative ceiling (beginner 3 / int 5 / adv 8 ft) + a worth-it floor per
   band. `faceFt > ceil` → "too big for you"; `< floor` → "too small to bother"; else "fun size for you".
   Uncalibrated → `estimated:true`, `~` prefix, **no shaping confidence**. `faceFt == null` → size clause omitted.
2. **swell_angle** (universal now that swellDirScore is fixed): prefer terrain `swellAccess` where
   present (`breakdown.swellAccess`); else use the corrected window-geometry fit (`breakdown.swellDirScore`).
   Buckets: ≥.7 "angled in clean" · .4–.7 "a touch side-on" · .15–.4 "partly shadowed at this angle" ·
   <.15 "wrong angle — mostly blocked". Omit only if **both** signals are absent.
3. **wind** — static from `windKts`/dir vs offshore (light/groomed/cross/onshore). **Temporal** clause
   ("clean till ~10am") **only if** the day's series shows a real clean→onshore crossover; otherwise static.
4. **tide** — `tideFt` vs band: `< min` "washes out till it fills" · `> max` "too full" · in-band
   "in the zone", and "filling into the zone" if `preferred_tide_direction` matches `tideStatus`.
5. **tide_window** — longest contiguous in-band (+ preferred-direction) daytime run → "best on the
   push, ~8–10am". Omit if < 2 in-band hours.

### Verdict (size-gated — this is the spike's key correction)
- `total0to100` → YES ≥70 / MAYBE ≥40 / NO. **Then gate:** size `too big` or `too small` or `null` →
  force **NO**; size `marginal` caps YES→MAYBE. (Mirror `surf-call-logic`'s character-gate posture.)

### Headline
Assemble verdict + the 2–4 most decision-relevant clauses (size always; then the limiting factor —
out-of-band tide / shadowed angle / onshore wind — then the positive best-window). Skill-tuned via `skillBand`.

## API / data contract
The composer is **pure and headless**: caller passes assembled signals (above), gets `LegibleCall`.
No new routes/actions/RPCs in this slice. The UI follow-up will assemble `LegibleCallParams` from
`useDataFetcher` + the resolved match-score band and render `clauses`/`headline`.

## Database / migration notes
None. Reads no DB. No schema change.

## Analytics / event notes
None in this slice. (A `last_mile_call_view` event will be added with the UI, allowlisted then.)

## Cross-app parity notes
Engine is web-side but **framework-agnostic pure TS** — intentionally portable so native can reuse the
same composer (or a port) when its `PersonalSurfCallCard` adopts it. Flag the contract in the follow-up
via `quiver-product-unity`. No native change here.

## Test plan (required — `__tests__/lib/surf/legible-call.test.ts`)
Use the spike's real beaches as fixtures (calibrated+terrain: Blacks 195–340°, Cottons 160–225°; generic: a no-terrain/no-shoaling beach).
1. **Skill-relativity:** same 1.9 ft hour → beginner "fun size"/MAYBE vs advanced "too small"/NO.
2. **Provenance audit:** every emitted clause has a non-null `value` (assert programmatically over `clauses`).
3. **Generic degradation:** no-terrain beach → no `swell_angle` clause from terrain; uncalibrated → every size clause `estimated:true` + `~`.
4. **Size-gate:** small surf (≤2 ft) never yields YES for advanced regardless of `total0to100`.
5. **Temporal honesty:** flat-wind series → no "till ~Xam" wind clause; a constructed crossover series → emits it.
6. **Wrap-around windows** (e.g. 340–20°) and **missing data** (`faceFt=null`, `tideFt=null`) → omit, never invent.

## Acceptance criteria
- `composeLegibleCall` renders for the fixture beaches with every clause traceable to a signal+value (test asserts it).
- Skill-relative copy verified across beginner/advanced on the same forecast.
- Generic-transform beach degrades to `~`/omit, never a confident shaping claim.
- Zero runtime LLM, zero new ML, served number untouched, no DB/route changes.
- `yarn typecheck` (Node 22) green · `npx jest __tests__/lib/surf/legible-call.test.ts` green ·
  `npx eslint --max-warnings=0 lib/surf/legible-call.ts <test>` clean.

## Flag
Gate any future call-site behind `LAST_MILE_CALL_ENABLED` (default **off**). The pure engine itself
needs no flag, but export a small `isLastMileCallEnabled()` helper reading the env/flag for the UI to use.

## Approval gates
None tripped (no deploy, no DB mutation, no outbound, no entitlement). **Do not commit** — leave the
diff for review.

## Rollback / failure plan
Pure additive module + tests; nothing wired to a render path, so rollback = delete the file. If the
clause copy reads wrong, iterate on the builders — no data/runtime risk.

## PM decision log
- 2026-06-24 — Engine-only slice; UI is a separate Claude follow-up (clean backend/frontend split per profile).
- 2026-06-24 — Composer takes a *resolved* skill band as a param (pure/sync/testable); RPC wiring deferred to UI.
- 2026-06-24 — Swell-angle source = terrain `swellAccess` where present, corrected `swellDirScore` elsewhere → universal clause (depends on the swellDirScore fix landed this session).
- 2026-06-24 — Verdict is size-gated (scorer is size-blind) — non-negotiable per spike finding.
