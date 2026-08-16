# Container Personality System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat, uniform card containers with four distinct Surf Culture container personalities — each content type gets its own visual treatment with textures, accent colors, and GPU-composited animations.

**Architecture:** Shared CSS texture classes (`.tex-waves`, `.tex-topo`) in `globals.css` with keyframes registered in `tailwind.config.ts`. Each container variant is applied by modifying existing component classNames. React wrapper component `<TextureOverlay variant="wave|topo" />` handles the texture layer portably.

**Tech Stack:** Tailwind CSS, CSS keyframes (GPU-composited transforms), React (server + client components)

**Spec:** `docs/archive/superpowers/specs/2026-04-01-container-personality-system-design.md`

---

### Task 1: Add shared keyframes and texture CSS classes

**Files:**
- Modify: `quiver/tailwind.config.ts:109-221` (keyframes + animation objects)
- Modify: `quiver/styles/globals.css:356-403` (texture classes + reduced motion)

- [ ] **Step 1: Add keyframes to tailwind.config.ts**

Add these keyframes inside the `keyframes` object (after `waveParticleDrift` at line 197):

```typescript
// Container personality system keyframes
containerWaveScroll: {
  "0%": { transform: "translateX(0)" },
  "100%": { transform: "translateX(-200px)" },
},
containerTopoDrift: {
  "0%": { transform: "translate(0, 0) rotate(0deg)" },
  "33%": { transform: "translate(15px, -10px) rotate(1deg)" },
  "66%": { transform: "translate(-10px, 12px) rotate(-0.5deg)" },
  "100%": { transform: "translate(0, 0) rotate(0deg)" },
},
containerGradientShift: {
  "0%": { backgroundPosition: "0% 50%" },
  "50%": { backgroundPosition: "100% 50%" },
  "100%": { backgroundPosition: "0% 50%" },
},
containerFadeSlideUp: {
  from: { opacity: "0", transform: "translateY(10px)" },
  to: { opacity: "1", transform: "translateY(0)" },
},
```

Add these animation utilities inside the `animation` object (after `formgrid-sticker-slap` at line 220):

```typescript
// Container personality system animations
"container-wave-scroll": "containerWaveScroll 12s linear infinite",
"container-topo-drift": "containerTopoDrift 24s ease-in-out infinite",
"container-gradient-shift": "containerGradientShift 8s ease-in-out infinite",
"container-fade-slide-up": "containerFadeSlideUp 0.5s ease-out both",
```

- [ ] **Step 2: Add texture CSS classes to globals.css**

Add before the closing `}` of the `@layer components` block (before line 361):

```css
/* Container Personality System — Texture Overlays */
.tex-waves {
  position: absolute;
  top: 0;
  left: -200px;
  right: 0;
  bottom: 0;
  width: calc(100% + 200px);
  opacity: 0.04;
  background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 40%22><path d=%22M0 20 Q25 5 50 20 T100 20 T150 20 T200 20%22 fill=%22none%22 stroke=%22white%22 stroke-width=%221.5%22/><path d=%22M0 30 Q25 15 50 30 T100 30 T150 30 T200 30%22 fill=%22none%22 stroke=%22white%22 stroke-width=%221%22 opacity=%220.5%22/></svg>');
  background-size: 200px 40px;
  animation: containerWaveScroll 12s linear infinite;
  will-change: transform;
  pointer-events: none;
}

.tex-topo {
  position: absolute;
  top: -30px;
  left: -30px;
  right: -30px;
  bottom: -30px;
  opacity: 0.05;
  background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22><ellipse cx=%2260%22 cy=%2260%22 rx=%2255%22 ry=%2240%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%2242%22 ry=%2230%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%2228%22 ry=%2220%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%2214%22 ry=%2210%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%224%22 ry=%223%22 fill=%22white%22 opacity=%220.3%22/></svg>');
  background-size: 120px 120px;
  animation: containerTopoDrift 24s ease-in-out infinite;
  will-change: transform;
  pointer-events: none;
}

/* Static variant — rendered but not animated (used when another texture is already animating) */
.tex-topo-static {
  position: absolute;
  top: -30px;
  left: -30px;
  right: -30px;
  bottom: -30px;
  opacity: 0.04;
  background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22><ellipse cx=%2260%22 cy=%2260%22 rx=%2255%22 ry=%2240%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%2242%22 ry=%2230%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%2228%22 ry=%2220%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%2214%22 ry=%2210%22 fill=%22none%22 stroke=%22white%22 stroke-width=%220.8%22/><ellipse cx=%2260%22 cy=%2260%22 rx=%224%22 ry=%223%22 fill=%22white%22 opacity=%220.3%22/></svg>');
  background-size: 120px 120px;
  pointer-events: none;
}
```

- [ ] **Step 3: Add texture classes to reduced motion media query**

In the `@media (prefers-reduced-motion: reduce)` block (line 364), add `.tex-waves`, `.tex-topo` to the selector list:

```css
.motion-optimized,
.like-button-spring,
/* ... existing classes ... */
.wave-layer,
.tex-waves,
.tex-topo {
```

- [ ] **Step 4: Verify build**

Run: `cd quiver && yarn build 2>&1 | tail -5`
Expected: Build succeeds (no CSS parse errors)

- [ ] **Step 5: Commit**

```bash
git add quiver/tailwind.config.ts quiver/styles/globals.css
git commit -m "feat: add container personality texture classes and keyframes"
```

---

### Task 2: Create TextureOverlay React component

**Files:**
- Create: `quiver/components/ui/texture-overlay.tsx`

This reusable component renders the texture `<div>` layer. Works in both server and client components since it's just a div with a className.

- [ ] **Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils";

type TextureVariant = "wave" | "topo" | "topo-static";

interface TextureOverlayProps {
  variant: TextureVariant;
  className?: string;
}

const VARIANT_CLASS: Record<TextureVariant, string> = {
  wave: "tex-waves",
  topo: "tex-topo",
  "topo-static": "tex-topo-static",
};

export function TextureOverlay({ variant, className }: TextureOverlayProps) {
  return (
    <div
      className={cn(VARIANT_CLASS[variant], className)}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd quiver && npx tsc --noEmit 2>&1 | grep texture-overlay || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add quiver/components/ui/texture-overlay.tsx
git commit -m "feat: add TextureOverlay component for container personality system"
```

---

### Task 3: Restyle beach card content area

**Files:**
- Modify: `quiver/components/beach-card.tsx:120-270`

The beach card currently uses a white Card background with Framer Motion hover. We need to:
1. Add wave texture to the content area
2. Apply Surf Culture dark styling to the content area
3. Migrate the outer card hover from Framer Motion to CSS transition (keep Framer Motion for AnimatePresence/layout)

- [ ] **Step 1: Add TextureOverlay import**

Add at the top of `beach-card.tsx` with other imports:

```tsx
import { TextureOverlay } from "@/components/ui/texture-overlay";
```

- [ ] **Step 2: Replace Framer Motion hover with CSS on the outer wrapper**

Replace lines 121-129 (the `<motion.div whileHover={...}>` wrapper):

```tsx
<motion.div
  className="transition-transform duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_8px_25px_rgba(0,0,0,0.15)]"
  whileTap={{ scale: 0.98 }}
  layout
>
```

This removes `whileHover` (now CSS) but keeps `whileTap` and `layout` from Framer Motion.

- [ ] **Step 3: Add dark container styling to Card**

Replace line 131-134:

```tsx
<Card
  className="overflow-hidden bg-gradient-to-br from-[#1a1f4a] to-[#2D357D] border border-[rgba(247,142,66,0.2)]"
  data-testid="beach-card"
  data-beach-id={id}
>
```

- [ ] **Step 4: Add wave texture and dark styling to CardContent**

Replace line 210 (`<CardContent className="p-3">`):

```tsx
<CardContent className="p-3 relative overflow-hidden border-t-2 border-[rgba(247,142,66,0.3)]">
  <TextureOverlay variant="wave" />
```

Add a closing tag consideration — the existing `</CardContent>` at the end of the content block stays as-is since TextureOverlay is a self-closing sibling.

- [ ] **Step 5: Update text colors for dark background**

Update the following classNames within the CardContent:

Rating text (line 219): Change `font-medium` to `font-medium text-white`

Review count (line 222): Change `text-muted-foreground text-sm` to `text-white/60 text-sm`

Expand button (line 231): Change `text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100` to `text-white/50 hover:text-white/80 p-1 rounded-full hover:bg-white/10`

View Details link (line 247): Change `text-primary text-sm font-medium` to `text-ocean-blue text-sm font-medium`

Star icon (line 218): Keep `text-yellow-500 fill-yellow-500` (yellow on dark is fine)

Wave height pill (if shown in expanded forecast, ~line 310-330): Wrap wave height value in a span with `bg-[rgba(247,142,66,0.15)] text-ocean-blue px-2 py-0.5 rounded-md font-semibold text-sm`

- [ ] **Step 6: Verify visually**

Run: `cd quiver && yarn dev`

Navigate to a beach listing page (e.g., `/surf/san-diego` or similar). Verify:
- Beach cards have dark navy gradient background
- Wave texture is visible and scrolling in content area
- Orange accent border-top visible between photo and content
- Text is legible on dark background
- Hover still works (translateY + scale)
- Star rating and review count visible

- [ ] **Step 7: Run affected tests**

Run: `cd quiver && yarn test -- --testPathPattern="beach-card" 2>&1 | tail -20`
Expected: Tests pass (changes are purely visual, no behavior change)

- [ ] **Step 8: Commit**

```bash
git add quiver/components/beach-card.tsx
git commit -m "feat: restyle beach card with Surf Culture container personality"
```

---

### Task 4: Restyle current conditions cards (forecast tab)

**Files:**
- Modify: `quiver/components/beach-detail/tabs/forecast-tab.tsx:341-444`

The current conditions section has 3 primary cards (Tide/Wind/Swell) and 4 secondary cards (Swell Direction, Water Temp, Next Tide, Daylight). Apply the conditions container personality with topo texture and left accent bars.

- [ ] **Step 1: Add TextureOverlay import**

At the top of `forecast-tab.tsx`:

```tsx
import { TextureOverlay } from "@/components/ui/texture-overlay";
```

- [ ] **Step 2: Restyle the outer Current Conditions container**

Replace line 342:

```tsx
<section className="rounded-2xl border border-white/10 bg-[#141937] p-4 md:p-6 shadow-lg relative overflow-hidden">
  <TextureOverlay variant="topo" />
```

Remove the `backdrop-blur` and white-based styling.

- [ ] **Step 3: Update the section header styling**

Replace line 345 heading:

```tsx
<h2 className="text-xl font-heading font-semibold text-white/90 relative">
```

Replace line 348-349 "Right now" span:

```tsx
<span className="text-sm text-white/60 relative">
```

- [ ] **Step 4: Restyle the 3 primary condition cards (Tide/Wind/Swell)**

Replace the Tide card (lines 359-374). Current card div:

```tsx
<div className="flex flex-col items-center gap-1 sm:gap-4 rounded-[8px_16px_16px_8px] border-l-[3px] border-l-ocean-blue bg-[#141937] p-3 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center sm:justify-between relative">
```

Update the icon circle: `bg-[rgba(247,142,66,0.1)] border border-[rgba(247,142,66,0.15)]`

Update label: `text-xs uppercase tracking-wider text-[#FFA559]` (lightened orange for contrast)

Update value: `text-base sm:text-2xl font-bold text-white`

Update sub-text: `text-sm text-white/60`

Repeat for Wind card (lines 375-389) with blue accent:
- Border: `border-l-[#6CB4EE]`
- Icon bg: `bg-[rgba(108,180,238,0.1)] border border-[rgba(108,180,238,0.15)]`
- Label: `text-[#8DC8F5]` (lightened blue)

Repeat for Swell card (lines 391-406) with gold accent:
- Border: `border-l-[#FDB84B]`
- Icon bg: `bg-[rgba(253,184,75,0.1)] border border-[rgba(253,184,75,0.15)]`
- Label: `text-[#FDCA7B]` (lightened gold)

- [ ] **Step 5: Restyle the 4 secondary condition cards**

Replace each secondary card (lines 412-443). Current: `rounded-xl bg-gray-50/80 p-2 sm:p-3 border border-gray-100`

New:

```tsx
<div className="rounded-xl bg-white/5 p-2 sm:p-3 border border-white/10 relative">
  <div className="text-xs text-white/60 mb-1">Swell Direction</div>
  <div className="text-sm font-semibold text-white">
```

Apply the same pattern to all 4 secondary cards (Swell Direction, Water Temp, Next Tide, Daylight).

- [ ] **Step 6: Verify visually**

Run: `cd quiver && yarn dev`

Navigate to a beach detail page, Forecast tab → Today sub-tab. Verify:
- Dark container with topo texture drifting smoothly
- 3 primary cards with left accent bars (orange/blue/gold)
- Labels legible at 12px
- Secondary cards dark with white text
- Topo contours visible and smooth

- [ ] **Step 7: Run tests**

Run: `cd quiver && yarn test -- --testPathPattern="forecast" 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 8: Commit**

```bash
git add quiver/components/beach-detail/tabs/forecast-tab.tsx
git commit -m "feat: restyle conditions cards with topo texture and accent bars"
```

---

### Task 5: Restyle optimal conditions / local intel section

**Files:**
- Modify: `quiver/components/beach-detail/optimal-conditions-section.tsx:48-148`

This component is server-rendered (no `"use client"`). Apply the local intel container personality with gradient shift animation and static topo texture. Since this is SSR, the texture div is just a plain `<div>` with a className — no React component needed, but we can use `TextureOverlay` since it has no hooks.

- [ ] **Step 1: Add TextureOverlay import**

```tsx
import { TextureOverlay } from "@/components/ui/texture-overlay";
```

- [ ] **Step 2: Restyle the outer section container**

Replace line 49:

```tsx
<section className="rounded-2xl border border-white/10 p-6 relative overflow-hidden bg-[length:200%_200%] animate-container-gradient-shift" style={{ backgroundImage: 'linear-gradient(160deg, #1a1f4a 0%, #0F1A2E 40%, #1a1f4a 100%)' }}>
  <TextureOverlay variant="topo-static" />
```

Note: Using `topo-static` (not animated) because the conditions cards already have animated topo in the same viewport. The gradient shift provides the motion here.

- [ ] **Step 3: Update heading**

Replace line 50:

```tsx
<h2 className="font-heading text-xl font-semibold text-white/90 mb-5 relative">
```

Add `relative` so heading appears above the texture layer.

- [ ] **Step 4: Restyle condition stat cards**

Replace each condition card's classes. Example for the wind card (lines 77-83):

```tsx
<div className="bg-white/5 rounded-xl p-4 border border-white/5 transition-colors hover:bg-white/[0.07] relative">
  <Wind className="h-5 w-5 text-white/50 mb-2" />
  <span className="text-xs text-white/60 uppercase tracking-wider block">
    Best Wind
  </span>
  <h3 className="text-lg font-semibold text-white">{windCardinal}</h3>
</div>
```

Key changes from current:
- Icon color: `text-sky-400` → `text-white/50` (neutral — no per-stat color coding)
- Label color: `text-white/50` → `text-white/60` (meets contrast minimum)
- Added hover state: `hover:bg-white/[0.07]`
- Border: `border-white/10` → `border-white/5` (subtler)

Apply the same pattern to all 4 stat cards (wind, swell, tide, months).

- [ ] **Step 5: Restyle prose and tips section**

Update the prose text (line 119): `text-white/70` stays (already meets contrast).

Update tip card containers (lines 127, 137): Keep `bg-white/5 rounded-xl p-4 border border-white/10` but change:
- Tip label (lines 128, 138): `text-white/50` → `text-white/60`
- Add `relative` to each tip card div

- [ ] **Step 6: Verify visually**

Run: `cd quiver && yarn dev`

Navigate to a beach detail page, scroll to the optimal conditions section (Overview tab). Verify:
- Background gradient shifts slowly
- Static topo texture visible
- Stat cards have neutral labels (no color coding)
- Hover brightens stat card backgrounds
- All text legible

- [ ] **Step 7: Run tests**

Run: `cd quiver && yarn test -- --testPathPattern="optimal-conditions\|beach-detail" 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 8: Commit**

```bash
git add quiver/components/beach-detail/optimal-conditions-section.tsx
git commit -m "feat: restyle local intel with gradient shift and topo texture"
```

---

### Task 6: Restyle horizon strip (3-day forecast outlook)

**Files:**
- Modify: `quiver/components/forecast/horizon-strip.tsx:60-133`
- Modify: `quiver/lib/utils/horizon-strip-utils.ts` (check tier color definitions)

The horizon strip day cards already have tier-based colors. We add the wave texture at the bottom of each card and staggered fade-slide-up entry animation. The day color progression (orange → blue → gold) applies only to the first 3 days; remaining days keep their tier colors.

- [ ] **Step 1: Read horizon-strip-utils.ts for tier color definitions**

Run: `cd quiver && grep -n "TIER_COLORS\|TIER_COLOR_HEX" lib/utils/horizon-strip-utils.ts | head -20`

Understand the current color scheme before modifying.

- [ ] **Step 2: Add static wave texture to DayCard**

In the `DayCard` component (line 72), add a wave bottom element inside the button, before the TierBadge:

```tsx
<button
  type="button"
  onClick={onClick}
  className={cn(
    // Base layout
    "relative snap-start overflow-hidden",
    // ... rest of existing classes
  )}
  // ... existing props
>
  {/* Wave texture at bottom */}
  <div
    className="absolute bottom-0 left-0 right-0 h-[20px] opacity-[0.08] pointer-events-none"
    style={{
      backgroundImage: `url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 20%22><path d=%22M0 10 Q25 0 50 10 T100 10%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22/></svg>')`,
      backgroundSize: '100px 20px',
      backgroundRepeat: 'repeat-x',
      backgroundPosition: 'bottom',
    }}
    aria-hidden="true"
  />
```

Add `overflow-hidden` to the button className (line 78) if not already present.

- [ ] **Step 3: Add staggered fade-slide-up entry**

The DayCard component needs to accept an `index` prop for stagger delay. Update the DayCard interface:

```tsx
function DayCard({
  day,
  isSelected,
  onClick,
  index,
}: {
  day: DaySummary;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
```

Add animation class and stagger delay to the button:

```tsx
className={cn(
  // Base layout
  "relative snap-start overflow-hidden",
  "w-full h-[88px] rounded-xl border-2",
  "flex flex-col items-center justify-between p-2",
  // Entry animation
  "animate-container-fade-slide-up",
  // ... rest
)}
style={{ animationDelay: `${index * 0.05}s` }}
```

- [ ] **Step 4: Pass index to DayCard from parent**

In the HorizonStrip component, where DayCard is mapped (around line 210-230), add `index` to the props:

```tsx
{days.map((day, index) => (
  <DayCard
    key={day.isoDate}
    day={day}
    isSelected={day.isoDate === selectedDate}
    onClick={() => handleDaySelect(day.isoDate)}
    index={index}
  />
))}
```

- [ ] **Step 5: Verify visually**

Run: `cd quiver && yarn dev`

Navigate to a beach detail forecast. Verify:
- Day cards have subtle wave texture at bottom
- Cards fade-slide-up with stagger on load
- Existing tier colors still work
- Selected state ring still visible
- Scroll behavior still smooth

- [ ] **Step 6: Run tests**

Run: `cd quiver && yarn test -- --testPathPattern="horizon-strip\|forecast" 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 7: Commit**

```bash
git add quiver/components/forecast/horizon-strip.tsx
git commit -m "feat: add wave texture and staggered entry to horizon strip"
```

---

### Task 7: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `cd quiver && yarn typecheck 2>&1 | tail -10`
Expected: No type errors

- [ ] **Step 2: Run lint**

Run: `cd quiver && yarn lint 2>&1 | tail -10`
Expected: No lint errors

- [ ] **Step 3: Run unit tests**

Run: `cd quiver && yarn test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 4: Visual smoke test — beach listing page**

Run: `cd quiver && yarn dev`

Navigate to a beach listing. Verify:
- Beach cards: dark background, wave texture scrolling, orange border accent, legible text
- Animation count: only wave scroll running (1 ambient animation)

- [ ] **Step 5: Visual smoke test — beach detail page**

Navigate to a beach detail page. Verify:
- Forecast tab → Today: dark conditions container, topo texture drifting, 3 accent bars (orange/blue/gold)
- Horizon strip: wave texture at bottom of day cards, staggered entry
- Optimal conditions: gradient shift, static topo texture, neutral stat labels
- Animation count: topo drift + gradient shift = 2 ambient animations (within budget)
- No purple anywhere
- All text legible on dark backgrounds

- [ ] **Step 6: Reduced motion test**

In browser DevTools, enable "Prefers reduced motion" (Rendering tab). Verify:
- All ambient animations stop (textures static, gradient static)
- Hover interactions still work
- No visual breakage

- [ ] **Step 7: Mobile viewport test**

Resize browser to 375px width. Verify:
- Beach cards stack properly
- Conditions cards adapt (grid-cols-1 or similar)
- No horizontal overflow from texture elements
- Text sizes legible on mobile

- [ ] **Step 8: Commit all remaining changes (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration fixes for container personality system"
```
