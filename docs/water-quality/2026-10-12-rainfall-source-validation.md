# Rainfall source validation for the SoCal runoff notice

Date: 2026-10-12. Window: Oct 5 to Oct 12 11:00 PDT. One rain event fell in the window, Oct 10 to Oct 12, so the comparison rests on three wet days across 11 stations.

## Verdict

- **Open-Meteo fails.** It must not drive a health notice.
- **METAR-derived totals pass.** Hourly precipitation from routine airport reports agrees with independent CoCoRaHS volunteer gauges at 9 of 10 stations that have gauges nearby. ASOS reads a little low in heavy rain, and one station (Santa Ana, KSNA) read well low on this event.
- **Production source:** aviationweather.gov METAR JSON, one request per station, routine reports only.

## Open-Meteo vs gauges

`/v1/forecast?past_days=7&hourly=precipitation&daily=precipitation_sum` (best-match model). Totals are inches, 7 am Oct 10 to 7 am Oct 12 PDT, against the nearest CoCoRaHS gauges.

| Point | Open-Meteo | Nearest gauges | Airport ASOS | Result |
|---|---|---|---|---|
| Santa Monica | 0.08 | 0.03 | SMO 0.03 | close, both tiny |
| Huntington | 0.12 | 0.43 to 0.46 | LGB 0.38, SNA 0.17 | misses 70% |
| Carlsbad | 0.53 | 2.25 to 2.94 | CRQ 1.91 | misses 75 to 80% |
| Pacific Beach | 2.95 | 0.96 to 1.19 | SAN 1.04 | 2.5x high |
| Ventura | 0.03 | Oxnard 0.07 | OXR 0.06 | close, both tiny |

Two independent failures, either one disqualifying:

1. **Phantom single-hour spikes.** Pacific Beach shows 1.15 in at 19:00 Oct 10 and 1.35 in at 01:00 Oct 12. SAN, NKX and MYF all report 0.00 to a trace in those hours. These two hours are 85% of its window total.
2. **Missed storm.** Carlsbad got 1.9 to 2.9 in. Open-Meteo shows 0.53, and its timing does not line up with the gauges (its largest hour, 0.28 in at 02:00 Oct 11, falls between CRQ's 0.24 and 0.44 hours).

Open-Meteo's past_days values are archived model output, not observations, which explains both failures. NWS gridpoint `quantitativePrecipitation` is also a forecast field and drops past hours, so it cannot measure what fell either. It was not evaluated further.

## METAR (ASOS) vs gauges

Source for validation: Iowa Environmental Mesonet ASOS archive, `p01i` from routine reports only (SPECI precipitation accumulates since the last routine report and would double count). Ground truth: CoCoRaHS daily reports for San Diego, Orange, Los Angeles and Ventura counties, report dates Oct 11 and Oct 12, gauges within 10 km. CO-OPS tide stations do not report precipitation here and MesoWest needs an API token, so CoCoRaHS replaced them.

| Station | ASOS 48 h | Gauges within 10 km | Gauge median | Ratio |
|---|---|---|---|---|
| SMO Santa Monica | 0.03 | 1 | 0.03 | 1.00 |
| LGB Long Beach | 0.38 | 4 | 0.37 | 1.03 |
| SNA Santa Ana | 0.17 | 4 | 0.57 | **0.30** |
| CRQ Carlsbad | 1.91 | 4 | 2.25 | 0.85 |
| OKB Oceanside | 1.74 | 2 | 2.94 | 0.59 |
| SAN Lindbergh | 1.04 | 6 | 1.14 | 0.91 |
| NKX Miramar | 1.15 | 5 | 1.28 | 0.90 |
| MYF Montgomery | 1.02 | 8 | 1.41 | 0.72 |
| NZY North Island | 0.66 | 4 | 1.03 | 0.64 |
| OXR Oxnard | 0.06 | 1 within 15 km | 0.07 | 0.86 |
| LAX | 0.23 | 0 | n/a | n/a |

Hourly timing matches between neighbouring stations (SAN, NKX and MYF peak in the same hours at 0.13 to 0.19 in). No single hour above 0.44 in at any station, and the 0.44 in CRQ hour sits inside a run of 0.24, 0.16 and 0.19 in hours that gauges corroborate in total.

Bias: ASOS reads low, median ratio about 0.86. Tipping-bucket gauges under-catch in heavy rain, and convective cells vary over a few km. For a 0.2 in trigger an under-read means a missed notice, not a false one.

**KSNA is the exception.** It read 0.17 in while four gauges within 10 km read 0.44 to 0.63 in. On this event that flips the 0.2 in verdict for Huntington and Newport if KSNA is used alone.

Cross-check of the production endpoint: aviationweather.gov routine `precip` for KSAN summed to 1.09 in over the same span, against 1.04 in from the IEM archive.

## Station policy

Each coastal cluster lists two stations and uses the larger 72 h total. A precautionary notice should err toward warning. The cost shows at Santa Monica on this event: LAX read 0.23 in and SMO 0.05 in, so the max rule would have posted a notice the local gauge (0.03 in) does not support. The benefit shows at Huntington, where LGB's 0.38 in catches what KSNA missed. LA County Public Health's own rain advisories apply county-wide after rainfall rather than per beach, so a cluster-level trigger matches how the authority already acts.

| Cluster | Stations |
|---|---|
| Santa Barbara | KSBA |
| Ventura / Oxnard | KOXR, KCMA |
| Malibu / Santa Monica | KSMO, KLAX |
| South Bay / Long Beach | KLAX, KLGB |
| Huntington / Newport | KLGB, KSNA |
| Laguna / San Clemente | KSNA, KNFG |

Excluded: KTOA (only 66 of 179 routine hours archived) and KNTD (no precipitation reported). KCMA read 0.16 in against 0.04 to 0.06 in at Camarillo gauges, so the Ventura cluster leans high, which is the safe direction. KSBA saw no rain in the window, so its agreement is unproven.

A station missing more than 6 of the 72 routine hours is dropped from its cluster. A cluster with no usable station records nothing and shows no notice. Silence never reads as clean water, because the notice only ever adds a warning.

Beaches inside the County of San Diego feed's coverage bounds get no rain notice. The County's own advisories cover them.

## Limits

- One storm. Re-check after the next rain with the spot check in the release pool.
- Gauges are volunteer CoCoRaHS reports with 7 am observation days, so ASOS windows were aligned to 7 am PDT.
- Raw data and scripts were kept out of the repo. Reproduce with the IEM `asos.py` request for `p01i` and `metar` and the CoCoRaHS daily CSV export.

## Cadence

The brief asked for a daily job. A once-daily run would lag new rain by up to 24 hours and keep a notice up to 30 hours past its 72-hour window. The job runs every 3 hours instead, about 64 small AWC requests a day, and a reading older than 7 hours is ignored.
