# Quiver Recommendations v1 — Implementation Plan & Prompts

This doc packages the next action steps, copy‑paste prompts, acceptance criteria, and quick checks to ship the NOAA‑seeded “Where & When to Surf” experience.

---

## 0) Context

* We’ve migrated and backfilled beach preference metadata (aspect, offshore wind, swell window, tide, skill, tolerances) and seeded `preference_model`.
* Advanced loader upserts these fields; inline loader keeps coordinates only.
* Goal: wire preferences into recommendations, surface a user‑facing Coach Card, capture feedback, and prepare nightly calibration.

---

## 1) Scoring Function Update (TypeScript)

**Prompt**

> Review the changelog and current recommendation scorer. Wire in the new beach preference fields (`shoreline_aspect_deg`, `swell_window_min_deg`, `swell_window_max_deg`, `wind_offshore_deg`, `wind_offshore_tol_deg`, `wind_cross_shore_ok_kt`, `wind_onshore_bad_kt`, `preferred_tide_ft_min`, `preferred_tide_ft_max`, `skill_level`).
> Implement helpers: `degNorm`, `angDiff(a,b)`, `inWrappedWindow(min,max,dir)`.
> Scoring rules (weights):
> • Swell direction in window: **+3**
> • Wind: offshore within tol **+3**; else cross‑shore if wind ≤ `wind_cross_shore_ok_kt` **+1**; onshore > `wind_onshore_bad_kt` **−2**
> • Tide within preferred range: **+2**
> • User skill ≥ `skill_level`: **+1**; else **−2**
> Return `reasons[]` (e.g., `"offshore"`, `"in_tide_window"`, `"out_of_swell_window"`). Add null guards; degrade gracefully when fields missing.

**Acceptance**

* Unit tests show: (1) offshore+in‑window outranks onshore/out‑of‑window, (2) outside tide window reduces score, (3) low‑skill user penalized at advanced spot.

**Notes**

* Keep the function pure; inject forecast snapshot + spot prefs; return score + reasons.

---

## 2) `/v1/recommendations` Endpoint

**Prompt**

> Implement `GET /v1/recommendations?lat&lon&time`.
> Steps:
>
> 1. Use PostGIS to fetch beaches within 25 km ordered by distance.
> 2. Pull NOAA snapshot for `time` (waves/wind/tide).
> 3. Score each spot via scorer (from §1).
> 4. Respond with: `{ spotId, name, distance_km, score, reasons[], wave:{ht_ft, dir_deg, period_s}, wind:{dir_deg,kts}, tide_ft, best_time_window:{start,end} }`.
> 5. Cache results for `(spotId, hour)` for 2h; bust cache on spot pref change.

**Acceptance**

* E2E test with stubbed NOAA returns deterministic ranking.

**Notes**

* Add pagination and `maxDistanceKm` param later.

---

## 3) Coach Card UI (Plan Session & Beach pages)

**Prompt**

> Build a compact Coach Card that calls `/v1/recommendations` for the user’s default beach/time.
> Display: headline window, spot name, 2–3 bullets (wave/wind/tide), and a board hint (e.g., twin‑fin for 2–4 ft clean; step‑up for >5 ft).
> Show badge: `Calibrating · NOAA seed` if `preference_model.source === 'noaa_seed'`.
> Add “Why this pick?” expander listing `reasons[]`.
> States: skeleton, success, error. Mobile‑first.

**Acceptance**

* Renders correctly on Plan Session and Beach pages; accessible and responsive.

**Notes**

* Keep under 6 lines visible; expand for details.

---

## 4) `spot_feedback` Table + RLS

**Prompt**

> Create table to capture user feedback on recommendation accuracy.
> DDL:
> • `id uuid pk default gen_random_uuid()`
> • `user_id uuid ref auth.users not null`
> • `spot_id uuid ref beaches(id) not null`
> • `rec_id uuid null`
> • `accurate boolean not null`
> • `reasons text[] null` (from set `{wind,tide,size,crowd,direction,other}`)
> • `note text null` (≤280)
> • `created_at timestamptz default now()`
> RLS: enable; INSERT when `user_id = auth.uid()`; SELECT own rows; admin role SELECT all; no UPDATE/DELETE.

**Acceptance**

* Migration + RLS policies applied; quick insert/select test passes.

**Notes**

* Consider enum for `reasons` later; start with text\[].

---

## 5) Admin “Spot Tuner” (Shadcn UI)

**Prompt**

> Build `/admin/spots/:id` to tune: `skill_level`, `preferred_tide_ft_min/max`, `swell_window_min/max`, `wind_offshore_deg`, `wind_offshore_tol_deg`, `wind_cross_shore_ok_kt`, `wind_onshore_bad_kt`.
> Controls: number inputs/sliders with validation; show live cardinal labels (e.g., ENE for 70°).
> Read‑only helpers: aspect, seed source.
> On save: upsert; bump `preference_model.version`, set `source: 'admin_override'`, stamp `updated_at`.

**Acceptance**

* Role‑guarded route; diff preview; optimistic save with toast; audit log written.

**Notes**

* Add “Reset to seed” action to revert to NOAA defaults.

---

## 6) Nightly Calibration Job

**Prompt**

> Add cron worker `calibrate_spots.ts` (03:00 local).
> Inputs: completed `sessions` with ratings + forecast snapshots at session time.
> Method:
> • Bin `swell_dir` & `wind_dir` into 16 bins; compute avg rating per bin; propose top 2–3 bins.
> • Compute tide IQR (Q1–Q3) for sessions with rating ≥ 4; propose tide\_min/max.
> • Write proposals to `beach_recommendation_calibration (spot_id, metric, key, value, updated_at)`; **do not** mutate `beaches`.
> • Skip spots with <20 rated sessions.

**Acceptance**

* Idempotent runs; proposals visible for multiple spots; no direct writes to `beaches`.

**Notes**

* Next iteration: /admin/calibration UI to review/apply.

---

## 7) Caching & Feature Flag

**Prompt**

> Add KV/Redis cache for recs: key `recs:${spotId}:${isoHour}`; TTL 2h.
> Feature flag: `recs.v1_noaa_seed` (ON for internal users; 10% public).
> Metrics: cache hit rate, rec generation latency, error rate.

**Acceptance**

* Flag toggles old vs new scorer; dashboard displays hit rate.

**Notes**

* Bust cache when Admin Spot Tuner saves.

---

## 8) Tests (Unit + E2E)

**Prompt**

> Add tests:
> • Unit (scorer): offshore+in‑window > onshore/out‑of‑window; outside tide penalizes; strong onshore penalizes; null‑safe paths.
> • E2E: `/v1/recommendations` ranks a seeded trio correctly with stubbed NOAA.
> • UI: Coach Card renders reasons/badge; `spot_feedback` insert works with current user.

**Acceptance**

* Tests green; scorer coverage ≥ 90%.

**Notes**

* Snapshot test Coach Card for mobile layout.

---

## 9) Guardrails & Monitoring

**Prompt**

> Add DB check: alert if any preference columns become NULL.
> Add SLOs: % recommendations generated, p50 latency, cache hit rate.
> Log `reasons[]` distribution to understand false positives.

**Acceptance**

* Alerting in place; basic dashboard live.

---

## 10) Definition of Done (v1)

* Scorer reads preference fields and returns reasons.
* `/v1/recommendations` live with caching.
* Coach Card in Plan Session & Beach pages.
* `spot_feedback` table + RLS; feedback UI shipped.
* Admin Spot Tuner shipped.
* Cron calibration job writing proposals.
* No NULL regressions; tests green; flag controllable.

---

## Quick SQL Sanity Checks (copy/paste)

```sql
select count(*) filter (where shoreline_aspect_deg is null
   or wind_offshore_deg is null
   or swell_window_min_deg is null
   or swell_window_max_deg is null
   or preferred_tide_ft_min is null
   or preferred_tide_ft_max is null
   or skill_level is null) as missing_any
from beaches;

select name, break_type,
       shoreline_aspect_deg as aspect,
       wind_offshore_deg as offshore,
       swell_window_min_deg, swell_window_max_deg,
       preferred_tide_ft_min, preferred_tide_ft_max,
       skill_level
from beaches
order by random()
limit 20;
```

---

## Shipping Notes

* Keep the UI copy honest: “Calibrating from NOAA seed; gets smarter as you rate sessions.”
* Favor fast iteration; perfection comes with calibration.
