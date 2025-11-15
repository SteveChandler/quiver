# Error Boundary Quick Start Guide

**For Developers** | **Last Updated**: 2025-11-14

## TL;DR - Quick Decision Tree

```
┌─────────────────────────────────────────────────────────┐
│ "Which Error Boundary Should I Use?"                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
                ┌────────────────┐
                │ What failed?   │
                └────────────────┘
                         │
         ┌───────────────┼───────────────┬─────────────┐
         │               │               │             │
         ▼               ▼               ▼             ▼
    ┌────────┐     ┌──────────┐   ┌─────────┐   ┌─────────┐
    │ Entire │     │ Feature  │   │  Data   │   │  Form   │
    │  Page  │     │  Module  │   │ Loading │   │  Input  │
    └────────┘     └──────────┘   └─────────┘   └─────────┘
         │               │              │             │
         ▼               ▼              ▼             ▼
    error.tsx    FeatureError-    DataError-    FormError-
    (Route)      Boundary         Boundary      Boundary
```

---

## 5-Minute Setup

### Step 1: Install Dependencies (if needed)

```bash
# Already included in Quiver
# @sentry/nextjs - for error logging
```

### Step 2: Choose Your Boundary

#### Option A: Generic Component Protection

```typescript
import { ErrorBoundary } from '@/components/error-boundaries';

<ErrorBoundary componentName="MyComponent">
  <MyComponent />
</ErrorBoundary>
```

#### Option B: Data Fetching with Retry

```typescript
import { DataErrorBoundary } from '@/components/error-boundaries';

<DataErrorBoundary
  retryCount={3}
  dataType="forecast"
  componentName="ForecastDisplay"
>
  <ForecastDisplay />
</DataErrorBoundary>
```

#### Option C: Form with State Preservation

```typescript
import { FormErrorBoundary } from '@/components/error-boundaries';

<FormErrorBoundary formId="my-form" preserveState={true}>
  <form data-form-id="my-form">
    {/* Your form fields */}
  </form>
</FormErrorBoundary>
```

### Step 3: Test It

```typescript
// Trigger test error (dev only)
if (process.env.NODE_ENV === 'development') {
  throw new Error('Test error boundary');
}
```

---

## Common Scenarios

### Scenario 1: Protecting Beach Detail Page

**Problem**: Beach detail page crashes when data is missing

**Solution**: Add route-level error boundary

```typescript
// app/beach/[slug]/error.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function BeachDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Beach detail error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Unable to Load Beach Details
        </h1>
        <p className="text-gray-600 mb-6">
          We encountered an error loading this beach page.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90"
          >
            Try Again
          </button>
          <Link
            href="/map"
            className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
          >
            Back to Map
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

### Scenario 2: Forecast Display with Retry

**Problem**: NOAA API occasionally fails, need automatic retry

**Solution**: Wrap forecast in DataErrorBoundary

```typescript
// components/forecast/forecast-display.tsx (usage)
import { DataErrorBoundary } from '@/components/error-boundaries';

export function ForecastPage({ beachId }: { beachId: string }) {
  return (
    <DataErrorBoundary
      retryCount={3}
      retryStrategy="exponential"
      dataType="forecast"
      componentName="ForecastDisplay"
      showCachedData={true}
    >
      <ForecastDisplayContent beachId={beachId} />
    </DataErrorBoundary>
  );
}
```

**Result**:
- ✅ Automatically retries 3 times (1s, 2s, 4s delays)
- ✅ Shows cached forecast if retries fail
- ✅ User-friendly error message
- ✅ Logs to Sentry with context

---

### Scenario 3: Session Form State Preservation

**Problem**: Users lose form data when error occurs

**Solution**: Wrap form in FormErrorBoundary

```typescript
// components/session-forms/SessionForm.tsx (wrapper)
import { FormErrorBoundary } from '@/components/error-boundaries';

export function SessionFormWrapper() {
  return (
    <FormErrorBoundary
      formId="session-log-form"
      preserveState={true}
      autoSave={true}
      autoSaveInterval={30000} // 30 seconds
    >
      <form data-form-id="session-log-form">
        <input name="beach" type="text" />
        <textarea name="notes" />
        {/* ... more fields */}
        <button type="submit">Log Session</button>
      </form>
    </FormErrorBoundary>
  );
}
```

**Result**:
- ✅ Form state auto-saved every 30 seconds
- ✅ State preserved on error
- ✅ User can restore form with one click
- ✅ No data loss

---

## Best Practices

### ✅ DO

1. **Use route-level error.tsx for page errors**
   ```typescript
   // app/forecast/[id]/error.tsx
   export default function ForecastError({ error, reset }) {
     // Custom error UI
   }
   ```

2. **Wrap data-fetching components**
   ```typescript
   <DataErrorBoundary retryCount={3}>
     <DataComponent />
   </DataErrorBoundary>
   ```

3. **Preserve form state**
   ```typescript
   <FormErrorBoundary formId="unique-id">
     <form data-form-id="unique-id">...</form>
   </FormErrorBoundary>
   ```

4. **Use descriptive component names**
   ```typescript
   <ErrorBoundary componentName="BeachCard">
     <BeachCard />
   </ErrorBoundary>
   ```

### ❌ DON'T

1. **Don't wrap every tiny component**
   ```typescript
   // ❌ Too granular
   <ErrorBoundary>
     <span>{text}</span>
   </ErrorBoundary>
   ```

2. **Don't forget data-form-id attribute**
   ```typescript
   // ❌ Missing attribute
   <FormErrorBoundary formId="my-form">
     <form> {/* Missing data-form-id */}
   </FormErrorBoundary>
   ```

3. **Don't hide all errors in production**
   ```typescript
   // ❌ Bad UX
   <ErrorBoundary fallback={() => null} />
   ```

4. **Don't retry infinitely**
   ```typescript
   // ❌ Will cause issues
   <DataErrorBoundary retryCount={999}>
   ```

---

## Troubleshooting

### Problem: Error boundary not catching errors

**Check**:
1. ✅ Error boundary is client component (`'use client'`)
2. ✅ Error occurs in child component (not boundary itself)
3. ✅ Error is a React render error (not async/promise rejection)

**Solution**:
```typescript
// For async errors, wrap in try-catch
async function fetchData() {
  try {
    const data = await fetch('/api/data');
    // ...
  } catch (error) {
    // This won't be caught by error boundary
    // Handle here or throw in render
    setState({ error });
  }
}
```

---

### Problem: Form state not saving

**Check**:
1. ✅ Form has `data-form-id` attribute
2. ✅ Form ID matches FormErrorBoundary `formId` prop
3. ✅ Input fields have `name` or `id` attributes

**Solution**:
```typescript
<FormErrorBoundary formId="session-form">
  <form data-form-id="session-form"> {/* Must match */}
    <input name="beach" /> {/* Must have name */}
    <input name="date" />
  </form>
</FormErrorBoundary>
```

---

### Problem: Retries not working

**Check**:
1. ✅ Error is network/data error (not rendering error)
2. ✅ `retryCount` is > 0
3. ✅ Component re-renders on reset

**Solution**:
```typescript
// Ensure error is retryable
<DataErrorBoundary
  retryCount={3}
  retryStrategy="exponential"
  onRetryExhausted={(error) => {
    console.log('All retries failed:', error);
    // Show user different UI or redirect
  }}
>
  <DataComponent />
</DataErrorBoundary>
```

---

## Cheat Sheet

### Import Statements

```typescript
// Generic boundary
import { ErrorBoundary } from '@/components/error-boundaries';

// Data fetching boundary
import { DataErrorBoundary } from '@/components/error-boundaries';

// Form boundary
import { FormErrorBoundary } from '@/components/error-boundaries';

// Fallback UI components
import {
  ErrorFallback,
  NetworkErrorFallback,
  DataLoadErrorFallback,
} from '@/components/error-boundaries';
```

---

### Props Quick Reference

#### ErrorBoundary

```typescript
<ErrorBoundary
  componentName="ComponentName"     // For logging
  tier="tier_3"                     // tier_1 | tier_2 | tier_3 | tier_4
  boundaryType="feature"            // global | route | feature | component
  resetKeys={[dep1, dep2]}          // Auto-reset when deps change
  showDetails={true}                // Show error stack in dev
  fallback={(error, reset) => ...}  // Custom fallback UI
  onError={(error, info) => ...}    // Custom error handler
>
  {children}
</ErrorBoundary>
```

#### DataErrorBoundary

```typescript
<DataErrorBoundary
  retryCount={3}                    // Max retry attempts
  retryStrategy="exponential"       // exponential | linear | fixed
  retryDelay={1000}                 // Base delay in ms
  dataType="forecast"               // For error messages
  componentName="ForecastDisplay"   // For logging
  showCachedData={true}             // Show cached on error
  fallbackData={cachedData}         // Cached data to show
  onRetryExhausted={(error) => ...} // All retries failed
>
  {children}
</DataErrorBoundary>
```

#### FormErrorBoundary

```typescript
<FormErrorBoundary
  formId="unique-form-id"           // Required, for state storage
  preserveState={true}              // Save state on error
  autoSave={true}                   // Auto-save periodically
  autoSaveInterval={30000}          // Save every 30s
  onFormError={(error, state) => ...} // Custom error handler
  recoveryFallback={(error, state, restore) => ...} // Custom recovery UI
>
  {children}
</FormErrorBoundary>
```

---

## Testing Error Boundaries

### Manual Testing

```typescript
// Add test button in development
{process.env.NODE_ENV === 'development' && (
  <button
    onClick={() => {
      throw new Error('Test error boundary');
    }}
    className="px-4 py-2 bg-red-500 text-white rounded"
  >
    Trigger Error
  </button>
)}
```

### Unit Testing

```typescript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/error-boundaries';

test('catches errors', () => {
  const ThrowError = () => {
    throw new Error('Test');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

---

## Next Steps

1. **Read Full Strategy**: See `/docs/architecture/ERROR_BOUNDARY_STRATEGY.md`
2. **Review Components**: See `/docs/architecture/ERROR_BOUNDARY_COMPONENTS.md`
3. **Check Examples**: See `/components/error-boundaries/__tests__/`
4. **Monitor Errors**: Check Sentry dashboard after deployment

---

## Quick Links

- **Strategy Document**: `/docs/architecture/ERROR_BOUNDARY_STRATEGY.md`
- **Component Specs**: `/docs/architecture/ERROR_BOUNDARY_COMPONENTS.md`
- **Sentry Dashboard**: [Sentry Project URL]
- **Support**: Contact dev team or file GitHub issue

---

**Questions?** Check the full documentation or ask in #engineering-help Slack channel.
