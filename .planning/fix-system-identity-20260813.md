# Canonical system identity

## Identifier

The canonical automated-poster profile is identified by its existing immutable
`profiles.id` UUID:

`3290f65d-b474-49e2-ac5e-27de2db3fc9e`

This is the Quiver Surf Forecast profile seeded by
`supabase/migrations/20260215035002_create_morning_bot_profiles.sql`. The
display name remains available for diagnostics only; it is not part of identity
resolution.

## Shared module

`lib/system-identity.ts` exports:

- `SYSTEM_IDENTITY`, containing the canonical profile UUID and diagnostic label.
- `resolveSystemIdentity`, which requires the stable UUID and
  `is_system_account = true`, verifies the returned UUID, and throws when the
  identity cannot be resolved.
- `isSystemAuthored`, a small predicate for profiles and posts so feed code can
  label system-authored content.

The resolver has no fallback to another profile. The morning forecast route
returns its existing 500 response before fetching forecasts or inserting posts
when resolution fails.

## Migration status and compatibility

No migration was added or applied. A stable identifier already exists on the
profile (`profiles.id`), so the requested identity-column migration is not
needed. The code works against the current schema and remains valid after any
future schema migration because it only relies on the existing profile UUID and
the existing `is_system_account` column. There is no pre/post-migration lookup
fallback because there is no pending schema dependency.
