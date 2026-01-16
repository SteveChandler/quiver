# Time Slot Discovery Filter — Design Document

**Date**: 2026-01-16
**Status**: Ready for implementation
**Author**: Collaborative brainstorm session

---

## Problem Statement

The surf discovery algorithm currently answers "best beach at best time" but users often want to answer "best beach for MORNING" (or another specific time window). When a user can only surf in the morning, they need recommendations constrained to that time slot rather than seeing afternoon windows ranked higher due to better conditions.

### Example Scenario

- User checks the app at 7pm Thursday
- Algorithm recommends Ocean Beach at "Tomorrow 4-8pm" (score 8.7)
- User wants to surf tomorrow MORNING before work
- Big Jetty at 8am (score 8.1) would be the better recommendation for their constraint
- Currently, there's no way to express this preference

---

## Solution: Time Slot Filter

Add a time slot selector to the discovery UI that constrains all recommendations to windows starting within the selected time range.

---

## User Interface

### Location
Home screen discovery card, below the "Your Top Spots" heading.

### Time Slot Options

| Slot | Hours (local time) | Use Case |
|------|-------------------|----------|
| **Any time** | 6am-9pm | Current default behavior |
| **Dawn patrol** | 6am-9am | Early risers, before work |
| **Morning** | 6am-12pm | General morning session |
| **Afternoon** | 12pm-6pm | Post-work or midday session |

### UI Treatment
- Horizontal pill/chip selector (similar to existing badge styling)
- Tapping a chip filters all recommendations to that time window
- Selected chip shows active state
- Default: "Any time" (preserves current behavior)

### Filtered Behavior
- Beaches with no viable window in the selected time slot are excluded from results
- Badge updates to show constrained window (e.g., "Tomorrow 7-10am" instead of "Tomorrow 4-8pm")
- Scores recalculated based on best window *within* the time slot

### Empty State
If no beaches have good conditions in the selected time slot:
> "No great morning windows tomorrow. Best conditions start at 2pm."
> [Clear filter]

---

## Algorithm Changes

### File to Modify
`lib/services/surf-discovery-service.ts`

### New Types

```typescript
type TimeSlot = 'any' | 'morning' | 'afternoon' | 'dawn-patrol';

// Add to SurfDiscoveryOptions interface
interface SurfDiscoveryOptions {
  // ... existing options
  timeSlot?: TimeSlot;  // defaults to 'any'
}
```

### Time Slot Definitions

```typescript
const TIME_SLOT_RANGES: Record<TimeSlot, { startHour: number; endHour: number }> = {
  'any': { startHour: 6, endHour: 21 },
  'dawn-patrol': { startHour: 6, endHour: 9 },
  'morning': { startHour: 6, endHour: 12 },
  'afternoon': { startHour: 12, endHour: 18 },
};
```

### Filter Logic in `selectBestWindow`

Before the scoring loop, filter forecasts to only include windows starting within the time slot:

```typescript
// After existing daylight filter, add time slot filter
if (timeSlot && timeSlot !== 'any') {
  const { startHour, endHour } = TIME_SLOT_RANGES[timeSlot];

  scoredForecasts = scoredForecasts.filter(({ forecastTime }) => {
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(forecastTime),
      10
    );
    return localHour >= startHour && localHour < endHour;
  });
}
```

### Time Decay Within Slot

When a time slot is selected, time decay can be reduced or removed within that slot. If the user explicitly wants "morning", a 7am window and an 11am window should compete primarily on conditions rather than proximity.

**Option A (Recommended):** Reduce `TIME_DECAY_PER_HOUR` to 0.25 when time slot is constrained
**Option B:** Remove time decay entirely within the slot

---

## API Changes

### Endpoint
`GET /api/surf/insights`

### New Query Parameter
```
?timeSlot=morning
```

### Validation
- Accept: `any`, `morning`, `afternoon`, `dawn-patrol`
- Default: `any` if not provided or invalid
- Case-insensitive matching

### Response Structure
No changes to response structure. The `window` object in each recommendation will contain times constrained to the requested slot.

### Example Request
```
GET /api/surf/insights?timeSlot=morning
```

---

## Frontend Changes

### State Management
Local component state (resets on page refresh). Time slot preference does not persist across sessions.

```typescript
const [timeSlot, setTimeSlot] = useState<TimeSlot>('any');
```

### Hook Integration
```typescript
// In the discovery data hook
const { data } = useSurfDiscovery({
  timeSlot: selectedTimeSlot
});
```

### Component Updates
- Add `TimeSlotSelector` component to home screen
- Pass selected time slot to discovery API call
- Handle empty results with helpful messaging

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Home Screen    │────▶│  API Route       │────▶│  Discovery      │
│  TimeSlot UI    │     │  /surf/insights  │     │  Service        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │  timeSlot=morning      │  timeSlot param        │  Filter forecasts
        │                        │                        │  by time slot
        ▼                        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Display        │◀────│  Return filtered │◀────│  selectBestWindow│
│  Recommendations│     │  recommendations │     │  with constraint │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Testing

### Unit Tests

| Test Case | Expected Behavior |
|-----------|-------------------|
| Morning slot filter | Only windows starting 6am-12pm returned |
| Afternoon slot filter | Only windows starting 12pm-6pm returned |
| Dawn patrol filter | Only windows starting 6am-9am returned |
| Boundary: 11:59am | Qualifies for morning |
| Boundary: 12:00pm | Does NOT qualify for morning |
| No viable windows | Returns empty array with metadata |
| Time zone handling | Uses beach local time, not UTC |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| No beaches with morning windows | Empty list + message with best available time |
| Only 1 beach qualifies | Show it (no minimum count) |
| User's home beach excluded | Still excluded if no window in slot |
| Dawn patrol in winter | Respect sunrise (~6:45am), skip if still dark |
| All forecasts are stale | Same as current behavior (show stale warning) |

### Manual QA Scenarios

1. Select "Morning" at 7pm → see tomorrow morning recommendations
2. Select "Morning" at 8am → see today's remaining morning windows
3. Toggle between time slots → rankings should visibly change
4. Select "Dawn patrol" → verify narrower 6-9am window
5. Clear filter → return to full recommendations

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/services/surf-discovery-service.ts` | Add `timeSlot` option, filter logic in `selectBestWindow` |
| `types/personalization.ts` | Add `TimeSlot` type to `SurfDiscoveryOptions` |
| `app/api/surf/insights/route.ts` | Parse and validate `timeSlot` query param |
| `components/home-screen/discovery-card.tsx` | Add `TimeSlotSelector` UI |
| `hooks/use-surf-discovery.ts` | Pass `timeSlot` to API |

---

## Scope & Non-Goals

### In Scope
- Time slot filter for discovery recommendations
- UI selector on home screen
- Helpful empty state messaging

### Out of Scope (Future Considerations)
- Persisting time slot preference to user profile
- Custom time ranges (e.g., "10am-2pm")
- Recurring preferences (e.g., "always show morning on weekdays")
- Push notifications for filtered time slots

---

## Risk Assessment

**Low risk**: Changes are additive and isolated.
- Default behavior (`timeSlot=any`) is unchanged
- No database schema changes
- No breaking API changes (new optional param)
- Feature can be rolled out incrementally

---

## Success Metrics

- Users who select a time slot see relevant recommendations
- Reduced "wrong time" complaints in feedback
- Engagement: track how often non-default time slots are selected

---

## Next Steps

1. Create implementation plan with specific code changes
2. Implement backend changes (service + API)
3. Implement frontend changes (UI + hook)
4. Add unit tests
5. Manual QA across time slots
6. Deploy behind feature flag (optional)
