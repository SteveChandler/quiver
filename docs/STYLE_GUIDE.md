# Quiver Style Guide

Practical reference for maintaining visual consistency. Use semantic tokens (CSS variables, Tailwind theme, shadcn/ui components) rather than hardcoded values.

**Source of truth:** `app/globals.css` (CSS custom properties), `tailwind.config.ts` (theme extensions), `components/ui/` (shared components).

---

## 1. Status Colors

Four semantic status colors are defined as CSS custom properties and extended into Tailwind.

| Token         | HSL (light mode)       | Use for                                      |
|---------------|------------------------|----------------------------------------------|
| `destructive` | `0 84.2% 60.2%`       | Errors, failures, critical alerts            |
| `success`     | `142 71% 29%`         | Confirmations, healthy states, positive data |
| `warning`     | `38 92% 32%`          | Cautions, rate limits, stale data            |
| `info`        | `217 91% 43%`         | Informational, loading states, neutral tips  |

### Usage pattern

Pair the base color with opacity modifiers for backgrounds and borders:

```tsx
// Text
<span className="text-success">Healthy</span>

// Tinted background with border
<div className="bg-warning/10 border border-warning/20 text-warning">
  Stale data
</div>

// Icon coloring
<AlertCircle className="h-4 w-4 text-destructive" />
```

### Do / Don't

- **Do** use `text-success`, `bg-info/10`, `border-destructive/20` for status indicators.
- **Don't** replace decorative or brand colors (primary action links, amber star ratings) with status tokens.

---

## 2. Shadow Scale

Use Tailwind's built-in shadow utilities. Do not invent custom `box-shadow` values.

| Class       | Use for                                |
|-------------|----------------------------------------|
| `shadow-sm` | Inputs, badges, small interactive bits |
| `shadow`    | Cards, panels                          |
| `shadow-md` | Hover states, elevated cards           |
| `shadow-lg` | Modals, popovers, overlays             |

```tsx
// Card with hover elevation
<div className="shadow transition-shadow hover:shadow-md">...</div>
```

---

## 3. Z-Index Layers

Named z-index values are defined in `tailwind.config.ts`. Use these instead of arbitrary numbers.

| Class          | Value | Use for                         |
|----------------|-------|---------------------------------|
| `z-overlay`    | 60    | Full-screen overlays, drawers   |
| `z-toast`      | 70    | Toast notifications             |
| `z-auth-wall`  | 80    | Authentication wall (topmost)   |

Common Tailwind z-index values also in use:

| Class   | Value | Use for                        |
|---------|-------|--------------------------------|
| `z-10`  | 10    | Sticky elements within content |
| `z-50`  | 50    | Navbar                         |

**Rule:** Never use arbitrary `z-[999]` values. If the existing scale doesn't cover a case, add a named token to `tailwind.config.ts`.

---

## 4. Typography Hierarchy

Font families loaded via CSS variables: Inter (default sans), Roboto, Open Sans.

| Role              | Classes                                           |
|-------------------|---------------------------------------------------|
| Page title        | `text-2xl font-bold` (mobile) / `text-3xl` (md+)  |
| Section heading   | `text-xl font-semibold`                            |
| Subsection / Card | `text-lg font-medium`                              |
| Body text         | `text-sm` or `text-base`                           |
| Caption / Helper  | `text-xs text-muted-foreground`                    |

---

## 5. Font Family Rules

Three font families are loaded via Google Fonts and configured as CSS variables:

| Font | Tailwind Class | Usage |
|------|---------------|-------|
| **Inter** | `font-sans` (default) | Body text, navigation, UI elements, form inputs |
| **Roboto** | `font-roboto` | All headings (h1-h4), CTAs, brand-prominent text |
| **Open Sans** | `font-open-sans` | Descriptive body copy on content-heavy pages (landing, about, features) |

**Rule:** App pages must use `font-roboto` on headings. Many components default to Inter -- always add `font-roboto` to `text-xl font-semibold`, `text-2xl font-bold`, and similar heading patterns.

**Local font copies** exist in `public/fonts/` but are used exclusively by Satori for OG image rendering (see `scripts/fetch-fonts.mjs`). Web pages load fonts via Google Fonts CDN.

---

## 6. Logo Usage

- **Primary logo:** `public/logoQuiver.png` (optimized PNG, <100KB)
- **No SVG version exists** -- flagged as future work
- **Canonical name in product UI:** "Quiver"
- **Canonical name in copyright/marketing:** "Quiver Surf"

---

## 7. Naming Conventions

| Context | Name |
|---------|------|
| Product UI | Quiver |
| Copyright / Marketing | Quiver Surf |
| Legal entity | Quiver Surf Technologies |
| SEO alternate name | Quiver Surf App |
| App Store | Quiver: Surf Forecast & Crew |

---

## 8. Spacing Rules

Use Tailwind `gap-*` and `space-*` utilities consistently.

| Gap        | Use for                              |
|------------|--------------------------------------|
| `gap-1`    | Badge groups, icon + label pairs     |
| `gap-1.5`  | Tight inline groups                  |
| `gap-2`    | Form fields, list items (default)    |
| `gap-3`    | Slightly roomier lists               |
| `gap-4`    | Sections within a card               |
| `gap-6`    | Major card sections                  |
| `gap-8`    | Page-level sections                  |

**Containers:** Use `.home-container` (max 1280px, responsive padding) or `.centered-container` (max 1100px) from `globals.css`. Do not hardcode container widths.

---

## 9. Component Patterns

### Buttons

Always use `<Button>` from `components/ui/button.tsx`. Never hand-code button styles.

| Variant       | Use for                                  |
|---------------|------------------------------------------|
| `default`     | Primary actions (submit, save, CTA)      |
| `destructive` | Delete, remove, dangerous actions        |
| `outline`     | Secondary actions, cancel                |
| `secondary`   | Lower-emphasis alternatives              |
| `ghost`       | Toolbar actions, inline triggers         |
| `link`        | Text-style navigation                   |

Sizes: `xs` (h-9), `sm` (h-10), `default` (h-11), `lg` (h-12), `icon` (h-11 w-11).

```tsx
import { Button } from "@/components/ui/button";

<Button variant="outline" size="sm">Cancel</Button>
<Button>Save Changes</Button>
<Button variant="destructive">Delete</Button>
```

### Skeletons

Use `<Skeleton>` from `components/ui/skeleton.tsx` for loading placeholders. Never hardcode `bg-gray-200 animate-pulse`.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

<Skeleton className="h-4 w-[200px]" />       // Text line
<Skeleton className="h-12 w-12 rounded-full" /> // Avatar
<Skeleton className="h-[200px] w-full" />     // Card placeholder
```

### Empty States

Use `<ZeroState>` from `components/ui/zero-state.tsx` for empty / zero-data screens.

```tsx
import { ZeroState } from "@/components/ui/zero-state";
import { Waves } from "lucide-react";

<ZeroState
  icon={Waves}
  title="No sessions yet"
  description="Log your first surf session to start tracking."
  action={{ label: "Log Session", href: "/sessions/new" }}
  proTip="Sessions are visible only to you until you share them."
/>
```

Props: `icon` (Lucide), `title`, `description`, `action?`, `secondaryAction?`, `proTip?`, `className?`.

---

## 10. Brand Colors

The app uses a **sunset/twilight surf aesthetic**. Charming Orange is the **primary action color**; Deep Twilight is the global background. The Tailwind token `ocean-blue` still exists in `tailwind.config.ts` but now maps to `#F78E42` (Charming Orange) — do not assume it is blue or pink.

| Token | Hex | Role |
|-------|-----|------|
| `ocean-blue` | `#F78E42` | **Primary action color** -- CTAs, links, active states, buttons (token retained; value is now Charming Orange) |
| `sunset-orange` | `#FF7F11` | Secondary accent -- warm highlights, badges, decorative emphasis |
| `sandy-beige` | `#F5F5DC` | Decorative -- beach-detail gradient background (1 usage, keep) |
| `dark-grey` | `#333333` | High-contrast text |

### Sunset/twilight palette

The global background and card surfaces use the following values directly (not tokenized as Tailwind colors — apply via `bg-[#...]` or CSS custom properties):

| Role | Hex | Notes |
|------|-----|-------|
| Background | `#252D6B` | Deep Twilight -- global page background |
| Card surface | `#2D357D` | Slightly lighter twilight for card/panel backgrounds |
| Elevated surface | `#354090` | Elevated cards, modals |
| Border | `#404C92` | Subtle borders and dividers |
| Primary accent | `#F78E42` | Charming Orange -- same value as `ocean-blue` token |
| Twilight Blue accent | `#4A70D9` | Links, success states, secondary highlights |
| Paradise Gold | `#FDB84B` | Badges, ratings, energy indicators |
| Charming Orange (dark) | `#D57835` | Hover/pressed states for primary accent |
| Valentina Pink | `#D3408B` | Tertiary pop -- decorative highlights, special badges |

### Hover states

Use Tailwind opacity modifiers instead of separate dark tokens:
- `hover:bg-ocean-blue/90` for primary button hovers
- `hover:text-ocean-blue/80` for link hovers

### CSS custom property

`--primary` in `globals.css` is set to match `#F78E42` (Charming Orange). All `bg-primary` / `text-primary` usages from shadcn/ui inherit the Charming Orange value automatically.

### Do / Don't

- **Do** use `ocean-blue` (Charming Orange `#F78E42`) for all primary actions and CTAs
- **Do** use `#4A70D9` (Twilight Blue) for links and secondary highlights in dark contexts
- **Do** use `#FDB84B` (Paradise Gold) for badges and energy/rating indicators
- **Do** use `#D3408B` (Valentina Pink) sparingly as a tertiary pop color
- **Don't** use `#0077B6` anywhere -- that is the old corporate blue and has been replaced
- **Don't** use `#FF3B8B` (old hot pink) -- replaced by Charming Orange `#F78E42`
- **Don't** use `#0B1426` (old deep navy) -- replaced by Deep Twilight `#252D6B`
- **Don't** use `sunset-orange` as the primary CTA color (it's secondary)
- **Don't** create new `-dark` color tokens -- use `/90`, `/80` opacity modifiers instead

---

## 11. Landing & App Visual Alignment

The landing page and authenticated app share the same visual language:

- **Same font hierarchy:** Roboto for headings, Inter for body, Open Sans for long-form content
- **Same primary color:** Charming Orange `#F78E42` (`ocean-blue` token) for all CTAs and action buttons
- **Same dark background:** Deep Twilight `#252D6B` as the global page background
- **Gradients encouraged** in both contexts for visual depth against the dark background
- **Same shadow scale** (see Shadow Scale section)
- **Same footer component** (`SiteFooter`) with optional brand section for landing

---

## 12. Motion

Standard durations from `lib/constants/animations.ts`:

| Duration   | Value  | Use for                    |
|------------|--------|----------------------------|
| `fast`     | 0.3s   | Hover, active, focus       |
| `standard` | 0.6s   | Entrance animations        |
| `slow`     | 0.8s   | Staggered reveals          |
| `hero`     | 1.0s   | Hero section intros        |

Respect `prefers-reduced-motion` -- all motion is disabled globally in `globals.css` when the user preference is set.

---

## Quick Reference: Do / Don't

| Do | Don't |
|----|-------|
| `<Button variant="destructive">` | `<button className="bg-red-500 ...">` |
| `<Skeleton className="h-4 w-32" />` | `<div className="bg-gray-200 animate-pulse h-4 w-32" />` |
| `<ZeroState icon={...} title="..." />` | Custom empty-state div with inline styles |
| `text-success`, `bg-warning/10` | `text-green-600`, `bg-yellow-100` for status |
| `z-overlay`, `z-toast` | `z-[999]` |
| `shadow` / `shadow-md` | `shadow-[0_4px_12px_rgba(0,0,0,0.1)]` |

---

## Asset Notes

- `public/fonts/` directories (Inter, Roboto, OpenSans, Montserrat, NotoSans) are used by `scripts/fetch-fonts.mjs` for Satori OG image rendering. Do not delete.
- Fonts for web pages are loaded via Google Fonts CDN (configured in layout.tsx).
