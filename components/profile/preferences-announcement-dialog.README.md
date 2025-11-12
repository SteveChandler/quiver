# PreferencesAnnouncementDialog Component

A welcome dialog component to announce enhanced profile preferences to returning users.

## Overview

This component displays a modal dialog that informs users about the new profile preference options and encourages them to update their profile for better personalized recommendations.

## Features

- ✨ Clean, welcoming design with gradient backgrounds
- 📱 Fully responsive (mobile and desktop)
- ♿ Accessible (keyboard navigation, ARIA labels)
- 🎨 Matches Quiver design system
- 🔔 Highlights 5 new/enhanced preference fields with emojis

## Props

```typescript
interface PreferencesAnnouncementDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Called when user dismisses the dialog */
  onClose: () => void;
  /** Called when user clicks "Update Profile" */
  onUpdateProfile: () => void;
}
```

## Usage Example

### Basic Integration

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreferencesAnnouncementDialog } from '@/components/profile/preferences-announcement-dialog';

export function ProfileView() {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const router = useRouter();

  return (
    <>
      {/* Your profile content */}
      <div>Profile content...</div>

      {/* Preferences announcement dialog */}
      <PreferencesAnnouncementDialog
        open={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
        onUpdateProfile={() => {
          setShowAnnouncement(false);
          router.push('/profile/preferences');
        }}
      />
    </>
  );
}
```

### Integration with localStorage (Show Once)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PreferencesAnnouncementDialog } from '@/components/profile/preferences-announcement-dialog';

const ANNOUNCEMENT_KEY = 'preferences_announcement_shown';

export function ProfileView() {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if announcement has been shown before
    const hasSeenAnnouncement = localStorage.getItem(ANNOUNCEMENT_KEY);

    if (!hasSeenAnnouncement) {
      // Show announcement after a short delay
      const timer = setTimeout(() => {
        setShowAnnouncement(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setShowAnnouncement(false);
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true');
  };

  const handleUpdateProfile = () => {
    handleClose();
    router.push('/profile/preferences');
  };

  return (
    <>
      {/* Your profile content */}
      <div>Profile content...</div>

      <PreferencesAnnouncementDialog
        open={showAnnouncement}
        onClose={handleClose}
        onUpdateProfile={handleUpdateProfile}
      />
    </>
  );
}
```

### Integration with Database Flag (Server-Side Tracking)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { PreferencesAnnouncementDialog } from '@/components/profile/preferences-announcement-dialog';

export function ProfileView() {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check if user has seen the announcement
    const checkAnnouncementStatus = async () => {
      try {
        const response = await fetch('/api/user/preferences-announcement-status');
        const data = await response.json();

        if (!data.hasSeenAnnouncement) {
          // Show announcement after a short delay
          setTimeout(() => {
            setShowAnnouncement(true);
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to check announcement status:', error);
      }
    };

    checkAnnouncementStatus();
  }, [user]);

  const handleClose = async () => {
    setShowAnnouncement(false);

    // Mark announcement as seen in database
    try {
      await fetch('/api/user/preferences-announcement-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seen: true }),
      });
    } catch (error) {
      console.error('Failed to update announcement status:', error);
    }
  };

  const handleUpdateProfile = () => {
    handleClose();
    router.push('/profile/preferences');
  };

  return (
    <>
      {/* Your profile content */}
      <div>Profile content...</div>

      <PreferencesAnnouncementDialog
        open={showAnnouncement}
        onClose={handleClose}
        onUpdateProfile={handleUpdateProfile}
      />
    </>
  );
}
```

## Feature Highlights Displayed

The dialog showcases these 5 preference options:

1. **🏄‍♂️ Experience Level** - Choose from Beginner to Expert
2. **🏄 Surf Styles** - Select your favorite boards and styles
3. **🌊 Preferred Wave Size** - From small rollers to big barrels
4. **🏖️ Preferred Break Type** - Beach, reef, or point breaks
5. **👥 Crowd Preference** - Social sessions or peaceful solitude

## Behavior

- **Open/Close**: Controlled via the `open` prop
- **Dismissal**: Users can dismiss by:
  - Clicking "Maybe Later" button
  - Pressing ESC key
  - Clicking outside the dialog
  - Clicking the X button in the top-right corner
- **Primary Action**: "Update Profile" navigates to preferences page
- **Mobile Responsive**: Buttons stack vertically on mobile

## Accessibility

- Proper ARIA labels for screen readers
- Keyboard navigable (Tab, Shift+Tab, ESC)
- Focus management handled by Radix UI Dialog
- Semantic HTML structure

## Styling

- Uses Tailwind CSS classes
- Gradient backgrounds for visual appeal
- Hover effects on feature highlights
- Matches Quiver design system colors and spacing
- Responsive design with mobile-first approach

## Dependencies

- `@radix-ui/react-dialog` (via shadcn/ui)
- `lucide-react` (Sparkles icon)
- Tailwind CSS
- Next.js (for routing)

## Related Components

- `PreferencesDisplayCard` - Read-only display of preferences
- `ProfilePreferences` - Edit form for preferences
- `EditProfileForm` - Main profile editing form

## API Routes (Optional)

If using server-side tracking, you'll need these API routes:

### GET `/api/user/preferences-announcement-status`

Returns whether the user has seen the announcement:

```json
{
  "hasSeenAnnouncement": false
}
```

### POST `/api/user/preferences-announcement-status`

Marks the announcement as seen:

```json
{
  "seen": true
}
```

## Testing

### Manual Testing

1. Navigate to profile page
2. Verify dialog appears (if conditions are met)
3. Test "Maybe Later" button - should close dialog
4. Test "Update Profile" button - should navigate to preferences
5. Test ESC key - should close dialog
6. Test click outside - should close dialog
7. Test on mobile devices for responsive behavior

### E2E Testing (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Preferences Announcement Dialog', () => {
  test('should display announcement dialog', async ({ page }) => {
    await page.goto('/profile');

    // Wait for dialog to appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('We've Enhanced Your Profile Preferences!')).toBeVisible();
  });

  test('should close on "Maybe Later"', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Maybe Later' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should navigate to preferences on "Update Profile"', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Update Profile' }).click();
    await expect(page).toHaveURL('/profile/preferences');
  });

  test('should close on ESC key', async ({ page }) => {
    await page.goto('/profile');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

## Customization

### Changing Feature Highlights

Edit the `FEATURE_HIGHLIGHTS` constant in the component:

```typescript
const FEATURE_HIGHLIGHTS = [
  {
    emoji: '🏄‍♂️',
    title: 'Your Custom Title',
    description: 'Your custom description',
  },
  // ... more features
];
```

### Changing Colors

Modify the Tailwind classes in the component:

```tsx
// Gradient header icon
className="bg-gradient-to-br from-blue-500 to-teal-500"

// Feature highlight backgrounds
className="bg-gradient-to-r from-blue-50 to-teal-50"

// Primary button
className="bg-gradient-to-r from-blue-500 to-teal-500"
```

## Migration Notes

If you're adding this to an existing Quiver installation:

1. Add the component file to `components/profile/`
2. Choose integration strategy (localStorage vs database)
3. Add to ProfileView or relevant parent component
4. Test thoroughly before deploying
5. Consider adding database migration if using server-side tracking
6. Update CHANGELOG.md

## License

Part of the Quiver surfing application.
