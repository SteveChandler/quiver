# AEO Citation Audit Runbook

The scheduled AEO routine refuses to run without this file. It is the contract for
how the citation rate is produced, so the number stays comparable week over week.

## Why this file exists

The 2026-07-27 run reported 26.7% all-query citation. The 2026-08-17 run reported
83.3%. Nothing in the product changed by a factor of three in three weeks. The
jump is a method change, not a result, and there was no pinned method to diff it
against. Everything below exists to make that failure visible instead of silent.

## Inputs

| Input | Path | Rule |
| --- | --- | --- |
| Query set | `docs/seo/aeo-query-set.json` | Must contain exactly 30 queries: 20 `informational`, 10 `product-brand`. Append only; never replace or reword an existing query. |
| Prior baselines | `docs/seo/reports/aeo-citation-tracking/*.md` | Read the most recent one before running. It is the comparison point, except across the 2026-10-14 series break (see Method changes). |
| Brand match | `brandDomains` in the query set | A citation counts only for these domains. |
| Measurement script | `/Users/stevenchandler/Desktop/dev/.quiver/ops/aeo_google.py` | Lives in the workspace control plane, not this repo. Its `--out` JSON is the per-query receipt set. |

If the query set is missing, unparseable, or does not contain exactly 30 queries
in the 20/10 split, stop and report the blocker. Do not run a partial set and
report a rate: a rate over a different denominator is not comparable and is worse
than no number.

## Method (pinned)

Series: **DataForSEO Google organic + AI Overview**, from 2026-10-14. The earlier
series (Claude Code `WebSearch`) is not comparable; see Method changes.

1. Run `python3 /Users/stevenchandler/Desktop/dev/.quiver/ops/aeo_google.py --out <receipts dir>/google-serp.json`.
   For each of the 30 queries it makes one DataForSEO
   `serp/google/organic/live/advanced` call with the query text verbatim: US
   (`location_code` 2840), `language_code` `en`, `device` `desktop`, `depth` 10,
   `load_async_ai_overview` `true`. No rewording, no added qualifiers, no site:
   operators.
2. **Organic citation:** a result whose host is a `brandDomains` domain or a
   subdomain of one, at organic position 1 to 10 (first page). `apps.apple.com`
   does not count.
3. **AI Overview citation:** Google showed an AI Overview for the query and any
   of its references or links points at a `brandDomains` host. No AI Overview,
   or one that cites nothing of ours, is not a citation. The two counts are
   independent: a query can have either, both, or neither.
4. One call per query per run. Do not retry. A query whose call errored has no
   receipt and is unknown, never absent: the run is partial and no rate is
   published.
5. Record the organic count per segment and overall, and the AI Overview count
   overall.
6. If the script reports `BLOCKED` (DataForSEO balance, auth or account), stop
   and report that. Do not substitute another search tool.

A run costs about $0.12 on the licensed DataForSEO account (live $0.002 per SERP
plus $0.002 for `load_async_ai_overview`), approved by Steven on 2026-10-11.

**What this measures.** Whether `quiversurf.app` is on the first page of Google,
and whether Google's AI Overview cites it, for a US, English, desktop SERP fetched
once per query. AI Overviews vary by fetch, device and location, so one fetch is a
sample. It does **not** measure ChatGPT, Perplexity, Gemini, Claude or Google AI
Mode. Every report must say so.

### Method changes

If the search provider, the counting rule, or the result-depth changes, the run
must:

- state the change in a `## Method change` section, and
- report both the old-method and new-method rate for that run, or
- if the old method cannot be reproduced, mark the run `baseline-reset` and say
  the series is not comparable across that date.

A rate that moves more than 20 points from the previous run without a
`## Method change` section is a defect in the run, not a finding. Investigate
before publishing.

### Series history

- **Through 2026-09-30:** Claude Code `WebSearch`; the search `mode` was not
  recorded.
- **2026-10-07:** `WebSearch` in `standard` mode returned a different index. Host
  overlap with the prior week fell from 0.75 to 0.10, staging and scraped sites
  appeared on first pages, and Quiver went from 4/30 to 0/30 while every cited
  page was healthy and on page one in GSC. Four `extended` probes the same day
  returned the earlier kind of results and cited `quiversurf.app` on 3 of them.
  The run is void (`2026-10-07.md`).
- **2026-10-14, series break:** the audit moved to real Google results and Google
  AI Overview citations through DataForSEO. The `WebSearch` backend is not
  Google: DataForSEO's Google SERPs did not rank Quiver for `surfline alternative`
  in any October export, while the proxy cited `/vs/surfline` for that query on
  six consecutive runs.

**The series break.** The first report written on the DataForSEO method (scheduled
2026-10-14; if that run is blocked, the first run that completes) must:

- include a `## Method change` section that says this is a `baseline-reset` and
  that the series is not comparable across 2026-09-30 and 2026-10-07;
- carry no delta in `## Movement`;
- not cite an old `WebSearch` score next to a Google score as a trend, in any
  section, ever.

The DataForSEO method here (desktop, depth 10, AI Overview loaded) is not the same
call as the weekly rankings export (`seo:export:dataforseo`: mobile, depth 100).
Do not join the two.

## Voiding a run

A run whose method cannot be reproduced is **voided, not deleted** — the file is
the evidence for why the series moved.

To void a run, do either of these in its report:

- append ` (VOID)` to the H1, or
- add a `Status: void` line.

`discoverLatestAeoCitationReport` skips voided reports, so the weekly report
falls back to the newest reproducible baseline instead of folding an
unreproducible rate into the AEO section. Covered by
`__tests__/lib/seo/agent-workflow/aeo-export.test.ts`.

Always state in the voided file which run superseded it and why.

## Report format

Write `docs/seo/reports/aeo-citation-tracking/YYYY-MM-DD.md` with:

```markdown
# AEO Citation Tracking — YYYY-MM-DD

## Citation Baseline

| Segment | Cited | Total | Rate |
|---|---:|---:|---:|
| All queries | n | 30 | n% |
| Informational queries | n | 20 | n% |
| Product/brand queries | n | 10 | n% |
| AI Overview citations | n | 30 | n% |

The first three rows count organic first-page results (Google positions 1 to 10).
The AI Overview row counts queries whose Google AI Overview cites us; it is a
separate number and is not part of the other three.

## Movement

Previous run YYYY-MM-DD: all n%, informational n%, product/brand n%, AI Overview n%.
Delta: +/- n points. [Method unchanged | Method change, see below]

## Method change

<Series-break run only (see Method changes). Later runs omit this section.>

## Queries that surfaced

| Query | Segment | Position | Quiver URL |
| --- | --- | --- | --- |

<one row per query with an organic hit>

## Queries that did not surface

<list them by name>

## AI Overview citations

| Query | Quiver URL |
| --- | --- |

<one row per query whose AI Overview cites us, or "None.". State how many of the
30 queries showed an AI Overview at all.>

## Notes

<limits, method qualifier, anything unusual>

## Capture points

<GSC-sourced, ranked by impressions; see "Capture points" below>

## Action list

- [APPLY FIX] ...
- [WRITE CONTENT] ...
```

The H1, the three-row baseline table, the Movement section, the Capture points
section, and the Action list are required. From 2026-10-14 the `AI Overview
citations` row and its section are required too, and the validator checks that
the row's count equals the queries listed under it. Listing which queries
surfaced is what makes a rate auditable; a bare percentage is not reviewable.

Keep the per-query receipts beside the report: the `aeo_google.py` JSON (verbatim
query, engine, request time, first-page URLs, matching host and disposition per
query) and a `search-receipts.md` summary. A missing receipt is unknown, never
absence.

## Capture points

The 30 queries are a **tracking instrument**. They are pinned so the rate stays
comparable, which also means the set can only ever tell you how the same 30
queries did. It cannot find demand it does not ask about, and a run that reports
only the rate will keep concluding `[NO ACTION]` forever while real opportunity
sits outside the set.

Every run must therefore also produce **capture points**: places where Quiver
already has demand it is not converting. These come from Google Search Console,
never from the query set, and they are reported in their own section so nobody
attributes them to the citation proxy.

### Method

Read the newest `Brand-Vault/seo-audit/*/GSC-EXPORT.json` (28-day window). Rank
candidates by impressions and classify each into exactly one of:

| Kind | Test | Why it is a capture point |
| --- | --- | --- |
| **CTR gap** | position ≤ 10 and CTR < 1% | Already on page one. The ranking is won; the click is not. Cheapest possible fix. |
| **Entity mismatch** | the page's title names a different entity than the query | A measurable sub-case of the CTR gap, and the one with a proven benchmark on this site. |
| **Intent mismatch** | query intent and page type differ | The page ranks for a question it does not answer. |
| **Page-two demand** | position > 20 with meaningful impressions | Real demand, no ranking. The only kind that may justify new work. |

State impressions, clicks, CTR, and position for every capture point. A capture
point without those four numbers is an opinion.

### Rules

- **Do not infer a ranking problem from the citation proxy.** The proxy shows
  absence from a first page; it does not distinguish "ranks 11th" from "ranks
  41st" from "ranks 8th and nobody clicks." Check position in GSC before
  describing anything as a ranking problem. A page ranking 8th with 0% CTR is a
  CTR problem and the opposite of unfixable.
- **Separate the traffic prize from the audience value.** Water-temperature
  queries are the largest impression pool on the site and the lowest-value
  audience Quiver reaches (Plan 064: 0.14% signup rate). Report both numbers and
  let Steven decide; never rank capture points by impressions alone.
- **Prefer a benchmark already observed on this site** over a projection. Where
  one exists, name it and the sample behind it.

## Action list rules

Every run ends in an action list. Each line must trace to a capture point or to
a defect in the run itself. `[NO ACTION]` is for a segment that genuinely needs
no response, not a resting state for the whole report: a run whose action list
is entirely `[NO ACTION]` has almost certainly skipped the capture-points work
above. Each line is one of:

- `[APPLY FIX]` — a technical or on-page change, with the file or route named.
- `[WRITE CONTENT]` — a page or section that does not exist yet, with the target
  query named.
- `[NO ACTION]` — state why, when a segment moved but needs no response.

Do not emit an action for a query that has been in the not-surfaced list fewer
than two consecutive runs. One run of absence is noise.

Product/brand queries where competitors dominate are generally not fixable by
on-page work alone. Prefer `[NO ACTION]` with a note over inventing a content
task for a query the site cannot realistically win.

### Settled queries — do not emit an action, in any form

Some queries have a standing decision behind them. They stay in the query set so
the denominator holds at 30 and they still appear in the surfaced/not-surfaced
lists, because that is measurement. They must **not** appear in the action list,
including as `[NO ACTION]`, and the run must not restate the reasoning for them.
A settled query is closed, not re-argued every week.

| Query | Settled | Decision |
| --- | --- | --- |
| `how do machine learning surf forecasts work` | 2026-09-02, Steven | Closed. Do not raise, do not propose a page, do not re-explain why. |

To reopen one, Steven says so. Nothing found in a run reopens it — not a rate
move, not a competitor appearing, not a new article shipping.

## Boundaries

- Read-only. The routine does not publish, commit, push, or mutate production.
- No direct scraping of Google. The licensed DataForSEO SERP API (approved by
  Steven on 2026-10-11) is the only automated source of Google results.
- No paid backlink index calls.
- If the environment cannot reach the network, or DataForSEO is blocked (balance,
  auth, account), stop and report the blocker. Do not fall back to `WebSearch`,
  and do not report the previous run's numbers as if they were new.

## Related

- `docs/seo/SEO_AGENT_WORKFLOW.md` — how this baseline folds into the weekly report.
- `docs/seo/aeo-query-set.json` — the canonical 30 queries.
