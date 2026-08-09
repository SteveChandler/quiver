# Last-Mile Translation — Spike Results

**Run:** 2026-06-23 · **Type:** time-boxed design spike (no build, no commits — per spec §8).
**Companion:** `2026-06-24-last-mile-translation-runtime-spec.md` (§7 spike) · strategy `../../2026-06-24-win-on-the-surfer-strategy.md`.

> **Verdict: GO — template-only is enough — gated on two fixes.** The deterministic composition reads like a local on real data, holds the grounding discipline, and needs **zero runtime LLM / zero new ML**. It is *not* the thin "renderer over one struct" the spec pictured — it's a deterministic **orchestration over ~4 subsystems**, and one signal the spec told us to narrate (`swellDirScore`) is **broken in committed code**. Fix those two things, then build half (a). No LLM polish needed for v1.

---

## 1. What was actually done

Ran the **real production scorer** (`computeHourScore` math mirrored verbatim from `lib/surf/scoring.ts` + `types/terrain.ts`, so output is identical) over **real committed-prod data**:

- **4 beaches** pulled from `quiverDB`: 3 marquee SoCal w/ rich signal — **Blacks** (beach, NW window 195–340°, calibrated + DEM terrain), **Cardiff Reef** (reef, 220–340°, rising-tide), **Cottons/Trestles** (point, narrow S window 160–225°) — + **1 generic-transform** beach (12th Street Jetty, NJ — `terrain_enabled=false`, no `shoaling_factors`) for graceful-degradation.
- **~18 real forecast hours each** from `enhanced_forecasts` (the production-assembled hourly row the app actually serves: face height, wind, tide, raw `*_om` numerics). Real terrain arrays (72-bin `wind_exposure_factors` / `swell_access_factors`) per beach.
- A throwaway **deterministic composer** (the thing being spiked) built the legible, skill-aware call from: scorer fits + served face height + skill band (capability ceiling from the match-score migration mapping: ≤3 ft beginner / ≤8 ft advanced) + tide series/band + terrain access. Every emitted clause carries a **provenance tag** (backing signal + value).

Harness is preserved (gitignored, uncommittable) at `scripts/_spike_lastmile/` — re-runnable on a better day (wind transition / bigger swell).

**Real-data caveats (honest):** this forecast window was **small everywhere** (served 0.7–2.0 ft) and **wind was flat** (~4 kt all day, every beach). So the window positively demonstrates *skill-relative size* and *tide* hard, but contains **no live "too big" case** and **no live wind-transition** — both noted below.

---

## 2. Real examples (verbatim harness output)

**Skill-relativity works — the crown-jewel result.** Same beach, same hour, same forecast; the call flips on the surfer:

```
Blacks Beach · 1.9 ft · scorer[wind .91 / tide .80 / swell .00 = 53]
  HEADLINE [beginner]: MAYBE · Might work — 1.9ft fun size for you · best on the push ~8am · light wind, clean texture
  HEADLINE [advanced]: NO · Skip — 1.9ft too small to bother · light wind, clean texture
```

**Generic-transform beach degrades correctly** — no terrain → zero fabricated "shadowed/sheltered" clauses; `~` prefix on every uncalibrated size; missing → omitted, never invented:

```
12th Street Jetty (NJ) · GENERIC · terrain OFF
  8am  ~0.9ft  NO · Skip — ~0.9ft too small to bother · tide in the zone (3ft) · light wind, clean texture
  2pm  ~0.8ft  NO · Skip — ~0.8ft too small to bother · tide drained out (0.8ft) — washes out till it fills · light wind, clean texture
```

**Tide is the richest live clause** — washes-out / filling-into-the-zone / best-on-the-push window, all backed by the real tide series + band + preferred direction:

```
Cardiff Reef (band 0–4 ft, rising) — best on the push, ~8am–11am
  5am  tide drained out (-0.5ft) — washes out till it fills
  8am  tide filling into the zone (1.3ft, rising)
```

**Provenance audit: PASS** — every emitted clause carried a backing value (this is spec §9's acceptance test, working).

---

## 3. Grounding-discipline scorecard (spec §5)

| Rule | Result |
|---|---|
| 1. Every clause maps to a signal w/ a value | ✅ provenance audit passes; clauses are functions of real numbers |
| 2. Admit the guess (`~`, muted) | ✅ generic beach gets `~` on every size; no confident shaping claim |
| 3. Missing is `—`/omit, never invented | ✅ no-terrain → access/exposure clauses omitted entirely |
| 4. Skill-relative, not absolute | ✅ 1.9 ft = "fun for you" (beginner) vs "too small" (advanced), same forecast |
| 5. No correction claims in v1 | ✅ composer describes conditions; never says "we run low" |
| 6. Safety language advisory | ✅ verdict is "Might work / Skip", never "safe" |

---

## 4. The weak clause + the blocker (spec §7 asks us to record this)

### 4a. THE one weak clause: the swell-angle clause
The spec's marquee phrasing — *"blocked / shadowed from this angle", "wraps in"* — was supposed to come from `computeHourScore`'s `swellDirScore`. **It can't:** `swellDirScore` is **0.00 at every beach, every hour** in this run. The composer dodged it by reading the terrain `swell_access_factors` array directly (Blacks 0.32 → "partly shadowed"; Cottons 0.58 → "a touch side-on"), which *is* grounded and meaningful — **but `swell_access` only exists at terrain-enabled beaches.** So the angle clause is **terrain-gated**, not universal; at generic/most non-CA beaches there is currently no honest swell-angle clause at all. The window-geometry fit that *every* beach has (`swell_window_*_deg`) is unusable until the bug below is fixed.

### 4b. Why `swellDirScore` is 0 — a real bug in committed `main`
`computeSwellDirScore()` (`lib/surf/scoring.ts`) returns **0.000 for every direction, including the dead-center of the window** (probed: 268° at Blacks, 0.5° off center → 0.000). The wrap math `Math.abs(((waveDir - (center + 540)) % 360) - 180)` is wrong (should be `+ 540` on the *difference*, i.e. `((waveDir - center + 540) % 360) - 180`), so `offFromCenter` is always huge → `inside=0`, `beyond` huge, `fade=0` → always 0.

- **Live, not dead code:** `computeHourScore` is called by `lib/surf/windows.ts` (best-window picker) and `lib/services/discovery/window-selector/window-refiner.ts`.
- **Blast radius (scoped, not catastrophic):** the **TS best-window / discovery picker ranks hours with the 40%-weighted swell-direction term silently zeroed** — effectively wind (40%) + tide (20%) only. The **served forecast number** (`enhanced_forecasts`, deterministic transform) and the **match/"fit-for-you" score** (`compute_user_match_score_core` RPC + `swell_windows_overlap`) are **separate paths and unaffected.** Needs a confirming trace of every `windows.ts` consumer.
- Tracked as a separate task (see §6). Not fixed here (spike = no commits).

### 4c. The framing correction (spec §3 / §41)
The spec calls the legibility layer "a **renderer over that struct** — nothing more." The spike shows it is **not**. To compose an honest call it must:
1. **Inject a size/skill dimension the scorer entirely lacks.** `computeHourScore` has **no height term** (`heightScore`/`periodScore` are reserved = 0). "Too big / too small / fun for you" comes from the **served face height + the skill band**, not the scorer.
2. **Size-gate the size-blind verdict.** Raw `total0to100` rated these 1.6–1.9 ft hours up to 53 ("MAYBE"). Ungated, the legible call would say "Might work" on a 1.7 ft day for an advanced surfer — wrong. The composer must cap the verdict on the size/skill check (it does; mirrors `surf-call-logic`'s character gate).
3. **Reach into the terrain arrays + tide series directly** (angle clause, tide phase/window) — not available as scalar fields on the scorer struct.

Net: it's a deterministic **orchestration over ~4 subsystems** — scorer fits (wind/tide + terrain telemetry) + face-height transform + skill band + tide series/geometry. Still fast, free, testable, hallucination-proof. Just not one struct.

---

## 5. Why GO (template-only), not GO-WITH-LLM-POLISH or NO-GO

- **Not NO-GO:** skill-relativity + tide + size are already legible and trustworthy on real data; the only broken piece (swell angle) has a working terrain substitute and a one-line bug fix.
- **Not LLM-polish:** the determinism *is* the brand ("data is sacred; the app admits when it's guessing"). The composed clauses read like a local once the size-gate and angle-source are right; an offline narrative remains the SZI §8 artifact, never runtime. v1 ships with **zero runtime LLM, zero new ML** — exactly as the spec wanted.

---

## 6. Required before build (half (a))

1. **Fix `computeSwellDirScore`** (the wrap bug) and re-verify the best-window picker, **then** decide the canonical swell-angle signal: terrain `swell_access` where present, corrected `swellDirScore` (window geometry) elsewhere, so the angle clause is **universal**, not terrain-gated. → spawned as a separate task.
2. **Correct the spec framing** (§3/§41): "renderer over one struct" → "deterministic orchestration over scorer + face-height transform + skill band + tide series," and make the **size/skill gate a first-class composer input** (the scorer is size-blind).
3. **Capture a wind-transition day + a bigger-swell day** before the build verdict is final — this window proved skill-relativity and tide, but not the live "clean till ~10am onshore" temporal wind clause or a real "too big for you" case. Re-run the preserved harness when the forecast cooperates.

## 7. Boundaries honored
Served forecast number unchanged · no new ML · no runtime LLM · no correction claims · no commits · worked off committed `main`.
