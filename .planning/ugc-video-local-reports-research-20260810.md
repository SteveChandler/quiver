# UGC Video + Local Spot Reports — Feasibility Research (2026-08-10)

**Trigger:** Andrew Webb's email (3rd user to ask for video upload + local reports on spots).
**Question:** Feasibility of (a) local spot reports, (b) user video upload, (c) share-to-Instagram/TikTok, and whether this can pull in the surfers already posting spot content on IG/TikTok.
**Status:** Research only. Nothing implemented. Sources: Codex codebase inventory + three web-research passes (Instagram APIs, TikTok APIs, video infra + competitors).

---

## Verdict (one paragraph)

Highly feasible, and cheaper than it looks: **local reports already exist in the codebase** (`submitConditionsReport`), a **fully-moderated community photo system is built but flag-gated off**, and moderation/report/block primitives required by Apple already ship. The genuinely new build is (1) a video attachment path (client-compressed 720p H.264 → Supabase TUS upload — ~$0 incremental infra at current scale) and (2) platform share polish: Instagram Stories/Reels URL schemes need only a Meta App ID (no review); TikTok Share Kit needs a developer-app review (days–2 weeks) and a thin Expo native module. **No tappable attribution exists on any platform** — branding must be burned into the rendered clip (watermark/stats overlay/handle), which is exactly what Strava/Surfline/Dawn Patrol do. No surf app currently does user-uploaded spot video; Surfline Sessions is cam-clip-based, so this is open ground.

---

## 1. What already exists (Codex codebase inventory)

### Local reports — ~built, not surfaced
- `submitConditionsReport` in [actions/conditions-report-actions.ts:51](../actions/conditions-report-actions.ts): beach-attached, structured wave-size range + vibe + 280-char note, one report per user/beach/day, 24h expiry, writes `intel_posts` (`tag="conditions"`) + a minimal `sessions` row (`source="conditions_report"`) for ML.
- `intel_posts` supports `photo_url` but the conditions action doesn't attach media.
- Gap is **surface/discoverability** (especially native), not backend. Andrew asking for this is evidence users can't find/reach it — same silent-feature pattern as elsewhere.

### Spot photos — built, dark
- `community_spot_photos` (migration 20260725230000): moderation status, consent/rights, votes, reports, moderation events, contributor restrictions, rate limits, private bucket, service-role-only access. **DB feature flags default OFF**; native gated at `beach-detail.tsx:1493`.
- Real image pipeline exists (Sharp server-side, `expo-image-manipulator` native-side).

### Rate-the-forecast — strong foundation to extend
- `forecast_feedback_contexts` (beach + exact `forecast_at` + window + horizon + JSONB context), mirrored to `forecast_accuracy_votes`; Seaside ingests via `/internal/forecast-feedback` and reads it as calibration evidence (dry-run by default). A local report is naturally the same shape with `feedback_kind="condition_report"` + media.
- Caveat: three generations of feedback tables (`spot_feedback`, `forecast_accuracy_votes`, `forecast_feedback_contexts`) — consolidate intent before adding a fourth.

### Video — schema foothold only
- `session_media.media_type` allows `photo|video`; `session-media` bucket MIME allows MP4/QuickTime. But: every upload path validates images only, no `video_url` on sessions, no picker/compression/thumbnail/playback-integration/duration-validation anywhere. `expo-video` (playback) installed; no capture lib, no `react-native-share`.
- Bucket limit contradiction: bucket migration says 10 MB; storage-contracts doc says 50 MB video. Remote state unverified — check before building.
- A stale PRD exists: `docs/features/PUBLIC_SESSIONS_VIDEO_UPLOAD_PRD.md` (60s, <50MB, suggests Cloudflare Stream).

### Moderation — mostly satisfies Apple already
- `content_reports` (users/sessions/comments), `user_blocks`, intel auto-hide after 3 reports, intel voting/trust, community-photo moderation events + holds + purge lifecycle. Fragmented but real.

### Sharing — OS share sheet only
- Native: OG-card download → `expo-sharing` / `Share.share`, saves to camera roll, `session_shares.platform` already tracks `instagram`/`tiktok` labels (analytics only). Web: Web Share API + OG image routes. **No platform SDK integration anywhere.**

---

## 2. Instagram sharing (2026 state)

| Surface | Feasible? | How | Catch |
|---|---|---|---|
| Stories | **Yes — best ROI** | `instagram-stories://share` + Meta App ID (mandatory since 2023, **no review**), via `react-native-share` `shareSingle`: background video ≤20s + transparent branded sticker PNG (Strava stats-sticker pattern) | 20s cap; no caption; no auto link — user adds link sticker manually |
| Reels | **Yes** | `instagram-reels://share` / `ADD_TO_REEL`, open to all devs since Oct 2023, 3–60s video + sticker layer | No first-class RN lib target — needs a small native shim; caption via clipboard only |
| Feed | Share sheet only | Generic OS share | Media only, becomes a Reel anyway |
| Graph publishing API | **No (consumers)** | Business/Creator accounts + Advanced Access review (weeks) | Dead end for the viral loop |

- Old swipe-up `attributionURL` is defunct. Attribution = watermark/@handle burned in + manual link sticker + link-in-bio.
- `expo-sharing` can't do the IG-specific flows; `react-native-share` requires a dev build (fine — we already prebuild).

## 3. TikTok sharing (2026 state)

- **OS share sheet:** works today, zero setup, video pixels only. This is what Surfline Sessions/Dawn Patrol/Strava-class apps actually ship.
- **Share Kit:** alive and current. Opens TikTok composer with clip preloaded + **auto-filled hashtag** (e.g. #quiver) — the only native attribution. Requires TikTok developer app + review (days–2 weeks; app must be live in stores — it is). No official RN wrapper; the two community wrappers are hobby-grade → write a thin Expo native module around the official SDKs (~1–2 days).
- **Content Posting API: skip.** Unaudited clients get silently-privatized posts; multi-week audit; composer-less UX loses TikTok sounds/effects.
- Tappable "made with X" anchors (CapCut-style) are partner-tier only. US platform risk resolved (USDS JV closed Jan 2026).

## 4. Video infra + moderation (cheapest credible stack)

- **v1 = existing Supabase Pro plan, ~$0 incremental:** client-side compress to 720p H.264 MP4 (`react-native-compressor` or picker-level export — this kills the iPhone HEVC→Android/desktop playback trap and cuts clips to 5–15 MB), TUS resumable upload (good on beach LTE), serve progressive MP4 via Supabase CDN signed URLs. 100 users × 4 clips/mo sits well inside 100 GB storage / 250 GB cached egress.
- **Upgrade trigger (defined in advance):** clips >60–90s, buffering complaints, or web/social embeds needing adaptive streaming → Cloudflare Stream ($5/mo min) or Mux (free encode tier); both ingest by URL, nothing is thrown away.
- **Moderation:** Apple Guideline 1.2 checklist = filtering method + report button + block user + published contact + act within 24h + EULA with objectionable-content language. Report/block already exist; needed: EULA language check, a review queue (Supabase table + admin page), the 24h SLA process, and optionally Sightengine free tier (2,000 ops/mo) frame-sampling as automated pre-screen — $0 at our scale. Google Play policy is the same shape.

## 5. Competitive landscape

- **Surfline:** Sessions = auto-cut clips from their own cam network (watch GPS sync), Premium-gated. Their moat is cams, **not** UGC. Modern app has paid staff reports, no community reports. Magicseaweed (and its community uploads) died into Surfline in 2023. **Nobody in surf does user-uploaded spot video.**
- **Best-practice report loops:** Fishbrain (structured catch log serving the logger first), Windy.app (one-tap wind report + comment + photo into per-spot feed — closest live analog), AllTrails (stars + condition tags + photos + activity-verified badge), OpenSnow (single structured measurement). Common pattern: **structured fields first, freeform optional, media as attachment, GPS/activity verification** — Quiver's session logging already provides the verification primitive.

## 6. Strategy fit + recommended shape (not implementation)

- The Fishbrain lesson matches our check-habit reality: the report must serve the reporter first (their session record, their clip rendered into a branded share card), with the per-spot community feed as byproduct. A local report attached to a beach at a time is also **ground truth for the call** — it feeds the same calibration lane as rate-the-forecast.
- The creator hook Andrew's cohort represents: they already film and post to IG/TikTok. Quiver's offer = attach the clip to the spot (their local cred, spot page presence) + get a branded 9:16 stats-overlay render + one-tap share to Stories/Reels/TikTok with #quiver. Quiver becomes the tool they make the post *with* — attribution lives in the pixels.

### Suggested phasing (for a future plan, not started)
1. **P0 — surface what's built (days):** expose conditions report properly (native + beach page), decide the community_spot_photos flag, let reports attach a photo (`intel_posts.photo_url` already there).
2. **P1 — video attachment (1–2 wks):** picker + 720p H.264 client compression + TUS upload to a video-appropriate bucket (resolve the 10 vs 50 MB contradiction), `expo-video` playback in feed/beach page, frame-sample pre-screen + reuse content_reports, admin review queue + 24h SLA.
3. **P2 — platform share (parallelizable):** branded 9:16 render (stats overlay + watermark; Remotion pipeline exists in Brand-Vault for reference), IG Stories + Reels URL schemes (Meta App ID, react-native-share + small Reels shim), TikTok via share sheet now, Share Kit after dev-app review, caption-to-clipboard toast.

### Open decisions for Steven
- Consolidate or bless the three feedback-table generations before adding condition-report media?
- Public-by-default vs owner-choice visibility for spot videos (community_spot_photos precedent = consent + moderation-gated public).
- Who staffs the 24h moderation SLA (currently: Steven).
- Free vs premium: existing pattern is UGC free / forecasts premium — video upload as free growth surface fits plan 065's acquisition arm.
