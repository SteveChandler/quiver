# Feed system cards and empty-state conversion

## Detection signal

The UI uses the author profile's `is_system_account === true` flag. The check is
isolated in `isSystemAuthoredPost()` so the sibling canonical system-identity
module can replace or feed that boundary later. It checks the current `user`
profile shape and the legacy `profiles` shape, and never infers authorship from
a display name.

The current intel query enrichers select only `id`, `full_name`, and
`avatar_url`, so they do not yet carry `is_system_account` into this component.
The profile flag must be included by the identity/data-layer worker for live
automated posts to take this branch; no UI fallback based on names was added.

## Card treatment

System-authored posts use a warm amber card surface, a bot mark instead of
`UserAvatarButton`, and the visible label `Quiver system`. The disclosure reads:

> Automated report generated from forecast and beach data—not a live surfer report.

Regular posts keep their existing clickable personal avatar and card treatment.

## Empty-state design

The empty state now leads with the beach and the current moment:

> What are conditions at {beachName} right now?

It names the lowest-effort useful inputs—wave size, wind, crowd, or hazards—and
explicitly says that no photo or polished write-up is needed. `Report current
conditions` opens the existing `IntelPostForm` with the beach coordinates
already supplied; the form itself was not rebuilt.

## Product and copy calls

- “Report current conditions” is more concrete than “Add First Intel” and makes
  the action useful even when a reader is not ready to write a full report.
- The copy avoids social-proof claims and does not imply that other surfers
  have posted.
- The system disclosure deliberately distinguishes data-generated context from
  a first-person surf report so the feed does not present automation as a
  person.

## Validation

- `npx eslint --max-warnings=0 components/intel/beach-intel-section.tsx __tests__/components/intel/beach-intel-section.test.tsx` — passed.
- Focused Jest suite — 23 tests passed.
- Requested gate (`yarn typecheck && yarn lint && npx jest --ci`) — passed: 1,280 suites passed, 16 skipped, 1 todo. Existing console warnings and a forced worker teardown were reported by the repository-wide suite.
