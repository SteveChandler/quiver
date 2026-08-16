# Quiver PRD: Public Sessions with Video Uploads

> Status: historical product proposal. For the shipped session-video storage,
> moderation, limits, and playback contract, use
> [`docs/session-video-ugc-runbook.md`](../session-video-ugc-runbook.md). The
> limits and public-read assumptions below are not the current implementation.

## Overview

This update enhances the existing Sessions feature by allowing surfers to upload video clips when creating or editing a session.

Users can mark sessions as Public to share them with the Quiver community — laying the groundwork for future features like peer feedback, comments, and AI coaching.

This phase focuses on content creation, discoverability, and social visibility, not on feedback or review mechanics yet.

## 1. Product Goals

- Let users attach videos to sessions to showcase surf clips or conditions.
- Allow public tagging so sessions appear in community feeds.
- Establish the data structure and storage pipeline needed for future feedback features.
- Keep it lightweight, mobile-first, and upload-friendly.

## 2. Problem Statement

Currently, sessions are private and text-based, limiting community engagement.

By introducing video uploads and a public visibility tag, Quiver can begin to build an authentic community loop — where users share their best moments and discover others' surf experiences — without needing to build full feedback tools yet.

## 3. Core User Stories

### Surfer (Uploader)

- As a user, I can upload a short video when I create or edit a session.
- As a user, I can mark my session as "Public," which allows it to appear in the community feed.
- As a user, I can see a preview of my uploaded clip inside the session detail view.
- As a user, I can view other users' public sessions in a Discover feed.

### Viewer

- As a user, I can browse public sessions posted by others.
- As a user, I can tap to play a clip, view basic details (beach, wave height, board).
- As a user, I can follow or like other users' sessions (optional Phase 2).

## 4. Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Video Upload | Upload up to 60 s clip (MP4/HEVC, < 50 MB) when creating/editing a session. | P0 |
| Public Tag | Toggle switch ("Make Public") that sets is_public=true in DB. | P0 |
| Feed Integration | Public sessions appear in a new "Discover" or "Community" tab. | P1 |
| Storage | Supabase Storage bucket session_videos/ or Cloudflare Stream for transcoding. | P0 |
| Preview Player | Simple responsive video player (mute autoplay on scroll). | P1 |
| Backend Support | Update sessions table schema to store video_url + is_public. | P0 |
| Future-proofing | Store feedback_enabled flag (boolean, default false) for later expansion. | P1 |

## 5. Database Updates

### Table: sessions

| Column | Type | Description |
|--------|------|-------------|
| video_url | text | URL to stored video (Supabase/Cloudflare). |
| is_public | boolean | Whether the session is visible in community feed. |
| feedback_enabled | boolean | Reserved for future feedback rollout. |
| created_at | timestamp | Already present. |
| user_id | uuid | FK → profiles.id |

## 6. UX Flow

### Create Session

1. User fills in session details (beach, board, rating).
2. Uploads a short video clip.
3. Toggles "Make Public."
4. Saves session → clip uploads to storage → metadata stored.

### View Session

- In "My Sessions," the video appears inline.
- Public sessions display a small 🌎 or "Public" badge.

### Discover Feed (Phase 1b)

- Public sessions aggregated and displayed in a vertical scroll.
- Sorted by recency or popularity.

## 7. Technical Requirements

### Frontend

Use existing Session form component; add:

- `<input type="file" accept="video/*" />`
- Video preview before upload.
- "Make Public" toggle.
- Use `<video>` tag for playback in feed or detail view.

### Backend / Infra

- **Supabase Storage**: new bucket session_videos/ with public-read policy.
- **Supabase Function**:
  - On upload success → generate URL → update sessions.video_url.
- **Supabase Policy**:
  - Only allow editing is_public for own sessions.

### Optional (for scaling)

- Use Cloudflare Stream for adaptive playback if size/traffic grows.
- Background worker to compress > 25 MB uploads.

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| % of sessions with video | ≥ 25% of new sessions |
| % marked public | ≥ 30% |
| Avg watch time per public session | ≥ 20 s |
| Community feed engagement (views/day) | ≥ 100 after 2 weeks |

## 9. Future Expansion (Phase 2+)

- Add comments + reactions on public sessions.
- Add "Request Feedback" toggle → triggers feedback thread system.
- Add verified coach tags and AI form analysis later.
