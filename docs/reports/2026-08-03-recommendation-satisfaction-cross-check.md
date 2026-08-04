# Recommendation Satisfaction Cross-Check

Generated: 2026-08-03

Status: **measurement gap confirmed; directional evidence only**

This is an internal product-improvement analysis. It is not evidence for a public satisfaction claim.

## Executive summary

Quiver cannot currently measure whether users who followed a recommendation were satisfied. The production attribution tables contain zero recommendation impressions and zero recommendation-attributed sessions. The live recommendation UI emits a PostHog `surf_window_impression`, but it does not write the durable impression row needed to join a recommendation to a later saved session.

The best available directional reads for 2026-07-09 through 2026-08-03 are:

- **Official attributed satisfaction:** not measurable (0 eligible sessions).
- **Spot-overlap proxy:** 11 of 18 rated sessions at six spots that appeared in recommendations were rated 4–5 stars, or **61.1%**. These sessions are not proven to have followed a recommendation. The 95% Wilson interval is 38.6%–79.7%.
- **All real rated sessions in the window:** 15 of 33 were rated 4–5 stars, or **45.5%**, across 16 beaches.

The marketing opportunity is a deliberately small, high-confidence proof cohort. Quiver should close the attribution loop, recommend only when confidence is high, and publish an exact-denominator claim only if every eligible rated session is satisfied.

## Marketing claim decision

Do not use the current 61.1% spot proxy in marketing. It is not deterministic recommendation attribution.

Run a prospective **Quiver Recommended Session Challenge** instead:

1. Enroll a fixed cohort before recommendations are issued.
2. Send only high-confidence, time-specific recommendations with a deterministic `recommendation_id`.
3. Count every participant who goes, not only positive responders.
4. Collect a required 1–5 post-session rating; define satisfied as 4–5 before the test starts.
5. Freeze the result when the predeclared cohort ends. Do not remove misses.

If the result is perfect, the claim can be precise:

> **100% satisfied after following Quiver.**
>
> *Among participants who followed a Quiver recommendation and submitted a rating: X of X rated the session 4–5 stars. [Dates and locations].*

The denominator, dates, locations, and rating definition should sit beside the claim or one click away.

## What the current data can and cannot say

| Evidence level | Eligible sessions | Satisfied (rating 4–5) | Rate | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Official `recommendation_id` attribution | 0 | 0 | Not measurable | Correct KPI, but the instrumentation path has no production rows |
| Rated sessions at any spot exposed in the period | 18 | 11 | 61.1% | Background satisfaction at exposed spots, not recommendation follow-through |
| All real rated sessions | 33 | 15 | 45.5% | Baseline session satisfaction, regardless of recommendation exposure |

PostHog recorded 242 `surf_window_impression` events from 43 people. Ninety-seven impressions carried an authenticated user ID, representing six identified users. All recommendation fields required for the directional analysis were present, but only 179 person-window-surface combinations were unique, so raw event counts include repeat renders.

The durable Supabase layer recorded:

- 0 rows in `recommendation_impressions`
- 0 rows in `recommendation_session_contexts`
- 0 sessions with a non-null `recommendation_id`
- 0 rows in `recommendation_feedback_summary`

This is a missing measurement path, not evidence of zero satisfaction.

## All-beach comparison

Fifteen of the 16 rated beaches have a matching row in the completed Quiver-versus-Surfline retrospective. Rockview has user-rating data but no benchmark row.

| Spot | Rated sessions | Satisfied | Recommendation impressions | Guarded Quiver MAE | Surfline midpoint MAE | Lower height MAE |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Del Mar | 9 | 66.7% | 8 | 0.80 ft | 0.83 ft | Quiver |
| Ala Moana Bowls | 3 | 100.0% | 3 | 0.47 ft | 0.17 ft | Surfline |
| C Street / Ventura Point | 3 | 33.3% | 0 | 0.95 ft | 0.83 ft | Surfline |
| Capitola Beach | 2 | 0.0% | 0 | 1.00 ft | 1.50 ft | Quiver |
| HB Cliffs | 2 | 50.0% | 0 | 0.77 ft | 1.17 ft | Quiver |
| Laniakea | 2 | 50.0% | 0 | 0.47 ft | 0.50 ft | Quiver |
| Ocean Beach Pier | 2 | 0.0% | 7 | 0.13 ft | 1.00 ft | Quiver |
| Pleasure Point | 2 | 50.0% | 1 | 2.91 ft | 2.50 ft | Surfline |
| Huntington Beach Pier Northside | 1 | 0.0% | 0 | 1.46 ft | 2.50 ft | Quiver |
| Malibu First Point | 1 | 100.0% | 27 | 0.30 ft | 0.50 ft | Quiver |
| Pipes | 1 | 0.0% | 0 | 0.28 ft | 1.50 ft | Quiver |
| Ponto | 1 | 0.0% | 1 | 0.12 ft | 2.00 ft | Quiver |
| Rockview | 1 | 0.0% | 0 | — | — | Not benchmarked |
| Seal Beach Pier | 1 | 0.0% | 0 | 0.52 ft | 0.50 ft | Surfline |
| Seaside Reef | 1 | 0.0% | 0 | 2.18 ft | 2.50 ft | Quiver |
| Terramar Point | 1 | 100.0% | 0 | 1.30 ft | 0.50 ft | Surfline |

The complete comparison reinforces the earlier finding: lower wave-height MAE does not translate directly into higher session satisfaction. At the ten beaches where guarded Quiver has lower height MAE, 9 of 22 sessions were satisfied (**40.9%**). At the five beaches where Surfline has lower height MAE, 6 of 10 were satisfied (**60.0%**). These tiny, spot-level samples do not establish that Surfline recommendations are better; they show that height accuracy alone is not the product outcome.

For a scrappy proof campaign, **Ala Moana Bowls is the strongest current seed** because it is the only beach with more than one session and a perfect satisfaction record (3/3). Malibu and Terramar are also perfect, but only at 1/1. Del Mar has the most evidence and is not perfect at 6/9.

## KPI to operate

### Primary: satisfied recommendation session rate

```text
distinct saved sessions with:
  a valid recommendation_id,
  a matching impression for the same user and recommendation,
  and rating >= 4
divided by
distinct saved sessions with:
  a valid recommendation_id,
  a matching impression for the same user and recommendation,
  and a non-null rating
```

Report the numerator and denominator beside the rate. Deduplicate on `session_id`. Exclude mock/system users and deleted sessions. Break down by recommendation surface, rank, score band, horizon, spot, and forecast source.

### Guardrails

- **Bad recommendation rate:** rating <= 2 or `recommendation_call_accuracy = 'wrong'`.
- **Call-right rate:** `right` divided by `right + partly + wrong`; report `not_sure` separately.
- **Attribution coverage:** attributed rated sessions divided by sessions launched from recommendation surfaces.
- **Recommendation coverage:** high-confidence recommendations shown divided by eligible user-days. This prevents a perfect satisfaction rate created by recommending almost nothing.

For the marketing proof, a small perfect cohort is acceptable when the exact denominator is prominent. Start with a predeclared 10-session pilot. If it finishes 10/10, the claim is “10 of 10,” not a generalized claim that all Quiver users will be satisfied. If it misses, do not publish 100%; review the failure, improve the call, and run a new prospectively defined cohort rather than silently resetting the count.

For the internal long-run product KPI, retain the broader rate and every miss. A practical first operating gate is at least 90% satisfied after 50 attributed rated sessions, with the 95% Wilson lower bound above 80%, while every rating <=2 or `wrong` call is reviewed.

## Fast implementation sequence

1. On `BestSurfWindows` visibility, keep the PostHog event and also batch POST the same deterministic recommendation payload to `/api/recommendation-impressions` for authenticated users.
2. Preserve `recommendation_id`, surface, forecast window, score, and rank in every CTA URL that can start a session log.
3. Verify the session form writes that ID to `sessions.recommendation_id` and `recommendation_session_contexts`; fail visibly in development if attribution is dropped.
4. Add one daily query or view for the KPI and a failure queue containing every <=2 rating or `wrong` call.
5. Launch the 10-session prospective marketing pilot. Initially recommend only high-confidence windows and use “no strong call” as a valid output.

The first trustworthy KPI can start collecting as soon as the instrumentation path is fixed. At the recent pace of 33 real rated sessions in 26 days, reaching 50 attributed ratings would likely take several weeks unless recommendation-followed sessions or feedback volume increases.

## Data quality and caveats

- The analysis window begins on 2026-07-09, when the durable recommendation feedback schema was introduced, and ends before 2026-08-04 UTC.
- The PostHog warehouse contains 33 saved real rated sessions across 16 beaches as of 2026-08-03 15:35 UTC. Raw `session_log_submit` events contain retries/duplicates and should not be the outcome denominator.
- Only 97 of 242 recommendation-window impressions carried an authenticated user ID.
- Ratings are subjective and may reflect conditions not captured by wave-height accuracy.
- The Quiver-versus-Surfline benchmark contains 36 weak surfer-reported height labels across 18 spots, almost entirely tiny spot samples.
- Rockview is the only rated beach without a matching forecast benchmark row.

## Reproducibility

- Executed analysis notebook: `docs/reports/notebooks/2026-08-03-recommendation-satisfaction-cross-check.ipynb`
- Notebook generator and frozen reviewed data: `docs/reports/notebooks/build_2026_08_03_recommendation_satisfaction_notebook.py`
- Forecast comparison source: `docs/reports/2026-08-03-quiver-surfline-backward-benchmark.md`
- Product sources: PostHog `events`; warehouse `quiversupabase_sessions`, `quiversupabase_profiles`; Supabase `recommendation_impressions`, `recommendation_session_contexts`, `sessions`, and `recommendation_feedback_summary`.
