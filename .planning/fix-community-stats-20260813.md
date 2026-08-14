# Community stats synthetic-account fix

## Change

- `profiles` counts now use `is_mock.is.null,is_mock.eq.false`, so NULL is treated as real.
- `sessions` counts use an inner `profiles` embed and the same null-safe filter.
- `intel_posts` counts use an inner `profiles` embed and the same null-safe filter.
- `totalBeaches` was left unchanged because it counts beach records, not user activity.
- The misleading “excluding bot/test sessions” comment now describes the implemented real-member filter.

## FK verification

The sessions query uses `profiles!sessions_user_id_profiles_fkey!inner(is_mock)` with
`referencedTable: "profiles"` on the `.or(...)` filter. I verified this against:

- `supabase/migrations/20260215011619_remove_sessions_profile_id.sql`, which adds
  `sessions_user_id_profiles_fkey` to `sessions.user_id → profiles.id`.
- `types/database.generated.ts`, whose current `sessions` relationships list only
  `sessions_user_id_profiles_fkey`.
- Existing current routes, including `app/api/recent-posts/route.ts` and
  `app/api/sessions/public/route.ts`, which use the same relationship name.
- `yarn typecheck`, plus the focused endpoint test assertion for the exact embedded select.

`sessions_user_id_fkey` is the legacy name still referenced by older action code; it is not
the current generated relationship used here. The intel-post query uses its generated
`intel_posts_user_id_fkey` relationship.

## Counts

The focused test fixture contains 3 users, 3 sessions, and 3 reports before filtering; each
becomes 2 after excluding one `is_mock = true` row while retaining one `is_mock = NULL` row.
The beach count remains 7 in the fixture.

Production figures supplied with the defect report identify 36 synthetic profiles and 1,986
synthetic intel posts in the last 30 days. The endpoint reports only posts created today, and
no production synthetic-session total was supplied, so exact production before/after endpoint
values cannot be derived from those figures alone.

## Response shape

The success and fallback response shapes are unchanged. The success response still contains
exactly `totalBeaches`, `totalSessions`, `totalUsers`, and `reportsToday`; the focused test
asserts those keys and filtered values.
