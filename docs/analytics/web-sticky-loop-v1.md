# Web sticky loops v1

`web_sticky_loop.v1` measures observed web navigation across the last 28 **complete** local days by default, in `America/Los_Angeles`. `--as-of` anchors the default window; `--start` and `--end` are local calendar dates with an exclusive end. A report is mature once its end midnight is no later than `asOf`. No later return observation or attribution lookahead is used.

## Units and sources

- The person unit is PostHog `person_id`, segmented as **identified** if any eligible window event has `$is_identified = true`, otherwise **anonymous**. Anonymous identity depends on a cookie, so repeat usage is a lower bound across cleared cookies and devices.
- The session join key is `(person_id, properties.$session_id)`. Events without a session ID contribute to person, view, and active-day counts but not session sequences, transitions, downstream rates, or loop prefixes.
- Page families come from `events` with `event = 'page_view'`, the PostHog mirror of `/api/events`. The SDK's `$pageview` is excluded to avoid double counting. `properties.surface` is retained. Signed-in `landing-page` views are **home** because `/` serves the Home experience after authentication; anonymous `landing-page` views remain **landing**.
- `events.event = 'nearby_beaches_viewed'` supplies the **nearby** family. `app_handoff_view` and `signup_cta_view` supply downstream intent targets only. All use the same `person_id` and `$session_id` keys. Utility is also split by raw surface: `water-temp`, `tide`, and `tools-page`.
- Every event must have `$lib = 'web'`, `environment = 'production'`, and `$host` in `www.quiversurf.app`, `quiversurf.app`, or `go.quiversurf.app`, and fall in `[window.start, window.end)`. `sourceFreshness` is the newest eligible timestamp per event.

Within each segment and family, **people** are distinct persons, **views** are eligible family events, **sessions** are distinct joined sessions, and **active days** are distinct local dates on that family. Repeat people have at least two such days; 4+ people have at least four. Each rate includes its numerator and denominator, with a null rate at zero denominator.

For each session touching family X, downstream means a different family or intent event whose timestamp is strictly later than X's **first** event in that session. The denominator is sessions touching X. Consecutive duplicate families are collapsed for transitions. The product loop is the ordered subsequence `home → map → beach_detail → forecast → nearby`; each prefix counts qualifying sessions out of all segment sessions. Return loops start with persons who saw X on their **first observed local day** and count their first family event on any later day, with the top five destinations.

Identified persons with at least `--power-days` distinct local days of `page_view` (default 4) are removed from the identified aggregate and listed individually by the first 10 hexadecimal characters of `sha256(person_id)`. Anonymous persons at the same threshold contribute only to `anonymousHeavy.people`; they stay in anonymous metrics. Power-user views by family include nearby events.

## Exclusions and limits

Bot events are filtered at `/api/events` ingest for the mirror and again by `HOGQL_NOT_BOT`. Emulators are filtered by `HOGQL_NOT_EMULATOR`. Internal persons are removed through `hogqlInternalPersonExclusion()` (cohort and known IDs). Because every data query applies those predicates, excluded population counts cannot be derived from eligible rows; the `excluded` block records each reason with `count: null` rather than silently implying zero. The readout does not capture SDK `$pageview`, off-site or native behavior, events blocked by consent or tracking settings, tab dwell, conversion completion, or activity outside the window. It makes no cross-device identity repair or causal claim about downstream navigation.

UUID-shaped `events.distinct_id` values on identified events are joined exactly to Supabase `profiles.id` through the guarded read-only profile lookup. The current profile snapshot excludes internal, deleted, mock, system, and explicitly non-real profiles before segmentation. If any looked-up ID belongs to an excluded profile, all rows for its PostHog person are removed, including anonymous rows and power-user activity. `excluded.profile.persons` counts removed persons; `byReason` counts distinct persons per reason and can overlap when a person has multiple excluded IDs. A missing profile is retained and counted once per surviving person in `identifiedWithoutProfile`, including retained power users. Profile flags reflect the lookup time, not a historical snapshot at `asOf`.

## Run

```bash
source ~/.nvm/nvm.sh && nvm use 22
node --import tsx scripts/web-sticky-loop-report.ts --days 28 --tz America/Los_Angeles --output-json /tmp/web-sticky-loop.json --output-md /tmp/web-sticky-loop.md
```

For a fixed window, use `--start YYYY-MM-DD --end YYYY-MM-DD` instead of `--days`. The runner uses read-only `runHogQL()` queries and `createReadOnlySupabaseFromEnv()` profile reads and never writes to production. Without `--output-json`, it prints the JSON report to stdout.
