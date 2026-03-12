# Time-Based Greeting System

A time-aware greeting component system for the Quiver home screen that displays personalized greetings based on the time of day.

## Overview

This feature provides a clean, friendly greeting that adapts to the time of day:
- "Good morning, [Name]." (5:00 AM - 11:59 AM)
- "Good afternoon, [Name]." (12:00 PM - 4:59 PM)
- "Good evening, [Name]." (5:00 PM - 4:59 AM)

## Architecture

### Components

```
lib/utils/greeting-utils.ts          # Core utility functions
components/home-screen/
  ├── use-time-of-day.ts             # React hook for time detection
  ├── greeting-section.tsx            # UI component
  ├── greeting-section.example.tsx    # Usage examples
  └── GREETING_README.md             # This file
```

### File Descriptions

#### `lib/utils/greeting-utils.ts`
Core utilities for time-based greetings:
- `getTimeOfDay(date?)` - Determines time period from date
- `getGreeting(timeOfDay)` - Gets greeting text
- `getGreetingWithName(userName, timeOfDay?)` - Complete greeting with name

#### `components/home-screen/use-time-of-day.ts`
React hook that:
- Returns current time of day
- Automatically updates when period changes
- Efficiently schedules updates (not every second)
- Can be disabled with `enableAutoUpdate: false`

#### `components/home-screen/greeting-section.tsx`
UI component that:
- Displays the greeting with proper styling
- Uses Tailwind CSS for responsive design
- Falls back to "Surfer" when no name provided
- Supports custom className for flexibility

## Usage

### Basic Usage

```tsx
import { GreetingSection } from "@/components/home-screen/greeting-section";
import { useTimeOfDay } from "@/components/home-screen/use-time-of-day";

export function HomeScreen() {
  const { timeOfDay } = useTimeOfDay();

  return (
    <GreetingSection
      userName="John Doe"
      timeOfDay={timeOfDay}
    />
  );
}
```

### With Authentication

```tsx
import { GreetingSection } from "@/components/home-screen/greeting-section";
import { useTimeOfDay } from "@/components/home-screen/use-time-of-day";
import { useAuth } from "@/context/auth-context";
import { useCachedProfile } from "@/hooks/use-cached-profile";

export function HomeScreen() {
  const { user } = useAuth();
  const { profile } = useCachedProfile();
  const { timeOfDay } = useTimeOfDay();

  return (
    <GreetingSection
      userName={user ? profile?.full_name || null : null}
      timeOfDay={timeOfDay}
    />
  );
}
```

### Static Time (No Auto-Update)

```tsx
import { GreetingSection } from "@/components/home-screen/greeting-section";
import { useTimeOfDay } from "@/components/home-screen/use-time-of-day";

export function StaticGreeting() {
  // Time won't update automatically
  const { timeOfDay } = useTimeOfDay({ enableAutoUpdate: false });

  return (
    <GreetingSection
      userName="Surfer"
      timeOfDay={timeOfDay}
    />
  );
}
```

## Time Periods

The system divides the day into three periods:

| Period    | Hours (24h) | Hours (12h)    | Greeting          |
|-----------|-------------|----------------|-------------------|
| Morning   | 5:00 - 11:59| 5 AM - 11:59 AM| Good morning      |
| Afternoon | 12:00 - 16:59| 12 PM - 4:59 PM| Good afternoon    |
| Evening   | 17:00 - 4:59| 5 PM - 4:59 AM | Good evening      |

## TypeScript Types

```typescript
export type TimeOfDay = "morning" | "afternoon" | "evening";

export interface GreetingSectionProps {
  userName: string | null;
  timeOfDay: TimeOfDay;
  className?: string;
}

export interface UseTimeOfDayOptions {
  enableAutoUpdate?: boolean;
}

export interface UseTimeOfDayReturn {
  timeOfDay: TimeOfDay;
}
```

## Testing

Comprehensive test coverage with 9 unit tests:

```bash
# Run tests
yarn test:unit __tests__/lib/utils/greeting-utils.test.ts

# Run all tests
yarn test:unit
```

Test coverage includes:
- ✅ All time period boundaries
- ✅ Morning period detection (5am - 11:59am)
- ✅ Afternoon period detection (12pm - 4:59pm)
- ✅ Evening period detection (5pm - 4:59am)
- ✅ Greeting text generation
- ✅ Name handling (null, empty, provided)
- ✅ Automatic time detection

## Performance

The `useTimeOfDay` hook is optimized for performance:

1. **Smart Updates**: Only re-renders when time period changes
2. **Efficient Scheduling**: Calculates exact milliseconds until next period
3. **Single Timer**: Uses one setTimeout per period change
4. **No Polling**: Doesn't check time every second
5. **Clean Cleanup**: Properly clears timers on unmount

## Accessibility

- Semantic HTML (`<h1>` for greeting)
- Clear, readable text hierarchy
- Responsive text sizing (sm, md, lg breakpoints)
- High contrast text color (text-gray-900)

## Styling

Default Tailwind classes:
```css
text-2xl sm:text-3xl lg:text-4xl /* Responsive sizing */
font-medium                       /* Medium weight */
text-gray-900                     /* Dark gray */
leading-tight                     /* Tight line height */
```

Override with custom `className` prop:
```tsx
<GreetingSection
  userName="Surfer"
  timeOfDay="morning"
  className="text-center py-8"
/>
```

## Integration with Home Screen

Replace the existing greeting section in `components/home-screen/index.tsx`:

```tsx
// OLD
<h2 className="text-3xl sm:text-4xl font-heading font-bold leading-tight sm:leading-[44px] text-gray-900">
  Hey, {user ? profile?.full_name || "Surfer" : "Guest"}!
</h2>

// NEW
import { GreetingSection } from "./greeting-section";
import { useTimeOfDay } from "./use-time-of-day";

// In component
const { timeOfDay } = useTimeOfDay();

<GreetingSection
  userName={user ? profile?.full_name || null : null}
  timeOfDay={timeOfDay}
/>
```

## Future Enhancements

Potential improvements:
- [ ] Internationalization (i18n) support
- [ ] Custom time period definitions
- [ ] Animation on period change
- [ ] Server-side rendering support
- [ ] Time-based emoji icons
- [ ] User-configurable greetings

## Related Files

- `/lib/utils/date-utils.ts` - Date/time formatting utilities
- `/components/home-screen/index.tsx` - Main home screen component
- `/context/auth-context.tsx` - Authentication context
- `/hooks/use-cached-profile.ts` - User profile hook

## Questions or Issues?

For questions about this feature, check:
1. Example file: `greeting-section.example.tsx`
2. Test file: `__tests__/lib/utils/greeting-utils.test.ts`
3. CHANGELOG.md entry for implementation notes
