# PostHog Pageview Taxonomy

**Status:** production contract
**Last verified:** 2026-07-06

Quiver web uses the custom `page_view` event as the canonical PostHog traffic
and path event. Do not build production web traffic dashboards on `$pageview`:
`lib/posthog-client.ts` disables PostHog pageview autocapture, and
`components/page-tracker.tsx` emits `page_view` with dashboard-ready path and
session properties.

`public_page_view` is a specialized public-surface signal. It can be used for
surface-specific public acquisition analysis, but it should not replace
`page_view` in the production web traffic dashboard.

The PostHog dashboard `Quiver Web Traffic - Prod Only` was updated on
2026-07-06 to use `page_view` for traffic and paths. Live 30-day PostHog
coverage at that time:

| Event | Events | Distinct IDs | Rows With Path | Prod Host Rows |
| --- | ---: | ---: | ---: | ---: |
| `page_view` | 4,924 | 2,959 | 4,924 | 4,555 |
| `public_page_view` | 1,582 | 1,219 | 1,582 | 1,554 |

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
