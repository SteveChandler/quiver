# Ocean Beach Pier 12–16 s shoaling bucket validation — 2026-10-27

## Decision

**Retain 1.04 for the existing max-based calibrated bucket. Do not apply the provisional 1.30.** The saved year of paired data yields a median `Surfline surf_max_ft / CDIP Hs_ft` of **1.038** (IQR **0.937–1.169**, **n = 5,296**). The requested midpoint comparison yields **0.878** (IQR **0.774–1.011**, same n); it is a different target and must not be substituted into the existing max-based calibration without a separate product decision. A week-block bootstrap gives a 95% interval of **1.009–1.075** for the historical max-ratio median and **0.846–0.912** for the midpoint-ratio median. These intervals describe estimation uncertainty over the saved year, not whether the relationship changed after April 2026.

The 1.30 proposal would make the factor 25% larger than the historical max-ratio median. It lies above 88.1% of historical max ratios (632 of 5,296 were at least 1.30). The single 2026-10-27 report is a real discrepancy to investigate, but it is not evidence that this one bucket should be changed for all conditions.

## Sources and identity

- Ocean Beach Pier is `ocean-beach-pier`, UUID `65d177de-e75a-4ad8-aa0d-48a67c0851b0`. The [calibration migration](../../supabase/migrations/20260407134519_add_shoaling_factors_to_beaches.sql) and [station override](../../supabase/migrations/20260220183416_audit_sd_cdip_station_overrides.sql) assign **CDIP 220**. The saved spot map selects Surfline Ocean Beach **`5842041f4e65fad6a770883f`**, 0.213 km from the Quiver point; this spot identity could not be checked live.
- Paired inputs: `/Users/stevenchandler/Desktop/dev/seaside/scripts/shoaling_calibration_pipeline/workspace/surfline/65d177de-e75a-4ad8-aa0d-48a67c0851b0.json` (8,832 hourly LOTUS rows, `complete: true`; SHA-256 `8f1d563eb7180aaa075ec918f1391b0a1de9d2f6a9393ec35a7b56363dce653c`) and `.../workspace/cdip/220.json` (17,375 half-hourly records; SHA-256 `fed56dab34247aa9810b8fce33956716a68011260f644431862a9dd356e860f2`). The CDIP file is labeled `source: dry_run_fixtures`; [dry_run_setup.py](/Users/stevenchandler/Desktop/dev/seaside/scripts/shoaling_calibration_pipeline/agents/dry_run_setup.py) says the fixture was pre-scraped from CDIP. Its first five rows matched a fresh query of the [public CDIP `wave_agg` archive](https://erddap.cdip.ucsd.edu/erddap/tabledap/wave_agg.html). The Surfline cache remains independently unverified.
- The saved [harvester](/Users/stevenchandler/Desktop/dev/seaside/scripts/shoaling_calibration_pipeline/agents/harvester.py) extracted Surfline `surf.raw.min` and `surf.raw.max`; [joiner](/Users/stevenchandler/Desktop/dev/seaside/scripts/shoaling_calibration_pipeline/agents/joiner.py) used **max/Hs**, a ±30-minute nearest CDIP match, Hs ≥0.3 ft, max/Hs in [0, 5], and CDIP peak period for bucket assignment. This report rejoined the raw files with the same gates and additionally calculated `(min + max) / 2 / Hs`.
- A fresh browser-User-Agent request to `https://services.surfline.com/kbyg/spots/forecasts/surf` for this spot, starting 2026-10-11 with `days=16`, returned **HTTP 403** on 2026-10-27. There is no independently retrieved Surfline series after the cache's April 2026 end. No production database was queried or changed.

## Paired distribution

All times below are UTC. Surfline rows span 2025-04-07 07:00 through 2026-04-10 06:00; CDIP rows span 2025-04-07 00:00 through 2026-04-07 00:00. Of 8,832 unique Surfline hours, **8,686** met the join and data gates; **146** had no CDIP match within 30 minutes. No matched rows were rejected for missing values, Hs, or factor range. The 12–16 s bucket contains **5,296** hours across **53** Monday-start UTC weeks (first and last weeks are partial). Quartiles use linear interpolation between ordered observations.

| CDIP Tp | n | Surfline min / Hs median [Q1, Q3] | Surfline midpoint / Hs median [Q1, Q3] | Surfline max / Hs median [Q1, Q3] |
| --- | ---: | ---: | ---: | ---: |
| 0–<8 s | 460 | 0.694 [0.599, 0.785] | 0.825 [0.728, 0.934] | 0.962 [0.846, 1.091] |
| 8–<12 s | 1,275 | 0.691 [0.587, 0.811] | 0.841 [0.743, 0.957] | 1.001 [0.880, 1.113] |
| **12–<16 s** | **5,296** | **0.717 [0.602, 0.871]** | **0.878 [0.774, 1.011]** | **1.038 [0.937, 1.169]** |
| 16–<999 s | 1,655 | 0.709 [0.613, 0.830] | 0.851 [0.767, 0.970] | 1.001 [0.909, 1.123] |

The 12–16 s weekly midpoint medians range **0.635–1.338** (weekly median **0.879**, interquartile range **0.799–0.944**); weekly max medians range **0.848–1.456** (weekly median **1.042**, interquartile range **0.959–1.109**). Only one week had a max-ratio median ≥1.30. Weekly sample sizes range **25–150**, so the full-year median should not be read as a promise for every week. The bootstrap above resampled the 53 entire weeks with replacement 2,000 times (seed `20261027`) and took the 2.5th and 97.5th percentiles of the pooled median.

| Week starting (UTC) | n | Midpoint/Hs median | Max/Hs median |
| --- | ---: | ---: | ---: |
| 2025-04-07 | 96 | 0.990 | 1.085 |
| 2025-04-14 | 130 | 0.792 | 0.959 |
| 2025-04-21 | 57 | 0.856 | 1.013 |
| 2025-04-28 | 89 | 0.857 | 0.985 |
| 2025-05-05 | 73 | 0.985 | 1.110 |
| 2025-05-12 | 89 | 0.838 | 0.935 |
| 2025-05-19 | 102 | 0.944 | 1.106 |
| 2025-05-26 | 115 | 0.901 | 1.042 |
| 2025-06-02 | 138 | 0.836 | 0.969 |
| 2025-06-09 | 83 | 0.908 | 1.028 |
| 2025-06-16 | 94 | 0.799 | 0.916 |
| 2025-06-23 | 92 | 0.879 | 1.082 |
| 2025-06-30 | 106 | 0.782 | 0.942 |
| 2025-07-07 | 79 | 0.856 | 1.008 |
| 2025-07-14 | 115 | 0.770 | 0.936 |
| 2025-07-21 | 128 | 0.720 | 0.898 |
| 2025-07-28 | 38 | 0.879 | 1.065 |
| 2025-08-04 | 94 | 0.945 | 1.065 |
| 2025-08-11 | 132 | 0.920 | 1.038 |
| 2025-08-18 | 88 | 0.901 | 1.088 |
| 2025-08-25 | 66 | 0.692 | 0.848 |
| 2025-09-01 | 148 | 0.804 | 0.942 |
| 2025-09-08 | 148 | 0.878 | 1.042 |
| 2025-09-15 | 139 | 0.777 | 0.931 |
| 2025-09-22 | 94 | 0.742 | 0.909 |
| 2025-09-29 | 85 | 0.857 | 0.992 |
| 2025-10-06 | 88 | 0.759 | 0.926 |
| 2025-10-13 | 123 | 0.909 | 1.088 |
| 2025-10-20 | 134 | 1.016 | 1.125 |
| 2025-10-27 | 82 | 0.869 | 1.024 |
| 2025-11-03 | 144 | 1.185 | 1.292 |
| 2025-11-10 | 138 | 0.866 | 1.036 |
| 2025-11-17 | 92 | 0.917 | 1.041 |
| 2025-11-24 | 150 | 1.100 | 1.280 |
| 2025-12-01 | 113 | 1.121 | 1.251 |
| 2025-12-08 | 141 | 0.906 | 1.118 |
| 2025-12-15 | 76 | 0.875 | 1.068 |
| 2025-12-22 | 41 | 0.939 | 1.142 |
| 2025-12-29 | 32 | 0.635 | 1.044 |
| 2026-01-05 | 74 | 0.826 | 0.975 |
| 2026-01-12 | 127 | 1.145 | 1.275 |
| 2026-01-19 | 135 | 1.007 | 1.211 |
| 2026-01-26 | 120 | 1.012 | 1.205 |
| 2026-02-02 | 137 | 1.338 | 1.456 |
| 2026-02-09 | 114 | 1.014 | 1.129 |
| 2026-02-16 | 56 | 0.966 | 1.109 |
| 2026-02-23 | 75 | 0.901 | 1.152 |
| 2026-03-02 | 79 | 0.898 | 1.064 |
| 2026-03-09 | 71 | 0.787 | 0.911 |
| 2026-03-16 | 120 | 0.708 | 0.885 |
| 2026-03-23 | 105 | 0.876 | 1.052 |
| 2026-03-30 | 86 | 0.761 | 0.992 |
| 2026-04-06 | 25 | 0.759 | 0.949 |

## 2026-10-27 incident and uncertainty

The [public CDIP archive query](https://erddap.cdip.ucsd.edu/erddap/tabledap/wave_agg.json?station_id,time,waveHs,waveTp,waveDp&station_id=%22220%22&time%3E=2026-10-27T15:00:00Z&time%3C=2026-10-27T15:00:00Z) returned **station 220 at 15:00 UTC (08:00 PDT): Hs 1.05 m = 3.445 ft, Tp 14.286 s, direction 240.219°**. Applying the stored 1.04 factor gives **3.6 ft after rounding**, consistent with the reported Quiver number. The live-column [migration value](../../supabase/migrations/20260211120000_comprehensive_swell_window_fix.sql) is 292.5° ±72.5°, which includes 240°; the later 270° ±72° value was staged in v2 columns only. Thus the direction gate does not explain this particular under-call if the live row still matches the migration. The user-reported Surfline 4–5 ft corresponds to min/mid/max ratios of **1.161 / 1.306 / 1.451** against that CDIP Hs. This point's midpoint ratio is near the historical midpoint upper tail; its max ratio is near the historical max upper tail. Surfline's 4–5 ft value was supplied by the user and could not be independently retrieved.

The source cache ends more than six months before the incident. LOTUS heights are modeled surf ranges, not observed wave faces. Sandbars, tides, directional mix, and model revisions can change the relationship, and adjacent hourly samples are correlated. The bootstrap interval therefore does **not** quantify October 2026 drift. A current paired Surfline series of at least two weeks, with varied conditions, is needed before recommending an increase from 1.04.

## SQL — documentary only; do not execute

No database change is recommended while the bucket remains **1.04**. The exact guarded UPDATE below states the retained value and would rewrite that same value only if the expected row and bucket are still present; it is included for review, **not for execution**. It cannot establish the live row's state. The proposed 1.30 UPDATE in the earlier audit should not be run.

```sql
UPDATE public.beaches
SET shoaling_factors = jsonb_set(shoaling_factors, '{buckets,2,factor}', '1.04'::jsonb)
WHERE id = '65d177de-e75a-4ad8-aa0d-48a67c0851b0'
  AND slug = 'ocean-beach-pier'
  AND cdip_station = '220'
  AND shoaling_factors->>'type' = 'period_lookup'
  AND shoaling_factors->'buckets'->2->>'tp_min_s' = '12'
  AND shoaling_factors->'buckets'->2->>'tp_max_s' = '16'
  AND shoaling_factors->'buckets'->2->>'factor' = '1.04'
RETURNING id, slug, shoaling_factors;
```
