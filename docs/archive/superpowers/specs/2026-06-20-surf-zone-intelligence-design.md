# Surf Zone Intelligence — Design Spec

**Status:** Approved design, pending implementation-plan. **Date:** 2026-06-20. **Implementer:** Codex (cold). **Scope:** Quiver Web only.

> This is the design/architecture spec. The task-by-task, file-grounded implementation plan is a separate document (produced next). Everything here is verified against the repo at HEAD — anchors and reuse targets are real.

---

## 1. Goal & Framing

Build a **measure-first, demand-weighted, per-dimension forecast-accuracy + zone-condition system** that uses your users' own data and AI to show **where our forecast is wrong at the beaches users actually watch**, and what each zone tends to do (tide windows, closeouts, and — later — rip/current risk).

This is the **first turn of a flywheel**, not the whole thing:
1. **Measure** (this spec): per-dimension accuracy + zone condition flags, internal/read-only.
2. **Correct** (later, gated on #1): feed validated deltas into the forecast number users see.
3. **Suggest** (later, gated on #2): better beach suggestions ride on a sharper forecast.

Granularity is **beach-level** (sessions are logged per beach; sub-beach zones are not backed by data). Imagery/satellite is **out** (see §11).

## 2. Core Principle — Ground Truth Is Per-Dimension

Trust each signal only where trust is earned:

| Dimension | Ground truth | Rationale |
|---|---|---|
| **Wave height** | **User sessions** (`session_forecast_snapshots.actual_conditions`) | Trusted by us; surfers are good at it; our known gaps live here (face-height underreads). |
| **Wind speed + direction** | **Objective *observed* wind at session time** (see §5 — this is the one genuinely new piece) | Users can't eyeball wind. **Do NOT calibrate against user-reported wind.** |
| **Wind feel / quality / closeout / rip / drift cues** | **AI-extracted from session free-text** (`notes`, `description`, `wave_characteristics`, `rip_current_observed`, `hazards`) | Rescues the *qualitative* user knowledge that IS reliable. |

**Hard rule for Codex:** the wind accuracy delta must compare forecast wind to an **observed** source, never to another forecast and never to the user's reported `wind_speed_mph`/`wind_direction`.

## 3. Architecture — Two Layers + One Surface

1. **Numeric spine** — deterministic TypeScript, fully recomputable, no AI. Per-beach, per-dimension deltas + physics-derived condition indices + demand rank. This is the trustworthy core.
2. **AI intelligence layer** — **offline, run locally via Codex, reviewed before trusted.** Two jobs: (a) extract structured signal from session free-text; (b) synthesize the per-zone narrative + correction hint. **No runtime/production LLM calls, no API keys in prod.** Outputs are persisted, source-tagged (`source = 'codex'`), and carry a `status` of `draft | reviewed`.
3. **Surface** — a **new admin-gated, flag-gated internal page** (NOT the existing public `app/forecast-accuracy` SEO page) that reads both layers: demand-ranked table → per-beach drill-down.

Separation is deliberate: the numeric spine can be trusted and auto-refreshed; the AI layer is advisory, offline, and human-reviewed.

## 4. Reuse Map (verified — reuse, don't reinvent)

| Need | Reuse | Location |
|---|---|---|
| Predicted-vs-reported pairs | `session_forecast_snapshots` (`forecast_snapshot` / `actual_conditions` JSONB, completion trigger) | `supabase/migrations/20250822190000_forecast_calibration_tables.sql` |
| Snapshot field shapes (incl. `wind_speed_mph: {forecast,actual,diff}`) | `forecast-snapshot-utils.ts` | `lib/utils/forecast-snapshot-utils.ts` |
| Accuracy math (deltas, paired deltas, horizon buckets, baselines) | `accuracy-metrics.ts` | `lib/services/forecast/accuracy-metrics.ts` |
| Per-beach accuracy aggregate + recompute | `beach_forecast_accuracy` table + `update_beach_forecast_accuracy` RPC | `actions/forecast-calibration-actions.ts`, migrations |
| Stats helpers (`percentile`, `findModes`, `calculateConfidence`, `normalizeTideStatus`) | `preference-learning-service.ts` | `lib/services/preference-learning-service.ts` |
| Demand / popularity (mock-excluded) | popular beaches API + `get_popular_beaches` | `app/api/beaches/popular/route.ts` |
| Wind **forecast** (to be compared against obs) | `nws-wind-service.ts`, `open-meteo-wind-service.ts` | `lib/services/` |
| Rip risk (already ingested per beach) | `rip_current_risks` table | `types/database.generated.ts` |
| Beach geometry for drift/closeout | `aspect_deg`, `swell_window_{min,center,max}_deg`, `preferred_tide_ft_{min,max}`, `preferred_tide_direction`, `hazards` | beaches row |
| Real-user exclusion | `profiles.is_mock`, `analytics_is_real_user`, `is_system_account` | (used across aggregates) |
| Admin gating | `withAdminAuth` | `lib/middleware/api-wrappers` (precedent: `app/api/admin/*`) |
| Service-role aggregation | `createSupabaseServiceRoleClient` | `lib/supabase/server` |

**Eligibility filter (mirror exactly):** `status = 'completed'`, `deleted_at IS NULL`, real profile (`is_mock = false`, `analytics_is_real_user <> false`, `is_system_account <> true`), and the test-email heuristic. **Fail closed** on unknown profiles (do NOT default-include — this is the fix for the bug found in the break-behavior review).

## 5. The One Genuinely New Piece — Observed Wind at Session Time

**Problem:** `session_forecast_snapshots` pairs forecast wind with the *user's reported* wind, which we don't trust. We need *observed* wind for the wind delta. Verified: `nws-wind-service.ts` and `open-meteo-wind-service.ts` both return **forecast** wind (NWS hourly forecast; Open-Meteo `/v1/forecast`) — **not** ground truth.

**Phase A must establish the observed source.** Candidate sources, in preference order:
1. **Open-Meteo Archive / reanalysis** (`https://archive-api.open-meteo.com/v1/archive`) — historical hourly 10m wind at lat/lon; simplest from TS, good coverage. **Recommended default.**
2. **NWS/METAR station observations** — nearest station actual winds; more "real" but station-sparse and needs nearest-station resolution.
3. **Seaside HRRR analysis** (`seaside/hrrr_wind_service.py`) — best physically, but lives in Python/Seaside; only pull if 1–2 prove insufficient. Do not add a Seaside dependency in v1 unless required.

This is an **offline backfill join** (measurement job), not a request-time call: for each eligible completed session, fetch observed wind at `arrival_time` ± tolerance for the beach `lat/lon`, store it, and compute `wind_speed_delta` / `wind_direction_delta` against the forecast snapshot. Cache by `(beach_id, hour)` to avoid refetching.

## 6. Metrics (Numeric Spine)

Per beach, per dimension (wave height; wind speed; wind direction):
- **bias** = signed mean delta (forecast − truth) — tells you *direction* of error (e.g., we run low).
- **MAE** = mean absolute delta.
- **n** = sample count contributing.
- **confidence** = `calculateConfidence(n)` (reuse; sigmoid, 0.5 at n=5).
- Wind direction uses angular distance (mind the 360° wrap; reuse direction helpers).

**Demand-weighted priority** = the fix-list ranking: surface beaches where **demand is high AND (error is high OR n is low)** first. That's the actionable output — "we're 1.3 ft low at the #3 most-watched break."

**Honesty rules:** withhold or clearly label rows below an `n` floor (start `n ≥ 5` for a firm call, `3 ≤ n < 5` = "learning", `< 3` = withheld). Never show a confident delta off n=1.

## 7. Zone Condition Flags (Tiered)

Each flag carries `{ value, groundTruthSource, n, confidence, tier }`. Tier drives presentation (call vs hunch).

**Tier 1 — ships and must be PROVEN first:**
- **Tide window** — best/worst tide from session quality-vs-tide, seeded by `preferred_tide_*`. Output: preferred tide band + "washes out above/below X".
- **Closeout risk** — derived: forecast wave height/period/direction vs the spot's `swell_window_*_deg` and learned good-session band → *too big / too short-period / wrong angle = elevated closeout risk*. **Ground-truthed** by `wave_characteristics` (e.g. "walled", "mushy") + AI-extracted "closed out / top-to-bottom" from notes. A hedged probability flag, never a guarantee.

**Tier 2 — built only after Tier 1 proves the loop; clearly labeled advisory/low-confidence:**
- **Rip risk level** — reuse `rip_current_risks` + reported `rip_current_observed`/`hazards` + correlates (size, tide). A per-spot **risk level**, condition-dependent. **NOT a location.**
- **Longshore drift index** — derive from `aspect_deg` vs forecast swell angle + height (more oblique + bigger = stronger pull); optionally validated by AI-mined notes ("dragged down the beach"). An estimate.

**Tier 3 — explicitly excluded (won't build, won't promise):** spatial rip channel location, exact current vectors. Needs bathymetry/imagery we don't have; 10m satellite cannot deliver it. We report **risk**, never position.

**Two non-negotiables:**
1. **Safety framing.** Rip/current flags are advisory, "elevated risk" language, never "safe", never authoritative. In v1 they are **internal calls we validate**, not user-facing safety warnings (user-facing safety is a separate, later, deliberately-gated decision).
2. **Confidence on every label.** Ground-truth source + `n` always shown. Tier-1 reads as a call; Tier-2 reads as a hunch we're still proving.

## 8. AI Layer (Offline via Codex, Reviewed)

Two offline jobs, run locally by Codex against a local env (service-role). No runtime LLM calls.

**Extraction job** — input: real-user completed sessions with free-text (`notes`, `description`, `wave_characteristics`, `rip_current_observed`, `hazards`). Output: structured per-session JSON, e.g.
`{ windFeel: 'offshore'|'onshore'|'cross'|'glassy'|null, windTiming: string|null, quality: 'clean'|'mushy'|'blown'|null, closeout: boolean|null, ripMentioned: boolean|null, driftMentioned: boolean|null, hazards: string[] }`.
Persisted, `source='codex'`, `status='draft'` until reviewed. **Idempotent**, keyed by `(session_id, notes_hash)` — re-running must not duplicate or re-process unchanged notes.

**Synthesis job** — input: numeric deltas + condition indices + extracted signal per beach. Output: per-zone narrative + **suggested correction direction** + confidence, e.g. *"La Jolla Shores: ~1.3 ft low on WNW groundswell; wind onshore ~2h before we call it; closes out above ~5 ft; best mid-incoming."* Persisted per beach, reviewed before it surfaces.

**Persistence:** a new table (e.g. `surf_zone_intel`: `beach_id`, `period`, `extracted` JSONB, `narrative` text, `correction_hint` JSONB, `source`, `status`, `n`, `confidence`, timestamps) OR a reviewed JSON artifact the scorecard reads. Prefer a table for query/refresh. Public read is **off**; admin/service-role only.

## 9. Surface (Internal)

- **New** flag-gated, **`withAdminAuth`** page (e.g. `/internal/zone-intel` or `app/admin/zone-intel`). **Not** the public `app/forecast-accuracy` page.
- Flag: `SURF_ZONE_INTEL_ENABLED` (server-only, default off; admin-only feature so no `NEXT_PUBLIC_` needed).
- View: demand-ranked table (beach, demand rank, wave bias/MAE+n, wind error+n, condition flags, AI narrative, status) → per-beach drill-down to predicted-vs-truth pairs and the session evidence behind each flag.
- API: `GET /api/internal/zone-intel` (admin) returns the assembled scorecard; service-role aggregation, no raw user identifiers in the response.

## 10. Phasing (Tier 1 proven, THEN continue)

**Phase A — Tier-1 numeric spine (prove the measurement loop).**
Per-dimension wave (vs sessions) + wind (vs observed, §5) deltas; tide + closeout indices; demand rank (mock-excluded, fail-closed); internal admin scorecard. **Audit** `beach_forecast_accuracy` / `update_beach_forecast_accuracy` freshness first; recompute fresh from snapshots if stale/wrong.
*Acceptance:* scorecard renders for the top-demand beaches with honest `n`; wind delta provably uses observed (not forecast/user) wind; deltas sanity-checked against ≥2 hand-verified beaches (incl. a known face-height-underread spot); mock/system/deleted excluded; low-`n` withheld.

**Phase B — Tier-1 AI (offline Codex).**
Extraction + synthesis for Tier-1 signals; reviewed outputs surfaced on the scorecard. *Acceptance:* AI fields populated + `status='reviewed'` for top-demand beaches; zero runtime LLM calls; extraction idempotent; outputs source-tagged.

**Phase C — Tier-2 (only after A+B prove out).**
Rip risk level + drift index, labeled advisory; audit `rip_current_risks` freshness before relying on it. *Acceptance:* Tier-2 flags render as clearly-advisory with source+`n`; no spatial/location claims; safety language enforced.

**Out of scope (all phases):** changing the production forecast number, changing discovery/suggestions, native UI, user-facing safety warnings, spatial rip location, satellite imagery.

## 11. Satellite Imagery — Deferred (on the record)

Demoted to a **gated, later R&D spike**, not built here. Sentinel-2 at 10 m/pixel cannot resolve per-break features (rip channels are 1–5 px; working prior art uses video-averaging or SAR, not single optical stills). **Revisit criteria:** only if a future spike **beats a forecast-only baseline** on a held-out accuracy bar, and even then scoped honestly to what 10 m supports (coarse sandbar/shoreline/turbidity change), never "rip channels." This very project is what would justify or kill it later, on evidence.

## 12. Risks & Open Items

- **Observed-wind source** (§5) — the key new dependency; default Open-Meteo Archive, validate coverage at pilot beaches.
- **`beach_forecast_accuracy` freshness/correctness** — audit before trusting (Phase A step 1).
- **Session sparsity** (~55 completed) — many beaches low-`n`; expected and surfaced honestly, not hidden.
- **Safety/liability** on rip/current — advisory-only, internal-only in v1.
- **AI offline discipline** — idempotent, content-hash keyed, reviewed; no money-burn, no prod calls.

## 13. Implementation Notes for Codex

- Beach-level. TDD (`yarn test:unit`), `yarn typecheck` (Node 22), scoped `npx eslint --max-warnings=0` per `quiver/CLAUDE.md`.
- **Reuse** `accuracy-metrics.ts`, `preference-learning-service.ts` helpers, snapshot utils, the recompute RPC, wind services, `createSupabaseServiceRoleClient`, `withAdminAuth` — do not reinvent.
- **Fail-closed** real-user filter; **observed** (not forecast/user) wind; **confidence + `n` on every output**; **flag-gated** surface; **no commits**.
- Work in a clean tree off committed `main` — the current working tree is dirty with an unrelated native-scoring refactor; do not sweep it in.
- Each phase lands independently and is verifiable on its own.
