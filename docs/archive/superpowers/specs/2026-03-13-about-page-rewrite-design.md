# About Page Rewrite — Design Spec

**Date:** 2026-03-13
**Status:** Draft

## Problem

The current `/about` page has:
- Hardcoded fake stats (1,247 users, 8,943 sessions — real numbers are 68 and 489)
- Generic SaaS copy ("We believe surfing is better when shared", "Foster genuine relationships built on trust")
- Light mode styling (`bg-gradient-to-br from-sandy-beige via-white to-blue-50`) inconsistent with the rest of the app (always-dark, Deep Twilight navy)
- Blue-to-purple gradient on subtitle — explicitly an anti-reference in design principles
- Emoji in headings
- Corporate "Our Mission / Our Values / Our Story" structure that doesn't match brand voice
- No real origin story

## Solution

Rewrite the about page as a **founder letter** — first person, casual, direct. Dark theme throughout. Real stats. No corporate structure.

## Files Changed

1. `lib/constants/content.ts` — Replace `ABOUT_CONTENT` with new copy; remove unused `Heart` icon import
2. `app/about/about-client.tsx` — Rewrite component structure and styling
3. `app/about/page.tsx` — Update metadata (title, description, keywords); preserve `revalidate = 3600`
4. `__tests__/lib/constants/content.test.ts` — Update `ABOUT_CONTENT` tests to match new structure (same-commit rule)
5. `lib/constants/ARCHITECTURE.md` — Update `ABOUT_CONTENT` shape documentation

## Page Structure

### Section 1: Hero
- **Background:** `bg-[#252D6B]` (Deep Twilight navy)
- **Heading:** "I built Quiver because I was tired of forecasts being wrong."
- **Subtext:** "Forecasts missed the swell. Missed the wind. Missed whether it was even worth getting out of bed at 5am."
- **Animation:** Simple `motion` fade-in on heading and subtext. No spinning wave icon, no animated counters.
- **Reduced motion:** Honors `prefers-reduced-motion` — content appears immediately without animation.

### Section 2: The Problem
- **Background:** Same `bg-[#252D6B]`, no visual break — flows as continuation of the letter
- **No section heading** — just body paragraphs
- **Copy:**
  > I was checking five different apps before every session. Surfline for the cam, Magic Seaweed for the swell, NOAA for the wind, some tide app, and then a group text to see if anyone was going out. And half the time I'd show up and conditions were nothing like what any of them said.
  >
  > The worst part? There was no way to say "hey, this is wrong." No way to tell the next person that the south wind was actually hammering Blacks even though the forecast said offshore. You just showed up, got skunked, and drove home.
- **Text:** `text-high` (87% white), `text-lg`, `leading-relaxed`, `max-w-3xl mx-auto`

### Section 3: What Quiver Actually Does
- **Background:** `bg-white/[0.04]` on navy for subtle separation
- **Bridge line:**
  > So I started building something different. Not another forecast aggregator — a platform that pulls real data from real sources and actually lets surfers tell each other what's happening.
- **Stats bar:** Horizontal on desktop (4 columns), 2x2 grid on mobile
  - Cards: `bg-[#2D357D]`, `border border-white/10`, `rounded-lg`
  - Values: `text-white`, `text-3xl font-heading font-bold`
  - Labels: `text-medium`, `text-sm`
  - "and counting" in `text-xs text-medium` below each label
  - Stats: 279 beaches, 131 cities, 17 states, 42K+ forecasts
  - No animated counters. No icons. Static numbers.
- **Closer:**
  > Every forecast is built from NOAA buoy data and ML models trained on real ocean observations — not just recycled from the same source everyone else uses.

### Section 4: What's Next
- **Background:** `bg-[#252D6B]` (back to base)
- **Copy:**
  > Quiver is early. I'm not going to pretend it's finished. But that's kind of the point — I want the people who use it to help shape what it becomes.
  >
  > If the forecast was off at your spot, tell me. If there's a beach we're missing, tell me. If you want a feature that would make you actually open this thing every morning, I want to hear it.

### Section 5: CTA
- **Background:** `bg-[#252D6B]` with subtle charming orange glow (`box-shadow` with `rgba(247, 142, 66, 0.15)`)
- **Heading:** "Come check it out."
- **Subtext:** "Free. No credit card. No spam. Just better data for your next session."
- **Primary button:** "Check the forecast" → `/` (home/map). White bg, dark text, `rounded-full`, pill style.
- **Secondary button:** "Drop me a line" → `mailto:support@quiversurf.app` (established address, already used on /cams and /support pages). Ghost style, `border-white/30`.
- **No emoji.** No "Join Our Community."

## Visual Rules

- **Entire page:** Dark theme. No light sections, no `bg-white`, no `bg-sandy-beige`.
- **Text colors:** `text-white` for headings, `text-high` for body, `text-medium` for secondary.
- **No blue-to-purple gradients.** No glassmorphism. No spinning animations.
- **Typography:** Space Grotesk (`font-heading`) for the main heading only. DM Sans (`font-sans`) for body text.
- **Max width:** `max-w-3xl` for body text (readability), `max-w-4xl` for stats bar.
- **Reduced motion:** Use Framer Motion's `useReducedMotion()` hook. When reduced motion is preferred, skip all `initial`/`animate` props (render content statically). No CSS-only fallback needed — Framer Motion handles it.

## Content Constants

Replace `ABOUT_CONTENT` in `lib/constants/content.ts`. New structure:

```ts
export const ABOUT_CONTENT = {
  hero: {
    title: "I built Quiver because I was tired of forecasts being wrong.",
    subtitle: "Forecasts missed the swell. Missed the wind. Missed whether it was even worth getting out of bed at 5am.",
  },
  problem: [
    "I was checking five different apps before every session. Surfline for the cam, Magic Seaweed for the swell, NOAA for the wind, some tide app, and then a group text to see if anyone was going out. And half the time I'd show up and conditions were nothing like what any of them said.",
    "The worst part? There was no way to say \"hey, this is wrong.\" No way to tell the next person that the south wind was actually hammering Blacks even though the forecast said offshore. You just showed up, got skunked, and drove home.",
  ],
  solution: {
    intro: "So I started building something different. Not another forecast aggregator — a platform that pulls real data from real sources and actually lets surfers tell each other what's happening.",
    stats: [
      { value: "279", label: "beaches" },
      { value: "131", label: "cities" },
      { value: "17", label: "states" },
      { value: "42K+", label: "forecasts" },
    ],
    closer: "Every forecast is built from NOAA buoy data and ML models trained on real ocean observations — not just recycled from the same source everyone else uses.",
  },
  whatsNext: [
    "Quiver is early. I'm not going to pretend it's finished. But that's kind of the point — I want the people who use it to help shape what it becomes.",
    "If the forecast was off at your spot, tell me. If there's a beach we're missing, tell me. If you want a feature that would make you actually open this thing every morning, I want to hear it.",
  ],
  cta: {
    title: "Come check it out.",
    subtitle: "Free. No credit card. No spam. Just better data for your next session.",
    primaryLabel: "Check the forecast",
    primaryHref: "/",
    secondaryLabel: "Drop me a line",
    secondaryHref: "mailto:support@quiversurf.app",
  },
} as const;
```

## Metadata

```ts
export const metadata: Metadata = buildPageMetadata({
  title: "About Quiver — Why I Built This",
  description:
    "I was tired of checking five apps before every session and showing up to conditions that didn't match. So I built Quiver — real surf data from real sources, for surfers who want to make the call.",
  path: "/about",
  keywords: [
    "about Quiver",
    "surf forecast app",
    "surf data",
    "surf conditions",
    "real surf data",
  ],
});
```

## Components Removed

- `AnimatedEngagementStat` — no longer used on this page (may still be used elsewhere)
- Lucide icons (`Heart`, `Users`, `Globe`, `Waves`, `Star`, `Camera`, `TrendingUp`) — no longer needed
- `Card`, `CardContent`, `CardHeader` — replaced with simple divs
- `ANIMATION_VARIANTS` import — simplified to inline motion props

## What This Does NOT Change

- Other pages using `ABOUT_CONTENT` (none found — only imported in `about-client.tsx`)
- The `AnimatedEngagementStat` component itself (used elsewhere)
- Any other content in `lib/constants/content.ts` (`PRIVACY_CONTENT` etc.)

## Stats Staleness

Stats are hardcoded with real numbers as of 2026-03-13. These change slowly (beaches/cities grow by single digits per month) so static values with "and counting" are appropriate for now. Future enhancement: fetch counts via server component since the page already uses ISR (`revalidate = 3600`).

## Testing

- Update `__tests__/lib/constants/content.test.ts` to assert new `ABOUT_CONTENT` shape:
  - `hero.title` and `hero.subtitle` are strings
  - `problem` is array of 2 strings
  - `solution.stats` is array of 4 objects with `value` and `label`
  - `solution.intro` and `solution.closer` are strings
  - `whatsNext` is array of 2 strings
  - `cta.title`, `cta.subtitle`, `cta.primaryLabel`, `cta.primaryHref`, `cta.secondaryLabel`, `cta.secondaryHref` are strings
- Visual check with Playwright MCP screenshot at desktop and mobile widths
- Verify dark theme consistency
- Verify `prefers-reduced-motion` is respected (use `useReducedMotion()` from framer-motion)
- Verify mailto link works
- Verify no console errors
