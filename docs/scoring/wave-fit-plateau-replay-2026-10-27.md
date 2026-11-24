# Wave fit plateau replay — 2026-10-27

Read-only replay of 42942 stored forecast rows for 385 beaches in 47 regions containing 311 nondeleted real-user home-beach profiles. Region key uses region_id when present, otherwise country/state/region. Local dates 2026-10-20 through 2026-11-02; daylight 06:00–20:00. Each stored forecast slot is a one-hour candidate window. No board inventory was assumed. Full beach decision ceilings and direction scoring were applied by scoreWindowConditionDetails.

| Skill | Windows | Label changed | Mean Δ | p90 Δ | >1 tier | Score-only day-pick verdict flips | Possible swell-alert GO starts/stops |
|---|---:|---:|---:|---:|---:|---:|---:|
| beginner | 21043 | 9617 (45.7%) | 9.3 | 22 | 1842 | 1577/5162 | 3117/0 |
| beginner transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 4307 | 1192 | 1010 | 5 | 0 |
| RIDEABLE | 0 | 495 | 4298 | 827 | 0 |
| FAIR | 0 | 0 | 5250 | 2285 | 0 |
| GOOD | 0 | 0 | 0 | 1374 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |
| intermediate | 21043 | 8785 (41.7%) | 9.0 | 22 | 1598 | 1508/5162 | 2694/0 |
| intermediate transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 4300 | 1464 | 835 | 0 | 0 |
| RIDEABLE | 0 | 534 | 3792 | 763 | 0 |
| FAIR | 0 | 0 | 5168 | 1931 | 0 |
| GOOD | 0 | 0 | 0 | 2256 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |
| advanced | 21043 | 8246 (39.2%) | 9.0 | 26 | 2268 | 1688/5162 | 2925/0 |
| advanced transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 8835 | 1172 | 1086 | 25 | 0 |
| RIDEABLE | 0 | 664 | 3063 | 1157 | 0 |
| FAIR | 0 | 0 | 2596 | 1743 | 0 |
| GOOD | 0 | 0 | 0 | 702 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |
| expert | 21043 | 8272 (39.3%) | 7.9 | 22 | 1753 | 1456/5162 | 2153/0 |
| expert transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 9534 | 1829 | 804 | 0 | 0 |
| RIDEABLE | 0 | 1425 | 3486 | 949 | 0 |
| FAIR | 0 | 0 | 1507 | 1204 | 0 |
| GOOD | 0 | 0 | 0 | 305 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |

Day picks are each beach/local day's highest daylight slot, with worth_it ≥70, maybe ≥40, skip <40 via `getRecommendationLabel`. Actual day selection also applies duration, safety, board, and user gates; these counts are score-only estimates. Possible swell-alert GO starts/stops use that same threshold on each slot: an upper bound on changed downstream canonical verdicts, not delivered alerts. Condition-alert rule matching and its best-hour score are independent of this flag: **0** raw-rule changes. Watched-call condition alerts use refreshed discovery scores; their starts/stops cannot be counted without saved watch state and are bounded by score changes here. Swell event detection uses independent swell energy/period/exposure thresholds: **0** event-detection changes.

### San Diego advanced spot checks

| Beach | Local day | Best slot before → after |
|---|---|---|
| Terramar Point | 2026-10-31 | 69 FAIR → 92 GOOD |
| Terramar Point | 2026-11-01 | 64 FAIR → 84 GOOD |
| Scripps | 2026-10-31 | 73 GOOD → 92 GOOD |
| Scripps | 2026-11-01 | 68 FAIR → 84 GOOD |
| La Jolla Shores | 2026-10-31 | 69 FAIR → 92 GOOD |
| La Jolla Shores | 2026-11-01 | 61 FAIR → 84 GOOD |
| Blacks | 2026-10-31 | 69 FAIR → 92 GOOD |
| Blacks | 2026-11-01 | 61 FAIR → 84 GOOD |

### Potential over-promotion near ideal minimum

| Skill | Beach / local time | Height | Before → after |
|---|---|---:|---|
| beginner | Kitty Hawk Pier / 2026-10-31T12:00:00+00:00 | 1 ft | 46 RIDEABLE → 86 GOOD |
| intermediate | Surf City / 2026-10-31T21:00:00+00:00 | 2 ft | 48 RIDEABLE → 84 GOOD |
| advanced | Agate Street / 2026-10-22T21:00:00+00:00 | 3 ft | 41 RIDEABLE → 74 GOOD |

Other scorer paths: `window-calculator` and displayed board overrides already call the native scorer and inherit the flag. Beach Detail runs the scorer in the browser; rollout must also set `NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED=true` at build time to match the server. The domain `base-conditions-scorer` uses a separate beach/composite ramp and is intentionally unchanged. Alert `best-hour` scores a user-defined swell-height range, not a skill ideal range; its matching is unchanged.
