# Session Form Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the multi-step session wizard with a single scrollable, branded form for both Log and Plan modes, with sliders, visibility controls, and feed-insertion post-save.

**Architecture:** New `SessionScrollForm` component renders all sections inline (no steps/navigation). Existing section components (`LocationStep`, `ConditionsSection`, etc.) are composed vertically. New `SessionSlider` and `VisibilitySection` components are added. Post-save navigates to profile with highlight param instead of modal overlay. All existing server actions, data builders, and submission logic are preserved.

**Tech Stack:** React 19, Next.js App Router, TypeScript, Tailwind CSS, Radix UI Slider (already installed), Framer Motion (for highlight animation), Supabase (migration for `muted` column).

**Design spec:** `docs/plans/2026-03-02-session-form-redesign.md`

---

## Task 1: Database Migration — Add `muted` Column

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_muted_to_sessions.sql`

**Step 1: Write the migration**

```sql
BEGIN;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS muted boolean DEFAULT false;

COMMENT ON COLUMN sessions.muted IS 'When true, session is public on profile but hidden from community feed';

COMMIT;
```

Use the Supabase MCP `apply_migration` tool with project ID from `.env` or `mcp__plugin_supabase_supabase__list_projects`. Name: `add_muted_to_sessions`.

**Step 2: Verify migration applied**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sessions' AND column_name = 'muted';
```

Expected: One row with `muted | boolean | false`.

**Step 3: Run security advisors**

Use `mcp__plugin_supabase_supabase__get_advisors` with type `security` to confirm no new RLS issues.

**Step 4: Commit**

```bash
git add supabase/migrations/*_add_muted_to_sessions.sql
git commit -m "feat(db): add muted column to sessions table"
```

---

## Task 2: Update Form State Types

**Files:**
- Modify: `hooks/use-session-form.ts` (lines 10-63 — `SessionFormState` type, lines ~150-200 — initial state)

**Step 1: Add `isPublic` and `isMuted` to `SessionFormState`**

In `hooks/use-session-form.ts`, add two fields to the `SessionFormState` type (after `tideStatus`):

```typescript
isPublic: boolean;
isMuted: boolean;
```

**Step 2: Set defaults in initial state**

In the initial state object inside `useSessionForm`, add:

```typescript
isPublic: true,
isMuted: false,
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No new errors related to `isPublic` or `isMuted`. (Existing errors may appear — only check for new ones.)

**Step 4: Commit**

```bash
git add hooks/use-session-form.ts
git commit -m "feat: add isPublic and isMuted to SessionFormState"
```

---

## Task 3: Build `SessionSlider` Component

**Files:**
- Create: `components/session-forms/SessionSlider.tsx`
- Test: `__tests__/components/session-forms/SessionSlider.test.tsx`

**Step 1: Write the test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionSlider } from "@/components/session-forms/SessionSlider";

describe("SessionSlider", () => {
  const labels = ["Flat", "Choppy", "Fun", "Good", "Firing"];
  const colors = ["#0D9488", "#F59E0B", "#EA580C"];

  it("renders with placeholder when no value set", () => {
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("Wave Quality")).toBeInTheDocument();
    expect(screen.getByText("Tap to rate")).toBeInTheDocument();
  });

  it("renders endpoint labels", () => {
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("Flat")).toBeInTheDocument();
    expect(screen.getByText("Firing")).toBeInTheDocument();
  });

  it("displays current label when value is set", () => {
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        value="3"
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("Fun")).toBeInTheDocument();
  });

  it("calls onChange when value changes", () => {
    const onChange = jest.fn();
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        value="3"
        onChange={onChange}
      />
    );
    // Radix slider renders with role="slider"
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/session-forms/SessionSlider.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found.

**Step 3: Implement `SessionSlider`**

Create `components/session-forms/SessionSlider.tsx`:

```tsx
"use client";

import React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SessionSliderProps {
  /** Display label above the slider */
  label: string;
  /** Labels for each stop (length determines number of stops) */
  labels: string[];
  /** Color ramp array — interpolated across the range. Minimum 2 colors. */
  colors: string[];
  /** Current value as string ("1"-"5") or undefined if unset */
  value?: string;
  /** Called with string value ("1"-"5") */
  onChange: (value: string) => void;
  /** Whether this is the hero/prominent slider */
  hero?: boolean;
  /** Optional icon to show next to the label */
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Interpolate between colors in the ramp based on a 0-1 progress value.
 */
function interpolateColor(colors: string[], progress: number): string {
  if (colors.length === 1) return colors[0];
  const segment = progress * (colors.length - 1);
  const index = Math.floor(segment);
  if (index >= colors.length - 1) return colors[colors.length - 1];
  return colors[index]; // Simplified: use nearest color stop
}

export function SessionSlider({
  label,
  labels,
  colors,
  value,
  onChange,
  hero = false,
  icon,
  className,
}: SessionSliderProps) {
  const numericValue = value ? parseInt(value, 10) : undefined;
  const isSet = numericValue !== undefined && !isNaN(numericValue);
  const max = labels.length;
  const progress = isSet ? (numericValue - 1) / (max - 1) : 0;
  const activeColor = isSet ? interpolateColor(colors, progress) : "#D1D5DB";
  const currentLabel = isSet ? labels[numericValue - 1] : undefined;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className={cn(
            "font-bold text-[#1A1A1A]",
            hero ? "text-base" : "text-sm"
          )}>
            {label}
          </span>
        </div>
        {isSet ? (
          <span
            className="text-sm font-semibold px-2 py-0.5 rounded-full"
            style={{ color: activeColor, backgroundColor: `${activeColor}15` }}
          >
            {currentLabel}
          </span>
        ) : (
          <span className="text-sm text-[#6B7280]">Tap to rate</span>
        )}
      </div>

      {/* Slider */}
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center"
        min={1}
        max={max}
        step={1}
        value={isSet ? [numericValue] : [1]}
        onValueChange={([val]) => onChange(String(val))}
        aria-label={label}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative w-full grow overflow-hidden rounded-full bg-gray-200",
            hero ? "h-3" : "h-2"
          )}
        >
          <SliderPrimitive.Range
            className="absolute h-full rounded-full transition-colors"
            style={{ backgroundColor: isSet ? activeColor : "#D1D5DB" }}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block rounded-full border-2 border-white shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-110",
            hero ? "h-7 w-7" : "h-6 w-6",
            !isSet && "opacity-0"
          )}
          style={{ backgroundColor: isSet ? activeColor : "#D1D5DB" }}
        />
      </SliderPrimitive.Root>

      {/* Endpoint labels */}
      <div className="flex justify-between text-xs text-[#6B7280] font-medium">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}
```

**Step 4: Run tests**

```bash
npx jest __tests__/components/session-forms/SessionSlider.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS.

**Step 5: Commit**

```bash
git add components/session-forms/SessionSlider.tsx __tests__/components/session-forms/SessionSlider.test.tsx
git commit -m "feat: add SessionSlider component with branded color ramps"
```

---

## Task 4: Build `VisibilitySection` Component

**Files:**
- Create: `components/session-forms/VisibilitySection.tsx`
- Test: `__tests__/components/session-forms/VisibilitySection.test.tsx`

**Step 1: Write the test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { VisibilitySection } from "@/components/session-forms/VisibilitySection";

describe("VisibilitySection", () => {
  it("renders with Public selected by default", () => {
    render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    const publicBtn = screen.getByRole("button", { name: /public/i });
    expect(publicBtn).toHaveAttribute("data-active", "true");
  });

  it("shows mute checkbox only when public", () => {
    const { rerender } = render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    expect(screen.getByText(/keep it off the feed/i)).toBeInTheDocument();

    rerender(
      <VisibilitySection
        isPublic={false}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    expect(screen.queryByText(/keep it off the feed/i)).not.toBeInTheDocument();
  });

  it("shows privacy note when private", () => {
    render(
      <VisibilitySection
        isPublic={false}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    expect(screen.getByText(/still help improve forecast accuracy/i)).toBeInTheDocument();
  });

  it("calls onPublicChange when toggling", () => {
    const onPublicChange = jest.fn();
    render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={onPublicChange}
        onMutedChange={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /just me/i }));
    expect(onPublicChange).toHaveBeenCalledWith(false);
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx jest __tests__/components/session-forms/VisibilitySection.test.tsx --no-coverage 2>&1 | tail -10
```

**Step 3: Implement `VisibilitySection`**

Create `components/session-forms/VisibilitySection.tsx`:

```tsx
"use client";

import React from "react";
import { Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface VisibilitySectionProps {
  isPublic: boolean;
  isMuted: boolean;
  onPublicChange: (isPublic: boolean) => void;
  onMutedChange: (isMuted: boolean) => void;
}

export function VisibilitySection({
  isPublic,
  isMuted,
  onPublicChange,
  onMutedChange,
}: VisibilitySectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
        Visibility
      </h3>

      {/* Segmented control */}
      <div className="flex rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          role="button"
          aria-label="Public"
          data-active={isPublic ? "true" : "false"}
          onClick={() => onPublicChange(true)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
            isPublic
              ? "bg-white text-[#1A1A1A] shadow-sm"
              : "text-[#6B7280] hover:text-[#1A1A1A]"
          )}
        >
          <Eye className="h-4 w-4" />
          Public
        </button>
        <button
          type="button"
          role="button"
          aria-label="Just me"
          data-active={!isPublic ? "true" : "false"}
          onClick={() => {
            onPublicChange(false);
            onMutedChange(false); // Reset muted when going private
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
            !isPublic
              ? "bg-white text-[#1A1A1A] shadow-sm"
              : "text-[#6B7280] hover:text-[#1A1A1A]"
          )}
        >
          <Lock className="h-4 w-4" />
          Just me
        </button>
      </div>

      {/* Mute checkbox (only when public) */}
      <AnimatePresence>
        {isPublic && (
          <motion.label
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-start gap-3 cursor-pointer overflow-hidden"
          >
            <input
              type="checkbox"
              checked={isMuted}
              onChange={(e) => onMutedChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <div>
              <span className="text-sm font-medium text-[#1A1A1A]">
                Keep it off the feed
              </span>
              <p className="text-xs text-[#6B7280]">
                Public on your profile, but won't show up in others' feeds
              </p>
            </div>
          </motion.label>
        )}
      </AnimatePresence>

      {/* Privacy note */}
      <AnimatePresence>
        {!isPublic && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-xs text-[#6B7280] overflow-hidden"
          >
            Private sessions still help improve forecast accuracy
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 4: Run tests**

```bash
npx jest __tests__/components/session-forms/VisibilitySection.test.tsx --no-coverage 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add components/session-forms/VisibilitySection.tsx __tests__/components/session-forms/VisibilitySection.test.tsx
git commit -m "feat: add VisibilitySection with public/private toggle and mute"
```

---

## Task 5: Build `SessionScrollForm` — Log Mode

This is the main component. It composes all existing section components into a single scrollable page.

**Files:**
- Create: `components/session-forms/SessionScrollForm.tsx`

**Step 1: Implement the component**

Create `components/session-forms/SessionScrollForm.tsx`. Key structure:

```tsx
"use client";

import React, { useState, useCallback } from "react";
import { useSessionForm, SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import { useAuth } from "@/context/auth-context";
import { LocationStep } from "./LocationStep";
import { DateTimeSection } from "./DateTimeSection";
import { EquipmentStep } from "./EquipmentStep";
import { ConditionsSection } from "./ConditionsSection";
import { PhotoSelectionSection } from "./PhotoSelectionSection";
import { NotesSection } from "./NotesSection";
import { GoalsSection } from "./GoalsSection";
import { SessionSlider } from "./SessionSlider";
import { VisibilitySection } from "./VisibilitySection";
import { WaveTypeSelector } from "@/components/ui/wave-type-selector";
import { FORECAST_ACCURACY_OPTIONS } from "./shared";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionScrollFormProps {
  initialMode: SessionFormMode;
  className?: string;
  onComplete?: (sessionData: any) => void | Promise<void>;
  onCancel?: () => void;
  initialFormState?: Partial<SessionFormState>;
}
```

**Layout structure** (inside the return):

- Sticky header: Cancel (X) left, title center, Save right
- `<div className="max-w-xl mx-auto px-4 pb-32">` (pb-32 for sticky save button clearance)
- Sections separated by `<hr className="border-gray-100 my-8" />`
- **Log mode sections**: Location+DateTime → Equipment → Conditions (objective inputs) → Sliders (wave quality, crowd, overall) + wave types → Forecast accuracy → Photos → Notes → Visibility
- **Plan mode sections**: Location+DateTime → Goals → Notes+Invites → Visibility
- Sticky bottom save button: `<div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t">`
- Save button: `className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg active:scale-[0.98] transition-transform"`

**Slider section** (log mode only, replaces star RatingInput calls):

```tsx
{/* How were the waves? */}
<section className="space-y-6">
  <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
    How were the waves?
  </h3>

  <SessionSlider
    label="Overall"
    labels={["Rough", "Meh", "Fun", "Great", "Epic"]}
    colors={["#9CA3AF", "#F59E0B", "#EA580C"]}
    value={formState.overallRating}
    onChange={(v) => updateField("overallRating", v)}
    hero
  />

  <SessionSlider
    label="Wave Quality"
    labels={["Flat", "Choppy", "Fun", "Good", "Firing"]}
    colors={["#0D9488", "#F59E0B", "#EA580C"]}
    value={formState.waveQuality}
    onChange={(v) => updateField("waveQuality", v)}
  />

  <SessionSlider
    label="Crowd"
    labels={["Empty", "Chill", "Moderate", "Busy", "Packed"]}
    colors={["#16A34A", "#FBBF24", "#DC2626"]}
    value={formState.crowdLevel}
    onChange={(v) => updateField("crowdLevel", v)}
  />

  <WaveTypeSelector
    selectedTypes={formState.waveTypes}
    onChange={(types) => updateField("waveTypes", types)}
  />
</section>
```

**Visibility section** (both modes):

```tsx
<VisibilitySection
  isPublic={formState.isPublic}
  isMuted={formState.isMuted}
  onPublicChange={(v) => updateField("isPublic", v)}
  onMutedChange={(v) => updateField("isMuted", v)}
/>
```

**Validation for save button**: Require `selectedBeachId` and `selectedDate` (same as current wizard). `isFormComplete` = both truthy.

**Data passthrough**: `onComplete` callback receives full `formState` plus `photos` array, same shape as current wizard's `sessionData` object. This ensures `useSessionSubmission` works unchanged.

**Key details:**
- Read `components/session-forms/ConditionsSection.tsx` — it already contains the objective condition inputs (wave height, wind, tide) AND the star ratings. The sliders in `SessionScrollForm` replace only the star ratings. The `ConditionsSection` will need its "Session Experience" section (lines 528-566) and "Wave Type" section (lines 569-578) and "Vibe/Notes" section (lines 581-595) removed since those move to the scroll form. Only keep: forecast comparison + actual conditions inputs + forecast accuracy.
- The component must NOT duplicate fields. Use `ConditionsSection` for objective data, `SessionSlider` for subjective ratings.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "SessionScrollForm" | head -10
```

**Step 3: Commit**

```bash
git add components/session-forms/SessionScrollForm.tsx
git commit -m "feat: add SessionScrollForm single scrollable page component"
```

---

## Task 6: Modify `ConditionsSection` — Remove Duplicate Sections

**Files:**
- Modify: `components/session-forms/ConditionsSection.tsx` (lines 527-661)

The `ConditionsSection` currently contains:
1. Forecast comparison (lines 271-357) — **KEEP**
2. Actual conditions inputs (lines 359-524) — **KEEP**
3. Experience Ratings / stars (lines 527-566) — **REMOVE** (replaced by sliders in scroll form)
4. Wave Types (lines 569-578) — **REMOVE** (moved to scroll form)
5. Vibe/Notes (lines 580-595) — **REMOVE** (separate section in scroll form)
6. Forecast Accuracy (lines 597-653) — **REMOVE** (moved to scroll form)
7. Community tip footer (lines 655-661) — **REMOVE**

**Step 1: Remove sections 3-7**

Delete from line 527 (`{/* Experience Ratings */}`) through line 661 (closing `</div>` before `</SimpleCardLayout>`). Keep the `</div>` that closes `space-y-8` and `</SimpleCardLayout>`.

Also remove unused imports: `Star`, `Users`, `Car`, `CheckCircle2`, `AlertCircle`, `XCircle` (if only used in removed sections). Remove `RatingInput` import. Remove `FORECAST_ACCURACY_OPTIONS` import. Keep `WaveTypeSelector` import removal.

**Step 2: Verify it still compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "ConditionsSection" | head -10
```

**Step 3: Run existing tests**

```bash
npx jest __tests__/components/session-forms/ --no-coverage 2>&1 | tail -15
```

**Step 4: Commit**

```bash
git add components/session-forms/ConditionsSection.tsx
git commit -m "refactor: slim ConditionsSection to objective inputs only"
```

---

## Task 7: Update `useSessionSubmission` — Feed Insertion Post-Save

**Files:**
- Modify: `app/sessions/new/useSessionSubmission.ts`

**Step 1: Replace celebration flow with feed navigation**

Changes to `useSessionSubmission.ts`:

1. Remove `showCelebration` state and `startCelebrationAndRedirect` function (lines 32, 40-67)
2. Remove confetti import logic (lines 44-61)
3. Replace `startCelebrationAndRedirect(mode)` call (line 287) with:

```typescript
// Navigate to profile with highlight
const highlightParam = `highlight=${result.data.id}`;
const tabParam = mode === "plan" ? "tab=planned&" : "";
router.push(`/profile?${tabParam}${highlightParam}`);
```

4. Update toast messages to branded copy:
   - Plan: `"Planned. Let's go."` (line 226)
   - Log: `"Logged. Nice one."` (lines 273-277)

5. Add `isPublic` and `isMuted` to the `buildSessionPayload` passthrough (these get added to the session data object that `handleSessionComplete` receives).

6. Update return object — remove `showCelebration`, `startCelebrationAndRedirect`. Keep `shareSheetOpen` (still used for profile highlight share prompt), `handleShareSession`, `handleShareSheetClose`.

**Step 2: Verify compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "useSessionSubmission" | head -10
```

**Step 3: Commit**

```bash
git add app/sessions/new/useSessionSubmission.ts
git commit -m "feat: replace celebration overlay with feed-insertion navigation"
```

---

## Task 8: Wire Up Page Wrapper

**Files:**
- Modify: `app/sessions/new/page.tsx`
- Delete: `app/sessions/new/CelebrationOverlay.tsx`

**Step 1: Replace wizard with `SessionScrollForm`**

In `app/sessions/new/page.tsx`:

1. Replace `SessionWizard` import with `SessionScrollForm` import
2. In `NewSessionPageContent`, replace `<SessionWizard>` render (lines 62-70) with:

```tsx
<SessionScrollForm
  initialMode={mode}
  onComplete={submission.handleSessionComplete}
  onCancel={() => router.push("/profile")}
  initialFormState={initialFormState}
/>
```

3. Remove `CelebrationOverlay` import and render block (lines 74-84)
4. Remove `showCelebration` from submission destructure

**Step 2: Delete `CelebrationOverlay.tsx`**

```bash
rm app/sessions/new/CelebrationOverlay.tsx
```

**Step 3: Verify page loads**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "sessions/new" | head -10
```

**Step 4: Commit**

```bash
git add app/sessions/new/page.tsx
git rm app/sessions/new/CelebrationOverlay.tsx
git commit -m "feat: wire SessionScrollForm into sessions/new page"
```

---

## Task 9: Build `FeedHighlight` and Wire Profile Page

**Files:**
- Create: `components/profile/FeedHighlight.tsx`
- Modify: `components/profile-view.tsx` (lines 107-125)

**Step 1: Create `FeedHighlight` component**

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedHighlightProps {
  sessionId: string | null;
  onShare: () => void;
  onDismiss: () => void;
}

export function FeedHighlight({ sessionId, onShare, onDismiss }: FeedHighlightProps) {
  const [visible, setVisible] = useState(!!sessionId);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!sessionId) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 10000);
    return () => clearTimeout(timer);
  }, [sessionId, onDismiss]);

  if (!visible || !sessionId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 flex items-center justify-between"
      >
        <span className="text-sm font-medium text-orange-800">
          Share your session?
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onShare}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
          >
            <Share2 className="h-3.5 w-3.5 mr-1" />
            Share
          </Button>
          <button
            type="button"
            onClick={() => { setVisible(false); onDismiss(); }}
            className="text-orange-400 hover:text-orange-600 p-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

**Step 2: Wire into `profile-view.tsx`**

In `ProfileViewContent` (line 107):

1. Add imports: `FeedHighlight`, `ShareSheet`, `buildSessionShareUrl`
2. Read `highlight` from `searchParams`:
   ```typescript
   const highlightSessionId = searchParams?.get("highlight") || null;
   ```
3. Add state for share sheet:
   ```typescript
   const [highlightShareOpen, setHighlightShareOpen] = useState(false);
   ```
4. In the sessions tab content (around line 497), before `<JournalView />`, add:
   ```tsx
   {highlightSessionId && (
     <FeedHighlight
       sessionId={highlightSessionId}
       onShare={() => setHighlightShareOpen(true)}
       onDismiss={() => {
         // Clean URL
         const params = new URLSearchParams(searchParams?.toString() ?? "");
         params.delete("highlight");
         const newUrl = params.toString() ? `/profile?${params.toString()}` : "/profile";
         router.replace(newUrl, { scroll: false });
       }}
     />
   )}
   ```
5. Add CSS to highlight the session card. Pass `highlightSessionId` down to `JournalView` if feasible, or use a CSS approach:
   ```css
   /* In globals.css or component style */
   [data-session-id="HIGHLIGHT_ID"] {
     animation: highlight-glow 2s ease-out;
   }
   @keyframes highlight-glow {
     0% { box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.5); }
     100% { box-shadow: 0 0 0 0 rgba(234, 88, 12, 0); }
   }
   ```

**Step 3: Verify compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "profile" | head -10
```

**Step 4: Commit**

```bash
git add components/profile/FeedHighlight.tsx components/profile-view.tsx
git commit -m "feat: add FeedHighlight share prompt on profile after session save"
```

---

## Task 10: Wire `isPublic` and `isMuted` into Session Payload

**Files:**
- Modify: `lib/utils/session-data-builder.ts`
- Modify: `app/sessions/new/useSessionSubmission.ts`

**Step 1: Add fields to `buildSessionPayload`**

In `lib/utils/session-data-builder.ts`, add to the returned object:

```typescript
is_public: sessionData.isPublic ?? true,
muted: sessionData.isMuted ?? false,
```

This is the single source of truth for mapping form state to DB columns. Both `createLoggedSession` and `createPlannedSession` server actions will receive these fields.

**Step 2: Verify server actions accept new fields**

Check `actions/session-actions.ts` — the `createLoggedSession` and `createPlannedSession` functions use spread `...data` into the Supabase insert. Since `is_public` and `muted` are valid columns, they'll pass through without changes.

**Step 3: Commit**

```bash
git add lib/utils/session-data-builder.ts
git commit -m "feat: pass isPublic and isMuted through session payload builder"
```

---

## Task 11: Brand Styling Pass

**Files:**
- Modify: `components/session-forms/SessionScrollForm.tsx` (apply brand colors, microcopy)
- Modify: `components/session-forms/ConditionsSection.tsx` (warm up section header styling)

**Step 1: Apply branded microcopy**

In `SessionScrollForm.tsx`, update all section headers and descriptions per the design spec:

| Section | Header text |
|---------|------------|
| Location | "Where'd you surf?" (log) / "Where & when?" (plan) |
| Date/Time | "When'd you paddle out?" |
| Equipment | "What'd you ride?" |
| Conditions | "What was it like out there?" |
| Sliders | "How were the waves?" |
| Forecast | "Was the forecast right?" |
| Photos | "Photos" |
| Notes | "Notes" |
| Visibility | "Visibility" |

Notes placeholder: `"dawn patrol, glassy, got a few good ones..."`

**Step 2: Apply brand colors**

- Page background: `bg-[#FAFAF5]` (warm sand)
- Section headers: `text-[#1A1A1A] font-bold uppercase tracking-wide text-sm`
- Muted text: `text-[#6B7280]`
- Save button: `bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]`
- Cancel button icon: warm gray

**Step 3: Add grain texture**

Add to the scroll form's outer wrapper:

```tsx
<div className="relative min-h-screen bg-[#FAFAF5]">
  {/* Grain overlay */}
  <div
    className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
    style={{ backgroundImage: "url('/textures/noise.png')", backgroundRepeat: "repeat" }}
  />
  {/* Content */}
  <div className="relative z-10">
    {/* form content */}
  </div>
</div>
```

Note: Create a small noise PNG tile at `public/textures/noise.png` (128x128px, grayscale noise). Can generate with a simple script or download a standard grain tile.

**Step 4: Commit**

```bash
git add components/session-forms/SessionScrollForm.tsx components/session-forms/ConditionsSection.tsx public/textures/noise.png
git commit -m "feat: apply brand styling — warm colors, surfer microcopy, grain texture"
```

---

## Task 12: Delete Wizard Files

**Files:**
- Delete: `components/session/wizard/AnimatedSessionWizard.tsx`
- Delete: `components/session/wizard/wizard-steps.tsx`
- Delete: `components/session/wizard/useWizardNavigation.ts`
- Delete: `components/session/wizard/WizardStep.tsx`
- Delete: `components/session/wizard/ProgressBar.tsx`
- Delete: `components/session/wizard/FieldFocus.tsx`
- Delete: `components/session/wizard/GuidanceHint.tsx`
- Modify: `components/session/wizard/SessionWizard.tsx` — update to re-export `SessionScrollForm`
- Modify: `lib/constants/animations.ts` — remove `WIZARD_MOTION` export
- Delete: `__tests__/unit/session-wizard/ProgressBar.test.tsx`

**Step 1: Update `SessionWizard.tsx` as a shim**

Change `components/session/wizard/SessionWizard.tsx` to simply re-export `SessionScrollForm` for any remaining imports:

```tsx
// Backward compatibility shim — SessionWizard is now SessionScrollForm
export { SessionScrollForm as default } from "@/components/session-forms/SessionScrollForm";
export { SessionScrollForm } from "@/components/session-forms/SessionScrollForm";
```

Or better: search for all imports of `SessionWizard` and update them directly, then delete the file entirely.

**Step 2: Delete files**

```bash
git rm components/session/wizard/AnimatedSessionWizard.tsx
git rm components/session/wizard/wizard-steps.tsx
git rm components/session/wizard/useWizardNavigation.ts
git rm components/session/wizard/WizardStep.tsx
git rm components/session/wizard/ProgressBar.tsx
git rm components/session/wizard/FieldFocus.tsx
git rm components/session/wizard/GuidanceHint.tsx
git rm __tests__/unit/session-wizard/ProgressBar.test.tsx
```

**Step 3: Remove `WIZARD_MOTION` from animations**

In `lib/constants/animations.ts`, delete the `WIZARD_MOTION` export block. Verify no other files import it:

```bash
grep -r "WIZARD_MOTION" --include="*.ts" --include="*.tsx" .
```

Only `AnimatedSessionWizard.tsx` should reference it (which is being deleted).

**Step 4: Also delete Quick mode files** (subsumed into SessionScrollForm):

```bash
git rm components/session-forms/QuickLocationTimeStep.tsx
git rm components/session-forms/QuickRatingStep.tsx
```

**Step 5: Verify compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Fix any broken imports.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: delete wizard files, quick mode shims, and WIZARD_MOTION"
```

---

## Task 13: Update E2E Tests

**Files:**
- Modify: `e2e/session-wizard.spec.ts` — rename to `e2e/session-form.spec.ts`, update selectors
- Modify: `e2e/session-wizard-autofill.spec.ts` — update selectors
- Modify: `e2e/plan-session.spec.ts` — update for scroll form
- Modify: `e2e/sessions.spec.ts` — update if referencing wizard steps

**Step 1: Update test selectors**

The new form uses `data-testid="session-scroll-form"` instead of `data-testid="session-wizard-form"`. Update all references.

Key selector changes:
- No more "Next" / "Previous" buttons — sections are all visible, just scroll
- No more step indicators or progress bar
- Slider interactions replace star rating clicks
- Save button is always visible (sticky bottom)

**Step 2: Add slider interaction helpers**

For slider tests, use Playwright's `locator.fill()` or `dragTo()` on the Radix slider thumb. Or test via keyboard: focus slider → ArrowRight to increase.

**Step 3: Run updated tests**

```bash
npx playwright test e2e/session-form.spec.ts --reporter=line 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add e2e/
git commit -m "test: update E2E tests for session scroll form redesign"
```

---

## Task 14: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

Add under `[Unreleased]`:

```markdown
### Changed
- Session form redesigned as single scrollable page (replaces multi-step wizard) for both Log and Plan modes
- Subjective ratings (wave quality, crowd, overall) now use branded sliders instead of star ratings
- Post-save flow navigates to profile feed with highlighted session instead of modal overlay
- Session form microcopy updated to match Quiver brand voice

### Added
- Visibility toggle on session form (Public / Just me)
- "Keep it off the feed" mute option for public sessions
- `muted` column on sessions table
- Grain texture and warm brand colors on session form

### Removed
- Session wizard step navigation (Previous/Next buttons, progress bar)
- CelebrationOverlay modal
- Confetti animation on session save
- Parking Ease rating (simplification)
```

**Commit:**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for session form redesign"
```

---

## Task Summary

| # | Task | New Files | Modified | Deleted | Est. |
|---|------|-----------|----------|---------|------|
| 1 | DB migration — `muted` column | 1 migration | — | — | 5 min |
| 2 | Form state types | — | `use-session-form.ts` | — | 5 min |
| 3 | `SessionSlider` component | 2 (component + test) | — | — | 20 min |
| 4 | `VisibilitySection` component | 2 (component + test) | — | — | 15 min |
| 5 | `SessionScrollForm` main component | 1 | — | — | 30 min |
| 6 | Slim `ConditionsSection` | — | `ConditionsSection.tsx` | — | 10 min |
| 7 | Update `useSessionSubmission` | — | `useSessionSubmission.ts` | — | 10 min |
| 8 | Wire page wrapper | — | `page.tsx` | `CelebrationOverlay.tsx` | 10 min |
| 9 | `FeedHighlight` + profile wiring | 1 | `profile-view.tsx` | — | 15 min |
| 10 | Payload builder for visibility | — | `session-data-builder.ts` | — | 5 min |
| 11 | Brand styling pass | — | Multiple | — | 15 min |
| 12 | Delete wizard files | — | `animations.ts` | 9 files | 10 min |
| 13 | Update E2E tests | — | 4 test files | — | 20 min |
| 14 | CHANGELOG | — | `CHANGELOG.md` | — | 5 min |

**Total: 14 tasks, ~175 min estimated**

**Dependency order:** 1 → 2 → 3,4 (parallel) → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14
