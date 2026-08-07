# Container Personality System

**Date:** 2026-04-01
**Status:** Draft
**Mockup:** `.superpowers/brainstorm/52071-1775081807/content/full-design.html`

## Summary

Replace flat, uniform card containers across beach pages with a system of four distinct container personalities within the Surf Culture visual family. Each content type gets its own container treatment with unique textures, accent colors, and animations — creating visual variety while maintaining brand cohesion.

## Design Direction: Surf Culture

Deep navy gradient backgrounds with warm orange/gold accents. Two texture motifs:

- **Wave texture** — SVG wave lines that scroll horizontally via GPU-composited `transform: translateX()` (12s loop)
- **Topo contour texture** — bathymetric depth chart ellipses that drift in a lazy figure-8 via GPU-composited `transform: translate()` (24s `ease-in-out` loop)

Both textures use `will-change: transform` for GPU compositing. Both extend 30px beyond container bounds (parent needs `overflow: hidden`) to hide edges during movement.

All animations respect `prefers-reduced-motion`. These styles apply exclusively to the dark theme and are not designed for light mode.

## Color Palette (3 accents only)

Consolidated to match the existing Quiver design system. No purple — it's explicitly an anti-reference.

| Token | Hex | Usage |
|-------|-----|-------|
| Orange (primary) | `#F78E42` | Tide accent, today forecast, beach card borders, primary labels |
| Gold (secondary) | `#FDB84B` | Swell accent, day 3 forecast, secondary highlights |
| Blue (tertiary) | `#6CB4EE` | Wind accent, tomorrow forecast, used sparingly for warm/cool contrast |

Intel stat labels all use `rgba(255,255,255,0.6)` (neutral) — the data type is communicated by the label text, not color coding.

## Accessibility Requirements

**Minimum contrast ratios (WCAG AA on `#141937` backgrounds):**
- Body text: `rgba(255,255,255,0.6)` minimum (~4.8:1)
- Large text (18px+ or 14px+ bold): `rgba(255,255,255,0.5)` minimum
- Accent label text: use lightened variants (e.g., `#FFA559` instead of `#F78E42` at small sizes)

**Minimum font sizes:**
- Labels: `12px` (matches codebase `text-xs` baseline) — not 10px
- Body: `13px`+

**Reduced motion:** All ambient animations (texture scrolling, gradient shifting, glow pulsing) disabled via `@media (prefers-reduced-motion: reduce)`. Hover transforms (user-initiated) remain active.

## Container Variants

### 1. Beach Cards (listings)

**Texture:** Wave
**Applied to:** Beach card content area below photo (`components/beach-card.tsx`)

| Property | Value |
|----------|-------|
| Background | `linear-gradient(145deg, #1a1f4a, #2D357D)` |
| Border | `1px solid rgba(247,142,66,0.2)` (static — no glow animation) |
| Top accent | `2px solid rgba(247,142,66,0.3)` border-top on content area |
| Wave height | Pill badge: `rgba(247,142,66,0.15)` bg, `#F78E42` text |
| Hover | `translateY(-4px) scale(1.02)`, elevated shadow |
| Border-radius | `16px` |

**Animations:**
- Wave texture scrolls horizontally (12s linear infinite, GPU-composited)

**Stagger strategy:** Use CSS custom property `--card-index` set by parent, with `animation-delay: calc(var(--card-index) * 0.5s)`.

**Framer Motion migration:** The existing `beach-card.tsx` uses Framer Motion `whileHover` for `scale: 1.02, y: -4`. Replace with CSS `transition: transform 0.3s ease, box-shadow 0.3s ease` + `:hover` to avoid double-application. Keep Framer Motion only for `AnimatePresence` entry/exit if used.

### 2. Conditions Cards (tide / wind / swell)

**Texture:** Topo contours
**Applied to:** Current conditions grid cards in `components/beach-detail/`

| Property | Value |
|----------|-------|
| Background | `#141937` |
| Border-left | `3px solid {accent}` — color varies by type |
| Border-radius | `8px 16px 16px 8px` (softened asymmetry) |
| Shadow | `0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)` |
| Hover | `translateY(-2px)`, elevated shadow |

**Accent colors by data type:**
- Tide: `#F78E42` (orange)
- Wind: `#6CB4EE` (blue)
- Swell: `#FDB84B` (gold)

**Animations:**
- Topo texture drifts (24s ease-in-out infinite, GPU-composited transform)
- Texture element oversized by 30px on all sides to hide edges during movement

**Radial glow:** Static at `opacity: 0.15` behind icon — no pulse animation. Reduces concurrent animation count.

**Icon container:** 44x44px rounded-12 box with `rgba({accent}, 0.1)` bg + `rgba({accent}, 0.15)` border.

**Label styling:** `12px` uppercase, `letter-spacing: 1.2px`, accent color per type (lightened to meet 4.5:1 contrast at small sizes).

**Sub-text:** `rgba(255,255,255,0.6)` minimum for all secondary text.

### 3. Local Intel

**Texture:** Topo contours
**Applied to:** Optimal conditions section — the static beach knowledge cards (best wind, best swell, preferred tide, best months, wave tips, crowd tips). Target component: `optimal-conditions-section.tsx` or equivalent in the intel tab — NOT `conditions-intel-card.tsx` (which is the live morning intel report with decision badges).

| Property | Value |
|----------|-------|
| Background | `linear-gradient(160deg, #1a1f4a 0%, #0F1A2E 40%, #1a1f4a 100%)` at `200% 200%` size |
| Border | `1px solid rgba(255,255,255,0.06)` |
| Border-radius | `16px` |
| Shadow | `0 8px 32px rgba(0,0,0,0.3)` |

**Sub-stat cards:** `rgba(255,255,255,0.04)` bg, rounded-10. All stat labels use `rgba(255,255,255,0.6)` (neutral, not color-coded — the label text communicates the data type).

**Sub-stat values:** White, `15px`, `font-weight: 600`, Space Grotesk.

**Tips section:** 2-column grid below stats. `rgba(255,255,255,0.03)` bg. Tip labels `rgba(255,255,255,0.6)`, tip text `rgba(255,255,255,0.7)`.

**Animations:**
- Background gradient shifts slowly (8s ease-in-out infinite via `background-position`)
- Topo texture is static on this container (only one texture animation per viewport — conditions cards already have topo drifting)
- Sub-stat cards: subtle bg change on hover (`0.04 → 0.07`)

### 4. 3-Day Forecast Outlook

**Texture:** Wave (bottom-anchored)
**Applied to:** 3-day outlook card and individual day pills

**Outer container:**
| Property | Value |
|----------|-------|
| Background | `#141937` |
| Border | `1px solid rgba(255,255,255,0.06)` |
| Border-radius | `16px` |

**Day cards — color progression (on-brand, no purple):**
| Day | Gradient | Shadow |
|-----|----------|--------|
| Today | `#F78E42 → #e06520` (orange) | `rgba(247,142,66,0.25)` |
| Tomorrow | `#6CB4EE → #4A8FCC` (blue) | `rgba(108,180,238,0.2)` |
| Day 3 | `#FDB84B → #D4942E` (darkened gold) | `rgba(253,184,75,0.2)` |

**Animations:**
- Wave SVG at bottom of each day card (static — wave scroll is already used on beach cards in the same viewport)
- Staggered `fadeSlideUp` entry (0s / 0.1s / 0.2s delay)
- Day cards: `translateY(-3px)` on hover

## Shared Texture Implementation

### Wave Texture (React component or CSS class)

Uses `transform: translateX()` instead of `background-position` for GPU compositing:

```css
.tex-waves {
  position: absolute;
  top: 0; left: -200px; right: 0; bottom: 0;
  width: calc(100% + 200px);
  opacity: 0.04;
  background-image: url('data:image/svg+xml,...'); /* inline SVG wave paths */
  background-size: 200px 40px;
  animation: waveScroll 12s linear infinite;
  will-change: transform;
  pointer-events: none;
}

@keyframes waveScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-200px); }
}
```

Parent container needs `overflow: hidden`.

**Production note:** Consider extracting the inline SVG data URIs to static `.svg` files in `public/textures/` to avoid per-element CSS parsing overhead. Measure CSS bundle impact.

### Topo Texture

```css
.tex-topo {
  position: absolute;
  top: -30px; left: -30px; right: -30px; bottom: -30px;
  opacity: 0.05;
  background-image: url('data:image/svg+xml,...'); /* inline SVG concentric ellipses */
  background-size: 120px 120px;
  animation: topoShift 24s ease-in-out infinite;
  will-change: transform;
  pointer-events: none;
}

@keyframes topoShift {
  0% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(15px, -10px) rotate(1deg); }
  66% { transform: translate(-10px, 12px) rotate(-0.5deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
```

### All Keyframes

```css
@keyframes waveScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-200px); }
}

@keyframes topoShift {
  0% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(15px, -10px) rotate(1deg); }
  66% { transform: translate(-10px, 12px) rotate(-0.5deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Removed: `glowBorder`, `subtlePulse` — no longer used.

## Animation Budget

Maximum **3 concurrent ambient animations** per page view:

| Section | Animation | Type |
|---------|-----------|------|
| Beach cards | Wave texture scroll | `transform` (GPU) |
| Conditions cards | Topo texture drift | `transform` (GPU) |
| Local intel | Gradient shift | `background-position` (main thread, acceptable — single element) |

Forecast wave bottoms and intel topo texture are **static** (rendered but not animated) to stay within budget. Entry animations (`fadeSlideUp`) run once and stop.

## Scope

### In scope
- Beach card content area restyling (`components/beach-card.tsx`)
- Conditions cards restyling (tide/wind/swell cards in `components/beach-detail/`)
- Local intel section restyling (`optimal-conditions-section.tsx` or equivalent)
- 3-day forecast outlook restyling (`components/home-screen/forecast-outlook-card.tsx` or day cards)
- Shared texture CSS classes or React components in `styles/globals.css`
- Reduced motion support
- Framer Motion → CSS transition migration for beach card hover

### Out of scope
- Beach card photo area (stays as-is)
- Map components
- Navigation / header / tabs
- Mobile-specific layout changes (containers adapt naturally via existing responsive grid)
- Beach card on map sidebar (`selected-beach-card.tsx`)
- `conditions-intel-card.tsx` (live morning intel — different component)
- Light mode support

## Files to modify

- `components/beach-card.tsx` — content area styling + Framer Motion hover migration
- `components/beach-detail/` — conditions card components (identify exact files during planning)
- Optimal conditions section in intel tab (identify exact file during planning)
- `components/home-screen/forecast-outlook-card.tsx` or forecast day components
- `styles/globals.css` — shared keyframes + texture classes
- `tailwind.config.ts` — register new animation keyframes if using Tailwind `animate-*` classes

## Success criteria

- Four visually distinct container types that feel cohesive within the Surf Culture family
- Maximum 3 concurrent ambient animations per page view
- All text meets WCAG AA contrast (4.5:1 for small text, 3:1 for large)
- All animations GPU-composited (`transform`-based) where possible
- `prefers-reduced-motion` disables all ambient animations
- No layout shift or jank on page load
- Minimum font size 12px (matching codebase baseline)
- Only 3 accent colors used (orange, gold, blue — no purple)
- Existing functionality unchanged — this is purely visual
