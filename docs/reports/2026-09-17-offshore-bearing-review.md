# Offshore-bearing review — 2026-09-17

Status: DRAFT. No database mutation was performed. The companion migration is intentionally empty because no HIGH-confidence changes were available.

## Method

The read-only script queried `public.beaches` with direct `POSTGRES_URL_NON_POOLING` through `psql`, with `PGOPTIONS='-c default_transaction_read_only=on'`. Calibrated means `shoaling_factors IS NOT NULL`, excluding `avalanche` and `imperial-beach-pier`. The run found 115 calibrated beaches and 350 other beaches with a non-null `wind_offshore_deg`; other beaches were reported but not proposed.

For each calibrated beach, aspect is treated as seaward-facing direction. OSM coastline ways were requested from the public Overpass endpoint within 1.5 km, cached under the requested output directory, and converted to local segment bearings. Because coastline ways have land on the left and water on the right, seaward is segment bearing +90°. Geometry was unavailable when no coastline was within 1 km or the request failed. Swell-window center is weak evidence only. Proposed offshore is seaward +180°, rounded to 5°. HIGH requires aspect and geometry within 25°; MEDIUM requires one of those sources plus swell center within 45°; otherwise REVIEW. `CHANGE` means the shortest angular delta is at least 20°.

The run command was:

```text
yarn tsx scripts/propose-offshore-bearings.ts --out /private/tmp/claude-501/-Usersstevenchandler-Desktop-dev/b6860db2-3182-4df6-99d2-589286756ffa/scratchpad/offshore/run1
```

Overpass returned `429`, `504`, and fetch failures, then remained unreachable. The script continued with aspect and swell evidence, wrote the CSV/JSON export and did not print credentials.

## Counts

| Scope | HIGH | MEDIUM | REVIEW | proposed changes |
| --- | ---: | ---: | ---: | ---: |
| Calibrated | 0 | 47 | 68 | 33 |
| Other, reported only | 0 | 0 | 350 | 0 |

## HIGH changes

None. Therefore the draft migration has no executable `UPDATE` statements.

## MEDIUM calibrated list

An asterisk marks the 33 rows that would meet the change threshold if approved after geometry confirmation.

`204s*`, `andrew-molera-river-mouth-big-sur-ca`, `beacons*`, `big-rock-la-jolla-ca`, `birdrock*`, `blacks`, `cardiff-reef*`, `county-line-malibu-ca*`, `c-street-ventura-ca*`, `del-mar`, `del-mar-rivermouth`, `d-street*`, `el-segundo-beach-jetty-el-segundo-ca*`, `emma-wood-ventura-ca*`, `forster-st-oceanside*`, `georges*`, `grandview*`, `horseshoe*`, `la-jolla-shores*`, `manhattan-beach-pier-manhattan-beach-ca`, `mission-beach`, `mission-beach-central`, `mondos-beach-ventura-ca*`, `moonlight-state-beach*`, `ocean-beach-pier`, `ocean-beach-sloat-san-francisco-ca`, `oceanside-harbor*`, `pacific-beach`, `pb-point*`, `pipes*`, `ponto*`, `san-elijo-state-beach*`, `scripps*`, `seaside-reef*`, `shipwrecks-coronado-ca*`, `silver-strand-state-beach*`, `solana-beach*`, `solimar-reef-ventura-ca*`, `sunset-cliffs-garbage*`, `swamis`, `tamarack`, `terramar-point*`, `topanga-malibu-ca*`, `torrey-pines-state-beach*`, `tourmaline-surf-park*`, `venice-breakwater-los-angeles-ca*`, `windansea`.

## REVIEW calibrated list

`52nd-street-newport-beach-ca`, `54th-street-newport-beach-ca`, `agate-street`, `alfonsos`, `big-jetty`, `brooks-street`, `carlsbad-state-beach`, `church`, `corona-del-mar`, `coronado-north-jetty`, `cottons`, `crystal-cove`, `crystal-pier`, `doheny`, `doheny-state-beach`, `el-morro-point-k37-5`, `el-porto-manhattan`, `goldenwest`, `hb-cliffs`, `hermosa-pier`, `hotel-del-coronado`, `huntington-beach-pier`, `huntington-beach-pier-northside`, `huntington-beach-pier-southside`, `huntington-st`, `huntington-state-beach`, `imperial-beach`, `jalama-beach-jalama-ca`, `k-38`, `k-40`, `las-gaviotas`, `lower-trestles`, `malibu-first-point-surfrider`, `marine-street-beach`, `middles`, `new-break-nubes`, `newport-56th-st`, `newport-lower-jetties`, `newport-point`, `newport-upper-jetties`, `ocean-beach`, `oceanside-pier`, `old-mans-sano`, `osprey-point`, `poche-beach`, `redondo-breakwall-redondo-beach-ca`, `renes`, `rincon-carpinteria-ca`, `river-jetties`, `rockpile`, `rosarito`, `salt-creek`, `san-clemente-pier-northside`, `san-clemente-state-beach`, `san-onofre-state-beach`, `strands`, `sunset-cliffs-garbage-san-diego-ca`, `sunset-cliffs-luscombs-san-diego-ca`, `teresas`, `thalia-street`, `the-rock-oceanside`, `the-wedge`, `tijuana-sloughs`, `tourmaline`, `trails`, `t-street`, `upper-trestles`, `zuma-beach-malibu-ca`.

## Spot checks

| Beach | Evidence from run | Result / real-coast reasoned review |
| --- | --- | --- |
| blacks | aspect 270°, swell 268°, current 90° | MEDIUM; west-facing La Jolla coast supports proposed offshore 90°, no geometry confirmation. |
| del-mar | aspect 265°, swell 265°, current 90° | MEDIUM; west-facing beach supports 85° offshore; only 5° delta. |
| la-jolla-shores | aspect 270°, swell 273°, current 135° | MEDIUM CHANGE; cove area faces roughly NW/WNW, so 90° is a coarse west-facing correction pending geometry. |
| scripps | aspect 270°, swell 270°, current 135° | MEDIUM CHANGE; west-facing coast supports 90° offshore pending geometry. |
| tourmaline | aspect 270°, swell 195°, current 45° | REVIEW; Pacific Beach shoreline is west-facing but swell evidence disagrees, so no proposal. |
| oceanside-pier | aspect 270°, swell 205°, current 45° | REVIEW; pier coast is broadly west-facing, but swell disagreement and no geometry prevent a proposal. |
| lower-trestles | aspect 270°, swell 220°, current 67° | REVIEW; San Onofre coast is broadly west-facing, but swell disagreement prevents a proposal. |
| church | no aspect, swell 218°, current 45° | REVIEW; south-facing cove context cannot be inferred safely from swell alone. |
| hb-cliffs | no aspect, swell 230°, current 45° | REVIEW; no aspect and no geometry; the coastline is broadly southwest-facing but evidence is insufficient. |
| huntington-beach-pier | aspect 0°, swell 213°, current 45° | REVIEW; known coast faces SSW, but stored aspect is inconsistent and must be corrected/verified manually. |
| c-street-ventura-ca | aspect 260°, swell 225°, current 45° | MEDIUM CHANGE; Ventura Point is broadly S/SW-facing in the requested real-coast check, so the aspect-derived 80° offshore is not trusted without coastline geometry. |
| ocean-beach-sloat-san-francisco-ca | aspect 280°, swell 263°, current 90° | MEDIUM; Ocean Beach Sloat faces west, aspect-derived 100° offshore is close to current. |

## Live code paths

These paths read or select `wind_offshore_deg`; changing the value changes the corresponding live behavior even when direction scoring is disabled.

- `app/[intent]/[city]/page.tsx` — supplies beach wind direction to intent/city rendering.
- `app/api/alerts/debug/[ruleId]/route.ts` — exposes the bearing in alert debugging.
- `app/api/beaches/[id]/route.ts` — returns the bearing in beach API payloads.
- `app/api/coast-pulse/summary/route.ts` — includes it in coast-pulse summaries.
- `app/api/cron/condition-alert-deliver/route.ts` — evaluates wind alert conditions.
- `app/api/cron/similarity-alerts/route.ts` — uses it in similarity alert matching.
- `app/api/forecasts/bulk/route.ts` — includes it in bulk forecast beach config.
- `app/api/surf/call/route.ts` — feeds the surf-call calculation.
- `app/api/v1/recommendations/route.ts` — returns it in recommendation context.
- `app/best-time-to-surf/[city]/page.tsx` — supplies city beach recommendation context.
- `app/embed/surf-terminal/[slug]/page.tsx` — displays wind-offshore orientation in the embed.
- `lib/alerts/condition-evaluator.ts` — checks forecast wind against the offshore bearing.
- `lib/alerts/seed-default-rule.ts` — seeds default alert rules with the bearing.
- `lib/alerts/types.ts` — carries the alert beach bearing type.
- `lib/domains/spot-profile/spot-profile.ts` — derives spot-profile wind orientation.
- `lib/monitoring/fallback-tracker.ts` — marks wind-quality fallback impact.
- `lib/npc/forecast-formatter.ts` — formats beach wind context for NPC forecasts.
- `lib/recommendations/surf-window-recommendations.ts` — labels wind quality for windows.
- `lib/recommendations/surf-window-source-flags.ts` — marks wind-bearing source availability.
- `lib/scoring/board-pick.ts` — uses offshore direction in board selection.
- `lib/scoring/trend-tags.ts` — creates wind-direction trend tags.
- `lib/scoring/types.ts` — carries the scoring input field.
- `lib/services/coast-pulse/coast-pulse-service.ts` — returns the bearing in coast-pulse data.
- `lib/services/discovery/surf-discovery-orchestrator.ts` — ranks discovery spots by wind orientation.
- `lib/services/discovery/window-selector/window-scorer.ts` — scores wind against the bearing.
- `lib/services/intel-generation-service.ts` — supplies wind orientation to generated intel.
- `lib/services/magic-hour/interpolation.ts` — evaluates wind quality at interpolated hours.
- `lib/services/magic-hour/scoring.ts` — scores magic-hour wind quality.
- `lib/services/magic-hour/types.ts` — carries the magic-hour bearing type.
- `lib/services/spot-surf-report-service.ts` — includes the bearing in surf reports.
- `lib/surf/scoring.ts` — uses it in surf scoring.
- `lib/utils/beach-defaults.ts` — defines the default nullable field.
- `lib/utils/beach-faq-utils.ts` — renders offshore direction in FAQ answers.
- `lib/utils/recommendation-scorer.ts` — scores wind direction for recommendations.
- `lib/utils/surf-call-logic.ts` — evaluates wind quality in surf calls.

The generated machine-readable export is outside the repository at `/private/tmp/claude-501/-Usersstevenchandler-Desktop-dev/b6860db2-3182-4df6-99d2-589286756ffa/scratchpad/offshore/run1/bearings.csv` and `bearings.json`.
