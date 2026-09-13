# Independent mainland provider review

Reviewed 2026-09-03. Scope: candidate camera geography and actual provider-page playback, followed by the two-camera migration and web link-out classification. No production writes.

## Accepted as external provider links

| Beach | Beach UUID | Provider page | Observations |
| --- | --- | --- | --- |
| Flagler Beach, Florida | `9ca1fa2f-2b90-4aa3-8784-48721e5463bb` | https://flaglersurf.com/webcam/ | Opened in the Codex browser. IPCamLive iframe reported `LIVE` in accessibility state. Screenshots showed beach, pier construction, and breaking waves; wave fronts changed between observations. The provider explicitly identifies Flagler Beach. |
| Corolla, North Carolina | `885440f6-10c2-4c70-aa40-b7b71044cda3` | https://www.corollalightresort.com/surf-cam/ | Opened in the Codex browser. VistaWebcams player reported `Pause` and `LIVE`; screenshot showed the resort oceanfront beach, ocean surf, umbrellas and lifeguard stand. The official beach page identifies this camera as showing Corolla Light beach conditions: https://www.corollalightresort.com/corolla-beaches . This is resort beach coverage within the broadly named Corolla row, not every location along Corolla. |

These were browser-rendered player checks, not conclusions from HTTP 200. Screenshots were inspected in tool output; no screenshot files were retained. Stream uptime after the observation is not guaranteed. No embedding permission was established: import the provider pages as external links only, not their extracted player URLs.

## Excluded or held

- **Stinson Beach / Sigward:** https://www.sigward.com/ has the explicit heading `Muir Beach Webcam`. The directory's Stinson association is wrong for exact coverage. Do not assign to Stinson.
- **Avalon Pier / Sea Ranch Resort:** https://www.searanchresort.com/webcam/ provides resort oceanfront coverage; no exact Avalon Pier field of view was established. Hold.
- **La Push:** https://forkswa.com/plan-your-visit/webcams/ explicitly states First Beach and James Island cameras are temporarily offline and being relocated. Do not import for First, Second or Third Beach.
- **Rockaway 90th / 98th Street:** https://thesurfersview.com/live-cams/new-york/rockaway-beach-cam-and-surf-report/ establishes Rockaway broadly but does not establish either exact street view. Hold.
- **Flagler's August 11 webcam blog post:** the title raised an outage concern, but the current provider camera rendered live during the browser check. No unsupported conclusion was drawn from the blog title alone.

## Scoped implementation review

Reviewed `lib/media/cam-embed.ts`, `__tests__/lib/media/cam-embed.test.ts`, and `supabase/migrations/20260903190000_add_verified_provider_cameras.sql`.

- Both UUIDs and slugs match the supplied read-only production beach snapshot.
- The migration joins UUID plus slug, excludes deleted beaches, and changes only `camera_url` when its existing value is null. Existing non-null cameras and forecast settings are preserved.
- The exact imported HTTPS provider URLs classify as `external`; their players are not embedded by this web helper.
- The added parameterized assertions require the full external intent, including provider label and destination URL, for both imported URLs.
- The code must deploy before the data migration. Installed native behavior is outside this scoped review and needs separate consumer verification.

No actionable issue found in the scoped diff. Tests were not run by this reviewer; execution validation belongs to the implementing agent.
