# /pbsc Evergreen Welcome Page — Implementation Plan (Codex handoff)

**Date:** 2026-07-01
**Owner:** Steven (via Claude PM session) → Codex implements → Claude reviews
**Status:** Implemented by Codex 2026-07-01; reviewed by Claude. Review fixes applied: (1) replaced dev-jargon microcopy under hero CTA, (2) fixed React hydration mismatch — `autoPlay` was rendered from `useReducedMotion()` which is `null` on SSR; autoplay now triggered imperatively in effect. Verified: typecheck, scoped eslint, jest 5/5, Playwright 3/3, browser preview (mobile + tablet, video autoplays muted, no hydration errors). Uncommitted, awaiting Steven.

## Goal

Repurpose the `/pbsc` event landing page (printed QR flyers point at
`quiversurf.app/pbsc` — URL MUST NOT change) from a stale, event-anchored,
static page into an evergreen, high-energy "welcome / get the app" page with a
Willy-Wonka-meets-surf-zine wow factor. One primary CTA — **Get the app** —
that routes each visitor to the right store for their device.

## Context / Why

- The PBSC Summer Longboard Classic (June 13, 2026) is over. Flyers with the
  QR are still being handed out, so scans continue to arrive.
- Current page problems (user's words): sterile, no animation, hero photo
  looks like a low render, and the CTA is platform-heavy ("Join Android
  waitlist") instead of a universal "Get the app".
- Both stores are now live:
  - iOS: `IOS_APP_STORE_URL` in `lib/constants/app-store.ts` (id6759300320)
  - Android: `ANDROID_BETA_PLAY_URL = "https://play.google.com/apps/testing/app.quiversurf.surf"` (Play closed-testing link, live)
- A smart cross-platform handoff route already exists at `/app`
  (`app/app/page.tsx`): iOS → App Store w/ campaign params, Android → Play
  testing URL, desktop → `DesktopHandoff` (send-to-phone QR). It logs
  `app_handoff_link_opened` server-side with source/surface/placement/UTM.
  **Reuse it. Do not duplicate UA→store routing logic on /pbsc.**

## Files

- **Rewrite:** `app/pbsc/page.tsx` (server component; keep `export const dynamic = "force-dynamic"`, keep `buildPageMetadata({ path: "/pbsc", ... })` with updated evergreen title/description — do NOT touch `lib/seo/meta.ts` itself)
- **Rewrite:** `app/pbsc/pbsc-scan-ctas.tsx` → replace with a new client component (name it what fits, e.g. `app/pbsc/pbsc-welcome-client.tsx`) holding the animated welcome experience + CTA
- **Add asset:** `public/videos/buoy-loop.mp4` (already copied into the repo by the PM session — verify it exists; if missing, copy from `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/launch-video/renders/buoy-loop-storyboard-with-voiceover.mp4`)
- **Update tests (same change):** `__tests__/app/pbsc-page.test.tsx`, `e2e/guest-pbsc.spec.ts`
- **Update:** `CHANGELOG.md` under `[Unreleased]`
- Do NOT modify: `app/app/page.tsx`, `lib/constants/app-store.ts`, `lib/constants/app-handoff.ts`, `components/app-store/*`, `components/pricing/android-waitlist-cta.tsx` (other surfaces depend on them)

## Functional requirements

1. **URL stability:** `/pbsc` keeps returning 200 for the printed QRs. No
   redirect of the page itself (a redirect would still "work" but we want the
   branded welcome moment before store handoff).
2. **Primary CTA — "Get the app":** a single primary CTA (hero + one repeat
   near the bottom) whose `href` is built with `buildAppHandoffPath` from
   `lib/constants/app-handoff.ts`:
   ```ts
   buildAppHandoffPath({
     source: "pbsc-flyer",
     surface: "pbsc-page",
     placement: "hero_primary", // or "bottom_primary"
     utm_source: "pbsc_qr",
     utm_medium: "flyer",
     utm_campaign: "pbsc_2026",
   })
   ```
   The `/app` route then does the per-OS store routing and analytics. This
   replaces `PbscScanCtas` / `IosAppStoreCta` / `AndroidWaitlistCta` usage on
   this page entirely.
3. **Platform-aware CTA label (server-side, same pattern as today):** keep
   the `parseUserAgent((await headers()).get("user-agent"))` check in
   `page.tsx` and pass the platform down so the button copy can read:
   - iOS → "Get it on the App Store"
   - Android → "Get it on Google Play"
   - unknown/desktop → "Get the app"
   The href is the same `/app?...` in all three cases (routing stays in /app).
4. **Evergreen copy:** remove the event date, "Tourmaline live issue no. 001"
   badge, and event framing. Keep a small nod to provenance (e.g. a rotated
   sticker: "Found via PBSC · Pacific Beach Surf Club") since every scanner is
   holding the flyer. Keep the product thesis copy direction: "your good days,
   on repeat" — Quiver matches today's forecast against the sessions you loved
   (do NOT describe it as generic "make the call" forecasting).
5. **Remove the tourmaline hero photo** (`tourmaline-photo.webp`) — user says
   it reads as a low-quality render. Replace visual interest with the type
   animation + video module below.

## Design requirements (the wow factor)

Canonical references: `app/styles/zine.css` tokens, `../Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md`. Aesthetic: retro surf-zine
(cream `#F4EBD8` paper on Deep Twilight stage, Charming Orange `#F78E42`
accent, Space Grotesk headings, Space Mono technical) — now cranked up with
Wonka-style theatrical reveal. `framer-motion` (v12) is already a dependency.

- **Act 1 — Welcome type entrance (code-driven, no video):** modeled on the
  Canva "welcome" intro the user likes: huge stacked words ("WELCOME" /
  "YOU FOUND IT" / "MEET QUIVER" — copywriting freedom within brand voice)
  that slam/stagger in with slight rotations, sticker badges popping in with
  spring physics, then settle into the hero. Keep it fast (~1.5–2.5s to
  interactive), never block the CTA — the CTA must be visible without waiting
  for the sequence to finish or scrolled interaction.
- **Golden-ticket motif:** one orange "ticket" sticker element (very Wonka,
  fits the flyer provenance). Sticker rules: rotated 1–3deg, asymmetric
  radius, and **never repeat the same sticker twice on the page**.
- **Act 2 — one video module only:** `public/videos/buoy-loop.mp4` in a
  zine-framed card ("see it in action" module). `autoPlay muted loop
  playsInline preload="metadata"` + `poster` (generate a poster frame or use a
  styled cream frame). Include a tap-to-unmute control since the render has a
  voiceover. Do NOT also embed `onboarding-hero.mp4` — the user flagged
  "too many videos"; one is the call.
- **Micro-texture:** keep scan-lines/checkered-tape flourishes from the
  current page if they help; content on cream paper, twilight stage behind.
- **`prefers-reduced-motion`:** all entrance animations collapse to simple
  fades/static; video shows poster + play button instead of autoplaying.
  Non-negotiable.
- Data-is-sacred and anti-reference rules apply (no glassmorphism, no purple
  gradients, no corporate SaaS look).

## Analytics

- The `/app` handoff route already logs `app_handoff_link_opened` with the
  params above — that is the primary conversion signal, and it finally gives
  the funnel visibility the old page lacked (scan → CTA → store).
- Do not fire any of the guarded pre-auth funnel events (`signup_cta_view`,
  etc.) from this page. If adding a lightweight page-view/CTA-click event,
  reuse existing event helpers and follow the `if (!user)` guard convention
  via `useAuth()` — the page serves anonymous scanners but a logged-in user
  may open it too.

## Tests (same change, blast radius)

- `__tests__/app/pbsc-page.test.tsx` — rewrite for the new page: metadata
  still uses path `/pbsc`; platform label logic (iOS/Android/unknown); CTA
  href contains `/app?` with `source=pbsc-flyer` and the UTM params; no
  event-date copy remains.
- `e2e/guest-pbsc.spec.ts` — rewrite the three UA scenarios: iPhone UA sees
  "Get it on the App Store" linking to the `/app` handoff path; Android UA
  sees "Get it on Google Play" with the same href; desktop sees "Get the
  app". Keep `setupErrorDetection`/`assertNoErrors`, 200 status assertions,
  and the existing UA/viewport fixtures. Assert the old
  "Join Android waitlist" button is gone. Follow the repo E2E rules (no
  `test.skip`, annotate any `waitForTimeout`).
- Keep tests mocked/unit-style where they are today — no real network.

## Verification (agent-executable, run all)

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
yarn typecheck
npx eslint --max-warnings=0 app/pbsc __tests__/app/pbsc-page.test.tsx e2e/guest-pbsc.spec.ts
yarn test:unit __tests__/app/pbsc-page.test.tsx
npx playwright test e2e/guest-pbsc.spec.ts
```

All four must pass. **Do not commit** — leave changes in the working tree;
the PM session reviews the diff first.
