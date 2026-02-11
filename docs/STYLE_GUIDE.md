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
- **Don't** replace decorative or brand colors (ocean-blue links, amber star ratings) with status tokens.

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

## 5. Spacing Rules

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

## 6. Component Patterns

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

## 7. Brand Colors (reference)

These are decorative / brand-identity colors, not status colors.

| Token           | Hex       | Use for                        |
|-----------------|-----------|--------------------------------|
| `ocean-blue`    | `#0077B6` | Links, brand accents           |
| `sunset-orange` | `#FF7F11` | Warm highlights, badges        |
| `sandy-beige`   | `#F5F5DC` | Subtle card backgrounds        |
| `dark-grey`     | `#333333` | High-contrast text             |

---

## 8. Motion

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
