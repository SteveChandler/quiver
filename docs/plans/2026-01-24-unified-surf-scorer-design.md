# Unified Surf Scorer Design

## Problem

Two issues with the current "Best Time to Surf" experience:

1. **Data mismatch** — "Today's Surf Call" (AI intel) and "Best Time to Surf Today" (forecast scorer) show different windows for the same spot/day because they use separate calculation systems.
2. **Redundancy** — "Best Window Today" and "Magic Hour" cards on the forecast tab present nearly identical information with slightly different ranges.

## Architecture: Referee vs. Commentator

### The Referee (Scoring Algorithm)

Single source of truth for all objective surf data. Scores each forecast timeslot and outputs:

| Output | Derivation |
|--------|-----------|
| **Verdict** | Max score in day: >75 = GO, 50-75 = MAYBE, <50 = SKIP |
| **Window** | Continuous range where score > 50 AND time < sunset |
| **Peak** | Narrower range where score > 80 (subset of window, interpolated to minute) |
| **Trend Tags** | Computed from score component slopes against raw data |

### The Commentator (AI Intel)

Receives the Referee's outputs and writes narrative text. It does not determine timing or verdict — it explains the call in human terms. Returns a single JSON response:

```json
{
  "banner_headline": "Rideable 1.7 ft surf — get in after 5 PM for cleaner conditions.",
  "card_analysis": "Conditions improve through the afternoon as winds shift offshore. Best quality on the dropping tide after 6 PM."
}
```

### Data Flow

```
Raw Forecasts → [Daylight Filter] → Scoring Algorithm → { verdict, window, peak, trends }
                                                              |
                                                    AI Narration (single call)
                                                              |
                                              +---------+----------+
                                              |                    |
                                        Top Banner          Forecast Card
                                       (Headline)           (The Story)
```

Both UI components read from the same scored output. They can never disagree.

## Daylight Protocol

The algorithm discards any timeslot where time >= sunset before scoring. Sunset is calculated from beach lat/lon using standard solar position formulas (no external API). A score of 100 is meaningless if it's dark.

## Unified Scorer Pipeline

```
1. FILTER: Discard slots where time >= sunset (location-aware)
2. SCORE: Weight each remaining slot (0-100):
   - Wind Quality:  35% (offshore/light = max)
   - Tide Match:    30% (within beach preferred range)
   - Swell Match:   25% (direction + period)
   - Time of Day:   10% (dawn patrol / glass-off bonus)
3. DERIVE:
   - Window: First-to-last continuous slot where score > 50
   - Peak:   Subset where score > 80 (interpolated to minute)
   - Verdict: Max(scores) -> GO / MAYBE / SKIP
   - Trends: Compare slot[n] vs slot[n-1] per component
```

## Trend Tag Derivation

Score determines IF a tag shows. Raw data determines WHICH label it gets.

| Condition | Tag |
|-----------|-----|
| Wind speed decreasing | "Winds Dropping" |
| Wind speed stable, direction improving | "Winds Cleaning Up" |
| Tide score rising | "Tide Filling In" |
| Swell score stable + high | "Clean Swell" |
| Wind score falling | "Winds Building" |
| All scores high + stable | "All-Day Conditions" |

## UI Components

### Top Banner (The Headline)

Stays compact. Uses new data source.

```
+-----------------------------------------------------------+
|  [GO]  Today's Surf Call          [Live Data] Updated 9:34 AM |
|  BEST WINDOW  3:00-7:30 PM . 1.7 ft . E 10-15 mph . Rising  |
|  Rideable 1.7 ft surf -- get in after 5 PM for cleaner.      |
+-----------------------------------------------------------+
```

- Verdict badge: GO (green), MAYBE (amber), SKIP (gray)
- Window from scorer's >50 threshold (capped at sunset)
- Inline stats from raw forecast at peak time
- One-line narrative from AI (banner_headline)
- Safe Mode badge: "Live Data" (green) or "Forecast Only" (amber) based on observation_count

### Forecast Card (The Story)

Single card replaces both "Best Window Today" and "Magic Hour" cards.

```
+-----------------------------------------------------------+
|  Best Time to Surf Today                                    |
|  Based on forecast data                                     |
|                                                             |
|  3:00 PM - 7:30 PM                                         |
|  Peak: 6:30 PM                                             |
|                                                             |
|  [ Winds Cleaning Up ]  [ Tide Filling In ]  [ Clean Swell ]|
|                                                             |
|  "Conditions improve through the afternoon as winds shift   |
|   offshore. Best quality on the dropping tide after 6 PM."  |
+-----------------------------------------------------------+
```

- Same window as banner (shared scorer output)
- Peak time (scorer's >80 threshold, interpolated)
- Trend tags beneath the times
- AI narrative paragraph (card_analysis)

### Progressive Disclosure

| Data Point | Top Banner (Headline) | Forecast Card (Story) |
|-----------|----------------------|----------------------|
| Verdict | Color/Icon (green GO) | Text ("Solid Potential") |
| Window | Compact (3-7:30 PM) | Expanded (3:00 PM - 7:30 PM) |
| Peak | Hidden | Highlighted (Peak: 6:30 PM) |
| Conditions | Raw stats (3ft, E 10mph) | Trend Tags |
| Narrative | One-liner | Full AI paragraph |
| Data Source | Safe Mode badge | Hidden |

## Safe Mode Indicator

When IOOS buoy data is unavailable (observation_count == 0), the banner shows:

- **Healthy:** `[ * Live Data ]` (green dot)
- **IOOS Down:** `[ ! Forecast Only ]` (amber)

This flag comes from the unified scorer. Users should never assume a GO verdict is based on live observations when it isn't.

## Token Optimization

A single AI prompt call returns both the banner headline and card analysis as JSON. This ensures thematic consistency between the two text layers and avoids double latency/cost.

### AI Prompt Input

```json
{
  "verdict": "GO",
  "window": "3:00 PM - 7:30 PM",
  "peak": "6:30 PM",
  "trends": ["Winds Cleaning Up", "Tide Filling In", "Clean Swell"],
  "wave_height": "1.7 ft",
  "wind": "E 10-15 mph",
  "tide_state": "Rising"
}
```

### AI Prompt Output

```json
{
  "banner_headline": "string (one line, max 80 chars)",
  "card_analysis": "string (2-3 sentences)"
}
```

## Migration Plan

### What Stays

- Scoring weights (wind 35%, tide 30%, swell 25%, time 10%) — proven logic
- Beach metadata fields (preferred tide, swell window, offshore direction)
- Top banner visual layout and positioning
- AI intel infrastructure (Supabase table, edge function)

### What Changes

| Current | New |
|---------|-----|
| AI intel determines window timing | Scorer determines all timing |
| `magic-hour-finder.ts` (770 lines) | Absorbed into unified scorer |
| `use-magic-hour.ts` hook | Replaced by `use-surf-score.ts` |
| Two cards (Best Window + Magic Hour) | Single card with peak line |
| Static tags ("Onshore winds") | Dynamic trend tags from score slopes |
| Separate AI calls for banner/card | Single prompt -> JSON with both fields |
| No data source indicator | Safe Mode badge when observation_count == 0 |
| No sunset filtering | Daylight Protocol: slots >= sunset discarded |

### New Files

- `lib/scorers/unified-surf-scorer.ts` — single scorer with threshold outputs
- `hooks/use-surf-score.ts` — hook consuming unified scorer
- `lib/utils/solar.ts` — sunrise/sunset calculation from lat/lon

### Removed Files

- `lib/services/magic-hour-finder.ts`
- `hooks/use-magic-hour.ts`

### Edge Function Update

AI prompt schema changes to accept referee outputs and return two-format JSON response.
