---
type: quiver-dev-pm-plan
target: web
status: proposed
risk: medium
backend_owner: codex
frontend_owner: claude
approval_required: yes
---

# UGC: Local Spot Reports, Session Video, Platform Share (S1–S3)

Integration task: **web primary**, native parity required (S1 form + all of S2/S3 have native surfaces). Research basis: `.planning/ugc-video-local-reports-research-20260810.md`. Week tracker + slice contracts: `../handoffs/week-20260810/{MASTER-PLAN.md,phaseB-ugc-slices.md}`. This doc is the durable in-repo record; handoffs are ephemeral.

## Objective
Ship the three UGC slices this week: S1 surface the existing conditions report (native + web, photo attach), S2 session video attachment with moderation, S3 branded-render share to Instagram (Stories/Reels schemes) and TikTok (share sheet now, Share Kit post-review).

## Non-goals
- No feedback-table consolidation (B0-2: deferred; S1 keeps writing `intel_posts` + `sessions` row exactly as `submitConditionsReport` does today).
- No TikTok Content Posting API. No Instagram Graph publishing. No new video platform (Mux/Stream) — Supabase Storage v1 with a pre-agreed upgrade trigger.
- No monetization gating (B0-4 recommendation: free growth surface).
- No native rewrite-adjacent work (Architecture Ratchet holds; new native code = feature modules).

## Current evidence
- `submitConditionsReport` exists at `actions/conditions-report-actions.ts:62` (structured fields, dedupe, 24h expiry) — **PROBED 2026-08-10: zero consumers outside its own test**; fully dark, not merely under-surfaced. The only live conditions-posting surface is the generic `components/intel/intel-post-form.tsx` (freeform intel with a conditions tag). S1 should wire the structured action into/alongside that existing surface, not build a parallel form.
- `community_spot_photos` fully built, DB flags default OFF (migration 20260725230000).
- `session_media.media_type` permits `video`; zero video upload paths; `expo-video` installed native-side; no capture/compression libs.
- Moderation primitives live: `content_reports`, `user_blocks`, intel auto-hide, community-photo moderation events.
- Bucket-limit contradiction (10 vs 50 MB) between migration 20251102000001 and storage-contracts doc — remote probe required before S2 DDL.

## Impacted surfaces
frontend (web beach page, native beach-detail + session flow + share sheet) · backend (new `/api/v1/conditions-reports`, `/api/sessions/[id]/videos`, admin moderation queue) · database (session-videos bucket, additive `session_media` columns, flag flips) · API contract (two new versioned mobile-consumed routes) · analytics/events (share + report events must clear the 4-layer allowlist) · cross-app parity (all slices).

## Existing patterns to follow
`withAuth` for routes / `withAuthenticatedAction` for actions · native uses Bearer→API route, never server actions · mobile-consumed routes are **versioned additive contracts with real HTTP error statuses** · new mutation routes set explicit `no-store` (blanket 60s `/api/*` cache in `next.config.mjs`) · `useDataFetcher` web, TanStack Query native · zine-first design tokens (`app/styles/zine.css` web, `src/constants/theme.ts` native), sticker-once-per-surface rule · migrations `BEGIN;…COMMIT;` per `docs/MIGRATION_SAFETY.md` · `yarn db:types` after schema change, never hand-edit generated types.

## Backend plan (Codex)
Per-slice handoffs written probe-data-first from `phaseB-ugc-slices.md` contracts. Codex runs `codex exec --sandbox workspace-write` in place; each slice on its own branch; Codex does not commit/push/merge. Every handoff embeds the web profile Hard rules block + the two new-route contracts verbatim.

## Frontend plan (Claude)
S1 native form (feature module `src/features/conditions-report/`), web beach-page entry; S2 picker/progress/playback UI both surfaces; S3 share UI + render flow. `/frontend-design` for net-new surfaces, `/polish`+`/critique` before merge. Motion: slow/organic, reduced-motion preserved.

## API / data contract
Locked in `handoffs/week-20260810/phaseB-ugc-slices.md` (POST `/api/v1/conditions-reports` shape; `session-videos/{sessionId}/{userId}/{ts}.mp4` + finalize route; `moderation_status` lifecycle). Contract changes require updating that file first, then consumers.

## Database / migration notes
S2 migration: bucket + additive `session_media` columns only; no backfill; shared prod/dev DB so it lands with main (prod promotion stays code-only). Verify remote bucket state before writing DDL. RLS mirrors existing session_media policies + moderation-status predicate.

## Analytics / event notes
Reuse existing funnel/share event names (plan-065 rule). Any genuinely new event needs all 4 allowlist layers (VALID_EVENTS + anon/pre-auth lists + DB CHECK + TS union) in the same slice — grep `trackEvent` diff against `VALID_EVENTS` as the check.

## Cross-app parity notes
S1/S2/S3 all ship web+native in the same slice (not deferred parity). S2+S3 native deps (`react-native-compressor`, `react-native-share`) are native modules → ONE binary cut, after the 1.0.2-b16 parity OTA ships. S1 native is JS-only → OTA-able after sim validation. Deep links for shared clips reconcile via `quiver-product-unity` before merge.

## Test plan
Per slice: web `yarn typecheck` → `yarn test:unit --bail=0` → scoped eslint → targeted Playwright (S1 gets one guest E2E on the web report path; e2e patterns per `AGENTS.md`) → `yarn deadcode` ratchet → `VERCEL_ENV=preview yarn build` for routing-affecting slices. Native `npm run typecheck` + `npm test` + sim validation; Maestro gate before any OTA. Local gates are mandatory; Main Gate PR checks are additive (the "Actions disabled 2026-05-06" note is stale — Prod Gate ran green on PR #529, 2026-08-10 — but do not rely on remote alone).

## Acceptance criteria
- S1: report submittable from native beach-detail and web beach page against dev; photo attach works; dedupe + expiry behavior unchanged; E2E green.
- S2: 60s clip uploads from sim on LTE-class throttling, resumes after kill; pending→approved flow works in admin queue; rejected/pending never publicly visible (RLS-tested); App Store 1.2 checklist evidenced in PR body.
- S3: Stories + Reels handoff verified on a real device/test account with the branded render; TikTok share-sheet pass; `share_completed` fires; TikTok dev-app review submitted.

## Approval gates
Steven, explicitly, per event: every commit/merge (repo rule: never commit unasked) · migration application · `community_spot_photos` flag flip (B0-6) · OTA publish · binary cut/store submission · prod slice promotion · TikTok/Meta app registrations (his accounts) · any outbound post from test accounts.

## Rollback / failure plan
S1: revert merge (flag flip is its own commit → independently revertible). S2: `moderation_status` default `pending` means worst case is invisible content, not bad content — bucket + columns are additive, rollback = revert code merge, leave schema (documented-dormant). S3: share buttons behind a UI flag; render failures fall back to existing OG-card share path.

## PM decision log
- 2026-08-10: Plan formalized under /quiver-dev-pm after research + week master plan. Awaiting B0-1…6 + Phase A DQ decisions. A1 branch audit running; A2 dev-root audit delivered (9 DELETE, 14 DECISION rows).
