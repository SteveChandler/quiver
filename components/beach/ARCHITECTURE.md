# Beach Components Architecture

## Purpose

Beach-related UI: summaries, lists, and review form. Provides CRUD + stats display for beach reviews and integrates with beach actions.

## Components

- `beach-review-form.tsx` — create/update user review for a beach
- `beach-review-summary.tsx` — aggregated stats and CTA to write a review
- `beach-reviews-list.tsx` — paginated list with edit/delete support

## Data Flow

- Reads/writes via actions:
  - `actions/beach-review-actions.ts` (CRUD + stats)
  - Optimized batch endpoints in `beach-review-actions-optimized.ts` for multi-beach pages
- Revalidation of `/beach/[id]` and `/map` after mutations

## UI Patterns

- Controlled inputs; ratings via icons; minimal a11y labels
- Toast feedback on success/error
- Props:
  - Summary: `{ beachId, onWriteReview?, refreshTrigger? }`
  - List: `{ beachId, onEditReview?, refreshTrigger? }`
  - Form: `{ beachId, beachName, existingReview?, onSuccess?, onCancel?, isInDialog? }`

## Testing

- Component tests: render states, rating selections, submit flows (success/error)
- Integration: mocks for actions and revalidation

## Related Docs

- `actions/ARCHITECTURE.md`
- `docs/ARCHITECTURE.md`
