# PersonalizedBadge Component

Enhanced badge component that displays personalization scores with color coding, mobile-responsive interactions, and comprehensive accessibility support.

## Overview

The PersonalizedBadge component provides visual feedback about how well a beach recommendation matches a user's preferences. It includes:

- **Score Display**: Shows personalization scores as percentages (e.g., "92% Match")
- **Color Coding**: Dynamic colors based on score ranges
- **Responsive Interactions**: Tooltips on desktop, collapsible on mobile
- **Display Modes**: Compact, score, and detailed variants
- **Size Variants**: Small, medium, and large sizes
- **Delta Indicators**: Optional improvement indicators
- **Full Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Installation

The component is already integrated into the Quiver codebase. No additional installation required.

## Basic Usage

### Simple Score Display (Recommended)

```tsx
import { PersonalizedBadge } from '@/components/recommendations/PersonalizedBadge';

<PersonalizedBadge
  personalized={true}
  score={92}
/>
```

### With Score Breakdown

```tsx
<PersonalizedBadge
  personalized={true}
  score={92}
  breakdown={{
    base: 75,
    onboardingPrefs: 10,
    learnedPrefs: 5,
    affinity: 2,
  }}
/>
```

### With Beach Affinity

```tsx
<PersonalizedBadge
  personalized={true}
  score={92}
  breakdown={{
    base: 75,
    onboardingPrefs: 10,
    learnedPrefs: 5,
    affinity: 2,
  }}
  affinityData={{
    sessionCount: 15,
    lastSurfed: new Date('2025-11-01'),
  }}
/>
```

## Props API

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `personalized` | `boolean` | Whether the recommendation is personalized. Component returns `null` if `false`. |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `score` | `number` | `undefined` | Personalization score (0-100). Determines color coding and display text. |
| `breakdown` | `object` | `undefined` | Score breakdown showing component contributions. |
| `affinityData` | `object` | `undefined` | User's history with this beach (session count, last surfed). |
| `displayMode` | `'compact' \| 'score' \| 'detailed'` | `'score'` | Display mode for the badge. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant for the badge. |
| `showDelta` | `boolean` | `false` | Show improvement delta (e.g., "+13 for you"). |
| `baseScore` | `number` | `undefined` | Base score before personalization (for delta calculation). |
| `className` | `string` | `undefined` | Additional CSS classes to apply. |

### Breakdown Object

```typescript
{
  base: number;           // Base recommendation score
  onboardingPrefs: number; // Contribution from user preferences
  learnedPrefs: number;    // Contribution from learned behavior
  affinity: number;        // Contribution from beach history
}
```

### Affinity Data Object

```typescript
{
  sessionCount: number;  // Number of sessions at this beach
  lastSurfed: Date;     // Most recent session date
}
```

## Color Coding

Scores are automatically color-coded based on ranges:

| Score Range | Variant | Color | Use Case |
|-------------|---------|-------|----------|
| **≥ 85** | Primary | Brand blue with glow | Excellent matches |
| **70-84** | Blue | Ocean blue | Good matches |
| **50-69** | Secondary | Muted | Fair matches |
| **< 50** | Outline | Low contrast | Weak matches |

## Display Modes

### Score Mode (Default)

Shows the percentage score with sparkles icon:

```tsx
<PersonalizedBadge
  personalized={true}
  score={92}
  displayMode="score" // Default
/>
// Displays: "92% Match ✨"
```

### Compact Mode

Shows only "Personalized" without the score (useful for space-constrained layouts):

```tsx
<PersonalizedBadge
  personalized={true}
  displayMode="compact"
/>
// Displays: "✨ Personalized"
```

### Detailed Mode

*(Reserved for future implementation - currently functions same as score mode)*

## Size Variants

```tsx
// Small (compact layouts, mobile)
<PersonalizedBadge personalized={true} score={92} size="sm" />

// Medium (default, most common use)
<PersonalizedBadge personalized={true} score={92} size="md" />

// Large (hero sections, emphasis)
<PersonalizedBadge personalized={true} score={92} size="lg" />
```

## Mobile vs Desktop Interactions

The component automatically adapts based on screen size:

### Desktop (width > 768px)
- **Hover**: Tooltip appears with score breakdown
- **Keyboard**: Tab to focus, Enter to activate tooltip
- **Cursor**: `cursor-help` indicates interactive tooltip

### Mobile (width ≤ 768px)
- **Tap**: Badge expands inline to show breakdown
- **Chevron**: Down arrow indicates expandable content
- **Animation**: Smooth accordion transition
- **Touch Target**: Minimum 44x44px for accessibility

## Delta Indicator

Show how much the score improved due to personalization:

```tsx
<PersonalizedBadge
  personalized={true}
  score={88}
  baseScore={75}
  showDelta={true}
/>
// Displays: "88% Match ✨ +13 for you"
```

**Notes:**
- Only shows positive deltas (score > baseScore)
- Displayed in muted text alongside the main score
- Useful for communicating value of personalization

## Accessibility Features

### ARIA Support

- **Role**: `role="status"` for dynamic content
- **Labels**: Descriptive `aria-label` with score
- **Descriptions**: `aria-describedby` links to breakdown
- **Hidden Icons**: Decorative icons marked `aria-hidden="true"`

### Screen Reader Experience

```tsx
<PersonalizedBadge
  personalized={true}
  score={92}
  breakdown={{
    base: 75,
    onboardingPrefs: 10,
    learnedPrefs: 5,
    affinity: 2,
  }}
/>
```

Screen reader announces:
- "92% personalization match"
- Hidden breakdown text: "Base score: 75, Your preferences: 10, Learned behavior: 5, Beach affinity: 2"

### Keyboard Navigation

- **Tab**: Focus on badge
- **Enter**: Activate tooltip (desktop) or expand (mobile)
- **Escape**: Close tooltip/collapse
- **Focus visible**: Clear focus indicator

## Performance Optimization

The component uses `React.memo()` with a custom comparison function to prevent unnecessary re-renders:

```typescript
export const PersonalizedBadge = memo(
  PersonalizedBadgeComponent,
  (prev, next) => {
    return (
      prev.score === next.score &&
      prev.personalized === next.personalized &&
      prev.displayMode === next.displayMode &&
      prev.size === next.size &&
      prev.showDelta === next.showDelta
    );
  }
);
```

Only re-renders when key props change.

## Real-World Examples

### Beach Recommendation Card

```tsx
function BeachCard({ beach, recommendation }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold">{beach.name}</h3>
        <PersonalizedBadge
          personalized={recommendation.personalized}
          score={recommendation.score}
          breakdown={recommendation.breakdown}
          affinityData={recommendation.affinityData}
          size="sm"
        />
      </div>
      {/* Beach details */}
    </div>
  );
}
```

### Beach List Item (Mobile)

```tsx
function BeachListItem({ beach, score }) {
  return (
    <li className="flex items-center justify-between py-2">
      <span className="font-medium">{beach.name}</span>
      <PersonalizedBadge
        personalized={score > 50}
        score={score}
        size="sm"
        displayMode="compact" // Save space on mobile lists
      />
    </li>
  );
}
```

### Hero Section (Desktop)

```tsx
function BeachHero({ beach, personalization }) {
  return (
    <div className="py-12">
      <div className="flex items-center gap-4">
        <h1 className="text-4xl font-bold">{beach.name}</h1>
        <PersonalizedBadge
          personalized={personalization.enabled}
          score={personalization.score}
          breakdown={personalization.breakdown}
          showDelta={true}
          baseScore={personalization.baseScore}
          size="lg"
        />
      </div>
    </div>
  );
}
```

## Testing

Comprehensive test coverage includes:

- ✅ Score display and rounding
- ✅ Color coding across all ranges
- ✅ Display modes (compact, score)
- ✅ Size variants (sm, md, lg)
- ✅ Delta indicators
- ✅ Breakdown filtering (zero values)
- ✅ Mobile vs desktop interactions
- ✅ Accessibility (ARIA, keyboard, screen readers)
- ✅ Affinity badge display
- ✅ Custom className support

Run tests:

```bash
yarn test:unit __tests__/components/recommendations/PersonalizedBadge.test.tsx
```

## Migration Guide

### From Old Component

If you're updating from the previous version:

**Before:**
```tsx
<PersonalizedBadge
  personalized={true}
  breakdown={{ base: 75, onboardingPrefs: 10, learnedPrefs: 5, affinity: 2 }}
/>
// Displayed: "✨ Personalized for you"
```

**After:**
```tsx
<PersonalizedBadge
  personalized={true}
  score={92} // NEW: Add score prop
  breakdown={{ base: 75, onboardingPrefs: 10, learnedPrefs: 5, affinity: 2 }}
/>
// Displays: "92% Match ✨"
```

**Backward Compatible:**
- Old usage still works (shows "Personalized for you" without score)
- New props are optional
- No breaking changes

## Best Practices

### 1. Always Provide Score

For maximum clarity, always pass the `score` prop when available:

```tsx
// ✅ Good
<PersonalizedBadge personalized={true} score={92} />

// ⚠️ Acceptable but less informative
<PersonalizedBadge personalized={true} />
```

### 2. Use Appropriate Sizes

Match badge size to context:

```tsx
// List items, compact layouts
<PersonalizedBadge size="sm" />

// Card headers, standard placements
<PersonalizedBadge size="md" /> // Default

// Hero sections, emphasis
<PersonalizedBadge size="lg" />
```

### 3. Provide Breakdown When Available

Users appreciate understanding WHY a recommendation is personalized:

```tsx
// ✅ Best: Include breakdown
<PersonalizedBadge
  score={92}
  breakdown={scoreBreakdown}
/>

// ⚠️ Okay: Just score
<PersonalizedBadge score={92} />
```

### 4. Consider Mobile Experience

Test on both desktop and mobile to ensure interactions work well:

```tsx
// Desktop: Hover tooltip
// Mobile: Tap to expand
<PersonalizedBadge
  score={92}
  breakdown={scoreBreakdown}
/>
```

### 5. Use Delta Sparingly

Only show delta when communicating value of personalization:

```tsx
// ✅ Good: First time user sees personalized results
<PersonalizedBadge
  score={88}
  baseScore={75}
  showDelta={true}
/>

// ❌ Don't: Always show delta (clutters UI)
```

## Troubleshooting

### Badge Not Appearing

**Issue**: Component renders nothing.

**Solution**: Check that `personalized={true}`:

```tsx
// ❌ Wrong
<PersonalizedBadge personalized={false} score={92} />

// ✅ Correct
<PersonalizedBadge personalized={true} score={92} />
```

### Tooltip Not Showing

**Issue**: Hover doesn't show breakdown.

**Solution**: Ensure `breakdown` prop is provided:

```tsx
// ❌ No tooltip
<PersonalizedBadge personalized={true} score={92} />

// ✅ Tooltip appears
<PersonalizedBadge
  personalized={true}
  score={92}
  breakdown={{ base: 75, onboardingPrefs: 10, learnedPrefs: 5, affinity: 2 }}
/>
```

### Color Not Changing

**Issue**: Badge always shows same color.

**Solution**: Ensure `score` prop is passed as a number:

```tsx
// ❌ Wrong (string)
<PersonalizedBadge personalized={true} score="92" />

// ✅ Correct (number)
<PersonalizedBadge personalized={true} score={92} />
```

### Mobile Chevron Missing

**Issue**: Chevron doesn't appear on mobile.

**Solution**: Requires both mobile viewport AND breakdown data:

```tsx
// Must have breakdown to show chevron
<PersonalizedBadge
  personalized={true}
  score={92}
  breakdown={{ base: 75, onboardingPrefs: 10, learnedPrefs: 5, affinity: 2 }}
/>
```

## Future Enhancements

Potential improvements for future iterations:

1. **Detailed Display Mode**: Inline breakdown chips alongside score
2. **Animation**: Score counting animation on mount
3. **Customizable Thresholds**: Allow custom score ranges for colors
4. **Historical Trend**: Show if score is improving over time
5. **Comparison Mode**: Compare scores across multiple beaches
6. **Internationalization**: Multi-language support

## Related Components

- `Badge`: Base badge component from shadcn/ui
- `Tooltip`: Tooltip component for desktop interactions
- `Collapsible`: Collapsible component for mobile interactions

## Support

For questions or issues with the PersonalizedBadge component:

1. Check this documentation
2. Review examples in `PersonalizedBadge.examples.tsx`
3. Run tests to verify expected behavior
4. Consult component architecture documentation

---

**Version**: 2.0.0 (Enhanced)
**Last Updated**: November 14, 2025
**Maintained By**: Quiver Development Team
