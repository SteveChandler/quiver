# Session video UGC runbook

Session videos use a private Supabase Storage bucket and a database row created
only after the object upload succeeds. The shipped upload UI is on
`feat/ugc-media-upload-ui`.

## Upload pipeline

1. The authenticated client uploads to the private `session-videos` bucket.
   The path must be shaped as
   `{sessionId}/{userId}/{name}.mp4` or `{sessionId}/{userId}/{name}.mov`.
   The current path builder sanitizes the name and appends a UUID, so the
   concrete shape is `{sessionId}/{userId}/{safeName}-{uuid}.mp4|.mov`.
2. After storage succeeds, the client posts to
   `POST /api/sessions/[id]/videos` with `storagePath`, `durationSec`, and
   `sizeBytes`.
3. The route requires ownership of the session, validates the path and
   metadata, and inserts the `session_media` row with `media_type = 'video'`
   and `moderation_status = 'pending'`.

The server enforces a maximum duration of 60 seconds, a maximum size of 60 MiB
(62,914,560 bytes), an `.mp4` or `.mov` extension, no `..` path segments, and a
path prefix of exactly `${sessionId}/${userId}/`. Client-side validation is
not a substitute for these checks.

## Storage RLS path requirement

The `session-videos` storage policies compare `auth.uid()` with
`(storage.foldername(name))[2]`. The user ID must therefore be the second path
segment. A path with the segments in another order is rejected by storage RLS
and can look like a silent upload/path failure; do not change the layout.

## Moderation and visibility

New rows are pending and are not public. Until approval, the owner can access
the row and admins can access it through the queue in
`components/admin/session-video-queue.tsx`. The admin API is
`/api/admin/session-videos` and provides signed preview URLs plus approve and
reject actions.

Playback uses `GET /api/sessions/[id]/videos/[mediaId]`. The route permits the
owner or an approved video attached to a public session, then returns a signed
URL that expires after 300 seconds. It does not expose the private storage path
as a public URL.

## Orphan retention

The client can reach storage before it creates the `session_media` row. The
orphan-retention implementation is on
`fix/audit-10-session-video-retention` at
`app/api/cron/session-video-retention/route.ts`. It recursively scans
`session-videos`, checks each object for a matching `session_media.storage_path`,
and removes objects with no row once they are older than 24 hours. The 24-hour
window protects an upload that is still between storage and row creation.

