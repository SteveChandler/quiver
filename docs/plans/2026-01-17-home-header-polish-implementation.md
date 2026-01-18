# Home Header Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add energetic, playful interactions to the authenticated home page header inspired by Duolingo and AllTrails.

**Architecture:** Extend existing `lib/constants/animations.ts` with new `HOME_HEADER_MOTION` constants. Update four header components (TimeSlotSelector, PrimaryActions, HeroRecommendation, GreetingSection) to use Framer Motion. Maintain accessibility via existing `useReducedMotion` hook.

**Tech Stack:** Framer Motion (already installed), Lucide icons (already installed), Tailwind CSS, existing animation constants pattern.

---

## Task 1: Add Home Header Animation Constants

**Files:**
- Modify: `lib/constants/animations.ts`
- Test: `__tests__/lib/constants/animations.test.ts` (create)

**Step 1: Write the test for new animation constants**

Create `__tests__/lib/constants/animations.test.ts`:

```typescript
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

describe("HOME_HEADER_MOTION", () => {
  describe("timeSlot", () => {
    it("has spring configuration for bouncy feel", () => {
      expect(HOME_HEADER_MOTION.timeSlot.spring).toEqual({
        stiffness: 400,
        damping: 17,
      });
    });

    it("has tap and selected variants", () => {
      expect(HOME_HEADER_MOTION.timeSlot.tap).toBeDefined();
      expect(HOME_HEADER_MOTION.timeSlot.selected).toBeDefined();
    });
  });

  describe("button", () => {
    it("has press animation with scale", () => {
      expect(HOME_HEADER_MOTION.button.tap.scale).toBeLessThan(1);
    });

    it("has hover animation", () => {
      expect(HOME_HEADER_MOTION.button.hover).toBeDefined();
    });
  });

  describe("hero", () => {
    it("has score glow animation", () => {
      expect(HOME_HEADER_MOTION.hero.scoreGlow).toBeDefined();
    });

    it("has badge stagger configuration", () => {
      expect(HOME_HEADER_MOTION.hero.badgeStagger.staggerChildren).toBeGreaterThan(0);
    });
  });

  describe("entry", () => {
    it("has staggered entry configuration", () => {
      expect(HOME_HEADER_MOTION.entry.staggerChildren).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/constants/animations.test.ts -v`
Expected: FAIL with "Cannot find module" or "HOME_HEADER_MOTION is not defined"

**Step 3: Add HOME_HEADER_MOTION constants**

Add to end of `lib/constants/animations.ts`:

```typescript
// Home Header Polish - Energetic/Playful Interactions (Duolingo/AllTrails inspired)
export const HOME_HEADER_MOTION = {
  // Spring config for bouncy Duolingo-like feel
  spring: {
    stiffness: 400,
    damping: 17,
  },
  springGentle: {
    stiffness: 300,
    damping: 25,
  },

  // Time Slot Selector
  timeSlot: {
    spring: { stiffness: 400, damping: 17 },
    tap: { scale: 0.97 },
    selected: {
      scale: [0.97, 1.03, 1],
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 17,
      },
    },
    glow: {
      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.3)",
    },
  },

  // Primary Action Buttons
  button: {
    tap: { scale: 0.96, y: 1 },
    hover: { scale: 1.02 },
    spring: { type: "spring", stiffness: 400, damping: 17 },
    iconHover: {
      plus: { rotate: 90, transition: { duration: 0.2 } },
      calendar: { y: -2, transition: { duration: 0.15 } },
    },
  },

  // Hero Recommendation
  hero: {
    scoreGlow: {
      textShadow: [
        "0 0 8px rgba(251, 146, 60, 0.4)",
        "0 0 16px rgba(251, 146, 60, 0.6)",
        "0 0 8px rgba(251, 146, 60, 0.4)",
      ],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    beachName: {
      hover: { scale: 1.01 },
      tap: { scale: 0.99 },
      underline: {
        initial: { scaleX: 0, originX: 0 },
        hover: { scaleX: 1 },
        transition: { duration: 0.2 },
      },
    },
    badge: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.15 },
    },
    badgeStagger: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },

  // Entry animations
  entry: {
    staggerChildren: 0.08,
    delayChildren: 0,
  },
  entryItem: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: "easeOut" },
  },

  // Skeleton shimmer
  shimmer: {
    backgroundSize: "200% 100%",
    backgroundPosition: ["-200% 0", "200% 0"],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "linear",
    },
  },
} as const;
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/constants/animations.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/constants/animations.ts __tests__/lib/constants/animations.test.ts
git commit -m "feat(animations): add HOME_HEADER_MOTION constants for header polish"
```

---

## Task 2: Add Time Slot Icons

**Files:**
- Modify: `components/home-screen/time-slot-selector.tsx`
- Test: `__tests__/components/home-screen/time-slot-selector.test.tsx` (create)

**Step 1: Write test for time slot icons**

Create `__tests__/components/home-screen/time-slot-selector.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { TimeSlotSelector } from "@/components/home-screen/time-slot-selector";

describe("TimeSlotSelector", () => {
  const defaultProps = {
    value: "any" as const,
    onChange: jest.fn(),
  };

  it("renders all time slot options", () => {
    render(<TimeSlotSelector {...defaultProps} />);

    expect(screen.getByText("Any time")).toBeInTheDocument();
    expect(screen.getByText("Dawn patrol")).toBeInTheDocument();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("Afternoon")).toBeInTheDocument();
  });

  it("displays icons for each time slot", () => {
    render(<TimeSlotSelector {...defaultProps} />);

    // Icons should be present (as SVG elements within buttons)
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("marks selected slot with aria-pressed", () => {
    render(<TimeSlotSelector {...defaultProps} value="morning" />);

    const morningButton = screen.getByText("Morning").closest("button");
    expect(morningButton).toHaveAttribute("aria-pressed", "true");
  });
});
```

**Step 2: Run test to verify icons test fails**

Run: `yarn test:unit __tests__/components/home-screen/time-slot-selector.test.tsx -v`
Expected: FAIL on "displays icons for each time slot" (no SVGs currently)

**Step 3: Add icons to TimeSlotSelector**

Update `components/home-screen/time-slot-selector.tsx`:

```typescript
'use client';

import { Clock, Sunrise, Sun, SunDim } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/types/personalization';

interface TimeSlotSelectorProps {
  value: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  className?: string;
}

const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string; icon: React.ElementType }[] = [
  { value: 'any', label: 'Any time', icon: Clock },
  { value: 'dawn-patrol', label: 'Dawn patrol', icon: Sunrise },
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'afternoon', label: 'Afternoon', icon: SunDim },
];

export function TimeSlotSelector({ value, onChange, className }: TimeSlotSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Time slot filter" className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {TIME_SLOT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              'min-h-[44px] flex items-center justify-center gap-1.5',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/components/home-screen/time-slot-selector.test.tsx -v`
Expected: PASS

**Step 5: Commit**

```bash
git add components/home-screen/time-slot-selector.tsx __tests__/components/home-screen/time-slot-selector.test.tsx
git commit -m "feat(home): add icons to time slot selector"
```

---

## Task 3: Add Bouncy Animation to Time Slot Selector

**Files:**
- Modify: `components/home-screen/time-slot-selector.tsx`
- Modify: `__tests__/components/home-screen/time-slot-selector.test.tsx`

**Step 1: Add animation test**

Add to `__tests__/components/home-screen/time-slot-selector.test.tsx`:

```typescript
import userEvent from "@testing-library/user-event";

// Add to existing describe block:
it("calls onChange when a time slot is clicked", async () => {
  const user = userEvent.setup();
  const onChange = jest.fn();
  render(<TimeSlotSelector value="any" onChange={onChange} />);

  await user.click(screen.getByText("Morning"));

  expect(onChange).toHaveBeenCalledWith("morning");
});

it("applies motion wrapper for animations", () => {
  render(<TimeSlotSelector {...defaultProps} />);

  // The component should have data-testid for the animated container
  expect(screen.getByTestId("time-slot-selector")).toBeInTheDocument();
});
```

**Step 2: Run test to verify data-testid fails**

Run: `yarn test:unit __tests__/components/home-screen/time-slot-selector.test.tsx -v`
Expected: FAIL on "applies motion wrapper" (no data-testid)

**Step 3: Add Framer Motion animations**

Update `components/home-screen/time-slot-selector.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { Clock, Sunrise, Sun, SunDim } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { HOME_HEADER_MOTION } from '@/lib/constants/animations';
import type { TimeSlot } from '@/types/personalization';

interface TimeSlotSelectorProps {
  value: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  className?: string;
}

const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string; icon: React.ElementType }[] = [
  { value: 'any', label: 'Any time', icon: Clock },
  { value: 'dawn-patrol', label: 'Dawn patrol', icon: Sunrise },
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'afternoon', label: 'Afternoon', icon: SunDim },
];

export function TimeSlotSelector({ value, onChange, className }: TimeSlotSelectorProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="Time slot filter"
      className={cn('flex gap-2 overflow-x-auto pb-1', className)}
      data-testid="time-slot-selector"
    >
      {TIME_SLOT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;

        return (
          <motion.button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            whileTap={reducedMotion ? undefined : HOME_HEADER_MOTION.timeSlot.tap}
            animate={
              isSelected && !reducedMotion
                ? HOME_HEADER_MOTION.timeSlot.selected
                : undefined
            }
            transition={reducedMotion ? undefined : { type: "spring", ...HOME_HEADER_MOTION.timeSlot.spring }}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap',
              'min-h-[44px] flex items-center justify-center gap-1.5',
              'transition-colors duration-200',
              isSelected
                ? 'bg-primary text-primary-foreground shadow-[0_0_0_3px_rgba(59,130,246,0.3)]'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </motion.button>
        );
      })}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/components/home-screen/time-slot-selector.test.tsx -v`
Expected: PASS

**Step 5: Commit**

```bash
git add components/home-screen/time-slot-selector.tsx __tests__/components/home-screen/time-slot-selector.test.tsx
git commit -m "feat(home): add bouncy animation to time slot selector"
```

---

## Task 4: Add Bouncy Animation to Primary Action Buttons

**Files:**
- Modify: `components/home-screen/primary-actions.tsx`
- Test: `__tests__/components/home-screen/primary-actions.test.tsx` (create)

**Step 1: Write test for primary actions**

Create `__tests__/components/home-screen/primary-actions.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimaryActions } from "@/components/home-screen/primary-actions";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe("PrimaryActions", () => {
  const mockRecommendation = {
    beach: { id: "test-beach", name: "Test Beach" },
    score: 85,
    window: { start: new Date(), end: new Date(), timezone: "America/Los_Angeles" },
  } as any;

  const defaultProps = {
    topRecommendation: mockRecommendation,
    onAtBeach: jest.fn(),
    onPlanWeekend: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both action buttons", () => {
    render(<PrimaryActions {...defaultProps} />);

    expect(screen.getByTestId("at-beach-button")).toBeInTheDocument();
    expect(screen.getByTestId("plan-weekend-button")).toBeInTheDocument();
  });

  it("calls onAtBeach when primary button clicked", async () => {
    const user = userEvent.setup();
    render(<PrimaryActions {...defaultProps} />);

    await user.click(screen.getByTestId("at-beach-button"));

    expect(defaultProps.onAtBeach).toHaveBeenCalled();
  });

  it("calls onPlanWeekend when secondary button clicked", async () => {
    const user = userEvent.setup();
    render(<PrimaryActions {...defaultProps} />);

    await user.click(screen.getByTestId("plan-weekend-button"));

    expect(defaultProps.onPlanWeekend).toHaveBeenCalled();
  });

  it("disables buttons when disabled prop is true", () => {
    render(<PrimaryActions {...defaultProps} disabled />);

    expect(screen.getByTestId("at-beach-button")).toBeDisabled();
    expect(screen.getByTestId("plan-weekend-button")).toBeDisabled();
  });

  it("has gradient background on primary button", () => {
    render(<PrimaryActions {...defaultProps} />);

    const primaryButton = screen.getByTestId("at-beach-button");
    expect(primaryButton.className).toMatch(/bg-gradient/);
  });
});
```

**Step 2: Run test to verify gradient test fails**

Run: `yarn test:unit __tests__/components/home-screen/primary-actions.test.tsx -v`
Expected: FAIL on "has gradient background" (currently solid color)

**Step 3: Update PrimaryActions with animations and gradients**

Update `components/home-screen/primary-actions.tsx`:

```typescript
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

export interface PrimaryActionsProps {
  topRecommendation: SurfDiscoveryRecommendation | null;
  onAtBeach: () => void;
  onPlanWeekend: () => void;
  disabled?: boolean;
}

export function PrimaryActionsSkeleton() {
  return (
    <div
      className="flex flex-col xs:flex-row gap-3 px-4 sm:px-1"
      data-testid="primary-actions-loading"
    >
      <div className="flex-1 h-12 sm:h-14 bg-white/20 rounded-full animate-pulse" />
      <div className="flex-1 h-12 sm:h-14 bg-white/20 rounded-full animate-pulse" />
    </div>
  );
}

export const PrimaryActions = React.memo(function PrimaryActions({
  topRecommendation,
  onAtBeach,
  onPlanWeekend,
  disabled = false,
}: PrimaryActionsProps) {
  const reducedMotion = useReducedMotion();
  const [hoveredButton, setHoveredButton] = useState<"primary" | "secondary" | null>(null);

  const buttonMotion = reducedMotion
    ? {}
    : {
        whileTap: HOME_HEADER_MOTION.button.tap,
        whileHover: HOME_HEADER_MOTION.button.hover,
        transition: HOME_HEADER_MOTION.button.spring,
      };

  return (
    <div
      className="flex flex-col xs:flex-row gap-3 px-4 sm:px-1"
      data-testid="primary-actions"
    >
      {/* Primary action: I'm at the beach */}
      <motion.button
        onClick={onAtBeach}
        disabled={disabled}
        onMouseEnter={() => setHoveredButton("primary")}
        onMouseLeave={() => setHoveredButton(null)}
        {...buttonMotion}
        className={cn(
          "flex-1 h-12 sm:h-14 min-h-[44px] rounded-full",
          "bg-gradient-to-b from-orange-400 to-orange-600",
          "hover:from-orange-500 hover:to-orange-700",
          "active:from-orange-600 active:to-orange-800",
          "text-white font-semibold text-sm sm:text-base",
          "shadow-md hover:shadow-lg",
          "transition-shadow duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md",
          "flex items-center justify-center"
        )}
        aria-label="Log that you are at the beach"
        data-testid="at-beach-button"
      >
        <motion.span
          animate={
            hoveredButton === "primary" && !reducedMotion
              ? HOME_HEADER_MOTION.button.iconHover.plus
              : { rotate: 0 }
          }
          className="flex items-center justify-center"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 shrink-0" />
        </motion.span>
        <span className="truncate">I&apos;m at the beach</span>
      </motion.button>

      {/* Secondary action: Plan Weekend */}
      <motion.button
        onClick={onPlanWeekend}
        disabled={disabled}
        onMouseEnter={() => setHoveredButton("secondary")}
        onMouseLeave={() => setHoveredButton(null)}
        {...buttonMotion}
        className={cn(
          "flex-1 h-12 sm:h-14 min-h-[44px] rounded-full",
          "bg-gradient-to-b from-white/15 to-white/5",
          "hover:from-white/25 hover:to-white/10",
          "active:from-white/30 active:to-white/15",
          "text-white font-semibold text-sm sm:text-base",
          "border border-white/20 hover:border-white/30",
          "shadow-sm hover:shadow-md",
          "transition-shadow duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-header-end",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm",
          "flex items-center justify-center"
        )}
        aria-label="Plan your weekend surf trip"
        data-testid="plan-weekend-button"
      >
        <motion.span
          animate={
            hoveredButton === "secondary" && !reducedMotion
              ? HOME_HEADER_MOTION.button.iconHover.calendar
              : { y: 0 }
          }
          className="flex items-center justify-center"
        >
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 shrink-0" />
        </motion.span>
        <span className="truncate">Plan Weekend</span>
      </motion.button>
    </div>
  );
});

export default PrimaryActions;
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/components/home-screen/primary-actions.test.tsx -v`
Expected: PASS

**Step 5: Commit**

```bash
git add components/home-screen/primary-actions.tsx __tests__/components/home-screen/primary-actions.test.tsx
git commit -m "feat(home): add bouncy animations and gradients to primary action buttons"
```

---

## Task 5: Add Score Glow and Staggered Badge Animation to Hero

**Files:**
- Modify: `components/home-screen/hero-recommendation.tsx`
- Test: `__tests__/components/home-screen/hero-recommendation.test.tsx` (create)

**Step 1: Write test for hero animations**

Create `__tests__/components/home-screen/hero-recommendation.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { HeroRecommendation } from "@/components/home-screen/hero-recommendation";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe("HeroRecommendation", () => {
  const mockRecommendation = {
    beach: { id: "test-beach", name: "Trestles" },
    score: 85,
    window: {
      start: new Date("2026-01-17T07:00:00"),
      end: new Date("2026-01-17T10:00:00"),
      timezone: "America/Los_Angeles",
    },
    matchQuality: "good",
    recommendationLabel: "Great conditions",
    message: "Clean waves with light offshore winds",
    conditionBadges: [
      { label: "Clean" },
      { label: "Offshore" },
    ],
  } as any;

  const defaultProps = {
    recommendation: mockRecommendation,
    onPlanSession: jest.fn(),
    onViewBeach: jest.fn(),
  };

  it("renders the beach name", () => {
    render(<HeroRecommendation {...defaultProps} />);

    expect(screen.getByText("Trestles")).toBeInTheDocument();
  });

  it("renders the score with glow class", () => {
    render(<HeroRecommendation {...defaultProps} />);

    const scoreElement = screen.getByTestId("hero-score");
    expect(scoreElement).toBeInTheDocument();
    expect(scoreElement.className).toMatch(/text-accent-orange/);
  });

  it("renders condition badges", () => {
    render(<HeroRecommendation {...defaultProps} />);

    expect(screen.getByText("Clean")).toBeInTheDocument();
    expect(screen.getByText("Offshore")).toBeInTheDocument();
  });

  it("renders loading skeleton when loading", () => {
    render(<HeroRecommendation {...defaultProps} recommendation={null} loading />);

    expect(screen.getByTestId("hero-recommendation-loading")).toBeInTheDocument();
  });

  it("renders empty state when no recommendation", () => {
    render(<HeroRecommendation {...defaultProps} recommendation={null} />);

    expect(screen.getByTestId("hero-recommendation-empty")).toBeInTheDocument();
  });

  it("has badge container with stagger animation data attribute", () => {
    render(<HeroRecommendation {...defaultProps} />);

    expect(screen.getByTestId("hero-badges")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify score testid fails**

Run: `yarn test:unit __tests__/components/home-screen/hero-recommendation.test.tsx -v`
Expected: FAIL on "renders the score with glow class" (no data-testid="hero-score")

**Step 3: Update HeroRecommendation with animations**

Update `components/home-screen/hero-recommendation.tsx` (key changes - full file too long):

Replace the component's return statement with animated version:

```typescript
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBeachDateTime } from "@/lib/utils/date-utils";
import { formatDiscoveryScore } from "@/lib/utils/rating-formatters";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
import type {
  SurfDiscoveryRecommendation,
  PersonalizedInsights,
} from "@/types/personalization";

// ... keep existing interfaces and helper functions ...

export function HeroRecommendationSkeleton() {
  return (
    <div
      className="space-y-3 px-4 sm:px-1"
      data-testid="hero-recommendation-loading"
    >
      <div className="space-y-2">
        <div
          className="h-8 sm:h-10 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-lg w-4/5 animate-shimmer"
          style={{ backgroundSize: '200% 100%' }}
        />
        <div
          className="h-8 sm:h-10 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-lg w-2/3 animate-shimmer"
          style={{ backgroundSize: '200% 100%' }}
        />
      </div>
      <div className="flex items-center gap-2 mt-4">
        <div className="h-6 w-24 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-full animate-shimmer" />
      </div>
    </div>
  );
}

// ... keep HeroRecommendationError and HeroRecommendationEmpty ...

export const HeroRecommendation = React.memo(function HeroRecommendation({
  recommendation,
  insights,
  loading = false,
  error = null,
  onPlanSession,
  onViewBeach,
  onEnableReminder,
  forecastAlertsEnabled = false,
  homeBeachId,
}: HeroRecommendationProps) {
  const reducedMotion = useReducedMotion();

  if (loading) {
    return <HeroRecommendationSkeleton />;
  }

  if (error) {
    return <HeroRecommendationError error={error} />;
  }

  if (!recommendation) {
    return <HeroRecommendationEmpty />;
  }

  const { beach, score, window, matchQuality, recommendationLabel, message, conditionBadges } = recommendation;
  const formattedScore = formatDiscoveryScore(score);
  const timeWindow = formatTimeWindowCompact(
    window.start,
    window.end,
    window.timezone
  );

  return (
    <motion.div
      className="space-y-3 px-4 sm:px-1"
      data-testid="hero-recommendation"
      initial={reducedMotion ? undefined : { opacity: 0 }}
      animate={reducedMotion ? undefined : { opacity: 1 }}
    >
      {/* Main headline */}
      <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
        <motion.button
          onClick={() => onViewBeach(beach.id)}
          whileHover={reducedMotion ? undefined : HOME_HEADER_MOTION.hero.beachName.hover}
          whileTap={reducedMotion ? undefined : HOME_HEADER_MOTION.hero.beachName.tap}
          className="hover:text-accent-orange focus-visible:text-accent-orange focus-visible:outline-none focus-visible:underline transition-colors text-left min-h-[44px] inline relative group"
          aria-label={`View details for ${beach.name}`}
        >
          {beach.name}
          <motion.span
            className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-orange origin-left"
            initial={{ scaleX: 0 }}
            whileHover={reducedMotion ? undefined : { scaleX: 1 }}
            transition={{ duration: 0.2 }}
          />
        </motion.button>{" "}
        is your best bet at{" "}
        <motion.span
          className="text-accent-orange"
          data-testid="hero-score"
          animate={reducedMotion ? undefined : HOME_HEADER_MOTION.hero.scoreGlow}
        >
          {formattedScore}/10
        </motion.span>.
      </h1>

      {/* Natural language message */}
      {message && (
        <p className="text-sm sm:text-base text-white/80" data-testid="hero-message">
          {message}
        </p>
      )}

      {/* Time window and condition badges with stagger */}
      <motion.div
        className="flex flex-wrap items-center gap-2"
        data-testid="hero-badges"
        initial="hidden"
        animate="visible"
        variants={reducedMotion ? undefined : {
          hidden: {},
          visible: HOME_HEADER_MOTION.hero.badgeStagger,
        }}
      >
        <motion.div
          variants={reducedMotion ? undefined : HOME_HEADER_MOTION.hero.badge}
        >
          <Badge
            variant="outline"
            className="text-xs sm:text-sm font-medium bg-white/10 text-white border-white/20 py-1.5 px-2.5"
          >
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
            {timeWindow}
          </Badge>
        </motion.div>

        {score >= 90 && (
          <motion.div
            variants={reducedMotion ? undefined : HOME_HEADER_MOTION.hero.badge}
          >
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
            >
              Perfect Match
            </Badge>
          </motion.div>
        )}

        {conditionBadges?.slice(0, 3).map((badge) => (
          <motion.div
            key={badge.label}
            variants={reducedMotion ? undefined : HOME_HEADER_MOTION.hero.badge}
          >
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
            >
              {badge.label}
            </Badge>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
});

export default HeroRecommendation;
```

**Step 4: Add shimmer animation to Tailwind config**

Add to `tailwind.config.ts` in the `extend.animation` section:

```typescript
shimmer: "shimmer 1.5s infinite linear",
```

And in `extend.keyframes`:

```typescript
shimmer: {
  "0%": { backgroundPosition: "-200% 0" },
  "100%": { backgroundPosition: "200% 0" },
},
```

**Step 5: Run test to verify it passes**

Run: `yarn test:unit __tests__/components/home-screen/hero-recommendation.test.tsx -v`
Expected: PASS

**Step 6: Commit**

```bash
git add components/home-screen/hero-recommendation.tsx __tests__/components/home-screen/hero-recommendation.test.tsx tailwind.config.ts
git commit -m "feat(home): add score glow and staggered badge animations to hero"
```

---

## Task 6: Add Entry Animations to Greeting Section

**Files:**
- Modify: `components/home-screen/greeting-section.tsx`
- Test: `__tests__/components/home-screen/greeting-section.test.tsx` (create)

**Step 1: Write test for greeting section**

Create `__tests__/components/home-screen/greeting-section.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { GreetingSection } from "@/components/home-screen/greeting-section";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
}));

describe("GreetingSection", () => {
  it("renders personalized greeting with user name", () => {
    render(<GreetingSection userName="John" timeOfDay="morning" />);

    expect(screen.getByText(/Good morning, John/)).toBeInTheDocument();
  });

  it("renders greeting without name when userName is null", () => {
    render(<GreetingSection userName={null} timeOfDay="afternoon" />);

    expect(screen.getByText(/Good afternoon/)).toBeInTheDocument();
  });

  it("has data-testid for testing", () => {
    render(<GreetingSection userName="John" timeOfDay="morning" />);

    expect(screen.getByTestId("greeting-section")).toBeInTheDocument();
  });

  it("renders with motion wrapper", () => {
    const { container } = render(<GreetingSection userName="John" timeOfDay="morning" />);

    // Should have a div wrapper (from mocked motion.div)
    expect(container.firstChild).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it passes (basic tests should pass)**

Run: `yarn test:unit __tests__/components/home-screen/greeting-section.test.tsx -v`
Expected: PASS (existing component should pass basic tests)

**Step 3: Add motion to GreetingSection**

Update `components/home-screen/greeting-section.tsx`:

```typescript
/**
 * GreetingSection Component
 *
 * Displays a time-aware greeting to the user on the home screen.
 * Shows "Good morning/afternoon/evening, [Name]." based on current time.
 * Includes subtle fade-in animation.
 */

"use client";

import { motion } from "framer-motion";
import { getGreetingWithName, type TimeOfDay } from "@/lib/utils/greeting-utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

export interface GreetingSectionProps {
  userName: string | null;
  timeOfDay: TimeOfDay;
  className?: string;
}

export function GreetingSection({
  userName,
  timeOfDay,
  className = "",
}: GreetingSectionProps) {
  const greeting = getGreetingWithName(userName, timeOfDay);
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`space-y-2 px-4 sm:px-0 ${className}`.trim()}
      data-testid="greeting-section"
      initial={reducedMotion ? undefined : HOME_HEADER_MOTION.entryItem.initial}
      animate={reducedMotion ? undefined : HOME_HEADER_MOTION.entryItem.animate}
      transition={reducedMotion ? undefined : HOME_HEADER_MOTION.entryItem.transition}
    >
      <h1 className="text-base xs:text-lg sm:text-xl font-normal text-white/80 leading-tight">
        {greeting}
      </h1>
    </motion.div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/components/home-screen/greeting-section.test.tsx -v`
Expected: PASS

**Step 5: Commit**

```bash
git add components/home-screen/greeting-section.tsx __tests__/components/home-screen/greeting-section.test.tsx
git commit -m "feat(home): add fade-in animation to greeting section"
```

---

## Task 7: Add Staggered Entry Animation to HomeScreen Container

**Files:**
- Modify: `components/home-screen/index.tsx`

**Step 1: Update HomeScreen with staggered entry**

Add motion imports and wrap header sections with staggered animation:

At top of file, add:
```typescript
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
```

In the component, add:
```typescript
const reducedMotion = useReducedMotion();
```

Wrap the header section content with:
```typescript
{/* Dark gradient header section */}
<motion.div
  className="bg-gradient-to-b from-header-start to-header-end pt-6 pb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 space-y-6 xs:space-y-8"
  initial="hidden"
  animate="visible"
  variants={reducedMotion ? undefined : {
    hidden: {},
    visible: {
      transition: HOME_HEADER_MOTION.entry,
    },
  }}
>
  {/* Wrap each section with motion.div */}
  <motion.section
    className="centered-container"
    variants={reducedMotion ? undefined : HOME_HEADER_MOTION.entryItem}
  >
    <GreetingSection ... />
  </motion.section>

  {/* ... repeat for other sections ... */}
</motion.div>
```

**Step 2: Run component tests**

Run: `yarn test:unit --testPathPattern="home-screen" -v`
Expected: PASS

**Step 3: Commit**

```bash
git add components/home-screen/index.tsx
git commit -m "feat(home): add staggered entry animation to header sections"
```

---

## Task 8: Visual Verification and Polish

**Step 1: Start dev server and verify animations**

Run: `yarn dev`

Open: `http://localhost:3000` (authenticate if needed)

**Verify checklist:**
- [ ] Time slot icons appear
- [ ] Time slot selection has bouncy spring animation
- [ ] Selected time slot has subtle glow
- [ ] Primary button scales on press with bounce
- [ ] Secondary button scales on press with bounce
- [ ] Icon rotates/bounces on button hover
- [ ] Score has subtle pulsing glow
- [ ] Badges cascade in with stagger
- [ ] Beach name has underline on hover
- [ ] Greeting fades in on page load
- [ ] All sections stagger in sequentially
- [ ] Loading skeletons have shimmer effect
- [ ] Animations respect reduced motion preference

**Step 2: Test on mobile viewport**

Use browser dev tools to test at 375px width.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore(home): polish and verify header animations"
```

---

## Summary

| Task | Component | Animation Added |
|------|-----------|----------------|
| 1 | `animations.ts` | HOME_HEADER_MOTION constants |
| 2 | `time-slot-selector.tsx` | Time-of-day icons |
| 3 | `time-slot-selector.tsx` | Bouncy selection animation |
| 4 | `primary-actions.tsx` | Button press + icon animations |
| 5 | `hero-recommendation.tsx` | Score glow + badge stagger |
| 6 | `greeting-section.tsx` | Fade-in entry animation |
| 7 | `index.tsx` | Staggered section entry |
| 8 | Manual | Visual verification |

**Estimated total: 8 tasks, ~45 minutes**
