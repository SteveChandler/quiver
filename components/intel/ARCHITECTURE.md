# Intel Components Architecture

## Purpose

Community intel (conditions, hazards, parking, etc.). Provides a feed, map, filters, modal details, and post creation.

## Components

- `intel-dashboard.tsx` — orchestrates map + feed views
- `intel-filters.tsx` — tag + radius filter controls
- `intel-post-form.tsx` — create new intel

## Data Flow

- Server actions in `actions/intel-actions.ts`:
  - `getNearbyIntelPosts`, `getPublicIntelPosts`, `createIntelPost`, `confirmIntelPost`, `removeIntelPost`
- Auth required for create/confirm; public read path available
- Revalidate `/` on create/confirm to keep feed fresh

## Interactions

- Plan Session CTA passes location context to session planner (when available)
- Confirm toggles are guarded: cannot confirm own posts; prevent duplicates

## Performance Notes

- Limit results and defer heavy map operations until visible
- Prefer batch queries (RPCs) for geospatial

## Testing

- Component tests with mocked actions
- E2E coverage: create intel, confirm/unconfirm, plan-session from intel

## Related Docs

- `actions/ARCHITECTURE.md`
- `docs/ARCHITECTURE.md`
