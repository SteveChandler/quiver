# Fixing Tests That Incorrectly Show Onboarding Modal

## Problem

Some Playwright tests are failing because they clear `localStorage`, which removes the onboarding completion flag and triggers the onboarding modal to appear when it shouldn't.

## Root Cause

Tests that call `localStorage.clear()` are removing the `quiver-onboarding` state that marks onboarding as completed, causing the modal to appear even for users who have already completed onboarding.

## Solution

Use the helper functions in `e2e/test-helpers.ts` instead of directly clearing localStorage.

### Available Helpers

```typescript
import {
  clearLocalStorageExceptOnboarding,
  setOnboardingCompleted,
  dismissOnboardingModal,
  gotoWithoutOnboarding
} from './test-helpers';
```

### 1. `clearLocalStorageExceptOnboarding(page)`

**Use this instead of `localStorage.clear()`** in tests that aren't testing onboarding:

```typescript
// ❌ OLD - Triggers onboarding modal
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ✅ NEW - Preserves onboarding state
await clearLocalStorageExceptOnboarding(page);
```

### 2. `setOnboardingCompleted(page)`

Explicitly mark onboarding as completed:

```typescript
await setOnboardingCompleted(page);
```

### 3. `dismissOnboardingModal(page)`

Dismiss the modal if it appears during a test:

```typescript
await dismissOnboardingModal(page);
```

### 4. `gotoWithoutOnboarding(page, url)`

Navigate to a page and automatically dismiss onboarding:

```typescript
await gotoWithoutOnboarding(page, '/beach/123');
```

## Which Tests Should Use These Helpers?

### ✅ Use helpers in:
- Tests that clear localStorage for other reasons (guest UI testing, etc.)
- Tests that navigate between pages and want consistent state
- Any test in the `auth` project that isn't testing onboarding

### ❌ Don't use helpers in:
- `onboarding-flow.spec.ts` - These tests ARE testing onboarding
- `onboarding-persistence.spec.ts` - These tests ARE testing onboarding
- Guest tests (`guest-*.spec.ts`) - These run unauthenticated, no onboarding

## Example Fix

### Before (nav-header-styling.spec.ts)
```typescript
test("sign up button has shadow", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  const signUpButton = page.getByRole("link", { name: /sign up/i });
  // Test assertions...
});
```

### After
```typescript
import { clearLocalStorageExceptOnboarding } from "./test-helpers";

test("sign up button has shadow", async ({ page }) => {
  await page.goto("/");

  await clearLocalStorageExceptOnboarding(page);
  await page.reload();

  const signUpButton = page.getByRole("link", { name: /sign up/i });
  // Test assertions...
});
```

## Finding Tests That Need Fixing

Search for tests that clear localStorage:

```bash
# Find all tests that clear localStorage
grep -r "localStorage.clear()" e2e/*.spec.ts

# Exclude onboarding and guest tests (those are intentional)
grep -r "localStorage.clear()" e2e/*.spec.ts | grep -v guest | grep -v onboarding
```

## Files Already Fixed

- ✅ `e2e/nav-header-styling.spec.ts` - All 5 occurrences updated
- ✅ `e2e/global-setup.ts` - Sets onboarding completed in auth state

## Files That May Need Fixing

Run the search command above to find other files that need updating. Common candidates:
- Any test that clears localStorage to test guest UI
- Any test that resets state between test cases
- Any test that navigates extensively and might trigger onboarding

## Quick Fix Script

To bulk-replace in a file:

```bash
# Add import at top of file
# Then replace all occurrences
sed -i '' 's/localStorage\.clear();\n.*sessionStorage\.clear()/clearLocalStorageExceptOnboarding(page)/g' e2e/your-test.spec.ts
```

(Manual review recommended after bulk replacement)
