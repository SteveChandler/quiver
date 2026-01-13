---
description: Run tests (Unit or E2E)
---

# Run Tests

Follow the Test Pyramid strategy.

## Unit Tests (Fast)

Run these for logic changes, utility functions, or single component updates.

```bash
# Run all unit tests
npm test

# Run specific test file
npm test <filename>
```

## E2E Tests (Slow)

Run these for full user flows, critical path verification, or routing changes.

```bash
# Run all E2E tests
npx playwright test

# Run with UI (for debugging)
npx playwright test --ui

# Run specific file
npx playwright test <filename>
```
