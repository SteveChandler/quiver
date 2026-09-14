# Cape Hatteras partition-absence decision — 2026-09-13

## (a) Finding

**The candidate does not meet the existing absence contract.** At the Hatteras cell, NCEP SWELL ordinal 2 is bitmap-missing at both f048 and f004. It is neither a stored numeric zero nor a positive height. The messages decode successfully, but successful message decoding does not establish valid partition computation at that cell. The bitmap preserves missingness, not an absence reason. Hatteras remains `provider_zero_tuple` / `incomplete_partition` under the current contract.

Evidence: [sanitized probe record](swell-watch-partition-absence-probe-20260913.json). Source `d264fbf8-0525-4d31-adb5-9a0742eaeb7e`, model `ncep_gfswave016`, issuance `2026-09-13T12:00Z`, retained semantic hash `a63bfc9e83434a2bda42cd3149e3ec2f13415585aa66495b48d7c8502be5832c`. Only two of the 48 zero-tuple hours were probed; no result is imputed to the other 46.

| Source path | Evidence checked or inherited | Establishes explicit absence? |
|---|---|---|
| Open-Meteo Single Runs fields | Read retained semantic payload: six partition arrays plus time and envelope metadata; both tested secondary tuples are `(0,0,0)`. No validity, absence, or partition-count field occurs in this retained response. No new API request. | No. This does not prove that no other provider capability exists. |
| Pinned Open-Meteo source | Local prior-investigation README and source manifest pin commit `9701689dd81ebef2d478800366c586c8a02c0c19`; the task establishes ocean-cell NaN-to-zero conversion. The Swift body was not available locally and was not fetched outside the permitted domains. | No. The documented lossy conversion cannot preserve a per-value reason. |
| NCEP gridded inventory | Reused the saved f048 offsets. Absence of PNR in f048/f126 is the supplied prior finding, not a repeated discovery. F004 inventory was fetched only to locate ordinal 2. | No independent count/validity witness identified. |
| GRIB2 bitmap probe | Four individually ranged messages successfully decoded with ecCodes 2.48.0; exact request lengths and Content-Range checked. | Distinguishes numeric values from missing at the cell; cannot distinguish absence from other undefined states. |
| WW3 partition-output semantics | Task-supplied manual rule: partition output beyond the partitions found is UNDEF. Primary manual reference below; no local copy found and no documentation fetched. | No. The rule establishes absence → UNDEF. It does not establish UNDEF → absence or successful partition computation. |

Primary references, cited without HTTP retrieval in this probe:

- [WW3 user manual v5.16](https://polar.ncep.noaa.gov/waves/wavewatch/manual.v5.16.pdf), section describing gridded/partitioned output fields `PHS`, `PTP`, `PDIR` and unused partition slots set to `UNDEF`. The section number/page and its applicability to the operational 2026 build were not independently verified here; the semantic premise is supplied by the task, not a newly verified quotation.
- [NCEP NOMADS GFS-Wave product description](https://nomads.ncep.noaa.gov/txt_descriptions/GFS_wave_doc.shtml), product reference only; not evidence of a per-value absence flag.
- [Pinned GfsWaveVariable.swift](https://github.com/open-meteo/open-meteo/blob/9701689dd81ebef2d478800366c586c8a02c0c19/Sources/App/Gfs/GfsWaveVariable.swift), field/ordinal mapping and interpolation reference.
- [Pinned GfsDownload.swift](https://github.com/open-meteo/open-meteo/blob/9701689dd81ebef2d478800366c586c8a02c0c19/Sources/App/Gfs/GfsDownload.swift), prior-established NaN-to-zero transformation.

### Actual cell results

All four messages have a bitmap (`bitmapPresent=1`). Missing counts are whole-message counts, not a partition count at Hatteras.

| Forecast hour | Inventory record | ecCodes shortName / parameter number | Surface / ordinal | numberOfMissing | Hatteras bitmap bit | Hatteras value |
|---|---|---|---|---:|---:|---|
| 48 | 5, HTSGW | `swh` / 3 | surface | 330377 | 1 | 1.32 m |
| 48 | 9, SWELL:1 | `shts` / 8 | type 241 / 1 | 350538 | 1 | 0.06 m |
| 48 | 10, SWELL:2 | `shts` / 8 | type 241 / 2 | 387344 | 0 | undefined/missing |
| 4 | 10, SWELL:2 | `shts` / 8 | type 241 / 2 | 384317 | 0 | undefined/missing |

Discipline 10, parameter category 0. Swell ordinals use `scaledValueOfFirstFixedSurface` 1 or 2 with scale factor 0. Do not interpret ecCodes' generic name “Significant height of total swell” as erasing the ordinal. The missing sentinel returned by the library is `9999`; it is not a measured height.

The decoded grid is template 0, `regular_ll`, 2160 × 406, first point `(52.5,0)`, last point `(-15,359.833376)`, declared increments `0.166667°`, positive-i/negative-j row scanning. All records select zero-based index **226347**, row 104, column 1707, coordinates `(35.166632000000334,284.5000337341343)` or longitude `-75.4999662658657`. This is about 5.04 m from the rounded Open-Meteo coordinate `(35.166668,-75.5)`. It is the nearest logical cell, not exact equality of floating-point coordinates. Operational integration must establish the grid-transform correspondence explicitly; a nearest-neighbor distance alone is insufficient provenance. The decoded regional extent must be retained even though the filename says `global`.

## (b) Contract consequence

**Do not implement `bitmap=0 → explicitly-absent`.** No sufficient witness was obtained. Adding the positive primary/HTSGW observations or the supplied WW3 rule still leaves the missing-value cause unknown. A hash binds bytes; it cannot supply missing semantics.

If a future authoritative provider contract establishes independent partition validity and absence for the same model/issuance/grid/hour/rank, use this representation:

- `present`: validated height, period, direction, with source provenance.
- `explicitly-absent`: no invented numeric tuple; mandatory independently verifiable absence evidence.
- `unavailable`: unknown validity, missing/undefined, missing messages, transport/decode failures, unmapped ordinals, or contradictory evidence. Preserve suppression.

Required evidence fields: contract/transformation version; provider and operational product identity; model; issuance; forecast hour and valid time; native-frame status; source point ID; original and decoded grid definition, grid hash, scan flags and cell index; API field names and upstream rank mapping pinned to code; GRIB discipline/category/parameter, surface type/scale/ordinal, inventory record; URL path, byte interval, byte count and SHA-256; index hash; acquisition time; decoder/library versions; bitmap presence, cell bit and missing count; **independent validity and absence/count field or provider attestation with documented semantics and its own immutable source reference**. Retain the original Open-Meteo receipt/hash separately.

Independent validation must replay retained GRIB bytes, verify hashes, transport range integrity, message identity, issue/time/rank/grid binding and the cell bit, then separately validate the authoritative absence/validity evidence. An untrusted receipt boolean is not evidence. Accept absence only when that independent evidence proves a valid partition computation and absent mapped rank. Bitmap missing alone, zero tuples, a wet cell, and valid sibling partitions must fail this rule. Contradictions remain unavailable. The two tested records therefore remain unavailable even under this proposed representation.

## (c) Cost

Actual probe: **5 GET requests, 1,561,788 response-body bytes**, no redirects/retries, no AWS fallback, no documentation request. Four HTTP 206 ranges and one HTTP 200 index. Largest range 425,239 bytes; sum of HTTP elapsed times 1.156 s on this machine. Every request was capped at 4,000,000 bytes and 30 seconds. No whole GRIB file was fetched. The explicitly requested pip installation is separate tooling traffic; its binary wheels exceed 4 MB and are not included in the provider-probe budget. ecCodes installed and selfcheck completed within five minutes.

Prospective diagnostics are **not a priced sufficient-witness adapter**: the necessary extra validity source has not been found. Let H be the union of native zero-tuple forecast hours across the ten sources, grouped by issuance and upstream grid/product. A grid record can serve multiple cohort cells; do not fetch it ten times.

| Diagnostic scope per issuance | Requests without a cached index | Approximate bytes using f048 sizes |
|---|---:|---:|
| SWELL:2 bitmap only | 2H (index + range) | H × (388,751 + index bytes) |
| HTSGW + SWELL:1 + SWELL:2 comparison | 4H | H × (1,167,631 + index bytes) |
| Hatteras' 48 hours, bitmap only | 96 | 18.66 MB + indexes |
| Hatteras' 48 hours, three-record comparison | 192 | 56.05 MB + indexes |

These are estimates, not measured whole-run totals or qualification evidence. Other sources can add hours or distinct grids; exact ten-source zero-hour coverage was not acquired. If all ten share the same 48 hours/grid, totals remain the same. If disjoint, use their union. Four issuances multiply the applicable daily estimate by four (e.g. about 224.2 MB/day for the 48-hour three-record comparison). Cached retries reuse immutable ranges and indexes; new issuances do not.

Store content-addressed ranged GRIB messages and indexes once per issuance/hour/product, plus small per-cell evidence records. JSON alone cannot be independently replayed after upstream expiry. The four probe messages remain in `/tmp/claude-501/probe-{1,2,3,5}.bin`; index request is `probe-4.bin`. Temporary files are not durable storage. Diagnostic persistent bytes roughly equal downloaded unique bytes; additional true validity evidence has unknown size/cost. No paid API or account was used. At 30 seconds per request, sequential worst-case latency is 60H or 120H seconds; the observed 1.156 seconds for five requests is not a production latency guarantee.

## (d) Risks and unverified bindings

- **Ordinal mapping:** the expected direct mapping is `secondary_swell_wave_height → SWELL:2`, `secondary_swell_wave_period → SWPER:2`, and `secondary_swell_wave_direction → SWDIR:2`, with primary fields at ordinal 1, as referenced by the pinned [GfsWaveVariable.swift mapping](https://github.com/open-meteo/open-meteo/blob/9701689dd81ebef2d478800366c586c8a02c0c19/Sources/App/Gfs/GfsWaveVariable.swift). **This packet did not independently verify those switch cases:** only the local pinned-source manifest was available. Thus “secondary maps to SWELL:2” remains an expected mapping, not an attested operational binding. The matching primary height (0.06 m) supports consistency but cannot prove it. Reviewer must inspect the pinned cases and operational serving version before treating ranks as identical. Do not equate WW3 partitions including wind sea with swell-only ordinals or a generic PNR without a documented mapping.
- **UNDEF semantics:** no exclusive missing-reason discriminator was recovered. Even confirming the manual premise would not establish its converse. Operational WW3 version, configuration, output sorting and GRIB encoding path remain unverified.
- **Retention:** treat NOMADS' approximately ten-day window as the planning assumption supplied in the task, not a guaranteed SLA. Persist evidence promptly or leave expired/unretrievable hours unavailable. The AWS mirror may differ in availability, object revision, or encoding. Re-read its index and validate its own hashes/identity before using its offsets; never mix offsets or provenance across origins blindly. AWS was not tested.
- **Grid and time:** bind the logical cell despite coordinate quantization and retain the actual decoded extent. Native f004 and f048 avoid the separate post-hour-120 interpolation issue; no interpolation conclusion follows from these probes.
- **Scope:** height only was probed for ordinal 2. Period/direction records and the other 46 missing hours were not fetched. Neither result proves every retained zero has the same cause. No global assertion that all possible provider products lack a signal is justified.

## (e) Deployment order and rollback

There is no deployable absence adapter from this evidence. First resolve the authoritative validity/absence and rank/grid binding gaps. Then: **new adapter + additive storage contract migration in isolation → review of real-source fixtures and actual receipt/database/evaluator integration → explicit epoch decision**. The review must prove unknown stays suppressed, forged absence claims fail, raw zero tuples cannot create completeness, and provenance is independently replayable. Preserve ten sources, matching thresholds, freshness and four distinct successful issuances per qualifying day. Do not backfill success or silently reinterpret current-epoch observations.

Rollback disables the new interpretation/adapter and restores unknown suppression; retain original receipts, byte evidence, and versioned decisions. Do not delete evidence or rewrite historical results. No application code, production state, authority, sends, migration, commit or push was changed by this packet. The only repository writes are the two requested documents.

## (f) Reviewer decision / alternative

**One approval to seek next: acknowledge that any change to qualifying-cohort treatment requires a separately reviewed study-definition amendment, with the current epoch remaining suppressed.** This probe does not support approval of bitmap-only “known absence.” Approval cannot turn undefined data into a source-backed witness.

A narrower future amendment could explicitly accept genuinely source-backed absence, conditional on the evidence contract in (b), without dropping Hatteras, widening thresholds, or altering the four-issuance rule. It currently has no qualifying witness. If the reviewer declines any amendment, Hatteras stays suppressed and the affected ten-source issuance cannot qualify under the current study definition; a day requiring it cannot qualify. This does not predict that every future Hatteras issuance will contain missing values. No production permission is requested or exercised here.

### Validation performed

- `/tmp/claude-501/grib-venv/bin/python -m eccodes selfcheck` — PASS, ecCodes 2.48.0.
- `/tmp/claude-501/grib-venv/bin/python /tmp/claude-501/partition-probe.py` — PASS, five bounded HTTP requests and four complete GRIB decodes; all ranged length/Content-Range and single-message-size assertions passed. Do not rerun this network script within this task: only one of the six allowed requests remains, and rerunning would exceed the cap.
- `/tmp/claude-501/grib-venv/bin/python /tmp/claude-501/validate-partition-probe.py` — PASS; offline replay and budget/hash/identity/cell-bit assertions, retained semantic hash reference and zero-tuple checks.
- Application tests and E2E not run: no application changes in this read-only research packet. This is source evidence, not an integration or production qualification pass.
