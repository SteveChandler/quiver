# Journal Components Architecture

## Purpose

User journal visualization and export. Shows calendar heatmap, analytics, and export options.

## Components

- `journal-view.tsx` — main container orchestrating analytics + list/calendar
- `calendar-heatmap.tsx` — per-day session density and quick stats
- `session-analytics.tsx` — summary cards and trends

## Data Flow

- Reads session analytics and calendar data from `lib/analytics/session-analytics.ts`
  through `app/api/analytics/sessions`
- Reads session lists from `actions/session-actions.ts`
- Privacy toggles route via `app/api/analytics/sessions` PATCH

## UX & State

- Toggle between list and calendar views, scoped filters (beach/board/date range)
- Export modal builds payload then triggers download

## Testing

- Component tests for calendar navigation, export selection, analytics rendering
- E2E happy path: navigate to journal, toggle views, export

## Related Docs

- `actions/ARCHITECTURE.md`
- `docs/ARCHITECTURE.md`
