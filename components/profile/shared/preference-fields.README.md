# Preference Fields Components

Reusable, composable field components for surf profile preferences that are compatible with React Hook Form.

## Overview

These components were extracted from `ProfilePreferences` to eliminate code duplication and enable reuse across multiple forms including:
- `ProfilePreferences` (settings page)
- `EditProfileForm` (inline profile editing)
- Future onboarding flows

## Components

### ExperienceLevelField

Dropdown selector for surfer experience level.

**Props:**
- `control: Control<any>` - React Hook Form control object (required)
- `name: string` - Field name (required)
- `error?: string` - Error message to display
- `disabled?: boolean` - Disable the field (default: false)
- `label?: string` - Custom label (default: "Experience Level")
- `description?: string` - Custom description (default: "How experienced are you with surfing?")

**Options:**
- Beginner 🏄‍♂️ - Just getting started
- Intermediate 🌊 - Catching waves regularly
- Advanced 🏆 - Experienced surfer
- Expert 🔥 - Highly skilled

**Example:**
```tsx
<ExperienceLevelField
  control={form.control}
  name="experience_level"
  disabled={isSubmitting}
/>
```

---

### SurfStylesField

Multi-select with emoji buttons for surf style preferences.

**Props:**
- `control: Control<any>` - React Hook Form control object (required)
- `name: string` - Field name (required)
- `error?: string` - Error message to display
- `disabled?: boolean` - Disable the field (default: false)
- `label?: string` - Custom label (default: "Surf Styles (select all that apply)")
- `description?: string` - Custom description (optional)

**Options:**
- Longboard 🏄
- Shortboard 🏄‍♀️
- Funboard 🏄‍♂️
- Bodyboard 🏊
- SUP 🚣
- Foil ✨

**Value Type:** Array of strings (e.g., `['longboard', 'shortboard']`)

**Example:**
```tsx
<SurfStylesField
  control={form.control}
  name="surf_styles"
  disabled={isSubmitting}
/>
```

---

### PreferredWaveSizeField

Dropdown selector for preferred wave size.

**Props:**
- `control: Control<any>` - React Hook Form control object (required)
- `name: string` - Field name (required)
- `error?: string` - Error message to display
- `disabled?: boolean` - Disable the field (default: false)
- `label?: string` - Custom label (default: "Preferred Wave Size")
- `description?: string` - Custom description (default: "What wave size do you prefer surfing?")

**Options:**
- Small 🌊 - 1-3 feet
- Medium 🌊🌊 - 3-6 feet
- Large 🌊🌊🌊 - 6+ feet
- Any Size 🤙 - I'll surf anything

**Example:**
```tsx
<PreferredWaveSizeField
  control={form.control}
  name="preferred_wave_size"
  disabled={isSubmitting}
/>
```

---

### PreferredBreakTypeField

Dropdown selector for preferred break type.

**Props:**
- `control: Control<any>` - React Hook Form control object (required)
- `name: string` - Field name (required)
- `error?: string` - Error message to display
- `disabled?: boolean` - Disable the field (default: false)
- `label?: string` - Custom label (default: "Preferred Break Type")
- `description?: string` - Custom description (default: "What type of break do you prefer?")

**Options:**
- Beach Break 🏖️ - Sandy bottom
- Point Break 🪨 - Rocky point
- Reef Break 🪸 - Coral or rock reef
- Any Type ✨ - I'll surf anywhere

**Example:**
```tsx
<PreferredBreakTypeField
  control={form.control}
  name="preferred_break_type"
  disabled={isSubmitting}
/>
```

---

### CrowdPreferenceField

Dropdown selector for crowd preference.

**Props:**
- `control: Control<any>` - React Hook Form control object (required)
- `name: string` - Field name (required)
- `error?: string` - Error message to display
- `disabled?: boolean` - Disable the field (default: false)
- `label?: string` - Custom label (default: "Crowd Preference")
- `description?: string` - Custom description (default: "How do you feel about crowds at the beach?")

**Options:**
- Love the crew 👥 - Enjoy surfing with others
- A few people is fine 🧘 - Small crowds are okay
- Prefer solitude 🏝️ - Like uncrowded spots

**Example:**
```tsx
<CrowdPreferenceField
  control={form.control}
  name="crowd_preference"
  disabled={isSubmitting}
/>
```

---

## Usage with React Hook Form

All components use `Controller` from React Hook Form internally, so you just need to pass the `control` object and field `name`.

```tsx
import { useForm } from 'react-hook-form';
import { ExperienceLevelField, SurfStylesField } from '@/components/profile/shared/preference-fields';

export function MyForm() {
  const form = useForm({
    defaultValues: {
      experience_level: null,
      surf_styles: [],
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <ExperienceLevelField
        control={form.control}
        name="experience_level"
      />

      <SurfStylesField
        control={form.control}
        name="surf_styles"
      />
    </form>
  );
}
```

## Constants

The component options are defined in `/lib/constants/user-preferences.ts`:

```typescript
import {
  EXPERIENCE_LEVELS,
  SURF_STYLES,
  WAVE_SIZES,
  BREAK_TYPES,
  CROWD_PREFERENCES,
} from '@/lib/constants/user-preferences';
```

Each constant is exported as a readonly array of objects with:
- `value: string` - The value stored in the database
- `label: string` - Human-readable label
- `emoji: string` - Emoji icon
- `description?: string` - Optional description (for dropdowns)

## TypeScript Types

Type definitions are also exported from the constants file:

```typescript
import type {
  ExperienceLevel,
  SurfStyle,
  WaveSize,
  BreakType,
  CrowdPreference,
} from '@/lib/constants/user-preferences';
```

## Error Handling

All fields support error display via the `error` prop:

```tsx
<ExperienceLevelField
  control={form.control}
  name="experience_level"
  error={form.formState.errors.experience_level?.message}
/>
```

When an error is present:
- The field border turns red
- The error message replaces the description text
- The field remains fully functional

## Styling

All components use:
- Tailwind CSS utility classes
- `cn()` utility for conditional classes
- Consistent spacing and sizing
- Focus states with ring and border changes
- Disabled states with opacity and cursor changes

The styling matches the existing Quiver design system and is consistent with other form components in the application.

## Architecture

These components follow the established patterns from:
- `/components/ARCHITECTURE.md` - Component structure guidelines
- `/components/profile/shared/surf-info-fields.tsx` - Existing shared field pattern
- `/components/profile/shared/basic-info-fields.tsx` - Field composition pattern

## Testing

When adding tests for forms using these components:
1. Test field rendering
2. Test value changes
3. Test error states
4. Test disabled states
5. Test form submission with field values

Example test:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { ExperienceLevelField } from './preference-fields';

const TestWrapper = () => {
  const form = useForm({ defaultValues: { level: null } });
  return <ExperienceLevelField control={form.control} name="level" />;
};

test('renders experience level options', () => {
  render(<TestWrapper />);
  expect(screen.getByLabelText('Experience Level')).toBeInTheDocument();
});
```

## Future Enhancements

Potential improvements:
1. Add loading states for async operations
2. Add tooltips for emoji meanings
3. Add keyboard navigation hints
4. Add animations for selection states
5. Add accessibility announcements for screen readers
