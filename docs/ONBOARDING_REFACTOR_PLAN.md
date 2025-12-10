# Onboarding Flow Refactoring Plan

> **Document Created**: December 2025
> **Status**: Approved for Implementation
> **Related Spec**: `docs/quiver_screen_state_planner.md`

## Overview

This document outlines the refactoring plan to align the Quiver onboarding flow with the specifications defined in `docs/quiver_screen_state_planner.md`. The goal is to create a more polished, visually consistent onboarding experience that incorporates the Quiver logo and follows the design system guidelines.

---

## Final Step Order (7 Steps)

Based on spec analysis and user decisions:

| Step | Component | Description |
|------|-----------|-------------|
| 1 | `welcome-step.tsx` | Quiver logo, welcome text, Get Started CTA |
| 2 | `profile-step.tsx` | Full Name + Display Name inputs |
| 3 | `experience-step.tsx` | Card-based experience level selection |
| 4 | `wave-preferences-step.tsx` | Wave size, break type, surf styles (segmented buttons) |
| 5 | `home-beach-step.tsx` | Beach search with nearby section |
| 6 | `referral-step.tsx` | Optional referral code input |
| 7 | `completion-step.tsx` | Celebration, forecast preview, CTA |

**Key Decisions Made:**
- Profile step kept as step 2 (name collection before preferences)
- Surf styles added to wave preferences step
- Notifications step removed (moved to settings)
- No skip option on welcome step (users must complete onboarding)

---

## Current vs. New Comparison

### Current Implementation (6 Steps)
| Step | Component | Description |
|------|-----------|-------------|
| 1 | `welcome-step.tsx` | Wave illustration image (clickable) |
| 2 | `profile-step.tsx` | Full Name + Display Name inputs |
| 3 | `home-beach-step.tsx` | Beach search/selection |
| 4 | `preferences-step.tsx` | Experience, Surf styles, Wave size, Break type, Crowd |
| 5 | `notifications-step.tsx` | Push + Email toggles |
| 6 | `completion-step.tsx` | Success screen with XP |

### What Changes
- **Step 1**: Welcome gets redesigned with logo
- **Step 2**: Profile stays (name collection)
- **Step 3**: NEW - Experience level (card-based, extracted from preferences)
- **Step 4**: NEW - Wave preferences + surf styles (segmented buttons)
- **Step 5**: Home beach moves later in flow
- **Step 6**: NEW - Referral code step
- **Step 7**: Completion updated with forecast preview
- **REMOVED**: Notifications step (move to settings)
- **REMOVED**: Old preferences step (split into steps 3 & 4)

---

## Detailed Implementation Plan

### Phase 1: Welcome Step Redesign

**File**: `components/onboarding/steps/welcome-step.tsx`

**Current Code**:
```tsx
<Image src="/examples/Gemini_Generated_Image_..." />
```

**New Structure**:
```
┌─────────────────────────────────────────┐
│                                         │
│     [Quiver Logo - logoQuiver.png]     │
│     (centered, ~200px width)            │
│                                         │
│  Welcome to Quiver!                     │
│  (text-3xl font-bold text-center)       │
│                                         │
│  Your personal surf companion           │
│  (text-lg text-gray-600 text-center)    │
│                                         │
│  Let's set up your profile to get       │
│  personalized forecasts and             │
│  recommendations.                       │
│  (text-sm text-gray-500 text-center)    │
│                                         │
│  [Get Started] (Primary Button)         │
│                                         │
└─────────────────────────────────────────┘
```

**Implementation Notes**:
- Use Next.js `<Image>` component: `src="/logoQuiver.png"`, width ~200px
- Remove old wave illustration image entirely
- NO skip option - users must complete onboarding
- Remove clickable image behavior, use proper button

---

### Phase 2: Profile Step (Keep)

**File**: `components/onboarding/steps/profile-step.tsx`

**Changes**: Minimal - ensure styling consistency
- Keep Full Name + Display Name inputs (already implemented)
- Step position stays at 2
- Just verify styling matches design system

---

### Phase 3: Experience Level Step (New)

**File**: `components/onboarding/steps/experience-step.tsx` (new file)

**UI Pattern**: Card-based selection per spec
```
┌───────────────────────────────────┐
│ 🏄 Beginner                       │
│ Just getting started, learning    │
│ to catch waves                    │
└───────────────────────────────────┘
┌───────────────────────────────────┐
│ 🏄 Intermediate              ✓    │
│ Comfortable in various conditions │
└───────────────────────────────────┘
... (Advanced, Expert)
```

**Implementation Notes**:
- Extract experience level logic from current `preferences-step.tsx`
- Use `EXPERIENCE_LEVELS` constant from `lib/constants/user-preferences.ts`
- Card styling: `border-2 rounded-lg p-4`, selected: `border-ocean-blue bg-blue-50`
- Single selection (radio behavior)

---

### Phase 4: Wave Preferences Step (New)

**File**: `components/onboarding/steps/wave-preferences-step.tsx` (CREATE NEW)

**UI Pattern**: Segmented buttons + surf styles multi-select
```
┌─────────────────────────────────────────┐
│  What waves do you prefer?              │
│                                         │
│  Wave Size                              │
│  ┌─────────┐┌─────────┐┌─────────┐     │
│  │ Small  ││ Medium ││ Large  │     │
│  │ 1-3ft  ││ 3-5ft ✓││ 5ft+   │     │
│  └─────────┘└─────────┘└─────────┘     │
│                                         │
│  Break Type                             │
│  ┌─────────┐┌─────────┐┌─────────┐     │
│  │ Beach ✓││ Point  ││ Reef   │     │
│  └─────────┘└─────────┘└─────────┘     │
│                                         │
│  Surf Styles (select all that apply)    │
│  ┌─────────┐┌─────────┐┌─────────┐     │
│  │Shortbrd││Longbrd ││ SUP    │     │
│  │   ✓    ││        ││        │     │
│  └─────────┘└─────────┘└─────────┘     │
│  ┌─────────┐                            │
│  │Bodyboard│                            │
│  └─────────┘                            │
│                                         │
│  [← Back]              [Continue →]     │
└─────────────────────────────────────────┘
```

**Implementation Notes**:
- Combine wave size, break type, AND surf styles (per user decision)
- Use `ToggleGroup` from shadcn/ui for segmented buttons
- Surf styles: multi-select grid (extract from current preferences)
- Touch targets: minimum 44px height
- Use constants from `lib/constants/user-preferences.ts`

---

### Phase 5: Home Beach Step Update

**File**: `components/onboarding/steps/home-beach-step.tsx`

**Changes**:
- Keep existing search functionality
- Add "📍 Nearby" section with distance indicators
- Update styling to match spec

---

### Phase 6: Referral Step (New)

**File**: `components/onboarding/steps/referral-step.tsx` (new file)

**Features**:
- Optional 6-character code input
- Real-time validation via `/api/referrals/validate`
- Skip option
- Validation states: valid (green check), invalid (red warning)

---

### Phase 7: Completion Step Update

**File**: `components/onboarding/steps/completion-step.tsx`

**UI Structure**:
```
┌─────────────────────────────────────────┐
│                                         │
│     🎉 (celebration animation)          │
│                                         │
│  You're all set!                        │
│  (text-3xl font-bold)                   │
│                                         │
│  Your personalized surf forecast        │
│  is ready.                              │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Today at [Home Beach Name]        │  │
│  │ Score: 78/100 - Good conditions   │  │
│  │ 3-4ft, offshore, mid tide         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  +100 XP earned                         │
│                                         │
│  [View Full Forecast]                   │
│                                         │
└─────────────────────────────────────────┘
```

**Implementation Notes**:
- Add confetti animation (consider `react-confetti` or CSS keyframes)
- Fetch basic forecast for home beach (if selected)
- Show forecast preview card only if home beach was selected
- Keep XP display (+100 XP)
- Change CTA to "View Full Forecast"

---

### Phase 8: Store & Schema Updates

**Files**:
- `store/onboarding-store.ts` - Update step count, data structure
- `lib/schemas/onboarding-schemas.ts` - Update validation schemas
- `actions/onboarding-actions.ts` - Update save logic

### Phase 9: Remove/Deprecate Files

**Files to Delete**:
- `components/onboarding/steps/notifications-step.tsx` - Move functionality to settings
- `components/onboarding/steps/preferences-step.tsx` - Split into experience + wave-preferences

**Files to Keep (but modify)**:
- `components/onboarding/steps/profile-step.tsx` - Keep as step 2

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `components/onboarding/onboarding-dialog.tsx` | Modify | Update STEPS array (7 steps) |
| `components/onboarding/steps/welcome-step.tsx` | **Rewrite** | Add logo, text, CTA button |
| `components/onboarding/steps/profile-step.tsx` | Minor | Keep, verify styling |
| `components/onboarding/steps/experience-step.tsx` | **Create** | Card-based experience selection |
| `components/onboarding/steps/wave-preferences-step.tsx` | **Create** | Segmented buttons + surf styles |
| `components/onboarding/steps/home-beach-step.tsx` | Modify | Add nearby section |
| `components/onboarding/steps/referral-step.tsx` | **Create** | Optional referral code |
| `components/onboarding/steps/completion-step.tsx` | Modify | Forecast preview, animation |
| `components/onboarding/steps/notifications-step.tsx` | **Delete** | Move to settings |
| `components/onboarding/steps/preferences-step.tsx` | **Delete** | Split into new steps |
| `store/onboarding-store.ts` | Modify | 7 steps, update data |
| `lib/schemas/onboarding-schemas.ts` | Modify | New schemas |
| `actions/onboarding-actions.ts` | Modify | Update save logic |

---

## Design Tokens to Use (from spec)

```css
/* Colors */
--primary: #0077B6 (Ocean Blue)
--accent: #FF7F11 (Sunset Orange)
--background: #F5F5DC (Sandy Beige)
--foreground: charcoal
--muted-foreground: gray-600
--destructive: mid-tone red
--success: green-600

/* Typography */
H1: text-3xl font-bold (Welcome heading)
Body: text-lg text-gray-600 (Tagline)
Small: text-sm text-gray-500 (Descriptions)

/* Spacing */
Section padding: py-6
Card padding: p-4
Button height: min 44px (touch targets)

/* Animation */
Fast: 0.3s (hover, press)
Standard: 0.6s (fade-in)
```

---

## Testing Requirements

### Unit Tests to Update
- `__tests__/components/onboarding/onboarding-dialog.test.tsx`
- `__tests__/components/onboarding/onboarding-steps.test.tsx`
- `__tests__/store/onboarding-store.test.ts`

### E2E Tests to Update
- `e2e/scripts/complete-onboarding.ts`
- `e2e/scripts/reset-onboarding.ts`

### New Test Cases
- Logo renders correctly on welcome step
- Experience level card selection works
- Wave preference segmented buttons work
- Referral code validation works
- Completion step shows forecast preview when home beach selected

---

## Migration Considerations

### Existing Users
- Users with `onboarding_completed_at` set should NOT see new onboarding
- New flow only affects new users

### Data Compatibility
- Existing preference data structure should remain compatible
- No database migrations required (using same profile fields)

### Rollback Plan
- Keep old components until new flow is verified in production
- Feature flag option: `NEXT_PUBLIC_NEW_ONBOARDING=true`

---

## Decisions Made (User Confirmed)

| Question | Decision |
|----------|----------|
| Profile name collection | Keep as step 2 (before experience level) |
| Surf styles | Add to wave preferences step |
| Notifications step | Remove from onboarding (move to settings) |
| Skip functionality | No skip option - users must complete onboarding |

---

## Execution Order

1. **Welcome Step** - Redesign with logo (highest impact, sets tone)
2. **Experience Step** - Create new (extract from preferences)
3. **Wave Preferences Step** - Create new (extract + add surf styles)
4. **Referral Step** - Create new
5. **Update Dialog** - Wire up new step order
6. **Store/Schema Updates** - Update for 7 steps
7. **Home Beach Step** - Add nearby section
8. **Completion Step** - Add forecast preview + animation
9. **Delete Old Files** - notifications + preferences steps
10. **Update Tests** - Unit and E2E tests
