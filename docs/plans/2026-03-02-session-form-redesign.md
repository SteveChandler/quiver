# Session Form Redesign — Single Scrollable Page

**Date:** 2026-03-02
**Status:** Design approved, ready for implementation
**Inspired by:** Strava iOS "Add Manual Activity" flow

---

## Summary

Replace the multi-step wizard (`AnimatedSessionWizard`) with a single scrollable page for both Log and Plan modes. Add branded sliders for subjective ratings, a visibility/privacy toggle, and a smooth post-save flow that inserts the session into the profile feed.

---

## 1. Page Layout & Structure

Both Log and Plan flows live at `/sessions/new?mode=log` and `/sessions/new?mode=plan`. No wizard steps, no Previous/Next buttons, no progress bar.

### Layout

- **Sticky header:** Mode label ("Log Session" / "Plan Session") + Cancel (left) + Save (right, disabled until required fields filled)
- **Below:** Single vertically-stacked form with sections separated by subtle dividers
- **Mobile-first:** Full-width, generous padding, 48px min touch targets
- **Desktop:** `max-w-xl` centered (narrower than current `max-w-2xl` for tighter feel)

### Sections — Log Mode (top to bottom)

1. **Where'd you surf?** — Beach search + date/time pickers (required)
2. **Board** — Board selector with inline "add board" (optional)
3. **Conditions** — Wave height, wind, water temp, tide (auto-prefilled from forecast, editable number inputs)
4. **How were the waves?** — Sliders for Wave Quality, Crowd, Overall Rating + wave type chips
5. **Forecast check** — "Was the forecast accurate?" (3-button choice, same as today)
6. **Photos** — Photo upload grid
7. **Notes** — Free text textarea
8. **Visibility** — Public/private toggle + "Keep it off the feed" checkbox
9. **Sticky bottom: Save button** — Fixed at bottom on mobile

### Sections — Plan Mode (top to bottom)

1. **Where & When** — Same beach/date/time
2. **Goals** — Goal selector chips
3. **Invite friends** — Invitation section
4. **Notes** — Free text
5. **Visibility** — Same toggle
6. **Sticky bottom: Save button**

---

## 2. Sliders for Subjective Ratings

Replace 1-5 star `RatingInput` components with horizontal sliders. Each has labeled endpoints and a colored fill.

### Wave Quality Slider

- Range: 1–5 (snaps to integers)
- Labels: "Flat" ← → "Firing"
- Stops: Flat | Choppy | Fun | Good | Firing
- Color ramp: Deep teal `#0D9488` → Amber `#F59E0B` → Hot orange `#EA580C`
- Default: unset (thumb hidden until first tap/drag)

### Crowd Level Slider

- Range: 1–5
- Labels: "Empty" ← → "Packed"
- Stops: Empty | Chill | Moderate | Busy | Packed
- Color ramp: Warm green `#16A34A` → Amber `#FBBF24` → Warm red `#DC2626`

### Overall Session Rating

- Range: 1–5
- Labels: "Rough" ← → "Epic"
- Stops: Rough | Meh | Fun | Great | Epic
- Color ramp: Muted gray `#9CA3AF` → Amber `#F59E0B` → Quiver orange `#EA580C`
- Hero slider — slightly larger, more prominent

### Parking Ease — Dropped

Removed to reduce friction. Can be re-added later if needed.

### Interaction Details

- Mobile: tap anywhere on track to set, or drag the thumb
- Thumb shows current label (e.g., "Fun") in a tooltip bubble above while dragging
- Haptic feedback on each snap point (Capacitor)
- Unset state: gray track, no thumb, "Tap to rate" placeholder
- Built on Radix `Slider` primitive (keyboard nav, ARIA labels)

### Component

New reusable `<SessionSlider>` with props: `labels: string[]`, `colors: string[]`, `value`, `onChange`.

---

## 3. Visibility & "Don't Publish"

### Visibility Toggle

Segmented control (not dropdown), single row:

- **Public** (default) — Eye icon. Session on profile and community feed.
- **Just me** — Lock icon. Private, only visible to you.

When "Just me" selected, subtle note: *"Private sessions still help improve forecast accuracy"*

### "Keep it off the feed" Checkbox

Only visible when "Public" is selected:

- Label: "Keep it off the feed"
- Sublabel: "Public on your profile, but won't show up in others' feeds"
- Maps to new `muted` column on sessions table

### Database Changes

- `is_public` — already exists, just newly surfaced in form UI
- `muted boolean DEFAULT false` — new migration

### Form State

- `isPublic: boolean` (default `true`)
- `isMuted: boolean` (default `false`)

### Visual Treatment

- Light warm-gray card, not prominent
- Subtle transition: "Keep it off the feed" checkbox slides in/out when toggling visibility

---

## 4. Post-Save — Feed Insertion

Replace `CelebrationOverlay` modal with smooth transition into the profile feed.

### Flow

1. Save button shows spinner + "Saving..."
2. Success toast: "Logged. Nice one." (brief, non-blocking)
3. Navigate to `/profile?highlight={sessionId}`
4. Profile page detects `highlight` param:
   - Scrolls to new session card (top of activity feed)
   - Applies brief highlight animation — warm orange border glow, fades over 2s
   - Shows share prompt bar pinned above card: "Share your session?" + Share button + dismiss X
5. Share prompt auto-dismisses after 10s or on tap

### Plan Mode

Same flow but navigates to `/profile?tab=planned&highlight={id}`

### What Gets Removed

- `CelebrationOverlay.tsx` — deleted
- Auto-redirect timer logic
- Confetti/zoom-in animation

### Edge Cases

- Save failure: error toast, stay on form, no navigation
- Slow connection: save button stays disabled in "Saving..." state, no double-submit

---

## 5. Brand Pass

### Colors

| Element | Current | Branded |
|---------|---------|---------|
| Primary action (save, active) | Ocean blue `#0077B6` | Warm orange `#EA580C` |
| Page background | Cool gray `gray-50` | Warm sand `#FAFAF5` |
| Section headers | Gray | Near-black `#1A1A1A` |
| Muted text | Cool slate | Warm gray `#6B7280` |
| Icons | Blue/gray | Teal/orange/amber |

Note: These color changes are scoped to the session form. A broader app-wide palette migration is a separate effort.

### Typography

- Form title: `font-bold text-2xl tracking-tight`
- Section headers: `font-bold uppercase tracking-wide` (bumped from `font-semibold`)
- Slider labels: `font-semibold` with warm color tones

### Tone of Voice

| Current | Branded |
|---------|---------|
| "Where did your session take place?" | "Where'd you surf?" |
| "When did you surf?" | "When'd you paddle out?" |
| "Rate the waves" | "How were the waves?" |
| "Session logged successfully" | "Logged. Nice one." |
| "Please complete all required fields" | "Just need a spot and a time" |
| "Your condition reports help improve forecasts" | "Your reports make the forecast sharper for everyone" |
| "Don't publish to feed" | "Keep it off the feed" |
| "Visible to everyone" | "Public" |
| "Only visible to you" | "Just me" |

### Texture

- Subtle CSS noise grain on page background (2-3% opacity tiling PNG via `::before`)
- Cards: `rounded-xl`, warm shadow, no hard borders — feel like paper

### Save Button

Full-width on mobile, warm orange gradient (`from-orange-500 to-orange-600`), bold white text, `py-4`, `rounded-xl`. `active:scale-[0.98]` press effect.

### Slider Thumb

Oversized `w-6 h-6`, solid orange fill, subtle warm shadow. Tactile.

---

## 6. Implementation Plan

### New Components

- `<SessionScrollForm>` — single scrollable form, replaces `AnimatedSessionWizard`
- `<SessionSlider>` — reusable slider with labeled stops, Radix Slider primitive
- `<VisibilitySection>` — segmented toggle + mute checkbox
- `<FeedHighlight>` — profile feed wrapper handling `?highlight=` with glow animation

### Reused As-Is

- `LocationStep` / beach search
- `DateTimeSection` / date-time pickers
- `EquipmentStep` / board selector
- `ConditionsSection` — objective data inputs (wave height, wind, water temp, tide) with auto-prefill
- `PhotoSelectionSection`
- `NotesSection`
- `GoalsSection` (plan mode)
- `WaveTypeSelector` chips
- Forecast accuracy 3-button choice
- `ShareSheet` (post-save sharing)
- All server actions (`createLoggedSession`, `createPlannedSession`)

### Modified

- `ConditionsSection` — remove star-based `RatingInput` calls (sliders replace them)
- `/sessions/new/page.tsx` — swap wizard for `SessionScrollForm`
- Profile page — add highlight detection logic

### Deleted

- `AnimatedSessionWizard.tsx`
- `CelebrationOverlay.tsx`
- `WizardStep.tsx`, `ProgressBar.tsx`, `useWizardNavigation.ts`
- `wizard-steps.tsx`
- Previous/Next navigation logic

### Database Migration

```sql
ALTER TABLE sessions ADD COLUMN muted boolean DEFAULT false;
```

### No Changes To

- Session data model (all existing fields preserved)
- Server actions / validation
- RLS policies
- `is_public` column (already exists, newly surfaced)
