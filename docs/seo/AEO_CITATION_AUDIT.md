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
| Prior baselines | `docs/seo/reports/aeo-citation-tracking/*.md` | Read the most recent one before running. It is the comparison point. |
| Brand match | `brandDomains` in the query set | A citation counts only for these domains. |

If the query set is missing, unparseable, or does not contain exactly 30 queries
in the 20/10 split, stop and report the blocker. Do not run a partial set and
report a rate: a rate over a different denominator is not comparable and is worse
than no number.

## Method (pinned)

1. For each of the 30 queries, run one live web search with the query text
   verbatim. No rewording, no added qualifiers, no site: operators.
2. Count a citation when a result whose host matches `brandDomains` appears in
   the returned results for that query. First page only.
3. One search per query per run. Do not retry a query that returned nothing in
   the hope of a better draw.
4. Record the count per segment and the overall count.

**This is a search-presence proxy.** It does not measure citations inside Google
AI Overviews, ChatGPT, Perplexity, or Gemini. Every report must say so. Do not
describe the output as an AI citation rate without that qualifier.

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

## Movement

Previous run YYYY-MM-DD: all n%, informational n%, product/brand n%.
Delta: +/- n points. [Method unchanged | Method change, see below]

## Queries that surfaced

<list them by name>

## Queries that did not surface

<list them by name>

## Notes

<limits, method qualifier, anything unusual>

## Action list

- [APPLY FIX] ...
- [WRITE CONTENT] ...
```

The H1, the three-row baseline table, the Movement section, and the Action list
are required. Listing which queries surfaced is what makes a rate auditable; a
bare percentage is not reviewable.

## Action list rules

Every run ends in an action list. Each line is one of:

- `[APPLY FIX]` — a technical or on-page change, with the file or route named.
- `[WRITE CONTENT]` — a page or section that does not exist yet, with the target
  query named.
- `[NO ACTION]` — state why, when a segment moved but needs no response.

Do not emit an action for a query that has been in the not-surfaced list fewer
than two consecutive runs. One run of absence is noise.

Product/brand queries where competitors dominate are generally not fixable by
on-page work alone. Prefer `[NO ACTION]` with a note over inventing a content
task for a query the site cannot realistically win.

## Boundaries

- Read-only. The routine does not publish, commit, push, or mutate production.
- No automated Google SERP scraping.
- No paid backlink index calls.
- If the environment cannot reach the network, stop and report the blocker.
  Do not fall back to reporting the previous run's numbers as if they were new.

## Related

- `docs/seo/SEO_AGENT_WORKFLOW.md` — how this baseline folds into the weekly report.
- `docs/seo/aeo-query-set.json` — the canonical 30 queries.
