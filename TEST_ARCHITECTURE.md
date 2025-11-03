# Test Architecture - Refactored Approach

## Overview

This document describes the refactored test architecture following the principle of **separation of concerns**. Tests are now organized by their purpose and scope, not by the feature they test.

**Tests-first requirement:** Always codify new behavior in failing unit tests before implementing or refactoring the production code, and only land changes once those tests pass cleanly.

## Test Pyramid

```
        /\
       /  \  E2E Tests (User Flows)
      /____\
     /      \
    / Integ. \ Integration Tests
   /__________\
  /            \
 /  Unit Tests  \ Component Logic
/________________\
```

### 1. Unit Tests (Base)
- **Location**: `__tests__/components/`, `__tests__/lib/`
- **Purpose**: Test component logic in isolation
- **Tools**: Jest, React Testing Library
- **Mocking**: Mock all external dependencies (storage, API calls, database)
- **Speed**: Fast (milliseconds)
- **Coverage**: High detail, edge cases

### 2. Integration Tests (Middle)
- **Location**: `__tests__/integration/`
- **Purpose**: Test how components work together
- **Tools**: Jest, React Testing Library
- **Mocking**: Mock only external services (database, storage)
- **Speed**: Medium (seconds)
- **Coverage**: Component interactions

### 3. E2E Tests (Top)
- **Location**: `e2e/`
- **Purpose**: Test complete user journeys
- **Tools**: Playwright
- **Mocking**: Minimal (only when necessary)
- **Speed**: Slow (seconds to minutes)
- **Coverage**: Critical user paths

## Refactored Profile Tests

### Unit Tests: Avatar Upload Component

**File**: `__tests__/components/profile/avatar-upload.test.tsx`

**What it tests**:
- ✅ File size validation (5MB limit)
- ✅ File type validation (images only)
- ✅ Upload success/failure handling
- ✅ Database persistence logic
- ✅ Old avatar cleanup
- ✅ Error handling

**Why unit tests**:
- Storage operations are mocked (fast, reliable)
- Can test edge cases easily
- No dependency on Supabase storage
- Tests run in milliseconds

**Example**:
```typescript
it('should reject files larger than 5MB', async () => {
  const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.png');
  fireEvent.change(fileInput, { target: { files: [largeFile] } });

  await waitFor(() => {
    expect(mockToast).toHaveBeenCalledWith({
      title: 'File too large',
      description: 'Please select an image smaller than 5MB.',
      variant: 'destructive',
    });
  });
});
```

### E2E Tests: Profile Edit User Flow

**File**: `e2e/profile-edit-user-flow.spec.ts`

**What it tests**:
- ✅ Complete profile edit flow (fill → submit → success)
- ✅ Validation prevents submission (doesn't check specific errors)
- ✅ Form state preservation
- ✅ Cancel without saving
- ✅ Deep linking (/profile?edit=true)
- ✅ Loading states
- ✅ Network error handling

**Why E2E tests**:
- Tests real user journey
- Verifies form integration
- Checks routing and navigation
- No mocking of UI components

**Example**:
```typescript
test('should prevent submission with invalid data', async ({ page }) => {
  await page.getByLabel(/^name$/i).fill('A'); // Too short

  await page.getByTestId('save-profile').click();
  await page.waitForTimeout(1000);

  // Form should still be visible (validation prevented submission)
  const editDialog = page.getByRole('dialog', { name: /edit profile/i });
  await expect(editDialog).toBeVisible();

  // URL should not have changed
  expect(page.url()).toContain('edit=true');
});
```

## Old vs New Approach

### ❌ Old Approach (Problems)
```typescript
// E2E test trying to verify exact error messages
test('should validate required name field', async ({ page }) => {
  await page.getByLabel(/^name$/i).clear();
  await page.getByTestId('save-profile').click();

  // ❌ Brittle: depends on exact error text
  await expect(page.getByText(/name must be at least 2 characters/i))
    .toBeVisible();
});

// E2E test uploading real files to storage
test('should upload avatar', async ({ page }) => {
  await fileInput.setInputFiles(testImage);

  // ❌ Slow: waits for real storage upload
  await expect(spinner).toBeHidden({ timeout: 30000 });

  // ❌ Flaky: depends on storage performance
  await expect(toast).toBeVisible();
});
```

### ✅ New Approach (Solutions)
```typescript
// Unit test with mocked storage
test('should upload avatar', async () => {
  (uploadImage as jest.Mock).mockResolvedValue({
    success: true,
    url: 'mock-url',
  });

  // ✅ Fast: mocked upload
  fireEvent.change(fileInput, { target: { files: [mockFile] } });

  // ✅ Reliable: no network dependency
  await waitFor(() => {
    expect(mockOnAvatarChange).toHaveBeenCalled();
  });
});

// E2E test verifies outcome, not details
test('should prevent invalid submission', async ({ page }) => {
  await page.getByLabel(/^name$/i).fill('A');
  await page.getByTestId('save-profile').click();

  // ✅ Resilient: checks outcome not error text
  const editDialog = page.getByRole('dialog');
  await expect(editDialog).toBeVisible();

  // ✅ Fast: no waiting for specific elements
  expect(page.url()).toContain('edit=true');
});
```

## Guidelines

### Process Guardrails
- ✅ Start every change by writing or updating unit tests that fail for the new or regressed behavior.
- ✅ Iterate on the implementation until those tests pass, then run the full validation loop (`yarn test`, `yarn typecheck`, `npx playwright test`, `yarn build`).

### When to Write Unit Tests

Write unit tests for:
- ✅ Component logic (validation, state management)
- ✅ Utility functions
- ✅ Calculations and transformations
- ✅ Error handling
- ✅ Edge cases

**Example**: Avatar upload validation, form schema validation

### When to Write E2E Tests

Write E2E tests for:
- ✅ Complete user journeys (login → navigate → submit)
- ✅ Critical paths (payment, signup, core features)
- ✅ Cross-component interactions
- ✅ Routing and navigation

**Example**: Profile edit flow, onboarding wizard

### What NOT to Test in E2E

Avoid E2E tests for:
- ❌ Specific error messages (test in unit tests)
- ❌ File upload implementation (test in unit tests)
- ❌ Validation logic (test in unit tests)
- ❌ Edge cases (test in unit tests)

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run specific test file
npm test avatar-upload

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### E2E Tests
```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test profile-edit-user-flow

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

## Test Maintenance

### Updating Tests After Code Changes

**Scenario**: You change avatar upload to use a different storage provider

**Unit Tests**: Update mocks to match new API
```typescript
// Old mock
(uploadImage as jest.Mock).mockResolvedValue({ success: true, url: '...' });

// New mock (different API)
(newStorageService.upload as jest.Mock).mockResolvedValue({ id: '...', publicUrl: '...' });
```

**E2E Tests**: No changes needed! Tests verify user can still upload avatars.

### Debugging Failed Tests

#### Unit Test Failures
1. Check if mock is correctly configured
2. Verify component props match test expectations
3. Check for async timing issues (use `waitFor`)

#### E2E Test Failures
1. Run with `--debug` flag to step through
2. Check screenshots in `test-results/`
3. Verify test data (user auth, database state)
4. Check for timing issues (increase timeouts if needed)

## Benefits of This Architecture

### 🚀 Fast Feedback
- Unit tests run in seconds
- Developers get immediate feedback
- CI pipeline runs quickly

### 🎯 Focused Tests
- Each test has a clear purpose
- Easy to understand what broke
- Tests don't interfere with each other

### 🔧 Easy Maintenance
- Mocked dependencies don't break tests
- E2E tests are resilient to UI changes
- Clear separation of concerns

### 📊 Better Coverage
- Unit tests cover edge cases
- E2E tests cover user flows
- High confidence in code quality

## Migration Path

### Deprecating Old Tests

Old test files are kept with `.deprecated.ts` extension:
- `profile-form-integration.spec.deprecated.ts`

These can be deleted after verifying new tests cover the same functionality.

### Checklist for New Features

When building a new feature:

1. **Write unit tests first** (TDD approach)
   - [ ] Component logic
   - [ ] Validation rules
   - [ ] Error handling

2. **Write integration tests** (if needed)
   - [ ] Component interactions
   - [ ] Data flow

3. **Write E2E tests last**
   - [ ] Happy path user journey
   - [ ] Critical edge cases (invalid input, errors)

4. **Verify test pyramid**
   - [ ] More unit tests than integration tests
   - [ ] More integration tests than E2E tests
   - [ ] E2E tests focus on user value

## Examples

### Good Test Organization

```
__tests__/
├── components/
│   ├── profile/
│   │   ├── avatar-upload.test.tsx          # Unit tests
│   │   ├── basic-info-fields.test.tsx      # Unit tests
│   │   └── profile-form-schema.test.ts     # Unit tests
│   └── ui/
│       └── form.test.tsx                    # Unit tests
├── lib/
│   └── image-upload.test.ts                 # Unit tests
└── integration/
    └── profile-form-submission.test.tsx     # Integration tests

e2e/
├── profile-edit-user-flow.spec.ts           # E2E user flows
├── onboarding.spec.ts                        # E2E user flows
└── session-wizard.spec.ts                    # E2E user flows
```

## Summary

**Old Approach**:
- ❌ Everything in E2E tests
- ❌ Slow, flaky, hard to maintain
- ❌ Dependent on external services

**New Approach**:
- ✅ Unit tests for logic
- ✅ E2E tests for user flows
- ✅ Fast, reliable, maintainable

**Result**: Better tests, faster feedback, higher confidence! 🎉
