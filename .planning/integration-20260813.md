# Integration pass — 2026-08-13

## Identity path

`SYSTEM_IDENTITY.profileId` in `lib/system-identity.ts` is the only identity used when either automated cron creates content. Both `/api/cron/system-cards` and `/api/cron/morning-forecast-bot` call `resolveSystemIdentity()`, which selects that immutable UUID and requires `is_system_account = true`. Neither cron uses a display name or `personality_type`; the system-cards route no longer has a fallback profile search. If resolution fails, both routes return an error before any post insert is attempted. The legacy morning route pause gate remains before Supabase client creation.

## Feed detection responsibilities

The feed uses two intentionally separate checks:

- `isSystemAuthored(post)` from `lib/system-identity.ts` answers who authored the post. It controls the amber system-card treatment, bot mark, “Quiver system” label, disclosure, and removal of the personal avatar. This applies to every system-authored post, including non-prompt cards.
- `getSystemCardMetadata(post.surf_conditions)` answers what kind of card it is. It continues to identify prompt cards for `cta_impression`, `cta_click`, and `promptSeen` tracking. A prompt is not required for system authorship styling.

The intel API still selects and passes through `is_system_account`, and community stats still exclude synthetic accounts; those merged changes were preserved.

## Beach intel merge

Merged the feed worker’s beach-specific empty state and system visual treatment with the build worker’s prompt tracking. The empty-state CTA opens the compose form in one tap. Added coverage for real-user avatar rendering, non-prompt system-card rendering, prompt tracking, and the empty-state compose path.

## Cron merge and validation

Kept the `isLegacyMorningForecastEnabled` pause behavior while replacing the morning route’s display-name lookup with canonical identity resolution. Added/updated tests for renamed display names, canonical UUID usage, personality-type independence, and refusal to post when identity resolution fails.

No migrations were applied, no commits were created, and `quiver-native/` was not touched. No reconciliation items remain known.
