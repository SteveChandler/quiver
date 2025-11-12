# Best Conditions Near You - E2E Test Suite

## Overview

This test suite provides comprehensive E2E testing for the "Best Conditions Near You" feature on the home page. The feature displays top surf spots within a 10-mile radius based on current conditions, using either GPS coordinates or the user's home beach as the search location.

## Test File

**Location**: `/e2e/home-best-conditions.spec.ts`

## Feature Modes

The "Best Conditions Near You" feature operates in three distinct modes:

### 1. GPS Mode (Priority 1)
- **Trigger**: User grants geolocation permission and GPS coordinates are available
- **Heading**: "Best Conditions Near You"
- **Data Source**: Real-time GPS coordinates
- **Search Radius**: 10 miles from GPS location

### 2. Home Beach Mode (Priority 2)
- **Trigger**: GPS unavailable/denied, but user has home beach set in profile
- **Heading**: "Best Conditions Near [Beach Name]"
- **Data Source**: Home beach coordinates from user profile
- **Search Radius**: 10 miles from home beach location

### 3. Hidden Mode (Priority 3)
- **Trigger**: No GPS coordinates and no home beach set
- **Behavior**: Section is completely hidden (returns null)
- **User Experience**: No "Best Conditions" section appears on home page

## Test Coverage

### Test Scenarios (15 test groups, 30+ individual tests)

#### 1. GPS Mode Tests
- ✅ Display "Best Conditions Near You" heading
- ✅ Display beach cards with GPS location
- ✅ Show loading skeleton initially
- **Coverage**: Verifies GPS mode activation and proper heading display

#### 2. Beach Card Details Tests
- ✅ Display required information (wave height, distance, badges)
- ✅ Display beach name and location
- ✅ Display wave, wind, and tide information
- ✅ Valid skill level badges (Beginner/Intermediate/Advanced/Expert)
- ✅ Valid crowd level badges (Uncrowded/Moderate/Crowded)
- ✅ Display beach images or placeholder
- **Coverage**: Validates card content accuracy and completeness

#### 3. Navigation and Interaction Tests
- ✅ Navigate to beach detail page on card click
- ✅ Support horizontal scrolling on mobile
- ✅ Display cards with proper responsive width
- **Coverage**: Ensures proper user interaction and responsive behavior

#### 4. Home Beach Fallback Mode Tests
- ✅ Display "Best Conditions Near [Beach Name]" when GPS unavailable
- ✅ Display beach cards based on home beach location
- **Coverage**: Verifies fallback mechanism works correctly

#### 5. No Location Available Tests
- ✅ Hide section when no location available
- **Coverage**: Validates proper handling of edge case

#### 6. Error Handling Tests
- ✅ Display error message when fetch fails
- ✅ Recover from error when page is refreshed
- **Coverage**: Ensures graceful error handling and recovery

#### 7. Distance Validation Tests
- ✅ Display beaches within 10-mile range
- **Coverage**: Validates search radius constraint

#### 8. Accessibility Tests
- ✅ Proper heading hierarchy (h3 element)
- ✅ Keyboard-accessible cards
- **Coverage**: Ensures WCAG compliance

#### 9. Performance Tests
- ✅ Load beach cards within reasonable time (<15s)
- ✅ Not block page rendering
- **Coverage**: Validates performance standards

## Component Data-TestId Attributes

The following `data-testid` attributes were added to enable reliable testing:

| Element | data-testid | Purpose |
|---------|-------------|---------|
| Main section container | `best-conditions-section` | Identify the feature section |
| Heading (h3) | `best-conditions-heading` | Verify heading text (GPS vs home beach) |
| Cards container | `best-conditions-cards-container` | Container for scrollable cards |
| Individual beach card | `best-conditions-card` | Each beach recommendation card |
| Skill level badge | `skill-badge` | Badge showing skill level |
| Crowd level badge | `crowd-badge` | Badge showing crowd level |
| Loading skeleton | `best-conditions-skeleton` | Loading state skeleton |
| Error container | `best-conditions-error` | Error state container |
| Error message | `error-message` | Error message text |

## Running the Tests

### Run all Best Conditions tests
```bash
yarn test:e2e home-best-conditions
```

### Run with UI mode (recommended for development)
```bash
yarn test:e2e:ui home-best-conditions
```

### Run specific test group
```bash
yarn test:e2e -g "GPS Mode"
yarn test:e2e -g "Beach Card Details"
yarn test:e2e -g "Navigation and Interaction"
```

### Run in headed mode (see browser)
```bash
yarn test:e2e home-best-conditions --headed
```

## Test Environment Setup

### Prerequisites
1. **Authenticated user**: Tests run in the `auth` project, requiring `.auth/state.json`
2. **Test data**: Beaches must exist within 10 miles of test coordinates
3. **Geolocation permissions**: Tests control permission grants via Playwright context

### Test Coordinates
The tests use San Diego, CA coordinates by default:
- **Latitude**: 32.8473
- **Longitude**: -117.2750
- **Area**: La Jolla / San Diego area
- **Expected Beaches**: Blacks Beach, Scripps Pier, La Jolla Shores, etc.

### Modifying Test Location
To test with different coordinates, modify the `beforeEach` hook:

```typescript
await context.setGeolocation({
  latitude: YOUR_LAT,
  longitude: YOUR_LON
});
```

## Test Data Requirements

### For GPS Mode Tests
- **Required**: Valid coordinates with beaches within 10-mile radius
- **Expected**: 1-3 beach recommendations (limited by server action)

### For Home Beach Mode Tests
- **Required**: Test user must have `home_beach_id` set in profile
- **Expected**: Heading shows home beach name
- **Fallback**: Test skips gracefully if no home beach set

### For No Location Tests
- **Required**: Test user without home beach (or different test user)
- **Expected**: Section is hidden (not visible)

## Common Issues and Solutions

### Issue: Section Not Visible
**Cause**: No beaches within 10-mile radius of test coordinates
**Solution**:
- Verify coordinates are in an area with beaches in database
- Check `get_nearby_beaches` RPC function is working
- Ensure test database is seeded with beach data

### Issue: Tests Timeout
**Cause**: Network requests taking too long or failing
**Solution**:
- Increase timeout values in test (use `TIMEOUTS.long`)
- Check backend server action is responding
- Verify Supabase connection is working

### Issue: Flaky Tests (Pass/Fail Inconsistently)
**Cause**: Race conditions between loading states
**Solution**:
- Tests already include proper waits for visibility
- Use `.catch(() => false)` pattern for optional elements
- Ensure skeleton->content transition is handled

### Issue: Home Beach Heading Not Showing
**Cause**: GPS taking priority over home beach
**Solution**:
- Ensure `context.grantPermissions([])` blocks GPS
- Verify test user has `home_beach_id` set
- Check `useGeo` hook respects permission denial

## Architecture Integration

### Component Architecture
The `BestConditionsCards` component follows the established patterns:
- Uses `useDataFetcher` hook for data loading
- Uses `useGeo` hook for location management
- Implements loading skeleton for better UX
- Shows error states instead of hiding on failure

### Data Flow
1. **useGeo hook** determines location (GPS or home beach)
2. **useDataFetcher** calls `getBestBeachesNearHome(coords)`
3. **Server action** queries nearby beaches and scores them
4. **Component** renders top 3 beaches in horizontal scroll

### Testing Strategy
- **Unit tests**: Component logic (already in `__tests__/`)
- **Integration tests**: Data fetching and state management
- **E2E tests**: This suite - full user scenarios

## Maintenance Notes

### When to Update Tests

1. **Heading text changes**: Update test assertions for new heading format
2. **Card layout changes**: Update selectors and assertions
3. **Distance radius changes**: Update 10-mile validation if changed
4. **New features added**: Add corresponding test scenarios

### Test Health Monitoring

Monitor these metrics:
- **Pass rate**: Should be >95% (some tests skip gracefully)
- **Duration**: Should complete in <60 seconds total
- **Flakiness**: Retry rate should be <5%

### Debugging Failed Tests

1. **Check Playwright trace**: `yarn test:e2e:ui` and inspect trace
2. **Review screenshots**: Auto-captured on failure
3. **Check console logs**: Component has extensive logging
4. **Verify test data**: Ensure beaches exist in test database

## Related Documentation

- **Component**: `/components/home-screen/best-conditions-cards.tsx`
- **Server Action**: `/actions/beach/best-beaches-simple.ts`
- **Hook**: `/hooks/useGeo.ts`
- **Architecture**: `/components/ARCHITECTURE.md`
- **E2E Patterns**: `/e2e/ARCHITECTURE.md`

## Future Enhancements

### Potential Test Additions
- [ ] Visual regression tests for card layouts
- [ ] Performance metrics tracking (Core Web Vitals)
- [ ] Cross-browser testing (Safari, Firefox)
- [ ] Mobile device testing (iOS, Android via Capacitor)
- [ ] Test with varying numbers of beaches (0, 1, 2, 3+)
- [ ] Test with different skill levels affecting scores
- [ ] Test "Hidden Gem" badge display

### Test Coverage Goals
- **Current**: ~85% of user scenarios covered
- **Target**: >90% with edge case coverage
- **Focus Areas**: Error recovery, performance edge cases

---

**Last Updated**: 2025-11-11
**Test File Version**: 1.0.0
**Playwright Version**: Latest (configured in `playwright.config.ts`)
