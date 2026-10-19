# PostHog Pageview Taxonomy

**Status:** production contract
**Last verified:** 2026-10-06

Quiver web sends two pageview events to PostHog. Each has its own job, and no
insight, view or dashboard should sum them.

| Event | Emitted by | Use it for |
| --- | --- | --- |
| `page_view` | `components/page-tracker.tsx` (also written to Supabase `user_events`) | Quiver's own traffic and path reporting: the `Quiver Web Traffic - Prod Only` dashboard, the `quiver_prod_*` warehouse views, the SEO agent-workflow export. Carries `page`, `surface`, `source_group`, `previous_pathname` and `browser_session_id`. |
| `$pageview` / `$pageleave` | posthog-js (`capture_pageview: "history_change"`, `capture_pageleave: true` in `lib/posthog-client.ts`) | PostHog's built-in Web Analytics, Paths, session `$entry_pathname` / `$is_bounce` / `$pageview_count`, and Marketing and Customer analytics. Filter by `$pathname`; these events do not carry Quiver's `page` or `surface` properties. |

`public_page_view` is a specialized public-surface signal. It can be used for
surface-specific public acquisition analysis, but it should not replace
`page_view` in the production web traffic dashboard.

## History

- Until 2026-05-22, a second `posthog.init` in `instrumentation-client.ts`
  sent `$pageview` and autocapture alongside `page_view`. Commit `d1480bc11`
  removed that init and set `capture_pageview: false`.
- From 2026-05-22 until this contract change shipped, the main web app sent no
  `$pageview`. During that window, PostHog's built-in web analytics only show the
  separately bundled `/surf-game` page.
- The SDK pageview fires once per full page load, guarded by posthog-js
  `_initialPageviewCaptured`, and again on each History API pathname change. It
  fires only after `lib/posthog-client.ts` allows tracking. Opting out and back in
  during consent revalidation does not repeat the initial pageview.
- Autocapture stays off.

Live 30-day PostHog coverage on 2026-10-06, before `$pageview` was re-enabled:

| Event | Events | Distinct IDs | Rows With Path | Prod Host Rows |
| --- | ---: | ---: | ---: | ---: |
| `page_view` | 12,874 | 9,292 | 12,874 | 12,712 |
| `public_page_view` | 1,048 | 491 | 1,048 | 1,046 |
| `$pageview` | 18 | 12 | 18 | 17 (all `/surf-game`) |

Verification query:

```sql
SELECT
  event,
  min(timestamp) AS first_event,
  max(timestamp) AS last_event,
  count() AS events,
  count(DISTINCT distinct_id) AS distinct_ids,
  countIf(coalesce(properties.pathname, properties['$pathname'], '') != '') AS rows_with_path,
  countIf(properties['$host'] = 'www.quiversurf.app') AS prod_host_rows
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
  AND properties['$app_namespace'] IS NULL
  AND coalesce(properties['$is_emulator'], false) = false
  AND event IN ('page_view', '$pageview', 'public_page_view')
GROUP BY event
ORDER BY events DESC
LIMIT 20
```
