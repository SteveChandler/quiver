# PreferencesDisplayCard Component

A read-only display component for user surf preferences on the profile page.

## Overview

The `PreferencesDisplayCard` component displays a user's surf preferences in a clean, card-based layout with emojis and descriptive text. It handles null/empty states gracefully and provides an optional edit button.

## Features

- **Read-only display** - Shows preferences without allowing inline editing
- **Emoji-rich UI** - Visual indicators for each preference type
- **Graceful null handling** - Shows helpful empty states when preferences aren't set
- **Optional edit button** - Configurable callback for edit functionality
- **Responsive design** - Works on mobile and desktop
- **Type-safe** - Full TypeScript support with proper Profile types
- **Accessible** - Proper ARIA labels and semantic HTML

## Displayed Preferences

1. **Experience Level** - Shows emoji + label (Beginner, Intermediate, Advanced, Expert)
2. **Surf Styles** - Multiple badge display with emojis (Longboard, Shortboard, etc.)
3. **Preferred Wave Size** - Emoji + size range (Small 1-3ft, Medium 3-6ft, Large 6ft+)
4. **Preferred Break Type** - Emoji + description (Beach, Point, Reef breaks)
5. **Crowd Preference** - Emoji + description (Social, Moderate, Solitude)

## Usage

### Basic Usage (Read-only)

```tsx
import { PreferencesDisplayCard } from '@/components/profile/preferences-display-card';

export function ProfilePage({ profile }: { profile: Profile }) {
  return <PreferencesDisplayCard profile={profile} />;
}
```

### With Edit Functionality

```tsx
import { useRouter } from 'next/navigation';
import { PreferencesDisplayCard } from '@/components/profile/preferences-display-card';

export function ProfilePage({ profile }: { profile: Profile }) {
  const router = useRouter();

  const handleEdit = () => {
    router.push('/profile/preferences');
  };

  return <PreferencesDisplayCard profile={profile} onEdit={handleEdit} />;
}
```

### In a Profile Section

```tsx
import { PreferencesDisplayCard } from '@/components/profile/preferences-display-card';

export function ProfileOverview({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-6">
      <h2>Your Profile</h2>

      {/* Other sections */}

      <PreferencesDisplayCard
        profile={profile}
        onEdit={() => console.log('Edit preferences')}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `profile` | `Profile` | Yes | User profile object with preference fields |
| `onEdit` | `() => void` | No | Callback function when edit button is clicked. If not provided, edit button won't be shown. |

## Profile Type

The component expects a `Profile` type with these preference fields:

```typescript
interface Profile {
  // ... other profile fields
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  surf_styles: string[] | null;
  preferred_wave_size: 'small' | 'medium' | 'large' | 'any' | null;
  preferred_break_type: 'beach' | 'point' | 'reef' | 'any' | null;
  crowd_preference: 'social' | 'moderate' | 'solitude' | null;
}
```

## Empty States

When a user hasn't set preferences, the component displays:

```
No preferences set yet. Click the edit button to add your preferences.
```

Individual preference sections are hidden if their values are `null` or empty arrays.

## Styling

The component uses:
- Tailwind CSS for styling
- shadcn/ui Card component for layout
- shadcn/ui Badge component for surf styles
- shadcn/ui Button component for edit button
- Consistent spacing and typography matching Quiver design

## Accessibility

- Proper heading hierarchy (`<h4>` for section titles)
- ARIA label on edit button
- Semantic HTML structure
- Color contrast meets WCAG AA standards

## Related Components

- **ProfilePreferences** (`profile-preferences.tsx`) - Edit form for these preferences
- **PreferencesStep** (`onboarding/steps/preferences-step.tsx`) - Onboarding version
- **LearnedPreferencesDisplay** (`learned-preferences-display.tsx`) - Shows learned preferences from sessions

## Constants

The component uses the same preference constants as other Quiver components:
- `EXPERIENCE_LEVELS` - 4 levels with emojis
- `SURF_STYLES` - 6 styles with emojis
- `WAVE_SIZES` - 4 size categories with descriptions
- `BREAK_TYPES` - 4 break types with descriptions
- `CROWD_PREFERENCES` - 3 crowd tolerance levels

## Example Data

See `preferences-display-card.example.tsx` for complete usage examples and mock data.

## Testing Considerations

When testing this component:
1. Test with all preferences set
2. Test with no preferences set (empty state)
3. Test with partial preferences
4. Test edit button functionality (when provided)
5. Test responsive layout on mobile
6. Test with various surf style combinations

## Migration from ProfilePreferences

If you were previously using `ProfilePreferences` for read-only display, you can replace it with:

```tsx
// Before (showing edit form when user just wants to view)
<ProfilePreferences userId={userId} profile={profile} beaches={beaches} />

// After (read-only display with optional edit link)
<PreferencesDisplayCard
  profile={profile}
  onEdit={() => router.push('/profile/preferences')}
/>
```

## Performance

- Lightweight component with no external API calls
- Minimal re-renders (uses React best practices)
- No heavy computations
- Fast initial render

## Browser Support

Works in all modern browsers supported by Next.js 14+:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers

## Future Enhancements

Potential improvements:
- [ ] Animation on preference changes
- [ ] Tooltip explanations for each preference
- [ ] Print-friendly styling
- [ ] Export preferences as JSON/PDF
- [ ] Share profile preferences link

## Contributing

When modifying this component:
1. Maintain consistency with `profile-preferences.tsx` constants
2. Test all null/empty states
3. Update this README if adding new features
4. Add examples to `preferences-display-card.example.tsx`
5. Ensure accessibility standards are maintained

## Questions?

For questions about this component, refer to:
- Component code: `components/profile/preferences-display-card.tsx`
- Example usage: `components/profile/preferences-display-card.example.tsx`
- Related edit form: `components/profile/profile-preferences.tsx`
- Quiver CLAUDE.md for project-wide patterns
