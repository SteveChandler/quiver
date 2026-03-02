# Retro Surf Redesign: "Deep Ocean + Neon Sticker"

**Date:** 2026-03-01
**Status:** Approved (brainstorming complete)

---

## Summary

Full-app visual redesign shifting Quiver from clean/corporate SaaS aesthetic to a retro 80s-90s surf culture identity. Dark-first, brush typography for personality, clean sans-serif for data, sticker-pop accent colors. Every surface gets the treatment, but data readability is sacred.

**Design principle:** Retro frame, clean data. Everything that isn't a number gets the personality. Everything that is a number stays crisp and scannable.

---

## Typography

### Display / Headlines
- **Font:** Brush/hand-drawn script (candidates: Permanent Marker, Caveat, or premium: Streetbrush, Surf Generation)
- **Usage:** Page titles, section headers, empty state messages, badges, landing page headlines, card section titles
- **Weight:** Single weight — brush fonts are inherently expressive

### UI / Body / Data
- **Font:** Inter (existing) — stays for body text, data values, forecast numbers, navigation labels, form inputs
- **Usage:** Everything that needs to be scanned fast
- **Weights:** 400 (body), 500 (labels), 600 (emphasis), 700 (data values)

### The Rule
If it's expressing personality, it's brush. If it's conveying information, it's clean.

---

## Color Palette

### Base Layer (the dark canvas)
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#0B1426` | Page background — deep navy, warm enough to avoid code-editor feel |
| `--surface` | `#111D35` | Cards, containers — subtle separation without heavy borders |
| `--surface-elevated` | `#172544` | Modals, dropdowns, popovers |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#F0F0F0` | Primary body text — off-white, easy on eyes |
| `--text-secondary` | `#8B9EC2` | Muted/secondary text — slate blue |
| `--text-data` | `#FFFFFF` | Forecast numbers, data values — bright white, maximum pop |

### Accent Colors (the sticker pops)
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-primary` | `#FF3B8B` | Primary CTAs, links, active states — hot pink |
| `--accent-secondary` | `#FFD639` | Badges, session highlights, "fire" moments — electric yellow |
| `--accent-tertiary` | `#00D4AA` | Links, secondary actions, progress — teal/cyan |
| `--destructive` | `#FF5C5C` | Danger/destructive actions — coral red |
| `--success` | `#7BFF5C` | Success states — lime green |

### Accent Usage Rules
- **Hot pink:** Primary buttons, selected tabs, key CTAs
- **Electric yellow:** Badges, session highlights, standout moments
- **Teal:** Links, secondary actions, progress indicators
- **Others:** Sparingly for status states only
- **The rule:** The dark base is the ocean. The accents are stickers slapped on your board. Sparse enough to have impact — if everything is neon, nothing is.

---

## Component Treatment

### Navigation / Header
- Dark navy bar with Quiver logo in brush script
- Nav items in clean sans-serif; active state gets a hand-drawn wavy underline (not a perfect CSS border)
- Mobile: bottom tab bar with bold/thick-stroke icons, slightly rounded — not thin line icons

### Cards (forecast, beach, session)
- Rounded corners with subtle rough/organic edge (CSS clip-path or border-image to break the perfect rectangle)
- Dark surface (`#111D35`) with faint 1px border in slightly lighter navy
- Hover/tap: brief glow in accent color — a color bloom, not a shadow lift
- Section headers inside cards: brush font, accent color

### Buttons
- **Primary:** Hot pink fill, bold white text, slightly irregular border-radius (subtly asymmetric, hand-cut feel)
- **Secondary:** Transparent with hot pink border, pink text
- **Press state:** Scale down to 0.96, fast spring back — tactile like pressing a real sticker

### Badges / Tags
- Sticker aesthetic: bold fill colors, slightly rotated (1-3 degrees), subtle drop shadow mimicking sticker lift
- Yellow for highlights, teal for informational, pink for actions

### Empty States & Loading
- Brush font headlines ("No sessions yet") with hand-drawn wave doodles
- Loading spinner replaced with animated wave line

---

## Page-Specific Treatments

### Landing Page
- Full retro energy — loudest page in the app
- Big brush headline over dark atmospheric surf image (VHS-filtered vibe)
- Bold sticker-style CTAs
- Sections separated by hand-drawn divider lines, not geometric borders

### Forecast / Beach Pages
- Brush font for beach name and section headers ("Today's Forecast", "Tide", "Wind")
- Data stays crisp: white numbers on dark cards, clean typography, proper spacing
- Condition tags get sticker treatment (rotated badges, bold color fills)
- Wave height displayed big and bold — heavier weight font for numbers to give punch without going brush

### Session Log
- Session cards get sticker-on-dark-board feel
- Session photos: optional subtle VHS/film grain CSS overlay filter (not modifying actual images)
- Ratings in electric yellow

### Profile
- Stats as bold typographic callouts rather than tiny charts
- Earned badges get full sticker treatment — rotated, colorful, collectible-feeling

---

## Micro-Interactions

- **Page transitions:** Quick fade with subtle slide — not elaborate
- **Button press:** Scale down (0.96) with fast spring back
- **Toast notifications:** Slide in from bottom, sticker-style rounded shape, accent colored
- **Card hover:** Color bloom glow in accent color

---

## Migration Notes

### What Changes
- CSS custom properties in `globals.css` (full palette swap)
- `tailwind.config.ts` color tokens, font families
- All component surfaces (backgrounds, borders, text colors)
- Typography hierarchy (add brush display font)
- Button, badge, card, and nav component styles
- Landing page layout and visual treatment
- Empty states and loading indicators

### What Stays
- Layout structure and component architecture
- Data fetching patterns
- Routing
- All business logic
- Inter for body/data text
- Responsive breakpoints
- Accessibility (WCAG AA contrast ratios maintained on dark backgrounds)

### Implementation Approach
Phased rollout recommended:
1. **Phase 1 — Foundation:** Color palette, typography, globals.css, tailwind tokens
2. **Phase 2 — Core components:** Buttons, cards, badges, navigation
3. **Phase 3 — Page treatments:** Landing, forecast, beach, session pages
4. **Phase 4 — Polish:** Micro-interactions, empty states, loading, illustrations

---

## Mood Board Reference
- Psychedelic VHS surf photography (deep teal-to-purple, motion blur)
- Hand-drawn lettering sticker sheets (bold colors, DIY zine energy)
- Vintage 80s Rip Curl magazine ads (hand-lettered display type, grassroots aesthetic)
