# Notification Build Compatibility Runbook

## Contract

Surf-alert push presentation is selected per registered device from the
`user_devices.platform`, `app_version`, and `build_number` tuple.

| Platform | App version | Build | Presentation |
| --- | --- | --- | --- |
| iOS | `1.0.1` | `11` | `quiver-alert.wav` |
| Android | `1.0.1` | `12` | `quiver-alerts-v1` |

Every other tuple uses the legacy/default notification presentation. This
includes old, missing, malformed, future/unreviewed, and unknown builds.
Notification types that do not request surf-alert presentation remain ordinary
on every build.

The allowlist is intentionally exact. Add a future binary only after its bundled
iOS sound or immutable Android channel is verified and the compatibility tests
are updated in the same change.

## Monitoring

The notifications delivery cron summary includes
`presentation_compatibility`, a count map keyed as:

```text
<ios|android|unknown>:<eligible_custom|legacy_default|ordinary_default>:<reason>
```

The map contains no push token, user identity, event identity, or raw build
metadata. Review it in the existing `cron_runs.summary` for
`/api/cron/notifications-deliver`.

Expected custom-presentation keys for the pinned candidates are:

```text
ios:eligible_custom:eligible
android:eligible_custom:eligible
```

Investigate increases in `missing_metadata`, `malformed_metadata`,
`unknown_platform`, or `unknown_build` before expanding the allowlist.

## Rollback

Removing a tuple from the exact allowlist immediately returns that build to the
legacy/default presentation without changing queued events, notification
preferences, device registrations, or native binaries. Do not rename an Android
channel in place; channel identifiers are immutable once shipped.
