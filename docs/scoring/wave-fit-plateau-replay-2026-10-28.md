# Wave fit plateau replay — 2026-10-27

Read-only replay of 41802 stored forecast rows for 385 beaches in 47 regions containing 311 nondeleted real-user home-beach profiles. Region key uses region_id when present, otherwise country/state/region. Local dates 2026-10-20 through 2026-11-02; daylight 06:00–20:00. Each stored forecast slot is a one-hour candidate window. Skill rows assume no board; the board table scores each skill with a single shortboard, mid-length or longboard in the quiver. Full beach decision ceilings and direction scoring were applied by scoreWindowConditionDetails.

| Skill | Windows | Label changed | Mean Δ | p90 Δ | >1 tier | Score-only day-pick verdict flips | Possible swell-alert GO starts/stops |
|---|---:|---:|---:|---:|---:|---:|---:|
| beginner | 20790 | 7965 (38.3%) | 7.0 | 16 | 415 | 1247/5005 | 2290/0 |
| beginner transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 4850 | 1445 | 179 | 0 | 0 |
| RIDEABLE | 0 | 1220 | 4051 | 236 | 0 |
| FAIR | 0 | 0 | 5359 | 2054 | 0 |
| GOOD | 0 | 0 | 0 | 1396 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |
| intermediate | 20790 | 5654 (27.2%) | 5.2 | 12 | 234 | 878/5005 | 1607/0 |
| intermediate transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 5202 | 1222 | 89 | 0 | 0 |
| RIDEABLE | 0 | 2115 | 2736 | 145 | 0 |
| FAIR | 0 | 0 | 5538 | 1462 | 0 |
| GOOD | 0 | 0 | 0 | 2281 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |
| advanced | 20790 | 4466 (21.5%) | 3.7 | 11 | 0 | 677/5005 | 1111/0 |
| advanced transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 9926 | 1034 | 0 | 0 | 0 |
| RIDEABLE | 0 | 2452 | 2321 | 0 | 0 |
| FAIR | 0 | 0 | 3267 | 1111 | 0 |
| GOOD | 0 | 0 | 0 | 679 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |
| expert | 20790 | 3494 (16.8%) | 2.7 | 7 | 0 | 419/5005 | 444/0 |
| expert transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |
| MEH | 10846 | 1134 | 0 | 0 | 0 |
| RIDEABLE | 0 | 3890 | 1916 | 0 | 0 |
| FAIR | 0 | 0 | 2271 | 444 | 0 |
| GOOD | 0 | 0 | 0 | 289 | 0 |
| EPIC | 0 | 0 | 0 | 0 | 0 |

Day picks are each beach/local day's highest daylight slot, with worth_it ≥70, maybe ≥40, skip <40 via `getRecommendationLabel`. Actual day selection also applies duration, safety, board, and user gates; these counts are score-only estimates. Possible swell-alert GO starts/stops use that same threshold on each slot: an upper bound on changed downstream canonical verdicts, not delivered alerts. Condition-alert rule matching and its best-hour score are independent of this flag: **0** raw-rule changes. Watched-call condition alerts use refreshed discovery scores; their starts/stops cannot be counted without saved watch state and are bounded by score changes here. Swell event detection uses independent swell energy/period/exposure thresholds: **0** event-detection changes.


### By skill and board (no matrix)

| Profile | Windows | Label changed | Mean Δ | p90 Δ | >1 tier | Score-only day-pick verdict flips | Possible swell-alert GO starts/stops |
|---|---:|---:|---:|---:|---:|---:|---:|
| beginner + shortboard | 20790 | 7405 (35.6%) | 6.7 | 16 | 338 | 1158/5005 | 2300/0 |
| beginner + mid-length | 20790 | 7835 (37.7%) | 6.9 | 16 | 445 | 1188/5005 | 2389/0 |
| beginner + longboard | 20790 | 7451 (35.8%) | 6.7 | 18 | 458 | 1133/5005 | 2434/0 |
| intermediate + shortboard | 20790 | 5374 (25.8%) | 4.9 | 12 | 173 | 840/5005 | 1529/0 |
| intermediate + mid-length | 20790 | 5888 (28.3%) | 5.5 | 13 | 234 | 874/5005 | 1690/0 |
| intermediate + longboard | 20790 | 6084 (29.3%) | 5.9 | 14 | 242 | 965/5005 | 2082/0 |
| advanced + shortboard | 20790 | 4428 (21.3%) | 3.7 | 11 | 1 | 676/5005 | 1107/0 |
| advanced + mid-length | 20790 | 5887 (28.3%) | 5.3 | 14 | 36 | 944/5005 | 1762/0 |
| advanced + longboard | 20790 | 5945 (28.6%) | 5.6 | 14 | 44 | 851/5005 | 1792/0 |
| expert + shortboard | 20790 | 3491 (16.8%) | 2.6 | 7 | 0 | 419/5005 | 441/0 |
| expert + mid-length | 20790 | 5579 (26.8%) | 4.6 | 11 | 16 | 888/5005 | 1395/0 |
| expert + longboard | 20790 | 6999 (33.7%) | 6.0 | 14 | 51 | 1098/5005 | 2164/0 |

### San Diego advanced spot checks

| Beach | Local day | Best slot before → after |
|---|---|---|
| Terramar Point | 2026-10-31 | 69 FAIR → 81 GOOD |
| Terramar Point | 2026-11-01 | 64 FAIR → 77 GOOD |
| Scripps | 2026-10-31 | 73 GOOD → 87 GOOD |
| Scripps | 2026-11-01 | 68 FAIR → 83 GOOD |
| La Jolla Shores | 2026-10-31 | 69 FAIR → 81 GOOD |
| La Jolla Shores | 2026-11-01 | 61 FAIR → 73 GOOD |
| Blacks | 2026-10-31 | 69 FAIR → 81 GOOD |
| Blacks | 2026-11-01 | 61 FAIR → 73 GOOD |

### San Diego advanced + shortboard spot checks

| Beach | Local day | Best slot before → after |
|---|---|---|
| Terramar Point | 2026-10-31 | 69 FAIR → 81 GOOD |
| Terramar Point | 2026-11-01 | 64 FAIR → 77 GOOD |
| Scripps | 2026-10-31 | 73 GOOD → 87 GOOD |
| Scripps | 2026-11-01 | 68 FAIR → 83 GOOD |
| La Jolla Shores | 2026-10-31 | 69 FAIR → 81 GOOD |
| La Jolla Shores | 2026-11-01 | 61 FAIR → 73 GOOD |
| Blacks | 2026-10-31 | 69 FAIR → 81 GOOD |
| Blacks | 2026-11-01 | 61 FAIR → 73 GOOD |

### Potential over-promotion near ideal minimum

| Skill | Beach / local time | Height | Before → after |
|---|---|---:|---|
| beginner | Kitty Hawk Pier / 2026-10-30T18:00:00+00:00 | 1.2 ft | 52 RIDEABLE → 66 FAIR |
| intermediate | 36th-42nd Street / 2026-10-23T15:00:00+00:00 | 2.2 ft | 38 MEH → 48 RIDEABLE |
| advanced | Huntington Beach Pier Southside / 2026-10-21T18:00:00+00:00 | 3.2 ft | 51 RIDEABLE → 60 FAIR |

Other scorer paths: `window-calculator` and displayed board overrides already call the native scorer and inherit the flag. Beach Detail runs the scorer in the browser; rollout must also set `NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED=true` at build time to match the server. The domain `base-conditions-scorer` uses a separate beach/composite ramp and is intentionally unchanged. Alert `best-hour` scores a user-defined swell-height range, not a skill ideal range; its matching is unchanged.
