# Journal Components Architecture

## Purpose

User journal visualization and export. Shows calendar heatmap, analytics, and export options.

## Components

- `journal-view.tsx` — main container orchestrating analytics + list/calendar
- `calendar-heatmap.tsx` — per-day session density and quick stats
- `export-modal.tsx` — export flows (PDF) with filters and batching
- `session-analytics.tsx` — summary cards and trends

## Data Flow

- Reads from actions:
  - `actions/analytics-actions.ts` (session analytics, calendar data)
  - `actions/session-actions.ts` (session lists)
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
