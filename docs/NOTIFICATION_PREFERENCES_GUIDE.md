# Notification Preferences Guide

## Overview

Quiver provides comprehensive notification preferences that give users granular control over how they receive updates. This guide covers the notification preferences system implementation, usage, and architecture.

## User Experience

### Location

Notification preferences are accessible in the **Edit Profile** modal, available from:

- Profile page → "Edit Profile" button
- Settings menu → Profile section

### Preference Structure

The notification preferences are organized in two tiers:

#### Master Toggles (Always Visible)

1. **Push Notifications** 🔔

   - Controls all push notifications to mobile devices and web browsers
   - When disabled, no push notifications will be sent regardless of feature settings

2. **Email Notifications** ✉️

   - Controls all email notifications
   - When disabled, no emails will be sent regardless of feature settings

3. **In-App Notifications** 📱
   - Controls in-app notification badges and feeds
   - When disabled, no in-app notifications will appear

#### Feature Toggles (Advanced Settings - Collapsible)

1. **Session Invites** 👥

   - Notifications when friends invite you to surf sessions
   - Honors master channel toggles

2. **Likes** ❤️

   - Notifications when someone likes your sessions or content
   - Honors master channel toggles

3. **Follows** 👤

   - Notifications when someone follows you
   - Honors master channel toggles

4. **Reminders** ⏰

   - Notifications for upcoming planned sessions
   - Honors master channel toggles

5. **XP Updates** ✨
   - Notifications for level ups, achievements, and XP milestones
   - Honors master channel toggles

### Responsive Design

- **Desktop**: Advanced Settings display in 2-column grid
- **Mobile**: Advanced Settings stack in single column
- **Modal**: Consistent with existing Edit Profile modal width (600px max)

## Database Schema

### New Columns in `profiles` Table

```sql
-- Master toggles
notif_push_enabled      BOOLEAN NOT NULL DEFAULT true
notif_email_enabled     BOOLEAN NOT NULL DEFAULT true
notif_inapp_enabled     BOOLEAN NOT NULL DEFAULT true

-- Feature toggles
notif_session_invites   BOOLEAN NOT NULL DEFAULT true
notif_likes             BOOLEAN NOT NULL DEFAULT true
notif_follows           BOOLEAN NOT NULL DEFAULT true
notif_reminders         BOOLEAN NOT NULL DEFAULT true
notif_xp_updates        BOOLEAN NOT NULL DEFAULT true
```

### Migration

File: `supabase/migrations/20250117000000_add_notification_preferences.sql`

- Safely adds columns with `IF NOT EXISTS` checks
- Sets sensible defaults (all true - opt-out model)
- Includes column comments for documentation
- Transaction-wrapped for safety

## Architecture

### Component Structure

```
components/
  profile/
    notifications-section.tsx    # New notification preferences UI
  edit-profile-form.tsx          # Integrates NotificationsSection
  edit-profile-modal.tsx         # Modal wrapper (unchanged)
```

### Data Flow

1. **Loading**: Profile data fetched with notification preferences
2. **Form State**: react-hook-form manages all toggle states
3. **Validation**: Zod schema ensures type safety
4. **Submission**: All preferences saved atomically with profile update
5. **Revalidation**: Cache cleared to show updated preferences immediately

### Form Integration

The NotificationsSection integrates seamlessly with the existing EditProfileForm:

```typescript
// In edit-profile-form.tsx
import { NotificationsSection } from "@/components/profile/notifications-section";

// Add to schema
const profileFormSchema = z.object({
  // ... existing fields
  notif_push_enabled: z.boolean().optional(),
  notif_email_enabled: z.boolean().optional(),
  notif_inapp_enabled: z.boolean().optional(),
  notif_session_invites: z.boolean().optional(),
  notif_likes: z.boolean().optional(),
  notif_follows: z.boolean().optional(),
  notif_reminders: z.boolean().optional(),
  notif_xp_updates: z.boolean().optional(),
});

// In form render
<NotificationsSection control={form.control} />;
```

## Implementation Patterns

### Toggle Row Component

Reusable component pattern for consistent toggle rows:

```typescript
const ToggleRow = ({ name, label, Icon }) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <FormLabel>{label}</FormLabel>
        </div>
        <FormControl>
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            className="data-[state=checked]:bg-[#0077B6]"
          />
        </FormControl>
      </FormItem>
    )}
  />
);
```

### Icons Used

All icons from `lucide-react`:

- `Bell` - Push Notifications
- `Mail` - Email Notifications
- `AppWindow` - In-App Notifications
- `UserPlus` - Session Invites
- `Heart` - Likes
- `Users` - Follows
- `Clock` - Reminders
- `Sparkles` - XP Updates
- `ChevronDown` - Advanced Settings toggle

## Design System

### Colors (Quiver Brand)

- **Primary (Ocean Blue)**: `#0077B6`

  - Switch active state
  - Focus rings
  - Hover effects

- **Accent (Sunset Orange)**: `#FF7F11`

  - Reserved for CTAs (not used in toggles)

- **Text Colors**:
  - Light mode: `text-gray-900`
  - Dark mode: `text-gray-100`
  - Muted: `text-gray-500`

### Spacing & Typography

- Section gap: `gap-2` (8px)
- Row padding: `py-3` (12px vertical)
- Title: `text-base font-semibold` (16px)
- Labels: `text-sm` (14px)
- Helper text: `text-xs` (12px)

### Interactive States

- **Focus**: `peer-focus:ring-2 peer-focus:ring-[#0077B6]/50`
- **Hover**: `hover:shadow-[0_0_0_3px_rgba(0,119,182,0.15)]`
- **Active (checked)**: `data-[state=checked]:bg-[#0077B6]`

## Notification Logic

### Master Toggle Hierarchy

When checking if a notification should be sent:

```typescript
function shouldSendNotification(
  profile: Profile,
  channel: "push" | "email" | "inapp",
  feature: "session_invites" | "likes" | "follows" | "reminders" | "xp_updates"
): boolean {
  // Check master toggle first
  const masterEnabled = {
    push: profile.notif_push_enabled,
    email: profile.notif_email_enabled,
    inapp: profile.notif_inapp_enabled,
  }[channel];

  if (!masterEnabled) return false;

  // Then check feature toggle
  const featureEnabled = {
    session_invites: profile.notif_session_invites,
    likes: profile.notif_likes,
    follows: profile.notif_follows,
    reminders: profile.notif_reminders,
    xp_updates: profile.notif_xp_updates,
  }[feature];

  return featureEnabled;
}
```

### Usage in Notification Services

```typescript
// Example: Session invite notification
import { getProfile } from "@/actions/profile-actions";

async function sendSessionInviteNotification(userId: string, inviteData: any) {
  const profile = await getProfile(userId);

  // Check if user wants push notifications for session invites
  if (shouldSendNotification(profile, "push", "session_invites")) {
    await sendPushNotification(userId, inviteData);
  }

  // Check if user wants email notifications for session invites
  if (shouldSendNotification(profile, "email", "session_invites")) {
    await sendEmailNotification(userId, inviteData);
  }

  // Check if user wants in-app notifications for session invites
  if (shouldSendNotification(profile, "inapp", "session_invites")) {
    await createInAppNotification(userId, inviteData);
  }
}
```

## Accessibility

### Keyboard Navigation

- All toggles accessible via Tab key
- Enter/Space keys toggle switches
- Collapsible opens/closes with Enter/Space
- Focus order follows visual hierarchy

### Screen Readers

- All switches have proper ARIA labels
- Icons marked with `aria-hidden="true"`
- Switch states announced automatically (Radix UI)
- Clear section headings for navigation

### Color Contrast

- Text colors meet WCAG AA standards
- Focus rings clearly visible
- Works in both light and dark modes

## Testing

### Component Tests

File: `__tests__/components/notifications-section.test.tsx`

Tests cover:

- ✅ Section rendering with title and description
- ✅ All master toggle rows present
- ✅ Advanced Settings collapsible functionality
- ✅ Feature toggles visible when expanded
- ✅ Switch interactivity and state changes
- ✅ ARIA labels and accessibility attributes
- ✅ Dark mode class application

### Integration Tests

Verify:

- Profile updates persist all notification preferences
- Form validation accepts new fields
- Default values applied correctly for new users

### Manual Testing Checklist

- [ ] Master toggles update form state
- [ ] Advanced Settings expand/collapse smoothly
- [ ] Grid layout responsive on mobile/desktop
- [ ] Focus states visible when tabbing
- [ ] Dark mode colors render correctly
- [ ] Save button persists all 8 preferences
- [ ] Preferences load correctly on modal reopen

## Future Enhancements

### Potential Features

1. **Visual Feedback for Master Toggles**

   - Gray out feature toggles when master toggle is OFF
   - Add tooltips explaining hierarchy

2. **Per-Channel Feature Toggles**

   - "Receive likes via push but not email"
   - More granular than current 2-tier system

3. **Notification Frequency Controls**

   - Immediate, hourly digest, daily digest
   - Quiet hours (e.g., no push after 10pm)

4. **Preview Mode**

   - "Send me a test notification" button
   - Helps users understand what they'll receive

5. **Smart Defaults**
   - ML-based preference suggestions
   - Based on user behavior patterns

## Troubleshooting

### Preferences Not Saving

1. Check browser console for errors
2. Verify database migration ran successfully
3. Ensure profile-actions.ts validation includes new fields
4. Check RLS policies on profiles table

### Toggles Not Appearing

1. Verify NotificationsSection imported correctly
2. Check form control passed to component
3. Ensure profile data includes notification fields

### Default Values Not Applied

1. Check form defaultValues in edit-profile-form.tsx
2. Verify database columns have DEFAULT true
3. Ensure profile fetch includes new columns

## Related Documentation

- [Push Notifications Setup](./PUSH_NOTIFICATIONS_SETUP.md)
- [Web Push Implementation](./WEB_PUSH_SETUP.md)
- [Notification Testing Guide](./NOTIFICATION_TESTING_GUIDE.md)
- [Session Notifications Guide](./SESSION_NOTIFICATIONS_GUIDE.md)

## Support

For questions or issues related to notification preferences:

1. Check this guide first
2. Review component tests for usage examples
3. Inspect NotificationsSection component code
4. Open an issue with reproduction steps
