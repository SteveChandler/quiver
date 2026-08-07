# Last-Mile Translation — Design / Spike Spec

**Status:** Design + time-boxed spike. **Date:** 2026-06-24. **Scope:** Quiver Web (signals) + Native (surface). **Type:** design/spike, not a build-everything plan.
Companion: extends the **Surf Zone Intelligence** flywheel (`docs/archive/superpowers/specs/2026-06-20-surf-zone-intelligence-design.md`). Strategy: `docs/2026-06-24-win-on-the-surfer-strategy.md`.

> A NOAA forecast can say "south shores are head-high to overhead." A surfer still has to know which reef is exposed, which tide works, how the swell wraps, how much wind is on it. That last-mile translation is where we earn the open. This spec is the **user-facing turn** of the SZI flywheel — the call, in plain language, for *this* surfer.

---

## 1. Framing — this is not a new system

SZI is a flywheel: **Measure → Correct → Suggest.** SZI Phase A builds the internal, offline measurement (where our number is wrong). This spec is a sibling, and it splits cleanly into two halves with very different readiness:

| Half | What it is | Needs | Gate |
|---|---|---|---|
| **(a) Legibility** | Translate the signals we **already compute** into a plain-English, skill-aware call | nothing new — no ML, no LLM | **none. Buildable now.** |
| **(b) Correction narrative** | "we run `~1.3 ft` low on WNW here" | proven per-dimension deltas | **gated on SZI Phase A** |

Half (a) is the whole bet for v1. It doesn't change the number, doesn't claim a correction — it just *says what the scorer already knows, out loud, for this surfer's skill.* Half (b) waits until the measurement loop earns the right to make a correction claim. **Do not ship (b)'s "we run low" language off un-measured deltas** — that's the v3 mistake wearing a UI.

## 2. The bet, concretely

Today the surfer sees a verdict + a number + reason bullets. The call we want reads like the local who knows the spot:

> `MAYBE · Might work` — `too big for you till the tide fills · clean till the ~10am onshore · best mid-incoming, 8-10am`

Every clause is already sitting in the scorer as a number. We're not generating insight — we're **narrating signal we have**, grounded, and tuned to skill.

## 3. Reuse map (verified — narrate these, don't reinvent)

| Clause in the call | Signal that backs it | Location |
|---|---|---|
| "too big / too small **for you**" | skill-aware capability ceiling + board band | `compute_user_match_score_core` (`supabase/migrations/20260612123000_match_score_skill_aware_band.sql`); `lib/personalization/match-score.ts` |
| "blocked / shadowed from this angle", "wraps in" | `swell_access_factors[]` (DEM exposure, per compass bin) | `lib/surf/scoring.ts` (`swellAccess`, `swellDirScore`) |
| "wind's on it / clean / offshore till ~10am" | `wind_exposure_factors[]` + forecast wind | `lib/surf/scoring.ts` (`windExposure`, `windScore`); `lib/services/*-wind-service.ts` |
| "best mid-incoming / washes out below X" | tide band + direction | `beaches.tide_min_ft/max_ft`, `preferred_tide_*`, `tideScore` in `lib/surf/scoring.ts` |
| "closes out above ~5 ft" | size/period/angle vs `swell_window_*_deg` + learned band (geometry only for v1) | `lib/surf/scoring.ts`, beach geometry; SZI §7 Tier-1 closeout |
| size in the call | the deterministic face-height transform | `lib/utils/wave-height-transformer.ts` |
| the verdict + window | existing surf call / decision | `lib/utils/surf-call-logic.ts`, native `src/lib/surf-decision.ts` |

`computeHourScore()` already returns `{ windScore, tideScore, swellDirScore, total0to100, windExposure, swellAccess }`. The legibility layer is a **renderer over that struct + beach geometry + the surfer's skill band** — nothing more.

## 4. The decision SZI left open: runtime, and whether to use an LLM

SZI deliberately said *offline, no runtime LLM, internal only.* For a **user-facing** call you want runtime freshness — but a runtime LLM means cost, latency, and the exact hallucination risk we can't take on a safety-adjacent surf call. Resolve it:

- **The call is composed deterministically.** Assemble it from the signals with rules/templates — no model at inference time. "best mid-incoming," "clean till the ~10am onshore," "too big for you till the tide fills" are all deterministic functions of signals we have. This is fast, free, testable, and **cannot hallucinate a break it has no data for.** It's also exactly the brand: *data is sacred; the app admits when it's guessing.*
- **The LLM, if any, stays offline.** Richer natural-language *flavor* (the SZI synthesis narrative) remains the offline, reviewed, source-tagged artifact from SZI §8 — never a runtime call. Half (a) does not need it to ship.

So v1 has **zero runtime LLM** and **zero new ML.** The spike's job is to prove the deterministic composition is good enough that we never reach for one.

## 5. Grounding discipline (non-negotiable — this is the brand)

1. **Every clause maps to a signal with a value.** No clause without a backing number. No free-form prose about a spot we have no signal for.
2. **Admit the guess.** Uncalibrated estimates get the `~` prefix and muted treatment (brand voice rule). Generic-transform beaches don't get a confident shaping claim.
3. **Missing is `—` / `no data`** — never an invented sentence, never "No data available."
4. **Skill-relative, not absolute.** "Too big" is *for this surfer* (capability ceiling), not a global threshold — the same 4 ft reads "too big" for a beginner and "fun" for an advanced surfer.
5. **No correction claims in v1.** Until SZI Phase A measures the delta, the call describes conditions; it does not say "we run low/high."
6. **Safety language stays advisory** (per SZI §7) — risk, never "safe," never authoritative.

## 6. Surface (extend, do not duplicate)

Per `../quiver-native/PLAN_MY_NEXT_SESSION_AUDIT.md` duplicate-prevention: extend the existing **`PersonalSurfCallCard`** / "Why this call" breakdown and the `match-mega-card`. The translation is the expanded "why" — the legible sentence under the verdict, not a new card family. Web mirrors via the existing match-score surfaces. Reuse `useDataFetcher` / `withAuth` (quiver `CLAUDE.md`); honor the cream-on-twilight zine treatment and `Space Mono` for the data clauses.

> **Spike verdict (2026-06-23): GO — template-only — gated on two fixes.** Ran the real `computeHourScore` over 4 real beaches × ~18 real forecast hours. Skill-relativity, tide, and graceful degradation all hold on live data; grounding-rule provenance audit passes; zero runtime LLM / zero new ML needed. Two corrections required before build: **(i)** `computeSwellDirScore` is **broken in committed `main`** (returns 0 for every direction, incl. window center) — so the swell-angle clause can't come from the scorer as §3/§41 claim; it currently rides on terrain `swell_access` (terrain-gated). **(ii)** the layer is **not** a "renderer over one struct" — the scorer is **size-blind** (`heightScore` reserved = 0), so size/skill must be injected and the verdict size-gated. Full evidence + the one weak clause: **`2026-06-24-last-mile-translation-spike-results.md`**.

## 7. The spike (time-boxed — ~2 days, then a verdict)

Prove half (a) is composable and trustworthy before any build:

- Pick **3 marquee SoCal beaches** with rich signal (calibrated shoaling, DEM exposure, tide band, geometry) and **one generic-transform beach** (to prove graceful degradation).
- For ~10 forecast hours across them, **hand-compose the deterministic call** from the real `computeHourScore` output + geometry + a sample surfer's skill band.
- Check, per the grounding rules: is each clause backed by a real signal? Is it accurate vs the actual forecast? Is "too big" skill-correct? Does the generic beach degrade to `~`/`—` instead of over-claiming? Is it legible — does it read like the local, not a SaaS tooltip?
- **Verdict:** GO (template-only is enough), GO-WITH-LLM-POLISH (deterministic skeleton + offline narrative flavor), or NO-GO (signals too thin to narrate honestly). Record real examples + the one weak clause.

## 8. Boundaries

- **Does not change the served forecast number.** That's SZI's "Correct" step, gated on Phase A.
- **No new ML, no runtime LLM, no API keys in prod.**
- **No correction claims** ("we run low") until measured.
- **Flag-gated** (e.g. `LAST_MILE_CALL_ENABLED`, default off); extend existing cards; reuse data/auth patterns; brand voice on every string.
- **No commits** as part of the spike; work off committed `main`.

## 9. Acceptance (for the eventual build, post-spike)

- The call renders for the spike beaches with every clause traceable to a signal (a test asserts no clause without a backing value).
- Skill-relative copy verified across beginner/advanced on the same forecast.
- Generic-transform beach degrades to `~`/`no data`, never a confident shaping claim.
- Zero runtime LLM calls; zero new ML; served number unchanged.
- `yarn test:unit` + `yarn typecheck` (Node 22) green; scoped eslint clean.

## 10. Dependencies & open items

- **(b) correction narrative** → blocked on SZI Phase A deltas. Track there, not here.
- **Skill band for anonymous / <5-session users** → reuse the match-score cold-start prior (skill/board); if neither, the call drops the "for you" framing rather than guess.
- **Wind timing precision** ("till ~10am") → from the existing hourly wind forecast + the window refinement in `scoring.ts`; round honestly with `~`.
