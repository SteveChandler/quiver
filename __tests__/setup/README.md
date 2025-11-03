# Test Setup & Mock Files

## 📦 Purpose

This directory contains mock implementations and test utilities used across the test suite. These mocks ensure tests run quickly and reliably without depending on external services.

---

## 📄 Files Overview

### mock-supabase.ts
**Purpose:** Main Supabase client mock used in all unit tests

**What it mocks:**
- `createClient()` - Returns mock Supabase client
- `.from()` - Returns mock query builder
- `.select()`, `.insert()`, `.update()`, `.delete()` - Mock query methods
- `.auth.getUser()` - Returns mock authenticated user
- `.storage` - Mock file storage operations

**Usage:**
```typescript
// Automatically applied via jest.config.js
import { createClient } from '@/lib/supabase/client';

test('should fetch data', async () => {
  const supabase = createClient(); // Already mocked!
  // Use as normal...
});
```

**Customization:**
```typescript
// Override default mock for specific test
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({
        data: [{ id: 1, custom: 'data' }],
        error: null
      })
    }))
  }))
}));
```

---

### mock-canvas.js
**Purpose:** Mock Canvas API for image upload tests

**What it mocks:**
- `document.createElement('canvas')`
- Canvas 2D context
- Image loading and manipulation
- toBlob() for image conversion

**Why needed:** Jest/jsdom doesn't include Canvas API implementation

**Usage:**
Automatically applied via `jest.config.js` - no explicit import needed

**Tests using this:**
- Avatar upload tests
- Image compression tests
- Photo upload workflows

---

### mock-next-cache.ts
**Purpose:** Mock Next.js cache functions

**What it mocks:**
- `revalidatePath()` - Cache invalidation
- `revalidateTag()` - Tag-based cache invalidation
- `unstable_cache()` - Cache wrapper function

**Why needed:** Next.js cache functions don't work in test environment

**Usage:**
```typescript
import { revalidatePath } from 'next/cache';

test('should revalidate cache', async () => {
  await updateData();

  // Mock tracks calls
  expect(revalidatePath).toHaveBeenCalledWith('/profile');
});
```

---

### mock-next-server.ts
**Purpose:** Mock Next.js server functions

**What it mocks:**
- `cookies()` - Cookie management
- `headers()` - Request headers
- Next.js server-only functions

**Why needed:** Server functions require Next.js runtime

**Usage:**
```typescript
import { cookies } from 'next/headers';

test('should set cookie', () => {
  const cookieStore = cookies();
  cookieStore.set('session', 'abc123');

  expect(cookieStore.get('session')).toBe('abc123');
});
```

---

### location-mocks.ts
**Purpose:** Mock geolocation APIs and utilities

**What it mocks:**
- `navigator.geolocation`
- Geolocation position data
- Location permission handling
- Coordinate utilities

**Usage:**
```typescript
import { mockGeolocation } from '@/__tests__/setup/location-mocks';

test('should get user location', async () => {
  mockGeolocation({
    latitude: 33.6844,
    longitude: -117.8265
  });

  const position = await getUserLocation();
  expect(position).toEqual({
    latitude: 33.6844,
    longitude: -117.8265
  });
});
```

---

### forecast-test-utils.ts
**Purpose:** Utilities for testing forecast data

**What it provides:**
- Mock forecast data generators
- Beach data factories
- Tide data generators
- Wind/swell data builders

**Usage:**
```typescript
import {
  createMockForecast,
  createMockBeach
} from '@/__tests__/setup/forecast-test-utils';

test('should display forecast', () => {
  const forecast = createMockForecast({
    waveHeight: 5,
    period: 12,
    direction: 'SW'
  });

  // Use in test...
});
```

---

### session-planner-test-utils.ts
**Purpose:** Utilities for testing session planning features

**What it provides:**
- Mock session data
- Beach availability data
- Forecast optimization helpers
- Session recommendation generators

**Usage:**
```typescript
import {
  createMockSession,
  createOptimalConditions
} from '@/__tests__/setup/session-planner-test-utils';

test('should suggest optimal time', () => {
  const conditions = createOptimalConditions();
  const suggestion = getSuggestion(conditions);

  expect(suggestion.time).toBe('Morning');
});
```

---

### supabase-mock.ts
**Purpose:** Alternative/legacy Supabase mock (deprecated)

**Status:** ⚠️ Use `mock-supabase.ts` instead

**Migration:**
```typescript
// ❌ Old
import { mockSupabase } from '@/__tests__/setup/supabase-mock';

// ✅ New
// No import needed - automatically mocked via jest.config.js
```

---

### vitest-shim.ts
**Purpose:** Compatibility shim for Vitest-style test syntax

**What it does:**
- Allows Vitest `describe` syntax in Jest
- No-op shim (Jest already has these)

**Status:** Legacy - kept for compatibility

---

## 🔧 Configuration

### jest.config.js Integration

Mocks are automatically applied via `jest.config.js`:

```javascript
moduleNameMapper: {
  // Mock Supabase entirely
  '^@/lib/supabase/client$': '<rootDir>/__tests__/setup/mock-supabase.ts',
  '^@/lib/supabase/server$': '<rootDir>/__tests__/setup/mock-supabase.ts',

  // Mock canvas
  '^canvas$': '<rootDir>/__tests__/setup/mock-canvas.js',
}
```

### jest.setup.js

Global test setup in `jest.setup.js`:
- Imports Testing Library matchers
- Sets up global test environment
- Configures console mocking (errors, warnings)

---

## 🎯 Best Practices

### When to Create New Mock Files

**Create new mock file when:**
- Mocking external service (API, SDK)
- Providing reusable test data
- Complex mock setup needed by multiple tests

**Don't create mock file for:**
- Simple test data (use inline in test)
- One-off mocks (use `jest.mock` in test file)
- Internal utilities (test them directly)

### Mock File Structure

```typescript
// Good mock file structure
export const createMockClient = () => ({
  // Implement mock interface
  method1: jest.fn().mockResolvedValue(defaultData),
  method2: jest.fn().mockResolvedValue(defaultData),
});

export const mockData = {
  // Default test data
};

export const mockHelpers = {
  // Helper functions for tests
};
```

### Testing with Mocks

```typescript
import { createMockClient } from '@/__tests__/setup/my-mock';

describe('MyComponent', () => {
  let mockClient;

  beforeEach(() => {
    // Fresh mock for each test
    mockClient = createMockClient();
  });

  test('should call API', async () => {
    await fetchData(mockClient);

    expect(mockClient.fetch).toHaveBeenCalledWith('/api/data');
  });
});
```

---

## 🔍 Troubleshooting

### Problem: Mock not being used

**Solution:**
1. Check `jest.config.js` has correct `moduleNameMapper`
2. Verify import path matches exactly
3. Clear Jest cache: `yarn test --clearCache`

### Problem: Mock returning undefined

**Solution:**
1. Check mock returns proper data structure
2. Verify mock method is called correctly
3. Use `.mockResolvedValue()` for async operations

### Problem: Mock state persists between tests

**Solution:**
1. Clear mocks in `beforeEach`:
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```
2. Create fresh mock instances per test
3. Use `jest.resetModules()` if needed

---

## 📚 Further Reading

- [docs/TESTING_GUIDE.md](../../docs/TESTING_GUIDE.md) - Main testing guide
- [Jest Mocking Guide](https://jestjs.io/docs/mock-functions)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

## ✅ Quick Reference

**Using default Supabase mock:**
```typescript
// No import needed - automatically mocked
const supabase = createClient();
```

**Custom Supabase mock:**
```typescript
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ /* custom mock */ })
}));
```

**Using test utilities:**
```typescript
import { createMockForecast } from '@/__tests__/setup/forecast-test-utils';
const forecast = createMockForecast({ waveHeight: 5 });
```

---

**Last Updated:** January 2025
**Maintainer:** Quiver Development Team
