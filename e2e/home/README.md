# Home Screen E2E Tests

This directory contains end-to-end tests for home screen features.

## Test Files

### time-slot-filter.spec.ts

Comprehensive E2E tests for the time slot filtering UI on the home screen.

#### Test Coverage

**1. Time Slot Selector Visibility (3 tests)**
- ✅ Display all 4 time slot buttons (Any time, Dawn patrol, Lunch session, Afternoon)
- ✅ "Any time" selected by default
- ✅ Selector visible and touch-friendly on mobile viewport

**2. Dawn Patrol Filter (3 tests)**
- ✅ Updates recommendations when selected
- ✅ Displays capped window times ending at or before 11am
- ✅ Does NOT show windows extending beyond 11am

**3. Lunch Session Filter (2 tests)**
- ✅ Updates recommendations when selected
- ✅ Displays window times within 11am-2pm range

**4. Afternoon Filter (3 tests)**
- ✅ Updates recommendations when selected
- ✅ Displays window times starting at 2pm or later
- ✅ Displays window times ending by 6pm

**5. Filter Switching Behavior (3 tests)**
- ✅ Handles rapid filter switching without rate limit errors
- ✅ Shows loading state during filter transition
- ✅ Preserves or resets filter selection after page reload

**6. Empty State Handling (2 tests)**
- ✅ Displays empty state when no matches for time slot
- ✅ Allows switching to "Any time" from empty state

**7. Top Spots Carousel (2 tests)**
- ✅ Updates carousel when filter changes
- ✅ Shows capped times in carousel beach cards

**8. Accessibility (2 tests)**
- ✅ Supports keyboard navigation for filter selection
- ✅ Has proper ARIA attributes for radio group

**Total: 20 test scenarios**

#### Key Features Tested

**Time Slot Capping Logic:**
- Dawn patrol windows are capped at 11am (6am-11am)
- Lunch session windows are capped at 2pm (11am-2pm)
- Afternoon windows start at 2pm and end at 6pm (2pm-6pm)
- Any time shows full daylight hours (6am-9pm)

**User Experience:**
- Debouncing prevents excessive API calls
- Loading states provide feedback during transitions
- Empty states guide users when no results available
- Mobile-optimized with touch-friendly targets (≥44px height)

**Data Integrity:**
- Window time format correctly shows capped times (e.g., "7-11am" not "7-1pm")
- Time parsing handles various formats (12-hour, with/without minutes)
- Validates both start and end times match filter constraints

#### Running the Tests

```bash
# Run all home screen tests
yarn test:e2e e2e/home/

# Run only time slot filter tests
yarn test:e2e e2e/home/time-slot-filter.spec.ts

# Run with UI mode for debugging
yarn test:e2e:ui e2e/home/time-slot-filter.spec.ts

# Run specific test by name
yarn test:e2e e2e/home/time-slot-filter.spec.ts -g "should display all 4 time slot buttons"
```

#### Architecture Notes

**Test Strategy:**
- Uses `@smoke` tags for critical path tests
- Gracefully handles empty states with `test.skip()`
- Implements proper wait strategies (debounce + API response)
- Uses data-testid selectors for stability

**Dependencies:**
- Requires authenticated user (uses `@project auth`)
- Depends on `useSurfDiscovery` hook with timeSlot parameter
- Validates against `PersonalizedForecastWindow` type
- Tests both hero recommendation and top spots carousel

**Time Parsing:**
Tests include robust time parsing logic that:
- Extracts hour and AM/PM from badge text
- Converts to 24-hour format for comparison
- Handles edge cases (12am = 0, 12pm = 12)
- Validates both start and end times

#### Debugging Tips

**Test failures:**
1. Check if recommendations are available for the selected time slot
2. Verify debounce timeout (1000ms) is sufficient
3. Ensure viewport is set correctly for mobile tests
4. Review console errors for rate limiting issues

**Common issues:**
- **No recommendations:** Some time slots may have no matches (tests handle with skip)
- **Timing issues:** Increase TIMEOUTS if tests are flaky
- **Time zone issues:** Ensure beach timezone is correctly set in test data
- **Caching:** Clear localStorage if filter state persists unexpectedly

#### Related Files

- `/components/home-screen/time-slot-selector.tsx` - Filter UI component
- `/hooks/use-surf-discovery.ts` - Discovery hook with timeSlot parameter
- `/types/personalization.ts` - TimeSlot type and TIME_SLOT_RANGES
- `/e2e/ARCHITECTURE.md` - E2E testing patterns and best practices

#### Future Enhancements

- [ ] Test filter state persistence in localStorage
- [ ] Validate API request payload includes correct timeSlot
- [ ] Test filter interaction with location-based recommendations
- [ ] Add visual regression tests for time badge formatting
- [ ] Test timezone edge cases (recommendations across midnight)
- [ ] Verify no duplicate API calls during rapid switching
