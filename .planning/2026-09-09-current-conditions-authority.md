# Current-conditions authority (2026-09-09)

Second slice after `2026-09-09-window-authority.md`. Same principle: one producer per user-facing
concept, additive contracts, clients prefer the server field.

## Live evidence

San Diego Ocean Beach (`15c7337e-5258-4339-9dc3-c435c666926b`), dev.quiversurf.app, 2026-09-09
~17:50 PT, maestro-regression account (`.planning/evidence/2026-09-09-current-conditions-authority/`).

| Concept | `/api/forecasts/current` | `/api/forecasts/bulk` (map) | `/api/surf/call?includeNow=1` |
|---|---|---|---|
| Current row | latest row with `forecast_at <= now` (5:00 PM, CDIP, `fresh`) | `nearestForecastRow(rows, now)`: 5:00 PM now, but flips to the 8:00 PM row after 6:30 PM | now-mode window 5:00–7:05 PM |
| Swell shown | named partition 3 ft / 9 s / SW | `mapSwellPartition` swaps s1 for the offshore tuple 2.2 ft / 6.9 s / 209° whenever it exists | context rule: named unless OM is in the beach window and named is not |
| Verdict | — | score 64 → `FAIR` → "Worth a look" (web chip); native maps it to its own `'FAIR'` | score 64 → `Maybe` (`getRecommendationLabelGated`); report verdict `NO` (skill hold) |

Native adds a fourth path: `useCurrentConditions` reads `enhanced_forecasts` directly from
Supabase (same "latest ≤ now" rule, duplicated client-side, no freshness metadata), and both map
features use it only as a gap-fill fallback for the sheet.

## Rules

1. **One current row per beach**: the latest row with `forecast_at <= now`
   (`lib/services/current-conditions/current-row.ts`). The bulk route uses it for "now"
   (swell partition, display fallback, scoring) with its existing 3-hour tolerance as the
   availability gate; a future row is never "now".
2. **One display-swell convention** (`lib/domains/conditions/display-swell.ts`, parity fixture
   `evidence/…/display-swell-parity.json`, mirrored in native): CDIP numeric-conflict rule, then
   the offshore tuple only when OM is inside the beach window and the named swell is not, else the
   named partition. Period, direction and height switch together. The map flow field may still
   render the offshore tuple, but every label that shows it says "offshore".
3. **One verdict producer**: `lib/services/discovery/recommendation-label.ts`
   (`getConditionCharacter` + `getRecommendationLabelGated`), used by discovery and by the bulk
   route (`recommendationLabels`). The map's score-band chip (`conditionSummaryFromScore`,
   `CONDITION_MARKER_CALLS`) is retired for user-facing text; `conditionSummaries` stays in the
   bulk response for installed clients.

## Contract (additive)

- `/api/forecasts/bulk`: `displaySwell[beachId] = { periodSeconds, directionDeg, heightFt, source }`,
  `recommendationLabels[beachId] = 'Worth it' | 'Maybe' | 'Skip' | null` (null when held/unscored).
- Native `useCurrentConditions` becomes a view over `/api/forecasts/current` (the route Beach
  Detail already reads); the map sheet reads it at "now" instead of gap-filling from Supabase.

## Packets

- A (web): current-row + display-swell + label producer; bulk route, surf-call context, orchestrator.
- B (web): map UI reads `recommendationLabels`/`displaySwell`; offshore label on the callout.
- N (native): route-backed `useCurrentConditions`, map sheets on the route row, unified
  `rowDisplaySwell`, label chip.
