# Landing: Swell View launch spotlight + badged feature grid — Design

**Date:** 2026-06-20
**Surface:** Quiver web landing `/` (the field-guide landing shipped in PR #330)
**Goal:** Mirror the Dispersed landing's *structure* (launch spotlight + badged feature-card grid) rendered entirely in Quiver's existing **zine aesthetic** — NOT Dispersed's clean SaaS look.

## Decisions (locked via brainstorm)
- **Visual treatment:** keep the zine/field-guide aesthetic (cream paper, monospace, Space Grotesk display, rotated sticker chips, asymmetric radius, offset shadows). Brand guide's anti-reference (corporate SaaS) stands — we borrow *layout + wording*, not Dispersed's visual style.
- **Spotlight subject:** the **Swell View** (the swell-field map). Framed as a launch announcement, mirroring Dispersed's "now free" beat.
- **Spotlight visual:** a **real captured frame of the Swell View** (from dev `/map`), committed as a static asset. NOT a drawn/mocked image.

## Section 1 — Swell View launch spotlight (new component)
New component `components/landing-page/field-guide/field-guide-spotlight.tsx`, placed in `QuiverFieldGuideLanding` between `FieldGuideHero` and `FieldGuideFeatures`. Two-column on desktop (text left, visual right), stacked on mobile. Zine card surface (cream, 1.5px ink border, asymmetric radius, offset shadow).

Copy (final):
- **Sticker chip:** `FREE · NEW IN THE APP` (green zine chip, rotated ~-2°)
- **Stat line (eyebrow):** `318 breaks · 73 cams · wave maps for the other 245`
- **Headline (Space Grotesk 700):** "Quiver's Swell View is here."
- **Story:** "We built it as an internal tool for our forecast team a year ago. Over a million images analyzed and classified."
- **Release line (highlighted):** "Today we're releasing it — free, in the app."
- **CTA:** "Get the app" → app download/handoff (drives the install).
- **Visual:** static `next/image` of the captured Swell View frame, in a zine-framed container; small caption "Satellite read where there's no cam" (optional).

Numbers are DB-derived (318 breaks, 73 cams → 245 without). A build step recomputes them so they don't go stale; if dynamic is overkill, hardcode with a comment citing the query + date.

## Section 2 — Badged feature grid (rework existing component)
Rework `components/landing-page/field-guide/field-guide-features.tsx` to mirror Dispersed's Features grid: responsive grid (`auto-fit, minmax(~178px, 1fr)`), each card = zine sticker icon + a FREE/PRO chip + title (Space Grotesk uppercase) + one-line description. ~6 cards, zine paper styling.

| Card | Tier | Icon | One-liner |
|---|---|---|---|
| Honest forecasts | FREE | chart-line | Wave height + conditions, no hype. |
| Wind & tide reads | FREE | wind | Plain-language wind/tide/best-hours calls. |
| Session log + crew | FREE | users | Log what you scored, share the call. |
| Board-aware picks | PRO | star | Matches breaks to what you ride. |
| Smart alerts | PRO | bell | Pinged when your spots line up. |
| Custom spots | PRO | map-pin | Drop your own breaks, same honest read. |

FREE chip = zine green (`#C0DD97` / text `#27500A`); PRO chip = brand orange (`#F78E42` / dark-orange text `#5C2E0C`). Tier mapping matches the existing `field-guide-audience-access` copy (free tier = forecasts + saved beaches; Pro = board-aware picks, alerts, custom spots, offline).

## Components touched
- **New:** `field-guide-spotlight.tsx`
- **Rework:** `field-guide-features.tsx` (add icons + FREE/PRO badges)
- **Wire:** `quiver-field-guide-landing.tsx` (insert spotlight between hero and features)
- **Asset:** `public/images/landing/swell-view-preview.<ext>` (captured from dev `/map`, swell layer verified painted)
- **Hero:** unchanged
- **Tests:** unit render tests for spotlight + reworked features; the e2e `guest-landing`/`guest-app-handoff` smoke covers presence.

## ⚠️ Copy-accuracy gates (must be true before prod)
1. **"is here" / "releasing it today":** Swell View is built (on main/dev). Ensure the launch claim is accurate for whatever surface ships (app and/or web).
2. **RESOLVED — "free in the app" (no exclusivity claim).** Copy softened from "exclusive to the app" to "free, in the app." Swell View may also live on web `/map`; promoting the surf-map reskin to prod web is now an independent decision, no longer gated by this copy.
3. **"internal tool a year ago," "over a million images analyzed and classified":** confirm these are factually accurate; soften if approximate.

## Scope / ship
- New feature branch off `main`; build + verify (typecheck, unit, `next build`, landing `@smoke`); promote to prod via the slice-promotion pattern used for #330.
- **Out of scope:** pricing/plans page, `/map` itself, the surf-map reskin promotion (separate decision; see gate #2), the clean-SaaS visual direction.
