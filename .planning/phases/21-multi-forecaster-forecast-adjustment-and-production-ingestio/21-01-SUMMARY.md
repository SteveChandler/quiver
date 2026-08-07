---
phase: 21-multi-forecaster-forecast-adjustment-and-production-ingestio
plan: 21-01
subsystem: infra
tags: [python, httpx, apscheduler, supabase, forecast-ingestion, html-parsing, nws-api]

requires: []
provides:
  - "Fixed 17-source trusted-forecast inventory with per-source lineage, evidence class, authority eligibility, timezone, freshness rule and redirect allowlist."
  - "Hardened HTTPS transport: manual per-hop redirect validation, bounded transient retry that preserves the underlying cause and HTTP status, response-size and content-type caps."
  - "Source-specific parsers producing immutable NormalizedIssue rows with day_part, validity_basis, stable identity keys and revision hashes."
  - "Six-hour append-only ingestion cron with partial-success persistence, degraded-item accounting, and D-04 fail-closed health reporting."
  - "Live-capture corpus (v2) plus a provenance ratchet forbidding unmarked invented fixtures."
affects: [21-02, 21-03, 21-04, 21-05]

tech-stack:
  added: []
  patterns:
    - "Every accept fixture is a verbatim live capture or a capture plus named literal edits."
    - "Degraded item losses are recorded on the durable source result instead of discarding a usable source."
    - "Duplicate issue identity inside one source result is an invariant violation that fails the source, never a degraded item."

key-files:
  created:
    - /Users/stevenchandler/Desktop/dev/seaside/trusted_forecasts/sources.py
    - /Users/stevenchandler/Desktop/dev/seaside/trusted_forecasts/fetch.py
    - /Users/stevenchandler/Desktop/dev/seaside/trusted_forecasts/models.py
    - /Users/stevenchandler/Desktop/dev/seaside/trusted_forecasts/parsers.py
    - /Users/stevenchandler/Desktop/dev/seaside/crons/fetch_trusted_forecasts.py
    - /Users/stevenchandler/Desktop/dev/seaside/tests/test_fetch_trusted_forecasts.py
    - /Users/stevenchandler/Desktop/dev/seaside/tests/fixtures/trusted_forecasts/corpus.json
    - /Users/stevenchandler/Desktop/dev/seaside/tests/fixtures/trusted_forecasts/captures/
  modified:
    - /Users/stevenchandler/Desktop/dev/seaside/scheduler.py
    - /Users/stevenchandler/Desktop/dev/seaside/.env.example

key-decisions:
  - "Four of the 17 sources are configured but disabled: their live documents state no publication instant anywhere, and inventing one is the defect this plan exists to prevent."
  - "socal keeps a 96-hour freshness bound rather than the WaveCast default of 36, because the page states its own Sunday/Tuesday/Thursday cadence."
  - "The socal chart's spot slug is part of the issue identity; without it eight spots minted one identity."
  - "validity_basis is provenance, deliberately excluded from the identity and revision hashes."

patterns-established:
  - "Capture-or-note ratchet: a fixture byte is either a byte a real source served or a byte with a written reason."
  - "Publication-day derivation sites are enforced by an AST ratchet over parsers.py."
  - "Disabled sources keep a dispatch entry that raises loudly, so re-enabling one cannot silently fabricate an issue."

requirements-completed: [MFA-01, MFA-02, MFA-03]

duration: multi-session
completed: 2026-08-06
---

# 21-01: Production Multi-Source Ingestion Summary

**All 17 configured sources now resolve against the live web — 13 parse, 4 are deliberately
disabled because their documents state no publication instant — and the six-hour job reports
healthy instead of raising `RuntimeError` on every run.**

## Live verification — the shipped cron against all 17 real URLs

Run 2026-08-07T03:36Z. Only the Supabase persistence boundary was stubbed; fetch, dispatch,
the socal fan-out, the duplicate-identity guard, degraded accounting and the D-04 health raise
are the shipped code paths.

| source_key | status | failure_code | http | issues | authority | degraded |
|---|---|---|---:|---:|---:|---|
| socal | ok | — | 200 | 264 | 256 | — |
| hawaii | ok | — | 200 | 32 | 32 | — |
| new_england | ok | — | 200 | 16 | 16 | — |
| new_york | ok | — | 200 | 15 | 15 | `missing_surf_range` ×1 |
| new_jersey | ok | — | 200 | 16 | 16 | — |
| north_carolina | ok | — | 200 | 16 | 16 | — |
| florida_east_coast | ok | — | 200 | 16 | 16 | — |
| norcal | ok | — | 200 | 32 | 32 | — |
| central_california | ok | — | 200 | 32 | 32 | — |
| baja | ok | — | 200 | 32 | 32 | — |
| nws_hawaii_srf | ok | — | 200 | 34 | 34 | — |
| surf_institute_pnw | ok | — | 200 | 2 | 0 | — |
| stormsurf_pnw_links | **skipped_disabled** | — | — | 0 | 0 | — |
| stormsurf_pnw_buoy | **skipped_disabled** | — | — | 0 | 0 | — |
| stormsurf_ny_shortcast | ok | — | 200 | 5 | 5 | — |
| nj_beach_cams_reports | **skipped_disabled** | — | — | 0 | 0 | — |
| surfers_view_nj | **skipped_disabled** | — | — | 0 | 0 | — |

```
run row: source_count=17  ok_count=17  failed_count=0  issue_count=512  healthy=True
issue rows written : 512
distinct identities: 512      <- no collisions
distinct revisions : 512
raised             : None     <- was RuntimeError on every prior run
```

## The five sources round 4 found still failing

All five failed with `missing_publication_marker` because their parsers were written against
invented fixtures. Each was resolved against the document the source actually serves.

### `socal` — parseable; it was the grammar that was wrong

`wavecast.com/socal/` is a hand-written narrative, not an index, but it **does** state a
publication instant: `Thursday 8/6/26 6:45 AM`, in a `<Weekday> M/D/YY h:mm AM` form that
neither the regional nor the chart grammar uses. The weekday prefix is load-bearing — it is
what separates the marker from an unrelated `2/5/26 6:00 AM` string sitting in an HTML comment
on the same page — and the stated weekday is what pins the two-digit year.

The page also links the configured chart slugs, but **5 of 8 hrefs carry no trailing slash**
(`.../socal-charts/trestles`, `oldmans`, `oceanside`, `beacons`, `huntington-beach`). The old
pattern required one, so it found 3 of 8 while still parsing — a silent 62% loss.

Freshness was raised from the inherited 36 h to 96 h: the page states its own cadence,
`Updated most Sundays, Tuesdays, and Thursdays`, so a 36 h bound rejects a healthy page on
most runs.

### Four sources disabled — measured, not assumed

| source | live document | why no grammar exists |
|---|---|---|
| `stormsurf_pnw_links` | `stormsurf.com/page2/links/orsrprt.shtml` | Static buoy-links directory. The only date anywhere is a site-wide banner (`…El Nino…Video HERE (8/2/26)`). No forecast content of its own. |
| `stormsurf_pnw_buoy` | `stormsurf.com/4cast/mht/pacnw.html` | Buoy-station index: station numbers and names linking elsewhere. Same banner date. No forecast content. |
| `nj_beach_cams_reports` | `njbeachcams.com/nj-surf-reports/` | WordPress shell around `thesurfersview.com/cams/forecast.php` iframes. Contains exactly **one** `/nj-surf-reports/` link — its own canonical self-link — so there are no per-spot reports. Its only stated instant is `article:modified_time 2026-03-21`, the page's edit date, 4.5 months stale and unrelated to the iframed content. |
| `surfers_view_nj` | `thesurfersview.com/surf-forecast/new-jersey/` | The same iframe shell one hop upstream. Only stated instant `article:modified_time 2022-11-02`. Its own body text describes the underlying figure as *significant wave height*, which D-07/D-08 make non-face evidence. |

`_STORMSURF_MARKER` and `_NJ_MARKER` matched **zero bytes** of any of the four. Both regexes,
the three report-href patterns, `_ListItemParser`, `_linked_report_slugs` and the four parser
functions were **deleted** rather than left in place — a grammar that cannot match any live
document is the invented-fixture defect, not dormant capability. The four keys stay in the
17-source inventory and dispatch to `parse_disabled_source`, which raises
`UNCONFIGURED_TARGET` with the per-source reason, so re-enabling one fails loudly instead of
silently fabricating an issue.

## D2 (P0) — the horizon fix, and the collision it exposed

`parse_wavecast_spot_chart` still enforced `abs(...) > 10` while `parse_wavecast_regional` had
been widened. The live chart runs 8/6/2026 → 8/21/2026, **+15 days** from its `8-6-2026`
marker, so all 8 charts failed with `valid_date_out_of_horizon`. Propagated the `-3 .. +18`
bound.

Fixing that surfaced a second P0 of the same class as round 1's and round 3's:

```
256 chart issues  ->  32 distinct issue_identity_key values
one key -> malibu 2.0-3.0, rincon 3.0-4.0, trestles 1.0-2.0, oldmans 1.0-2.0,
           beacons 3.0-4.0, ventura 2.0-3.0, huntington-beach 1.0-2.0, oceanside 3.0-4.0
```

All eight charts share one `SourceConfig`, so `region_key` was the constant `"socal"` and eight
spots minted one identity carrying eight different ranges — **seven fabricated D-18 corrections
per identity, every six hours.** `dispatch()`'s duplicate guard never saw it because the cron
calls the chart parser directly per chart. Fixed by making the spot slug the `region_key`
(required keyword `spot_slug`, unconfigured slug rejects), and by running the guard over the
whole socal fan-out in the cron. After the fix: 512 live issues, 512 distinct identities.

## D3 (P1) — corpus honesty

`corpus.json` had 54 documents: 33 capture-based, 21 inline, **only 2 with a `note`**. The
other 19 were the original invented fixtures, unmarked, belonging to exactly the five sources
never re-captured. All 19 were **deleted**. Twelve capture-based `socal` documents replaced
them, from three new verbatim captures (`wavecast_socal_20260806.html` and the trestles /
malibu charts).

Redaction fidelity was measured, not asserted: parsing the stored capture and the live document
yields **identical `issue_identity_key` and `revision_hash` sequences** for all three captures
(8/8, 32/32, 32/32). The byte deltas are 10–20 bytes of GA/AdSense ID masking.

Two ratchets now enforce provenance:
- `test_every_corpus_document_is_a_capture_or_a_documented_derivation` — pins the inline set to
  exactly the two DST-boundary documents, requires every other document to name a capture that
  is registered in `capture_source_urls`, and requires any inline document to carry a `note`.
- `test_socal_negative_fixtures_cover_the_live_marker_grammar` — pins the seven reject codes the
  live socal grammar must be able to produce.

## D4 (P2) — the shortcast horizon guard

`parse_stormsurf_ny_shortcast` had **no horizon check at all**, so the 336 h freshness
justification's fallback ("per-row weekday-validated dates are the real staleness guard") was
false: weekday validation only pins the year and accepts any date shifted by a multiple of 7.
Added a `-1 .. +10` day bound, pinned by a fixture that shifts one row date by exactly two
weeks so it still matches its stated weekday and only the horizon guard can reject it.

## Gates

```
~/.venvs/seaside/bin/python -m pytest tests/ -q
858 passed, 2 skipped
```
Baseline was 853 passed, 2 skipped.

### Mutation checks — 10 of 10 RED, tree restored byte-identical

| # | Mutation | Result |
|---|---|---|
| M1 | socal marker back to dashed separators (the pre-fix grammar) | RED 12 |
| M2 | drop the socal weekday-vs-date validation | RED 1 |
| M3 | require the trailing slash on chart links again | RED 1 |
| M4 | restore the ±10-day spot-chart horizon | RED 7 |
| M5 | chart `region_key` back to `source.region_key` (identity collision) | RED 1 |
| M6 | delete the shortcast horizon guard | RED 2 |
| M7 | re-enable `stormsurf_pnw_links` | RED 4 |
| M8 | socal freshness back to the inherited 36 h | RED 4 |
| M9 | delete the socal fan-out duplicate-identity guard | RED 1 |
| M10 | smuggle an unmarked invented inline fixture into the corpus | RED 1 |

Tree digest before the first mutation and after the last: `c2b238a66c02` — identical.

**M8 escaped the first audit.** Reverting socal's 96 h override left the entire suite green,
because the accept fixture was 15 minutes old and the stale fixture 144 hours old — neither
could see the boundary. The same trap round 3 recorded as *"live data agreeing everywhere can
hide a real branch."* Closed with an accept fixture at a measured 72.25 h, inside 96 and outside
36; M8 then went RED.

## Deviations from plan

Two, both forced by what the live documents actually contain:

1. **Four sources ship disabled.** The plan's D-01 inventory of 17 is intact and asserted, but
   only 13 are enabled. This is the honest reading of D-02/D-03: those four documents state no
   publication time, so there is nothing to parse. `SKIPPED_DISABLED` is already a non-failing
   status, so D-04 no longer fails on them.
2. **The chart identity fix was not in scope** but was created by the in-scope horizon fix, and
   would have written fabricated D-18 revisions on the first production run.

## Filed, not fixed

- **The socal 8-chart fan-out is still unisolated.** One chart failing discards all socal issues
  including the parsed index. All 8 parse today. This is the same class as round 3's per-segment
  NWS fix and should follow it.
- `crons/fetch_rip_current_risk.py`'s `UGC_RE` matches zero zone blocks on the live HFO product
  (task `task_50ac23bf`), so Hawaii rip-current rows are likely absent in production today.
  Out of scope; recorded beside the new `_SRF_UGC_LINE`.
- `parse_stormsurf_pnw_buoy` hashing the whole document is moot — the source is disabled.

## Next phase readiness

- **21-02 must still carry the four columns** named in GOAL.md: `day_part`, `validity_basis` on
  `trusted_forecast_issues`; `degraded_failure_code`, `degraded_item_count` on
  `trusted_forecast_ingest_source_results`. All four are emitted by `_serialize_issue` /
  `_serialize_source_result` today.
- **21-03 may now be verified against a real corpus.** Round 3's caveat is lifted: the live run
  produces 512 issues across 13 sources with zero identity collisions and zero fabricated
  measurements. Note that `surf_institute_pnw` contributes evidence with **no height** by design
  (its `waveHeightRange` is metres Hs), and `socal`'s 8 index rows likewise carry no height —
  only its 256 chart rows are authority-eligible.
- **21-05's verifier must treat `skipped_disabled` as non-failing** and must still exit nonzero
  on `degraded_item_count > 0`. Today's run carries exactly one degraded item
  (`new_york` / `missing_surf_range`, a day the source states no height for), so that threshold
  needs a product call before it can gate.

---
*Phase: 21-multi-forecaster-forecast-adjustment-and-production-ingestio*
*Completed: 2026-08-06*
