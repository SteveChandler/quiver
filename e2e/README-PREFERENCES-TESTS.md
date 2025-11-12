# Profile Preferences E2E Tests

Comprehensive Playwright test suite for the new profile preferences functionality.

## Overview

Three test files covering all aspects of the profile preferences v2 feature:

1. **`profile-preferences-display.spec.ts`** - Display card tests (read-only view)
2. **`profile-edit-preferences.spec.ts`** - Edit modal tests (form interaction)
3. **`preferences-welcome-popup.spec.ts`** - Welcome popup tests (user onboarding)

## Test Files

### 1. profile-preferences-display.spec.ts

Tests the `PreferencesDisplayCard` component on the profile page.

**Coverage:**
- ✅ Displays all 5 preference fields with correct data
- ✅ Shows emojis correctly for each preference type
- ✅ Handles empty state (no preferences set)
- ✅ Edit button visibility and functionality
- ✅ Mobile responsive layout
- ✅ Partial preferences handling
- ✅ Badge styling for surf styles
- ✅ Typography and formatting

**Total Tests:** 11

### 2. profile-edit-preferences.spec.ts

Tests the Edit Profile modal with focus on preference fields.

**Coverage:**
- ✅ All 5 preference fields present in modal
- ✅ Experience Level is dropdown (NOT text input)
- ✅ Dropdown options match constants
  - Experience Level (4 options)
  - Wave Size (4 options)
  - Break Type (4 options)
  - Crowd Preference (3 options)
- ✅ Surf Styles multi-select functionality
- ✅ Form pre-populates with existing values
- ✅ Form saves all preference data correctly
- ✅ Display card updates after save
- ✅ Form validation
- ✅ Mobile layout and functionality
- ✅ Multiple changes before save
- ✅ Cancel discards changes
- ✅ Optional fields (can be left empty)
- ✅ Emojis display in dropdowns

**Total Tests:** 14

### 3. preferences-welcome-popup.spec.ts

Tests the `PreferencesAnnouncementDialog` on the home page.

**Coverage:**
- ✅ Returning users see popup (preferences_v2_shown_at IS NULL)
- ✅ New users don't see popup (onboarding incomplete)
- ✅ Users who already saw popup don't see it again
- ✅ Popup shows only once per user
- ✅ "Update Profile" button navigation
- ✅ "Maybe Later" button dismissal
- ✅ Database `preferences_v2_shown_at` updated correctly
- ✅ ESC key dismisses popup
- ✅ Click outside dismisses popup
- ✅ Displays all 5 feature highlights
- ✅ Feature emojis display correctly
- ✅ Correct styling and structure
- ✅ Accessibility (ARIA attributes)
- ✅ Mobile responsive
- ✅ Doesn't interfere with home page functionality
- ✅ Analytics tracking (optional)

**Total Tests:** 16

## Test Helpers

### profile-preferences-helpers.ts

Utility functions for database setup and user state management.

**Key Functions:**

```typescript
// User state management
setUserState(email, UserState.RETURNING_USER)
setUserState(email, UserState.NEW_USER)
setUserState(email, UserState.POPUP_SEEN)

// Preferences management
setUserPreferences(email, preferences)
clearUserPreferences(email)

// Database verification
getCurrentUserProfile(email)
verifyPopupDismissalRecorded(email)

// Cleanup
resetUserToCleanState(email)
```

**User States:**
- `NEW_USER` - Onboarding not completed
- `RETURNING_USER` - Onboarding complete, hasn't seen popup
- `POPUP_SEEN` - Already saw popup

## Running Tests

### Run all preference tests
```bash
yarn test:e2e --grep "preferences"
```

### Run individual test files
```bash
# Display card tests
yarn test:e2e profile-preferences-display.spec.ts

# Edit modal tests
yarn test:e2e profile-edit-preferences.spec.ts

# Welcome popup tests
yarn test:e2e preferences-welcome-popup.spec.ts
```

### Run with UI mode (recommended for debugging)
```bash
yarn test:e2e:ui profile-preferences-display.spec.ts
```

### Run specific test
```bash
yarn test:e2e --grep "displays all 5 preference fields"
```

## Test Requirements Met

### Technical Requirements ✅

- ✅ Follow patterns from `e2e/ARCHITECTURE.md`
- ✅ Use auth helpers from `e2e/utils/auth-helpers.ts`
- ✅ Use Supabase test client for database setup/verification
- ✅ Clean up test data after each test
- ✅ Use proper waits (not arbitrary sleeps)

### Database Setup ✅

- ✅ Create test users with different states
- ✅ Clean up after tests
- ✅ Verify database updates persist

### Assertions ✅

- ✅ Verify UI elements are visible
- ✅ Verify correct data is displayed
- ✅ Verify database updates persist
- ✅ Verify navigation works
- ✅ Verify form submissions succeed

### Special Considerations ✅

- ✅ Handle async database operations
- ✅ Verify localStorage doesn't interfere
- ✅ Verify popup logic with different user states
- ✅ Verify mobile responsiveness
- ✅ Designed to run reliably in CI/CD

## Test Data

### Preference Constants

All tests use constants from `/lib/constants/user-preferences.ts`:

**Experience Levels:**
- beginner - 🏄‍♂️
- intermediate - 🌊
- advanced - 🏆
- expert - 🔥

**Surf Styles:**
- longboard - 🏄
- shortboard - 🏄‍♀️
- funboard - 🏄‍♂️
- bodyboard - 🏊
- sup - 🚣
- foil - ✨

**Wave Sizes:**
- small - 🌊 (1-3 feet)
- medium - 🌊🌊 (3-6 feet)
- large - 🌊🌊🌊 (6+ feet)
- any - 🤙

**Break Types:**
- beach - 🏖️
- point - 🪨
- reef - 🪸
- any - ✨

**Crowd Preferences:**
- social - 👥
- moderate - 🧘
- solitude - 🏝️

## Test Coverage Summary

**Total Tests:** 41
- Display Card: 11 tests
- Edit Modal: 14 tests
- Welcome Popup: 16 tests

**Components Tested:**
- `components/profile/preferences-display-card.tsx`
- `components/edit-profile-form.tsx`
- `components/profile/shared/preference-fields.tsx`
- `components/profile/preferences-announcement-dialog.tsx`
- `components/home-screen/index.tsx` (popup logic)

**Database Fields Tested:**
- `experience_level`
- `surf_styles`
- `preferred_wave_size`
- `preferred_break_type`
- `crowd_preference`
- `preferences_v2_shown_at`
- `onboarding_completed_at`

## CI/CD Integration

Tests are designed to run in CI/CD pipelines:

- Use `@project auth` tag for authenticated tests
- Proper cleanup after each test
- No hardcoded waits (use proper Playwright waits)
- Database state reset between tests
- Mobile and desktop viewports tested

## Debugging

### View test traces
```bash
yarn playwright show-report
```

### Run with headed browser
```bash
yarn test:e2e --headed profile-preferences-display.spec.ts
```

### Debug mode
```bash
yarn test:e2e --debug profile-preferences-display.spec.ts
```

### Check database state
The helper functions log database operations:
```
[Test Setup] Set user test@quiver.com to state: returning_user
[Test Setup] Set preferences for user test@quiver.com
[Test Cleanup] Reset user test@quiver.com to clean state
```

## Maintenance

### Adding New Tests

1. Follow existing patterns in test files
2. Use helper functions for database operations
3. Always clean up in `afterEach` hook
4. Use descriptive test names
5. Add assertions for both UI and database state

### Updating Preferences

If preference options change in `/lib/constants/user-preferences.ts`:
1. Update test assertions in `profile-edit-preferences.spec.ts`
2. Update emoji checks in display tests
3. Update `TEST_PREFERENCES` in helpers if needed

### Common Issues

**Test fails with "not authenticated":**
- Ensure `ensureAuthenticated(page)` is in `beforeEach`
- Check that global setup created auth state

**Database updates not persisting:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check RLS policies allow service role updates
- Ensure `await` is used on all database operations

**Popup not appearing:**
- Verify user state is set to `RETURNING_USER`
- Check `preferences_v2_shown_at` is NULL
- Confirm `onboarding_completed_at` is NOT NULL

## Architecture Compliance

✅ Follows patterns from `e2e/ARCHITECTURE.md`
✅ Uses established test helpers
✅ Consistent with existing test structure
✅ Proper cleanup and test isolation
✅ Database operations through service client
✅ No duplicate test utilities

---

**Created:** 2025-11-04
**Author:** test-automator agent
**Related Features:** Profile Preferences V2, User Onboarding, Personalization
