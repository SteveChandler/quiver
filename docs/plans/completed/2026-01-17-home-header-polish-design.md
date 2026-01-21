# Home Header Polish Design

**Date:** 2026-01-17
**Status:** Draft
**Goal:** Polish the authenticated home page header with energetic, playful interactions inspired by Duolingo and AllTrails.

## Overview

The authenticated home page header includes:
- Greeting section ("Good morning, John.")
- Time slot selector (Any time, Dawn patrol, Morning, Afternoon)
- Hero recommendation (beach name + score + badges)
- Primary action buttons (I'm at the beach, Plan Weekend)

Current state: Functional but static. Lacks the satisfying feedback and personality expected from a modern mobile-first app.

Target vibe: **Energetic and playful** — bouncy animations, pronounced feedback, surfing personality.

## Design Specifications

### 1. Time Slot Selector

**Current:** Plain pills with basic color swap on selection.

**Enhancements:**

#### 1.1 Time-of-day Icons
Add icons to make options scannable and add personality:
- Any time → `Clock` icon
- Dawn patrol → `Sunrise` icon
- Morning → `Sun` icon
- Afternoon → `SunDim` or sun with rays icon

Icons should be 14-16px, positioned before the label with 6px gap.

#### 1.2 Bouncy Selection Animation
When tapping a time slot:
```
Press down:   scale(0.97)  → 50ms
Release:      scale(1.03)  → 100ms, ease-out-back
Settle:       scale(1.0)   → 50ms
```

Framer Motion config:
```typescript
const springConfig = { stiffness: 400, damping: 17 };
```

#### 1.3 Selected State Glow
Active pill gets a subtle outer glow:
```css
box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.3);
```

#### 1.4 Unselected Transition
Other pills fade gently (200ms) rather than snapping to avoid jarring state changes.

---

### 2. Primary Action Buttons

**Current:** Basic hover/active states with opacity changes. Functional but flat.

**Enhancements:**

#### 2.1 Bouncy Press Animation
Same spring physics as time slots:
```
Press:    scale(0.96), shadow reduced
Release:  scale(1.02) overshoot, then settle to 1.0
```

#### 2.2 Gradient Backgrounds
Replace flat colors with subtle gradients:

**Primary button (I'm at the beach):**
```css
background: linear-gradient(to bottom, #fb923c, #ea580c);
/* orange-400 → orange-600 */
```

**Secondary button (Plan Weekend):**
Keep frosted glass (`bg-white/10`) but add top highlight:
```css
background: linear-gradient(
  to bottom,
  rgba(255, 255, 255, 0.15),
  rgba(255, 255, 255, 0.05)
);
```

#### 2.3 Icon Micro-animations
On hover/focus:
- **Plus icon:** Rotate 90° (transform: rotate(90deg), 200ms)
- **Calendar icon:** Subtle bounce (translateY -2px and back, 300ms)

#### 2.4 Ripple Effect
Soft radial ripple on tap:
- Expands from touch point
- White at 20% opacity
- 400ms duration, eases out
- More organic than Material Design's sharp ripple

#### 2.5 Pressed State Depth
When pressed:
- Reduced shadow (shadow-sm → shadow-none)
- 1px translateY for "sinking" feel
- Darker gradient tint

---

### 3. Hero Recommendation

**Current:** Static headline with instant badge appearance.

**Enhancements:**

#### 3.1 Score Highlight Treatment
The score ("/10" value) deserves celebration:

**Pulsing glow:**
```css
@keyframes score-glow {
  0%, 100% { text-shadow: 0 0 8px rgba(251, 146, 60, 0.4); }
  50% { text-shadow: 0 0 16px rgba(251, 146, 60, 0.6); }
}
animation: score-glow 2s ease-in-out infinite;
```

**Count-up on mount:**
- Score animates from 0 to final value over 600ms
- Use `useCountUp` hook or Framer Motion's `useSpring`
- Easing: ease-out for satisfying settle

**High score sparkle (8+):**
- Optional: subtle CSS sparkle/shine effect
- Or a small particle burst on mount

#### 3.2 Staggered Badge Entrance
Badges cascade in with staggered timing:
```typescript
const badgeVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 }
};

const containerVariants = {
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};
```

Order: Time badge → Perfect Match badge → Condition badges

#### 3.3 Beach Name Interaction
When hovering/tapping the beach name:
- Underline slides in from left (scaleX 0 → 1, origin left)
- Color transitions to accent orange
- Subtle scale up (1.01) with spring easing
- Makes it feel tappable and alive

```typescript
const nameVariants = {
  hover: { scale: 1.01 },
  tap: { scale: 0.99 }
};
```

#### 3.4 Loading Skeleton Polish
Replace static pulse with shimmer:
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
background: linear-gradient(
  90deg,
  rgba(255,255,255,0.1) 25%,
  rgba(255,255,255,0.2) 50%,
  rgba(255,255,255,0.1) 75%
);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;
```

---

### 4. General Visual Accents

#### 4.1 Wave Pattern Overlay
Faint wave texture in header gradient:
- SVG pattern or CSS background
- 5-8% opacity
- Adds depth without competing with content
- Reinforces surf brand

#### 4.2 Ambient Gradient Animation
Header gradient slowly shifts/breathes:
```css
@keyframes gradient-breathe {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
background-size: 200% 200%;
animation: gradient-breathe 20s ease-in-out infinite;
```

Should pause when user is scrolling (performance + focus).

#### 4.3 Entry Animations on Page Load
Staggered content reveal:
```
0ms:    Greeting fades in
80ms:   Time slots slide up
160ms:  Hero headline reveals
240ms:  Badges cascade
320ms:  Buttons fade in
```

Total under 400ms — quick but intentional.

#### 4.4 Scroll-linked Header Compression
As user scrolls down:
- Header height reduces (pb-8 → pb-4)
- Greeting fades out (opacity 1 → 0)
- Creates more room for content
- Use CSS `position: sticky` with scroll-driven effects or Framer Motion's `useScroll`

#### 4.5 Weather-aware Accent Colors (Optional)
Dynamic gradient tinting based on conditions:
- Epic conditions → warm golden tint
- Stormy/poor → cooler blue tones
- Reinforces the "live" feel

Lower priority — implement after core polish.

---

## Technical Implementation

### Dependencies
- **Framer Motion** (already installed) — spring animations, variants, gestures
- **Lucide icons** (already installed) — time-of-day icons

### Animation Constants
Create shared animation config:
```typescript
// lib/animation-config.ts
export const springBouncy = { stiffness: 400, damping: 17 };
export const springGentle = { stiffness: 300, damping: 25 };
export const durationFast = 0.15;
export const durationMedium = 0.25;
```

### Component Changes
1. `time-slot-selector.tsx` — Add motion, icons, glow
2. `primary-actions.tsx` — Add motion, gradients, ripple
3. `hero-recommendation.tsx` — Add stagger, count-up, glow
4. `greeting-section.tsx` — Add fade-in animation
5. `index.tsx` — Add scroll-linked header behavior

### New Components/Hooks
- `useCountUp` hook (or use Framer Motion's useSpring)
- `Ripple` component for button tap effect
- `ShimmerSkeleton` component for loading states

---

## Testing Considerations

- Test animations on low-end devices (reduce motion if needed)
- Respect `prefers-reduced-motion` media query
- Verify touch targets remain 44x44px minimum
- Test animation performance on iOS Safari
- Ensure no layout shift (CLS) during animations

---

## Success Criteria

- [ ] Time slots feel bouncy and responsive
- [ ] Buttons have satisfying press feedback
- [ ] Score reveal creates a small "moment"
- [ ] Badges cascade smoothly on load
- [ ] Header feels alive without being distracting
- [ ] Animations respect reduced motion preferences
- [ ] No performance regression on mobile

---

## Open Questions

1. Should wave pattern be static or subtly animated?
2. How prominent should the score glow be?
3. Weather-aware colors: worth the complexity?

---

## References

- [Duolingo](https://duolingo.com) — bouncy spring animations, celebration moments
- [AllTrails](https://alltrails.com) — outdoor polish, smooth transitions, scroll compression
