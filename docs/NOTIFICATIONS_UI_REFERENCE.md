# Notifications Section - UI Reference

## Visual Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Edit Profile                                          [X]    │
│  Update your personal information and preferences            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  [Avatar with "Change Photo" button]                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Name         [John Surfer                            ]│ │
│  │ Bio          [Catching waves since 2010              ]│ │
│  │ Location     [San Diego, CA                          ]│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  Surf Information                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Home Beach       [La Jolla Shores                    ]│ │
│  │ Experience Level [Intermediate                       ]│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│  ┃ Notifications                                          ┃ │
│  ┃ Choose how you'd like to get updates about your       ┃ │
│  ┃ sessions and friends.                                  ┃ │
│  ┃                                                        ┃ │
│  ┃ You can change these anytime — we'll only notify you  ┃ │
│  ┃ about things you care about.                          ┃ │
│  ┃                                                        ┃ │
│  ┃ ┌────────────────────────────────────────────────────┐┃ │
│  ┃ │ 🔔 Push Notifications              [━━━━━●]       ││┃ │
│  ┃ ├────────────────────────────────────────────────────┤┃ │
│  ┃ │ ✉️  Email Notifications             [━━━━━●]       ││┃ │
│  ┃ ├────────────────────────────────────────────────────┤┃ │
│  ┃ │ 📱 In-App Notifications            [━━━━━●]       ││┃ │
│  ┃ └────────────────────────────────────────────────────┘┃ │
│  ┃                                                        ┃ │
│  ┃ ▼ Advanced Settings                                   ┃ │
│  ┃ ┌──────────────────────────┬─────────────────────────┐┃ │
│  ┃ │ 👥 Session Invites       │ ❤️  Likes               ││┃ │
│  ┃ │    [━━━━━●]             │    [━━━━━●]            ││┃ │
│  ┃ ├──────────────────────────┼─────────────────────────┤┃ │
│  ┃ │ 👤 Follows               │ ⏰ Reminders            ││┃ │
│  ┃ │    [━━━━━●]             │    [━━━━━●]            ││┃ │
│  ┃ ├──────────────────────────┼─────────────────────────┤┃ │
│  ┃ │ ✨ XP Updates            │                         ││┃ │
│  ┃ │    [━━━━━●]             │                         ││┃ │
│  ┃ └──────────────────────────┴─────────────────────────┘┃ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                               │
│  Social Media                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Instagram    [@johnsurfer                            ]│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                                         [Cancel] [Save Changes]│
└──────────────────────────────────────────────────────────────┘
```

## Toggle States

### ON State (Ocean Blue)

```
[━━━━━●]  Checked (background: #0077B6, thumb: white)
```

### OFF State (Gray)

```
[●━━━━━]  Unchecked (background: gray, thumb: white)
```

## Mobile View

```
┌──────────────────────────────┐
│  Edit Profile          [X]   │
│  Update your information     │
├──────────────────────────────┤
│                              │
│  [Avatar + Change Photo]     │
│                              │
│  Name, Bio, Location...      │
│                              │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│  ┃ Notifications          ┃ │
│  ┃ Description text       ┃ │
│  ┃                        ┃ │
│  ┃ 🔔 Push     [━━━━━●]  ┃ │
│  ┃ ✉️  Email    [━━━━━●]  ┃ │
│  ┃ 📱 In-App   [━━━━━●]  ┃ │
│  ┃                        ┃ │
│  ┃ ▼ Advanced Settings    ┃ │
│  ┃ 👥 Session Invites     ┃ │
│  ┃    [━━━━━●]           ┃ │
│  ┃ ❤️  Likes              ┃ │
│  ┃    [━━━━━●]           ┃ │
│  ┃ 👤 Follows             ┃ │
│  ┃    [━━━━━●]           ┃ │
│  ┃ ⏰ Reminders           ┃ │
│  ┃    [━━━━━●]           ┃ │
│  ┃ ✨ XP Updates          ┃ │
│  ┃    [━━━━━●]           ┃ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                              │
│  Instagram field...          │
│                              │
├──────────────────────────────┤
│  [Cancel]     [Save Changes] │
└──────────────────────────────┘
```

## Interactive States

### Focus State

```
┌─────────────────────────────────┐
│ 🔔 Push Notifications          │ ← Blue 2px ring at 50% opacity
│    [━━━━━●] ← Blue glow        │   when switch is focused
└─────────────────────────────────┘
```

### Hover State

```
┌─────────────────────────────────┐
│ 🔔 Push Notifications          │
│    [━━━━━●] ← Soft glow effect │   rgba(0, 119, 182, 0.15)
└─────────────────────────────────┘
```

### Collapsed Advanced Settings

```
► Advanced Settings
```

### Expanded Advanced Settings

```
▼ Advanced Settings
  [Grid of 5 feature toggles below]
```

## Color Specifications

### Light Mode

- **Primary**: Ocean Blue `#0077B6`
- **Text**: Dark Gray `#333333` / Tailwind `text-gray-900`
- **Muted**: Gray 500 `text-gray-500`
- **Divider**: Light Gray `#E7E7E7`
- **Background**: White

### Dark Mode

- **Primary**: Ocean Blue `#0077B6` (same)
- **Text**: Light Gray `text-gray-100`
- **Muted**: Gray 400 `text-gray-400`
- **Divider**: Dark Gray `#2B2B2B`
- **Background**: Dark

## Spacing Measurements

```
Section Gap: 8px (gap-2)
Row Padding: 12px vertical (py-3)
Icon-Label Gap: 12px (gap-3)
Icon Size: 20px (h-5 w-5)

Section Title: 16px / 600 (text-base font-semibold)
Description: 14px / 400 (text-sm)
Helper Text: 12px / 400 (text-xs text-muted)
Labels: 14px / 400 (text-sm)

Modal Width: 600px max (sm:max-w-[600px])
Modal Border Radius: 16px (rounded-2xl)
Switch Size: 24px height, 44px width
```

## Accessibility Features Visual Indicators

### Focus Visible

```
┌─────────────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ ← 2px Ocean Blue ring
│ ┃ 🔔 Push Notifications     ┃ │   when keyboard focused
│ ┃    [━━━━━●]              ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
└─────────────────────────────────┘
```

### Screen Reader Announcement

```
When toggle is switched:
"Push Notifications, checked" or
"Push Notifications, not checked"
```

## Grid Breakpoints

### Desktop (≥768px)

```
┌──────────────────┬──────────────────┐
│ Session Invites  │ Likes            │
├──────────────────┼──────────────────┤
│ Follows          │ Reminders        │
├──────────────────┼──────────────────┤
│ XP Updates       │                  │
└──────────────────┴──────────────────┘
```

### Mobile (<768px)

```
┌──────────────────────────────┐
│ Session Invites              │
├──────────────────────────────┤
│ Likes                        │
├──────────────────────────────┤
│ Follows                      │
├──────────────────────────────┤
│ Reminders                    │
├──────────────────────────────┤
│ XP Updates                   │
└──────────────────────────────┘
```

## Typography Hierarchy

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Notifications                ┃ ← 16px / 600 (Roboto)
┃ Choose how you'd like to get ┃ ← 14px / 400 (Open Sans)
┃ updates about your sessions  ┃
┃                              ┃
┃ You can change these anytime ┃ ← 12px / 400 (Open Sans, muted)
┃                              ┃
┃ 🔔 Push Notifications       ┃ ← 14px / 400 (Open Sans)
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## Component Hierarchy

```
NotificationsSection
├── Section Header
│   ├── h3 (title)
│   ├── p (description)
│   └── p (helper text, muted)
├── Master Toggles Container (with dividers)
│   ├── ToggleRow (Push)
│   ├── ToggleRow (Email)
│   └── ToggleRow (In-App)
└── details (Advanced Settings)
    ├── summary (with chevron)
    └── Grid Container
        ├── ToggleRow (Session Invites)
        ├── ToggleRow (Likes)
        ├── ToggleRow (Follows)
        ├── ToggleRow (Reminders)
        └── ToggleRow (XP Updates)

ToggleRow
├── Icon (lucide-react)
├── Label (FormLabel)
└── Switch (Radix UI)
```

## Animation Specifications

### Details Chevron

```css
transition: transform 200ms ease
group-open:rotate-180
```

### Switch Toggle

```css
transition: transform 200ms ease
data-[state=checked]:translate-x-5
```

### Hover Glow

```css
transition: box-shadow 200ms ease
hover:shadow-[0_0_0_3px_rgba(0,119,182,0.15)]
```

## Real Content Examples

### With All Toggles ON

```
🔔 Push Notifications             [━━━━━●]
✉️  Email Notifications            [━━━━━●]
📱 In-App Notifications           [━━━━━●]

▼ Advanced Settings
  👥 Session Invites    [━━━━━●]    ❤️  Likes        [━━━━━●]
  👤 Follows            [━━━━━●]    ⏰ Reminders    [━━━━━●]
  ✨ XP Updates         [━━━━━●]
```

### With Some Toggles OFF

```
🔔 Push Notifications             [●━━━━━]  ← OFF
✉️  Email Notifications            [━━━━━●]  ← ON
📱 In-App Notifications           [━━━━━●]  ← ON

▼ Advanced Settings
  👥 Session Invites    [━━━━━●]    ❤️  Likes        [●━━━━━]  ← OFF
  👤 Follows            [━━━━━●]    ⏰ Reminders    [●━━━━━]  ← OFF
  ✨ XP Updates         [━━━━━●]
```

## Edge Cases

### Long Labels (should not wrap on desktop)

```
┌──────────────────────────────────────┐
│ 🔔 Very Long Notification Type Name │
│    That Could Potentially Wrap       │
│                            [━━━━━●] │
└──────────────────────────────────────┘
```

### Narrow Mobile Viewports

```
┌──────────────────────────┐
│ 🔔 Push              │ ← Label truncates
│    Notifications     │    if needed
│    [━━━━━●]         │
└──────────────────────────┘
```

---

**Reference**: This UI matches the design specification provided, implementing Ocean Blue (#0077B6) as the primary brand color for all interactive states and maintaining Quiver's established design system.
