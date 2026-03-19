# Rideable Waves Per Hour — Design Spec

**Date:** 2026-03-17
**Status:** Draft (reviewed)
**Author:** Steve + Claude

## Summary

A surfer-facing metric predicting how many catchable waves occur per hour at a specific beach. Displayed in the existing ConditionsTicker alongside wave height, period, wind, and tide. Calculated client-side as a pure TypeScript function from `EnhancedForecastEntity` data already fetched by the beach detail page.

**Competitive context:** No major surf platform (Surfline, Windy, Surf-Forecast) or indie app offers a predictive wave frequency metric. Wavy counts waves *after* sessions via GPS, but nobody *predicts* them. This is genuine whitespace. The underlying science (wave grouping theory, Rayleigh distribution) is well-established in coastal engineering but has never been productized for surfers.

## Goals

- Give surfers an intuitive "wave opportunity" number to compare time windows at a beach
- Ship a v1 on beach detail pages only, using existing data (no new data sources)
- Validate against user feedback before expanding to discovery/comparison surfaces

## Non-Goals (v1)

- User skill/board-type personalization (future enhancement)
- Crowd factor adjustment
- Hourly timeline chart or historical trends
- Integration into the scoring engine (kept decoupled for independent iteration)
- Display on embed widgets, landing pages, or discovery surfaces (beach detail only)

---

## Calculation Model

### Inputs (all already available)

| Input | Source | Parsing Notes |
|---|---|---|
| `dominant_period_s` | `EnhancedForecastEntity.wave_period` | Parsed via existing `parseWavePeriod` from `lib/utils/number-parsing.ts` (handles "10s", "10 s", "10", null) |
| `swell_1_period_s` | `EnhancedForecastEntity.swell_1_period` | Same parser, nullable |
| `swell_2_period_s` | `EnhancedForecastEntity.swell_2_period` | Same parser, nullable |
| `swell_1_direction_deg` | `EnhancedForecastEntity.swell_1_direction` | **Stored as cardinal string ("SW", "WNW")**. Convert via existing `getDirectionDegrees` helper in `lib/domains/scoring/discovery-adapter.ts`. Nullable |
| `wave_height_ft` | `EnhancedForecastEntity.wave_height` | **Stored as text range ("3-4ft")**. Parse lower bound using `parseWaveHeight` from `lib/ml/parse-wave-height.ts` (returns meters), then convert m->ft. Use lower bound for threshold check |
| `wind_speed_kts` | `EnhancedForecastEntity.wind_speed` | **Stored as string ("8 mph")**. Parse via `parseWindSpeed` from `lib/utils/number-parsing.ts` (returns raw number), then convert mph->kts (÷ 1.151) |
| `wind_direction_deg` | `EnhancedForecastEntity.wind_direction` | Cardinal string, same `getDirectionDegrees` conversion |
| `break_type` | `beaches.break_type` | `string | null` — not a DB enum. Handle any unrecognized string value as "other" defaults |
| `aspect_deg` | `beaches.aspect_deg` | Beach orientation in degrees |
| `swell_access_factors` | `beaches.swell_access_factors` | Array[72], 5-degree bins. Nullable |

### Algorithm

```
Step 0: Period guard
  If dominant_period_s <= 0 or null → return 0

Step 1: Height gate
  If wave_height_ft < rideable_threshold_ft for break type → return 0

Step 2: Base wave frequency
  If two swells present AND |swell_1_period - swell_2_period| >= 1.0s:
    set_interval = clamp((T1 * T2) / |T1 - T2|, 60, 600)
    waves_per_set = clamp(round(max(T1, T2) / min(T1, T2)), 2, 7)
    base_frequency = (3600 / set_interval) * waves_per_set
  Else (single swell or periods within 1.0s):
    base_frequency = 3600 / dominant_period_s

Step 3: Break type factor
  beach: 0.15, point: 0.08, reef: 0.10, river: 0.08, other/null/unrecognized: 0.12

Step 4: Short period penalty (wind swell degradation)
  If dominant_period_s < 8:
    penalty = dominant_period_s / 8  (linear ramp, e.g., 6s -> 0.75)
  Else:
    penalty = 1.0

Step 5: Swell direction access
  Convert swell_1_direction cardinal string to degrees via getDirectionDegrees
  bin = round(swell_1_direction_deg / 5) % 72
  access_factor = beach.swell_access_factors[bin]  (0.0 to 1.0)
  Fallback: 0.7 if no access factors on beach OR swell direction unavailable

Step 6: Wind penalty
  Convert wind_direction cardinal string to degrees via getDirectionDegrees
  Convert wind_speed string to kts (parse mph string, divide by 1.151)
  onshore_component = cos(toRadians(wind_direction_deg - beach.aspect_deg))
  If onshore (component > 0):
    wind_penalty = max(0.3, 1 - (wind_speed_kts * onshore_component) / 30)
  Else (offshore/cross):
    wind_penalty = 1.0

Step 7: Final
  raw = base_frequency * break_type_factor * short_period_penalty * access_factor * wind_penalty
  rideable_waves_per_hour = clamp(round(raw), 0, 60)
```

### Confidence Levels

Derived from `forecast_at` timestamp and available data:

| Level | Criteria |
|---|---|
| high | hours_from_now <= 48 AND swell components available AND confidence_score >= 0.7 |
| medium | Everything else |
| low | hours_from_now > 168 OR confidence_score < 0.4 |

Where `hours_from_now = (Date.parse(forecast_at) - Date.now()) / 3_600_000`

### Break Type Defaults

| Break Type | Factor | Rideable Threshold (ft) | Rationale |
|---|---|---|---|
| beach | 0.15 | 2.0 | Shifting peaks, many waves but few with shape |
| point | 0.08 | 2.5 | Organized lineup, fewer but higher quality |
| reef | 0.10 | 2.5 | Defined takeoff, moderate frequency |
| river | 0.08 | 2.5 | Organized flow, similar to point |
| other / null / unrecognized | 0.12 | 2.0 | Conservative default |

### Example Outputs (fully specified inputs)

| Beach | Height | Period | Swell Dir | Access Factor | Wind | Break Type Factor | Result |
|---|---|---|---|---|---|---|---|
| Ocean Beach Pier (beach) | 4ft | 10s single | SW (direct) | 0.85 | 5kt offshore | 0.15 | 3600/10 × 0.15 × 1.0 × 0.85 × 1.0 = **~46** |
| Scripps (reef) | 4ft | 12s single | WNW (direct) | 0.90 | calm | 0.10 | 3600/12 × 0.10 × 1.0 × 0.90 × 1.0 = **~27** |
| Scripps (reef) | 4ft | 12s single | WNW (direct) | 0.90 | 15kt onshore | 0.10 | 3600/12 × 0.10 × 1.0 × 0.90 × 0.55 = **~15** |
| Generic beach | 2ft | 6s wind swell | W | 0.70 | calm | 0.15 | 3600/6 × 0.15 × 0.75 × 0.70 × 1.0 = **~47** clamped to **~47** |
| Any | 1.5ft | 8s | any | any | any | any | **0** (below 2.0ft threshold) |

### Edge Case Handling

- **Period zero or null:** Return 0 immediately (Step 0 guard)
- **Equal periods:** |T1 - T2| < 1.0s falls back to single-swell formula
- **Set interval clamping:** 60s to 600s prevents runaway values
- **Output ceiling:** Hard cap at 60 waves/hr (one per minute)
- **Wind swell (< 8s):** Linear penalty reduces count proportionally
- **Height ranges ("3-4ft"):** Parse lower bound (3ft) for threshold check
- **"Flat" text:** parseWaveHeight returns ~0.15m (~0.5ft), correctly gated to 0
- **Null break_type or unrecognized string:** Uses "other" defaults (factor 0.12, threshold 2.0ft)
- **Missing swell_access_factors:** Falls back to 0.7
- **Missing swell direction:** Falls back to access_factor 0.7
- **Missing wind data:** wind_penalty defaults to 1.0 (assume calm)
- **Trig conversion:** All `cos()` calls use `toRadians()` — angles stored/parsed as degrees

---

## Data Storage & Pipeline Integration

### Compute Strategy: Client-Side Pure Function

**Why not MV storage (revised from initial design):** The materialized view `mv_beach_hourly_scores` is built from `marine_forecasts` which only has single-swell data (`tp_s`, `swell_dir_deg`). It lacks the multi-swell component data (`swell_1_period`, `swell_2_period`) needed for the set-wave formula. Rather than rebuilding the MV, we compute in the `forecastToConditionsData` mapper using `EnhancedForecastEntity` which already has all swell components.

**Compute path:**
1. Beach detail page fetches `EnhancedForecastEntity` (already happens)
2. `forecastToConditionsData` mapper calls `calculateRideableWaves(forecast, beach)` — a pure function
3. Result populates `ConditionsData.rideableWavesPerHour`
4. ConditionsTicker renders it

**No new cron, no migration, no additional API call.** The calculation piggybacks on the existing data fetch.

### New Files

| File | Purpose |
|---|---|
| `lib/domains/wave-frequency/calculator.ts` | Pure calculation function, no DB dependency |
| `lib/domains/wave-frequency/constants.ts` | Break type factors, thresholds, clamps |
| `lib/domains/wave-frequency/types.ts` | Input/output types |

### Reused Utilities (no new parsers)

| Utility | Location | Purpose |
|---|---|---|
| `parseWavePeriod` | `lib/utils/number-parsing.ts` | Parse "10s" → 10 |
| `parseWaveHeight` | `lib/ml/parse-wave-height.ts` | Parse "3-4ft" → meters (convert to ft) |
| `parseWindSpeed` | `lib/utils/number-parsing.ts` | Parse "8 mph" → 8 |
| `getDirectionDegrees` | `lib/domains/scoring/discovery-adapter.ts` | Convert "SW" → 225 |

---

## UI Integration

### Approach

Extend the existing ConditionsTicker system — no standalone component. Beach detail page only in v1.

### Changes

1. Add `rideableWavesPerHour?: number | null` to `ConditionsData` type in `types/conditions.ts`
2. Add `"frequency"` to `ConditionsIconType` union in `lib/utils/conditions-card-builder.ts`
3. Add frequency card builder block in `buildConditionsCards` — **gated by an options parameter** so it only renders on beach detail pages, not embed/widget/discovery surfaces
4. Add `CardIcon` case for `"frequency"` using `Activity` icon from lucide
5. Compute value in `forecastToConditionsData` mapper in `lib/mappers/conditions-mappers.ts` by calling the pure calculator function

### Display Format

- **Value:** `~46` (tilde prefix for estimation)
- **Label:** `waves/hr`
- **aria-label:** `"approximately 46 rideable waves per hour"`
- **Zero case:** `Flat` (no elaboration)
- **Confidence v1:** Colored dot (no text) or omit entirely
- **First-encounter tooltip:** "Estimated catchable waves based on swell, break type, and conditions"

---

## Testing Strategy

### Unit Tests (calculator)

- Known inputs -> expected outputs for each break type (using fully specified examples from this spec)
- Edge cases: equal periods, near-zero period difference, wind swell (< 8s), null swell components, null break type, unrecognized break type strings
- Period zero/null guard returns 0
- Division-by-zero guard verification (periods within 1.0s)
- Clamp boundaries: output 0-60, set interval 60-600s
- Height gate: below-threshold returns 0
- Wind penalty: onshore vs offshore vs calm vs missing wind data
- Swell access factor: direct vs oblique angles vs missing access factors
- Cardinal-to-degrees conversion for swell and wind directions
- Unit conversions: meters-to-feet for height, mph-to-kts for wind

### Integration Tests

- `forecastToConditionsData` maps the new field correctly
- `buildConditionsCards` produces frequency card with correct formatting when enabled
- `buildConditionsCards` does NOT produce frequency card on non-beach-detail surfaces
- End-to-end: forecast entity with known values → correct display string in ticker

### Post-Launch Validation

- Compare predictions against session logs with user-reported wave counts
- Reference beaches: Ocean Beach Pier, Scripps
- Track user feedback on whether numbers feel believable
- Adjust break type factors based on real-world calibration

### Commit Strategy

Two commits to manage risk:
1. **Calculator + unit tests** — pure TypeScript, zero risk, independently verifiable
2. **UI integration + integration tests** — wires the calculator into the conditions pipeline

Both commits ship together in the same PR. This satisfies the same-commit rule for behavior changes (the calculator is inert until wired).

---

## Future Enhancements (not in v1)

- **User skill/board personalization:** Longboarders see higher counts (lower height threshold), shortboarders see lower
- **Crowd-adjusted count:** "Waves available to you" factoring in lineup density
- **Hourly timeline:** Mini chart showing wave frequency changes through the day
- **Discovery integration:** Show waves/hr on beach cards, search results, "best time to surf"
- **Scoring engine integration:** Promote to 9th scorer plugin if it improves recommendations
- **Session log calibration:** Use actual wave-caught data to train break-type coefficients
- **MV materialization:** Once validated, pre-compute and store in `mv_beach_hourly_scores` for use in discovery queries
- **Rounding to nearest 5:** Display as ~35, ~40 instead of exact integers to better communicate imprecision
