## Quiver App Design Style Guide

This guide defines Quiver’s brand identity and UI/UX standards. It maps voice, visuals, typography, color, iconography, motion, copy, and accessibility to concrete tokens and components used in the app.

### How to use this guide

- Designers: reference brand, typography, and component patterns for mockups.
- Developers: use semantic tokens (CSS variables, Tailwind theme, shadcn/ui) rather than hardcoded values. Prefer classes like `bg-background`, `text-foreground`, `text-balance`, and the standard containers.

Token mapping (current implementation):

- Fonts (loaded in `app/globals.css`): Roboto, Open Sans, Montserrat
- Colors (CSS variables in `:root`): `--background`, `--foreground`, `--primary` (H 196 S 100% L 47%), `--ring` (same as primary), `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`
- Tailwind theme aliases (`tailwind.config.ts`): `primary`, `secondary`, `muted`, `accent`, `destructive`, `ring`, plus brand extensions: `ocean-blue` `#0077B6`, `sunset-orange` `#FF7F11`, `sandy-beige` `#F5F5DC`, `dark-grey` `#333333`
- Radius: `--radius: 0.5rem` (maps to Tailwind `rounded-lg`/`md`/`sm`)
- Motion: `lib/constants/animations.ts` with `DURATIONS` { fast: 0.3, standard: 0.6, slow: 0.8, hero: 1 }

---

### Brand Identity & Tone

- Voice & Personality: energetic, playful, minimalist, inclusive. Use active, second-person language (e.g., “Connect with surfers, track epic sessions, and inspire your community”). Light surf slang and emojis are OK sparingly; clarity first.
- Visual Personality: vibrant yet clean. Ocean-inspired palette with bold imagery and generous whitespace. Interfaces feel friendly and familiar—not corporate.

---

### Typography

- Font Families: Roboto (impactful headings/UI), Open Sans (body/longer copy), Montserrat (accent/special UI). All sans-serif for legibility.
- Hierarchy & Sizing (mobile → desktop):
  - H1: ~text-5xl → text-7xl/8xl (Roboto Bold)
  - H2: ~text-4xl → text-5xl (Roboto Bold)
  - H3/Card Titles: ~text-2xl (Roboto Medium/Bold)
  - Body: `text-base` → `text-xl` for subtitles (Open Sans Regular/Semibold)
  - Minimum important text size ~14px for legibility
- Weights: headings 500–700; body 400–600; italics rarely.
- Usage: sentence case for most UI. Title Case sparingly for short feature names or proper nouns. Maintain generous line-height on large text and limit paragraph width to ~600–700px for readability.

---

### Color Palette

Quiver uses semantic tokens with brand-aligned hues.

- Primary — Ocean Blue: core brand/action color.
  - Design token: `--primary` (H 196 S 100% L 47%) and `--ring`
  - Tailwind: `text-primary`, `bg-primary`, `ring-primary`
  - Hex brand reference: `#0077B6` (theme `ocean-blue`)
  - Usage: primary CTAs, links, selection states, focus rings, key charts
- Secondary — Sunset Orange `#FF7F11` (theme `sunset-orange`): warm accent; use sparingly for highlights/secondary buttons/badges.
- Neutrals & Backgrounds:
  - Background: `--background` (default light)
  - Foreground: `--foreground` (~charcoal for headings/body)
  - Secondary text: Tailwind gray-600 equivalent via `muted-foreground`
  - Borders/Dividers: `--border` / `--input`
  - Alternate surface: sandy beige `#F5F5DC` for subtle warmth on cards/sections
- Status & Accents:
  - Success: green (e.g., Tailwind `green-600`) for positive states
  - Error/Destructive: `--destructive` (mid-tone red) + `--destructive-foreground`
  - Warning/Attention: yellow/amber used sparingly in icons/badges/charts

Accessibility: ensure WCAG 2.1 AA contrast (white-on-primary, charcoal-on-white, etc.). Use overlays/gradients on media for readable text.

Code examples:

```tsx
// Semantic surfaces
<div className="bg-background text-foreground border border-border" />

// Primary CTA
<button className="bg-primary text-primary-foreground ring-1 ring-primary" />
```

---

### Iconography & Imagery

- Icons: line-based, minimal (Lucide/Feather style). Consistent stroke/size (16–24px typical). Prefer Lucide icons for new needs.
- Usage: reinforce labels and key stats. Use brand colors to tie to features (blue for community, orange for logging/progress). Avoid mixing filled and outline styles.
- Imagery: authentic surf photography and light background video usage. High-quality, vibrant, with gradient overlays where needed for readability. Favor community-sourced images (sessions, beach shots). Optimize for performance.
- Illustrations: minimal; if used, keep flat/simple, aligned to brand palette.

---

### UI Components & Layout

- General Layout: mobile-first, responsive. Content centered up to ~1200px desktop.
  - Standard containers (defined in CSS): `.home-container`, `.centered-container`
  - Spacing: multiples of 4/8px; e.g., sections often use `py-20`, content gutters `px-4` (scale up on larger breakpoints)
- Navigation: compact, sticky where appropriate. Clear active states using primary color.
- Buttons:
  - Primary: `bg-primary text-primary-foreground`, generous padding (e.g., `px-6 py-3`), rounded (radius `--radius` or pill for key CTAs), hover/active transitions 0.2–0.3s
  - Secondary: outline/ghost variants; same shape/typography; subtle hover fills
  - Tertiary/Text: link-style with primary text; underline on hover when needed
  - Destructive: red outline/fill using `destructive` tokens; clear labeling/icons
  - Sizes: `sm | md | lg` tied to consistent padding/fonts across the app
- Inputs & Forms:
  - Neutral/white backgrounds, 1px `--border`, `--radius`. Focus ring uses `--ring` (primary). Labels above/left, placeholder mid-grey meeting contrast. Error states use `destructive`.
  - Use shadcn/ui form components and DRY layouts.
- Cards & Surfaces:
  - `bg-card text-card-foreground border-border`, `--radius`, subtle shadow/hover elevation.
  - Clickable cards: cursor change, focus outlines, slight hover scale/shadow.
- Tabs/Segmented Controls: primary for active state; clear 44px+ touch targets.
- Grid & Spacing: whitespace is a feature; use Tailwind spacing and responsive grids to adapt stacks (1→3/4 columns on desktop). Test at breakpoints.

#### DRY Component Patterns

**Purpose**: Eliminate duplicate code by using standardized, reusable components following established patterns.

**Key Patterns**:

1. **Form Layout Components** (`components/ui/form-layout.tsx`)
   ```tsx
   // Instead of: Card + CardHeader + CardTitle + Form wrapper (50 lines)
   // Use: CardFormLayout (1 component)
   <CardFormLayout
     title="Edit Profile"
     description="Update your personal information"
     form={form}
     onSubmit={form.handleSubmit(onSubmit)}
     headerActions={<Button>Optional Action</Button>}
   >
     <FormInput control={form.control} name="name" label="Name" />
     <FormTextarea control={form.control} name="bio" label="Bio" />
   </CardFormLayout>
   ```

2. **Form Field Components** (`components/ui/form-fields.tsx`)
   ```tsx
   // Instead of: FormField + FormItem + FormLabel + FormControl (12 lines each)
   // Use: Specialized field components (1 line each)
   <FormInput control={form.control} name="email" label="Email" type="email" />
   <FormTextarea control={form.control} name="bio" label="Bio" rows={4} />
   <FormSelect
     control={form.control}
     name="level"
     label="Experience Level"
     options={[{value: 'beginner', label: 'Beginner'}]}
   />
   ```

3. **API Server Client** (`lib/supabase/api-server-client.ts`)
   ```tsx
   // API routes: use one-line client creation
   import { createAPIServerClient } from "@/lib/supabase/server";

   export async function POST(request: NextRequest) {
     const supabase = createAPIServerClient();
     // ... use supabase client
   }
   ```

4. **Form Submission Hook** (`hooks/use-form-submission.ts`)
   ```tsx
   // Handles loading, errors, success messages automatically
   const { isLoading, error, handleSubmit } = useFormSubmission({
     onSuccess: (data) => router.push("/success"),
     successMessage: "Saved successfully!",
   });
   ```

**Impact**: ~1,050 lines of duplicate code eliminated; 40-50% maintenance reduction.

**Reference**: See directory `ARCHITECTURE.md` files for pattern details and `components/ARCHITECTURE.md` for component usage.

---

### Motion & Interaction Design

Principles: snappy, purposeful, never overwhelming. Prefer fade-in + slide-up.

- Standard variants and durations (see `lib/constants/animations.ts`):
  - Variants: `fadeUpSlow`, `fadeUpWithDelay(delay)`, `staggerItem(index, duration)`, `heroText(delay)`, `fadeInView`
  - Durations: `fast=0.3s`, `standard=0.6s`, `slow=0.8s`, `hero=1s`
- Patterns:
  - Staggered entrance for lists (delay ~0.1s per item)
  - Hover: slight scale (~1.05) and shadow growth (~0.2–0.3s ease-out)
  - Active/Press: brief scale to ~0.98 or shade change (~100ms)
  - Focus: visible blue ring (`--ring`) with subtle opacity transition
  - Modals: fade+scale 95%→100%
  - Respect `prefers-reduced-motion`: disable non-essential motion

---

### Copywriting Guidelines

- Voice: direct, upbeat, community-forward. Use second person; occasional inclusive “we/let’s”. Avoid overly formal/technical language.
- Style: sentence case for UI. Active voice and present tense. Keep labels short; use tooltips/subtitles where extra context is needed.
- Preferred terms: crew, community, session, spots, forecast, log, track, share. Use “epic” sparingly to convey excitement; “stoke” acceptable in friendly contexts.
- CTAs: concise and inviting (e.g., “Join free today”). Avoid negativity; error copy should be helpful.
- Platform: ensure strings fit small screens; avoid awkward wraps/truncation. Keep consistency across mobile/desktop; show more detail on desktop if needed.
- Internationalization: avoid idioms; support units (ft/m). Keep enthusiasm translatable.

---

### Accessibility Guidelines

- Contrast: meet WCAG 2.1 AA (or better) for text/critical UI. Use overlays/gradients on media to ensure readability.
- Typography: legible sizes; generous line-height; use `text-balance` for large headings where appropriate.
- Keyboard: every control reachable; visible focus ring using brand-blue `--ring`. Don’t remove outlines without accessible alternatives.
- Semantics: correct HTML elements; icons with meaning have labels (`aria-label` or text). Don’t use color alone for state.
- Motion: honor reduced-motion; avoid flashes/rapid color changes.
- Touch targets: ~44px min; use padding like `py-3 px-6` for buttons and adequate gaps in lists.
- Copy: descriptive link/button text (“View forecast”, “Edit profile”), not “Click here”. Success/error toasts pair playful tone with informative text.
- Testing: verify color contrast, keyboard-only flows, screen reader basics (VoiceOver/NVDA), and mobile accessibility. Build on shadcn/ui ARIA patterns.

---

### References

- Tokens and globals: `app/globals.css`, `styles/ARCHITECTURE.md`
- Tailwind theme: `tailwind.config.ts`
- Motion: `lib/constants/animations.ts`
- Component patterns: `components/ARCHITECTURE.md`, `docs/DRY_COMPONENT_USAGE.md`
