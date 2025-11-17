# Error Boundary Strategy

**Version**: 1.0
**Last Updated**: 2025-11-14
**Status**: Architecture Design Phase

## Executive Summary

This document defines a comprehensive error boundary strategy for the Quiver surfing application, addressing the critical gap identified where 195+ components lack proper error isolation. The strategy implements a four-tier error boundary hierarchy integrated with Next.js 14+ App Router, providing granular error handling, improved user experience, and effective monitoring.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Current State Analysis](#current-state-analysis)
- [Error Boundary Architecture](#error-boundary-architecture)
- [Error Taxonomy](#error-taxonomy)
- [Component Design Specifications](#component-design-specifications)
- [Integration Strategy](#integration-strategy)
- [User Experience Guidelines](#user-experience-guidelines)
- [Monitoring & Observability](#monitoring--observability)
- [Mobile Considerations](#mobile-considerations)
- [Implementation Roadmap](#implementation-roadmap)
- [Testing Strategy](#testing-strategy)
- [Appendices](#appendices)

---

## Current State Analysis

### Existing Error Handling

**Assets:**
- ✅ `global-error.tsx`: Root-level global error boundary with Sentry integration
- ✅ `app/beaches/[country]/[state]/[city]/error.tsx`: Route-level error boundary example
- ✅ 133 try-catch blocks throughout components (good error awareness)
- ✅ Sentry integration configured

**Gaps (MEDIUM Severity):**
- ❌ 195+ components without error boundaries
- ❌ No feature-level error isolation
- ❌ Missing data fetching error boundaries
- ❌ No form-specific error recovery
- ❌ Unhandled promise rejections
- ❌ Limited fallback UI patterns
- ❌ Inconsistent error messaging

### Impact Analysis

**User Impact:**
- Component crashes propagate to entire routes
- Loss of user data during errors
- Poor error messages (technical jargon)
- No recovery path for transient failures

**Developer Impact:**
- Difficult to trace error sources
- Incomplete error context in Sentry
- No standardized error handling patterns
- Time-consuming debugging

**Business Impact:**
- Reduced user engagement during errors
- Higher support tickets
- Lower conversion rates
- Poor user retention

---

## Error Boundary Architecture

### Four-Tier Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: Global Error Boundary (app/global-error.tsx)           │
│ Scope: Catastrophic app-level failures                          │
│ Fallback: Full-page error with reload option                    │
│ Logging: All errors → Sentry with max context                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIER 2: Route/Layout Boundaries (app/[route]/error.tsx)        │
│ Scope: Page-level errors within specific routes                 │
│ Fallback: Route-specific error UI with navigation options       │
│ Logging: Route errors → Sentry with route context               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIER 3: Feature Boundaries (components/[feature]/ErrorBoundary) │
│ Scope: Feature-specific failures (forecast, map, sessions)      │
│ Fallback: Feature-level error with retry mechanism              │
│ Logging: Feature errors → Sentry with feature context           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIER 4: Component Boundaries (granular isolation)               │
│ Scope: Individual critical components                           │
│ Fallback: Inline error with component-specific recovery         │
│ Logging: Component errors → Sentry with component metadata      │
└─────────────────────────────────────────────────────────────────┘
```

### Boundary Placement Strategy

#### Tier 1: Global (Root) Level

**Location**: `app/global-error.tsx` (✅ Already exists)

**When to Use**:
- Last resort error catcher
- Handles errors not caught by lower boundaries
- Framework-level errors
- Critical runtime failures

**Current Implementation**: Good foundation, needs enhancement
```typescript
// Current: Basic NextError fallback
// Enhancement needed: Add recovery options, better messaging
```

**Enhancements Needed**:
- [ ] Add "Reload Application" button with state preservation attempt
- [ ] Display user-friendly error message (hide technical details)
- [ ] Add "Report Problem" link to support
- [ ] Include offline detection and guidance
- [ ] Track global error frequency in Sentry

---

#### Tier 2: Route/Layout Level

**Locations**:
```
app/
├── error.tsx                              # Root route errors
├── (main)/
│   ├── error.tsx                          # Main layout errors
│   ├── map/error.tsx                      # Map route errors
│   ├── beach/[slug]/error.tsx             # Beach detail errors
│   ├── forecast/[beachId]/error.tsx       # Forecast route errors
│   ├── sessions/error.tsx                 # Sessions list errors
│   ├── sessions/[id]/error.tsx            # Session detail errors
│   └── profile/error.tsx                  # Profile route errors
├── (auth)/
│   └── error.tsx                          # Auth layout errors
├── admin/
│   └── error.tsx                          # Admin section errors
└── beaches/[country]/[state]/[city]/error.tsx  # ✅ Already exists
```

**When to Use**:
- Page-level error isolation
- Route-specific failures
- Layout rendering errors
- Data loading failures at route level

**Standard Pattern**:
```typescript
// app/[route]/error.tsx
'use client';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 1. Log to Sentry with route context
  // 2. Display user-friendly error message
  // 3. Provide recovery actions:
  //    - Retry (reset)
  //    - Navigate to safe route (home, map)
  //    - Contact support
  // 4. Preserve user context where possible
}
```

---

#### Tier 3: Feature Level

**Locations**:
```
components/
├── forecast/
│   └── ForecastErrorBoundary.tsx          # Forecast feature errors
├── map/
│   └── MapErrorBoundary.tsx               # Map feature errors
├── session-forms/
│   └── SessionFormErrorBoundary.tsx       # Session wizard errors
├── journal/
│   └── JournalErrorBoundary.tsx           # Journal feature errors
├── intel/
│   └── IntelErrorBoundary.tsx             # Intel feature errors
├── social/
│   └── SocialErrorBoundary.tsx            # Social features errors
├── profile/
│   └── ProfileErrorBoundary.tsx           # Profile feature errors
└── beach-detail/
    └── BeachDetailErrorBoundary.tsx       # Beach details errors
```

**When to Use**:
- Wrap entire feature modules
- Isolate complex interactive features
- Features with heavy data dependencies
- Features with multiple child components

**Standard Pattern**:
```typescript
// components/[feature]/[Feature]ErrorBoundary.tsx
interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export function FeatureErrorBoundary({
  children,
  featureName,
  fallback,
  onError,
}: FeatureErrorBoundaryProps) {
  // 1. Catch feature-specific errors
  // 2. Log with feature context to Sentry
  // 3. Show feature-specific fallback UI
  // 4. Provide feature-relevant recovery options
  // 5. Allow rest of app to continue functioning
}
```

---

#### Tier 4: Component Level

**Locations** (Critical Components Only):
```
components/
├── beach-detail/
│   └── beach-hero.tsx                     # Wrap in DataErrorBoundary
├── forecast/
│   ├── forecast-display.tsx               # Wrap in DataErrorBoundary
│   └── tide-chart-recharts.tsx            # Wrap in ErrorBoundary
├── map/
│   └── interactive-map.tsx                # Wrap in MapErrorBoundary
├── session-forms/
│   └── SessionForm.tsx                    # Wrap in FormErrorBoundary
├── journal/
│   └── calendar-heatmap.tsx               # Wrap in ErrorBoundary
├── profile/
│   └── profile-edit-form.tsx              # Wrap in FormErrorBoundary
└── media/
    └── session-photo-gallery.tsx          # Wrap in ErrorBoundary
```

**When to Use**:
- Critical user-facing components
- Components with high error probability
- Complex data visualization
- Third-party library integrations
- Components handling user input

**Granularity Decision Matrix**:

| Component Complexity | User Impact | Error Probability | Boundary Needed? |
|---------------------|-------------|-------------------|------------------|
| Low | Low | Low | ❌ No |
| Low | High | Low | ✅ Maybe (route-level sufficient) |
| High | Low | Low | ✅ Maybe (feature-level sufficient) |
| High | High | Low | ✅ Yes (component-level) |
| Any | Any | High | ✅ Yes (component-level) |

---

## Error Taxonomy

### Error Categories & Handling Strategies

#### 1. Network Errors

**Detection**:
- `fetch()` failures
- Supabase client errors (`PGRST`, `NETWORK`)
- Timeout errors
- DNS resolution failures

**User-Facing Message**:
```
"Connection Lost"
"We're having trouble connecting to the internet. Please check your connection and try again."
```

**Recovery Actions**:
1. Automatic retry with exponential backoff (1s, 2s, 4s, 8s)
2. Show cached data if available (with staleness indicator)
3. Manual retry button
4. "Work Offline" mode for supported features

**Logging**:
```typescript
{
  category: 'network_error',
  error_type: error.name,
  endpoint: failedUrl,
  retry_count: attemptNumber,
  network_status: navigator.onLine ? 'online' : 'offline'
}
```

---

#### 2. Data Parsing Errors

**Detection**:
- JSON parsing failures
- Schema validation errors (Zod)
- Type assertion failures
- Unexpected response format

**User-Facing Message**:
```
"Data Format Error"
"We received unexpected data from the server. This has been reported to our team."
```

**Recovery Actions**:
1. Log detailed error to Sentry with raw response
2. Display fallback UI with generic data
3. Retry with fresh request
4. Option to contact support

**Logging**:
```typescript
{
  category: 'data_parsing_error',
  error_type: 'validation_error',
  schema_path: zodError.path,
  expected: zodError.expected,
  received: zodError.received,
  raw_data: JSON.stringify(rawData).slice(0, 1000) // Truncate
}
```

---

#### 3. Rendering Errors

**Detection**:
- Component lifecycle errors
- React render errors
- Hydration mismatches
- `null`/`undefined` reference errors

**User-Facing Message**:
```
"Display Error"
"We encountered a problem displaying this content. Try refreshing the page."
```

**Recovery Actions**:
1. Show fallback UI for affected component
2. Reset component state (if boundary has reset capability)
3. Preserve user context and data
4. Suggest page refresh if critical

**Logging**:
```typescript
{
  category: 'rendering_error',
  component_name: componentDisplayName,
  component_stack: errorInfo.componentStack,
  props_snapshot: JSON.stringify(props),
  state_snapshot: JSON.stringify(state)
}
```

---

#### 4. User Input Errors

**Detection**:
- Form validation failures
- Invalid file uploads
- Constraint violations
- Permission denied

**User-Facing Message**:
```
"Invalid Input"
"Please check your entry and try again."
[Specific field-level error messages]
```

**Recovery Actions**:
1. Inline field-level error messages
2. Preserve form state (don't clear)
3. Focus on first error field
4. Show validation hints/examples
5. No automatic retry (user-driven)

**Logging**:
```typescript
{
  category: 'user_input_error',
  form_name: formId,
  field_name: fieldName,
  validation_rule: failedRule,
  user_value: sanitizedValue
}
```

---

#### 5. System/Resource Errors

**Detection**:
- Out of memory errors
- Browser storage quota exceeded
- Browser compatibility issues
- Performance degradation

**User-Facing Message**:
```
"System Resources Low"
"Your device may be running low on resources. Try closing other tabs or apps."
```

**Recovery Actions**:
1. Clear non-critical caches
2. Reduce feature complexity (disable animations)
3. Suggest browser restart
4. Graceful degradation to simpler UI

**Logging**:
```typescript
{
  category: 'system_error',
  memory_usage: performance.memory?.usedJSHeapSize,
  storage_quota: storageEstimate.quota,
  storage_usage: storageEstimate.usage,
  browser: navigator.userAgent
}
```

---

## Component Design Specifications

### 1. Generic Error Boundary

**File**: `components/error-boundaries/ErrorBoundary.tsx`

**Purpose**: General-purpose error boundary for any component

**Interface**:
```typescript
interface ErrorBoundaryProps {
  /**
   * Custom fallback UI to display when error occurs
   * Receives error object and reset function
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;

  /**
   * Callback fired when error is caught
   * Useful for custom logging or side effects
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Array of values that trigger boundary reset when changed
   * Similar to useEffect dependencies
   */
  resetKeys?: any[];

  /**
   * Child components to protect
   */
  children: ReactNode;

  /**
   * Optional component name for logging context
   */
  componentName?: string;

  /**
   * Whether to show technical error details in development
   * Default: true in dev, false in production
   */
  showDetails?: boolean;
}
```

**Behavior**:
1. **Error Catching**: Catches all errors in child component tree
2. **Logging**: Automatically logs to Sentry with component context
3. **Fallback Rendering**: Shows fallback UI or default error message
4. **Reset Capability**: Provides reset function to retry rendering
5. **Auto-Reset**: Resets when `resetKeys` values change
6. **Development Mode**: Shows detailed error stack in development

**Example Usage**:
```typescript
// Basic usage
<ErrorBoundary>
  <ComplexComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={reset}>Try Again</button>
    </div>
  )}
>
  <ComplexComponent />
</ErrorBoundary>

// With reset keys (auto-reset when data changes)
<ErrorBoundary resetKeys={[beachId, forecastDate]}>
  <ForecastDisplay beachId={beachId} date={forecastDate} />
</ErrorBoundary>

// With custom error handler
<ErrorBoundary
  onError={(error, errorInfo) => {
    console.error('Custom handler:', error);
    analyticsTrack('component_error', {
      component: errorInfo.componentStack,
    });
  }}
>
  <CriticalComponent />
</ErrorBoundary>
```

---

### 2. Data Error Boundary

**File**: `components/error-boundaries/DataErrorBoundary.tsx`

**Purpose**: Specialized boundary for data fetching errors with retry logic

**Interface**:
```typescript
interface DataErrorBoundaryProps {
  /**
   * Optional cached/fallback data to display if fetch fails
   */
  fallbackData?: any;

  /**
   * Maximum number of automatic retry attempts
   * Default: 3
   */
  retryCount?: number;

  /**
   * Retry delay strategy
   * 'exponential': 1s, 2s, 4s, 8s...
   * 'linear': 1s, 2s, 3s, 4s...
   * 'fixed': constant delay
   */
  retryStrategy?: 'exponential' | 'linear' | 'fixed';

  /**
   * Base delay for retry (milliseconds)
   * Default: 1000
   */
  retryDelay?: number;

  /**
   * Child components that fetch data
   */
  children: ReactNode;

  /**
   * Custom loading indicator during retry
   */
  retryLoadingIndicator?: ReactNode;

  /**
   * Whether to show cached data with staleness indicator
   * Default: true
   */
  showCachedData?: boolean;

  /**
   * Callback when all retries exhausted
   */
  onRetryExhausted?: (error: Error) => void;
}
```

**Behavior**:
1. **Automatic Retry**: Retries failed data fetches with configurable strategy
2. **Exponential Backoff**: Default retry delays: 1s, 2s, 4s, 8s
3. **Cached Data Fallback**: Shows stale data if available during errors
4. **Network Awareness**: Detects offline state and pauses retries
5. **User Override**: Manual retry button available
6. **Loading States**: Shows retry progress indicator

**Example Usage**:
```typescript
// Basic data boundary with auto-retry
<DataErrorBoundary retryCount={3}>
  <ForecastDisplay beachId={beachId} />
</DataErrorBoundary>

// With fallback data
<DataErrorBoundary
  fallbackData={cachedForecast}
  showCachedData={true}
>
  <ForecastDisplay beachId={beachId} />
</DataErrorBoundary>

// Custom retry strategy
<DataErrorBoundary
  retryCount={5}
  retryStrategy="exponential"
  retryDelay={2000}
  onRetryExhausted={(error) => {
    toast.error('Unable to load data after multiple attempts');
  }}
>
  <BeachList />
</DataErrorBoundary>
```

---

### 3. Form Error Boundary

**File**: `components/error-boundaries/FormErrorBoundary.tsx`

**Purpose**: Specialized boundary for form components with state preservation

**Interface**:
```typescript
interface FormErrorBoundaryProps {
  /**
   * Callback fired when form error occurs
   * Receives error and current form state
   */
  onFormError?: (error: Error, formState?: any) => void;

  /**
   * Whether to preserve form state on error
   * Default: true
   */
  preserveState?: boolean;

  /**
   * Form identifier for state storage
   */
  formId?: string;

  /**
   * Child form components
   */
  children: ReactNode;

  /**
   * Whether to auto-save form state periodically
   * Default: true
   */
  autoSave?: boolean;

  /**
   * Auto-save interval (milliseconds)
   * Default: 30000 (30 seconds)
   */
  autoSaveInterval?: number;

  /**
   * Custom recovery UI
   */
  recoveryFallback?: (
    error: Error,
    savedState: any,
    restore: () => void
  ) => ReactNode;
}
```

**Behavior**:
1. **State Preservation**: Automatically saves form state to localStorage
2. **Auto-Save**: Periodic state snapshots during editing
3. **Recovery**: Restores saved state after error
4. **Validation Errors**: Handles validation failures gracefully
5. **Submission Errors**: Preserves data on failed submissions
6. **User Notification**: Clear messaging about saved state

**Example Usage**:
```typescript
// Session logging form with state preservation
<FormErrorBoundary
  formId="session-log-form"
  preserveState={true}
  autoSave={true}
  onFormError={(error, formState) => {
    console.error('Form error:', error);
    console.log('Form state preserved:', formState);
  }}
>
  <SessionForm mode="log" />
</FormErrorBoundary>

// Profile edit form with custom recovery
<FormErrorBoundary
  formId="profile-edit-form"
  recoveryFallback={(error, savedState, restore) => (
    <div>
      <p>Form error occurred, but your changes are saved</p>
      <button onClick={restore}>Restore Form</button>
    </div>
  )}
>
  <ProfileEditForm />
</FormErrorBoundary>
```

---

### 4. Error Fallback Components

#### A. Generic Error Fallback

**File**: `components/error-boundaries/ErrorFallback.tsx`

**Purpose**: Default error UI for generic boundaries

**Interface**:
```typescript
interface ErrorFallbackProps {
  /**
   * The error that was caught
   */
  error: Error;

  /**
   * Function to reset the error boundary
   */
  resetError: () => void;

  /**
   * Whether to show technical error details
   * Default: false in production
   */
  showDetails?: boolean;

  /**
   * Custom title for error message
   */
  title?: string;

  /**
   * Custom description
   */
  description?: string;

  /**
   * Additional recovery actions
   */
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  }[];
}
```

**UI Elements**:
- Icon: Alert circle (error state)
- Title: User-friendly error title
- Description: Non-technical explanation
- Actions:
  - Primary: "Try Again" (calls resetError)
  - Secondary: "Go Home" (navigate to /)
  - Optional: "Report Problem" (contact support)
- Details: Collapsible technical details (dev mode only)

**Visual Design**:
```
┌─────────────────────────────────────────┐
│                                         │
│         [!] Alert Circle Icon           │
│                                         │
│         Something Went Wrong            │
│                                         │
│  We encountered an unexpected problem.  │
│  Please try again or return home.       │
│                                         │
│  [Try Again]  [Go Home]  [Get Help]    │
│                                         │
│  ▼ Technical Details (Dev Only)         │
│     Error: TypeError: Cannot read...    │
│     Component: BeachDetail              │
│     Stack: at BeachDetail.render...     │
│                                         │
└─────────────────────────────────────────┘
```

---

#### B. Network Error Fallback

**File**: `components/error-boundaries/NetworkErrorFallback.tsx`

**Purpose**: Specialized UI for network/connectivity errors

**Interface**:
```typescript
interface NetworkErrorFallbackProps {
  error: Error;
  resetError: () => void;
  retryCount?: number;
  isRetrying?: boolean;
  cachedData?: any;
}
```

**UI Elements**:
- Icon: Wifi-off icon (network issue indicator)
- Title: "Connection Lost"
- Description: Network-specific messaging
- Status: Online/offline indicator
- Actions:
  - Primary: "Retry" (with loading state)
  - Secondary: "View Cached Data" (if available)
  - Tertiary: "Work Offline"
- Progress: Retry attempt counter (1 of 3)

**Visual Design**:
```
┌─────────────────────────────────────────┐
│                                         │
│         [📡] Wifi-Off Icon              │
│                                         │
│         Connection Lost                 │
│                                         │
│  We're having trouble connecting to     │
│  the internet. Check your connection.   │
│                                         │
│  Status: Offline 🔴                     │
│  Retry attempt: 2 of 3                  │
│                                         │
│  [Retry] [View Cached Data] [Offline]  │
│                                         │
└─────────────────────────────────────────┘
```

---

#### C. Data Load Error Fallback

**File**: `components/error-boundaries/DataLoadErrorFallback.tsx`

**Purpose**: UI for data loading/parsing failures

**Interface**:
```typescript
interface DataLoadErrorFallbackProps {
  error: Error;
  resetError: () => void;
  dataType?: string; // e.g., "forecast", "beach details"
  lastSuccessfulLoad?: Date;
  cachedData?: any;
}
```

**UI Elements**:
- Icon: Database icon with error badge
- Title: "Unable to Load [Data Type]"
- Description: Data-specific messaging
- Timestamp: Last successful load time
- Actions:
  - Primary: "Refresh" (reload data)
  - Secondary: "Use Cached" (if available)
  - Tertiary: "Skip" (continue without data)
- Cached indicator: Staleness warning if showing old data

**Visual Design**:
```
┌─────────────────────────────────────────┐
│                                         │
│         [🗄️] Database Icon              │
│                                         │
│      Unable to Load Forecast Data       │
│                                         │
│  We couldn't load the latest forecast.  │
│  Last updated: 2 hours ago              │
│                                         │
│  ⚠️ Showing cached data from 2h ago     │
│                                         │
│  [Refresh Data]  [Continue]  [Skip]    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Integration Strategy

### Phase-by-Phase Implementation

#### Phase 1: Foundation (Week 1)

**Goal**: Establish core error boundary infrastructure

**Tasks**:
1. **Create Core Components**
   - [ ] `ErrorBoundary.tsx` - Generic boundary
   - [ ] `DataErrorBoundary.tsx` - Data fetching boundary
   - [ ] `FormErrorBoundary.tsx` - Form boundary
   - [ ] `ErrorFallback.tsx` - Generic fallback UI
   - [ ] `NetworkErrorFallback.tsx` - Network error UI
   - [ ] `DataLoadErrorFallback.tsx` - Data error UI

2. **Enhance Existing Boundaries**
   - [ ] `global-error.tsx` - Add recovery options
   - [ ] `app/beaches/.../error.tsx` - Improve UX

3. **Create Route-Level Boundaries**
   - [ ] `app/error.tsx` - Root route
   - [ ] `app/map/error.tsx` - Map route
   - [ ] `app/beach/[slug]/error.tsx` - Beach details
   - [ ] `app/forecast/[beachId]/error.tsx` - Forecast route
   - [ ] `app/sessions/error.tsx` - Sessions list
   - [ ] `app/sessions/[id]/error.tsx` - Session detail
   - [ ] `app/profile/error.tsx` - Profile route
   - [ ] `app/admin/error.tsx` - Admin section

**Success Criteria**:
- All route-level error boundaries in place
- Core boundary components tested and documented
- Sentry integration verified
- Developer documentation complete

---

#### Phase 2: Feature Integration (Week 2)

**Goal**: Add feature-level error isolation

**Tasks**:
1. **Forecast Feature**
   - [ ] Create `ForecastErrorBoundary.tsx`
   - [ ] Wrap `ForecastDisplay` component
   - [ ] Handle NOAA API failures gracefully
   - [ ] Add cached forecast fallback

2. **Map Feature**
   - [ ] Create `MapErrorBoundary.tsx`
   - [ ] Wrap `InteractiveMap` component
   - [ ] Handle Mapbox initialization errors
   - [ ] Provide text-based beach list fallback

3. **Session Forms**
   - [ ] Create `SessionFormErrorBoundary.tsx`
   - [ ] Wrap `SessionForm` component
   - [ ] Implement state preservation
   - [ ] Add auto-save functionality

4. **Social Features**
   - [ ] Create `SocialErrorBoundary.tsx`
   - [ ] Wrap `ActivityFeed` component
   - [ ] Handle feed loading failures
   - [ ] Show partial data on errors

**Success Criteria**:
- 4 major features have error boundaries
- State preservation working for forms
- Cached data fallbacks functional
- User testing shows improved error UX

---

#### Phase 3: Critical Components (Week 3)

**Goal**: Protect high-risk individual components

**Tasks**:
1. **Identify Critical Components** (completed)
   - BeachHero, ForecastDisplay, TideChart
   - InteractiveMap, SessionForm, ProfileEditForm
   - CalendarHeatmap, SessionPhotoGallery

2. **Wrap Critical Components**
   - [ ] `beach-hero.tsx` → `DataErrorBoundary`
   - [ ] `forecast-display.tsx` → `DataErrorBoundary`
   - [ ] `tide-chart-recharts.tsx` → `ErrorBoundary`
   - [ ] `interactive-map.tsx` → `MapErrorBoundary`
   - [ ] `SessionForm.tsx` → `FormErrorBoundary`
   - [ ] `profile-edit-form.tsx` → `FormErrorBoundary`
   - [ ] `calendar-heatmap.tsx` → `ErrorBoundary`
   - [ ] `session-photo-gallery.tsx` → `ErrorBoundary`

3. **Component-Specific Fallbacks**
   - [ ] Create tailored error messages per component
   - [ ] Design component-appropriate recovery actions
   - [ ] Add component-level error tracking

**Success Criteria**:
- 8+ critical components protected
- Component-specific error handling working
- No regressions in component functionality
- Error rates decreased by 50%+

---

#### Phase 4: Refinement & Monitoring (Week 4)

**Goal**: Optimize error handling and monitoring

**Tasks**:
1. **Monitoring Setup**
   - [ ] Create Sentry dashboard for error boundaries
   - [ ] Set up error rate alerts
   - [ ] Configure error grouping by boundary type
   - [ ] Add custom Sentry tags (tier, feature, component)

2. **UX Refinement**
   - [ ] A/B test error messages
   - [ ] Optimize retry strategies based on success rates
   - [ ] Improve fallback UI based on user feedback
   - [ ] Add error recovery analytics

3. **Performance Optimization**
   - [ ] Lazy load error boundary components
   - [ ] Optimize error logging payload sizes
   - [ ] Reduce error boundary re-render overhead
   - [ ] Implement error deduplication

4. **Documentation**
   - [ ] Create error boundary usage guide
   - [ ] Document error handling patterns
   - [ ] Add examples to component library
   - [ ] Create troubleshooting guide

**Success Criteria**:
- Comprehensive Sentry dashboard operational
- Error messages validated with users
- Performance impact < 5ms per boundary
- Complete developer documentation

---

### Boundary Placement Map

```
app/
├── global-error.tsx                      ✅ Tier 1 (enhance)
├── error.tsx                             ⭐ Tier 2 (create)
├── layout.tsx
├── page.tsx
│
├── map/
│   ├── error.tsx                         ⭐ Tier 2 (create)
│   └── page.tsx → <MapErrorBoundary>     ⭐ Tier 3 (create)
│
├── beach/[slug]/
│   ├── error.tsx                         ⭐ Tier 2 (create)
│   └── beach-detail-client.tsx
│       └── <BeachDetailErrorBoundary>    ⭐ Tier 3 (create)
│           └── <BeachHero>               → wrap DataErrorBoundary
│
├── forecast/[beachId]/
│   ├── error.tsx                         ⭐ Tier 2 (create)
│   └── page.tsx → <ForecastErrorBoundary>⭐ Tier 3 (create)
│       └── <ForecastDisplay>             → wrap DataErrorBoundary
│       └── <TideChart>                   → wrap ErrorBoundary
│
├── sessions/
│   ├── error.tsx                         ⭐ Tier 2 (create)
│   ├── page.tsx
│   └── [id]/
│       ├── error.tsx                     ⭐ Tier 2 (create)
│       └── page.tsx
│
├── profile/
│   ├── error.tsx                         ⭐ Tier 2 (create)
│   └── page.tsx → <ProfileErrorBoundary> ⭐ Tier 3 (create)
│       └── <ProfileEditForm>             → wrap FormErrorBoundary
│
├── admin/
│   └── error.tsx                         ⭐ Tier 2 (create)
│
└── beaches/[country]/[state]/[city]/
    └── error.tsx                         ✅ Tier 2 (already exists)

components/
├── error-boundaries/                     ⭐ New directory
│   ├── ErrorBoundary.tsx                 ⭐ Tier 4 (create)
│   ├── DataErrorBoundary.tsx             ⭐ Tier 4 (create)
│   ├── FormErrorBoundary.tsx             ⭐ Tier 4 (create)
│   ├── ErrorFallback.tsx                 ⭐ Fallback UI (create)
│   ├── NetworkErrorFallback.tsx          ⭐ Fallback UI (create)
│   └── DataLoadErrorFallback.tsx         ⭐ Fallback UI (create)
│
├── forecast/
│   ├── ForecastErrorBoundary.tsx         ⭐ Tier 3 (create)
│   └── forecast-display.tsx              → use DataErrorBoundary
│
├── map/
│   ├── MapErrorBoundary.tsx              ⭐ Tier 3 (create)
│   └── interactive-map.tsx               → use MapErrorBoundary
│
├── session-forms/
│   ├── SessionFormErrorBoundary.tsx      ⭐ Tier 3 (create)
│   └── SessionForm.tsx                   → use FormErrorBoundary
│
└── [other features]/
    └── [Feature]ErrorBoundary.tsx        ⭐ As needed
```

**Legend**:
- ✅ Already exists
- ⭐ Needs to be created
- → Indicates wrapping relationship

---

## User Experience Guidelines

### Error Message Principles

#### 1. Clarity Over Accuracy

❌ **Bad**:
```
"TypeError: Cannot read property 'map' of undefined at ForecastDisplay.tsx:124"
```

✅ **Good**:
```
"Unable to Load Forecast
We're having trouble displaying the forecast right now. Try refreshing the page."
```

#### 2. Actionable Guidance

❌ **Bad**:
```
"An error occurred. Please try again later."
```

✅ **Good**:
```
"Connection Lost
Check your internet connection and tap 'Retry' to reload the forecast."
[Retry Button]
```

#### 3. Context Preservation

❌ **Bad**:
```
Error → Redirect to home page → User loses context
```

✅ **Good**:
```
Error → Show inline error → Keep user on same page → Preserve form data
```

#### 4. Progressive Disclosure

❌ **Bad**:
```
Show full error stack trace to all users
```

✅ **Good**:
```
Simple message by default
▼ "Show technical details" (optional, dev mode)
```

---

### Error UI Design Patterns

#### Pattern 1: Inline Error (Tier 4 - Component)

**When to Use**: Small, non-critical component failures

**Design**:
```
┌─────────────────────────────────────┐
│ [Beach Card - Normal Content]       │
│ Wave Height: 3-5 ft                 │
│ Period: 12s                         │
│                                     │
│ ⚠️ Tide data unavailable            │
│    [Retry]                          │
└─────────────────────────────────────┘
```

**Characteristics**:
- Minimal visual impact
- Preserves surrounding content
- Small retry button
- Yellow/orange warning color
- No navigation away from page

---

#### Pattern 2: Section Error (Tier 3 - Feature)

**When to Use**: Feature module failures

**Design**:
```
┌─────────────────────────────────────┐
│                                     │
│    [!] Unable to Load Forecast      │
│                                     │
│    We couldn't load the forecast    │
│    data. Your internet connection   │
│    may be unstable.                 │
│                                     │
│    [Try Again]  [View Cached]       │
│                                     │
└─────────────────────────────────────┘

[Rest of page continues normally]
```

**Characteristics**:
- Takes up full feature section
- Clear error icon and message
- Multiple recovery options
- Doesn't block other page sections
- Red/orange accent color

---

#### Pattern 3: Page Error (Tier 2 - Route)

**When to Use**: Entire page/route failures

**Design**:
```
┌─────────────────────────────────────┐
│         [App Header]                │
├─────────────────────────────────────┤
│                                     │
│                                     │
│         [!] Something Went Wrong    │
│                                     │
│    We encountered a problem loading │
│    this page. You can try reloading │
│    or return to the map.            │
│                                     │
│    [Try Again]  [Go to Map]         │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│    [Bottom Navigation]              │
└─────────────────────────────────────┘
```

**Characteristics**:
- Full page error state
- Navigation still available
- Clear path to recovery
- Maintains app shell (header, nav)
- Friendly, apologetic tone

---

#### Pattern 4: Critical Error (Tier 1 - Global)

**When to Use**: Catastrophic app-level failures

**Design**:
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│                                     │
│         [!] App Crashed             │
│                                     │
│    Quiver encountered a critical    │
│    error and needs to restart.      │
│                                     │
│    [Reload App]  [Report Problem]   │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Characteristics**:
- Full screen error state
- No navigation available
- Clear reload action
- Support link
- Serious but calm tone

---

### Mobile-Specific Considerations

#### 1. Touch-Friendly Error UI

**Requirements**:
- Buttons: Minimum 44x44px touch targets
- Spacing: 16px+ between interactive elements
- Font Size: Minimum 16px for body text
- Contrast: WCAG AA minimum (4.5:1)

**Example**:
```typescript
<Button
  className="min-h-[44px] min-w-[88px] text-base"
  onClick={retry}
>
  Try Again
</Button>
```

#### 2. Offline Detection

**Pattern**:
```typescript
// Detect online/offline status
const isOnline = navigator.onLine;

// Listen for connectivity changes
useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

// Show offline-specific UI
{!isOnline && (
  <OfflineBanner>
    You're offline. Some features may be limited.
  </OfflineBanner>
)}
```

#### 3. Haptic Feedback (Optional)

**For Native Mobile Apps**:
```typescript
// Error occurred - light haptic feedback
if (window.Capacitor?.isNativePlatform()) {
  Haptics.notification({ type: NotificationType.Error });
}

// Success after retry - success haptic
if (window.Capacitor?.isNativePlatform()) {
  Haptics.notification({ type: NotificationType.Success });
}
```

#### 4. Reduced Data Mode

**For Users on Limited Connections**:
```typescript
// Detect slow connection
const connection = navigator.connection;
const isSlowConnection =
  connection?.effectiveType === '2g' ||
  connection?.effectiveType === 'slow-2g';

// Offer reduced data mode
{isSlowConnection && (
  <Alert>
    Slow connection detected.
    <button onClick={enableReducedMode}>
      Enable Reduced Data Mode
    </button>
  </Alert>
)}
```

#### 5. Cached Data Strategy

**Mobile-First Caching**:
```typescript
// Cache forecast data for offline viewing
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// On fetch success, cache data
localStorage.setItem(
  `forecast_${beachId}`,
  JSON.stringify({
    data: forecastData,
    timestamp: Date.now(),
  })
);

// On fetch failure, use cached data if available
const cached = localStorage.getItem(`forecast_${beachId}`);
if (cached) {
  const { data, timestamp } = JSON.parse(cached);
  const age = Date.now() - timestamp;

  if (age < CACHE_DURATION) {
    return {
      data,
      cached: true,
      age: Math.floor(age / 1000 / 60), // minutes
    };
  }
}
```

---

## Monitoring & Observability

### Sentry Integration

#### Error Boundary Logging Pattern

**Standard Logging**:
```typescript
import * as Sentry from '@sentry/nextjs';

// In error boundary componentDidCatch
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // Log to Sentry with rich context
  Sentry.withScope((scope) => {
    // Boundary metadata
    scope.setTag('error_boundary_tier', 'tier_3');
    scope.setTag('error_boundary_type', 'feature');
    scope.setTag('feature_name', 'forecast');

    // Component context
    scope.setContext('component', {
      name: this.props.componentName,
      stack: errorInfo.componentStack,
    });

    // User context (if available)
    scope.setUser({
      id: userId,
      username: username,
    });

    // Additional metadata
    scope.setContext('boundary_state', {
      reset_count: this.state.resetCount,
      last_reset: this.state.lastResetTime,
    });

    // Capture exception
    Sentry.captureException(error);
  });

  // Update component state
  this.setState({ hasError: true, error });
}
```

#### Custom Error Tags

**Tier Tags**:
- `error_boundary_tier`: `tier_1` | `tier_2` | `tier_3` | `tier_4`
- `error_boundary_type`: `global` | `route` | `feature` | `component`

**Feature Tags**:
- `feature_name`: `forecast` | `map` | `session_form` | `profile` | etc.
- `component_name`: Specific component identifier

**Error Category Tags**:
- `error_category`: `network` | `data_parsing` | `rendering` | `user_input` | `system`
- `retry_attempted`: `true` | `false`
- `retry_count`: `0` | `1` | `2` | `3` | etc.
- `recovery_action`: `reset` | `cached_data` | `redirect` | `skip`

---

### Sentry Dashboard Configuration

#### 1. Error Boundary Overview Dashboard

**Metrics**:
- Total errors caught by boundaries (last 24h, 7d, 30d)
- Errors by tier (pie chart)
- Errors by feature (bar chart)
- Recovery success rate (%)
- User-initiated retries (count)

**Filters**:
- Tier level
- Feature/component
- Error category
- Time range

---

#### 2. Error Rate Alerts

**Alert Conditions**:
```yaml
# Critical: Tier 1 global errors
- condition: error_boundary_tier = "tier_1"
  threshold: "> 10 errors in 5 minutes"
  severity: critical
  notification: slack, pagerduty

# High: Tier 2 route errors
- condition: error_boundary_tier = "tier_2"
  threshold: "> 50 errors in 15 minutes"
  severity: high
  notification: slack

# Medium: Tier 3 feature errors
- condition: error_boundary_tier = "tier_3"
  threshold: "> 100 errors in 1 hour"
  severity: medium
  notification: slack

# Low: Tier 4 component errors
- condition: error_boundary_tier = "tier_4"
  threshold: "> 500 errors in 24 hours"
  severity: low
  notification: email
```

---

#### 3. Error Trends Report

**Weekly Report Includes**:
- Top 10 most frequent errors
- Error rate trend (increasing/decreasing)
- Recovery action effectiveness
- User impact (affected users, sessions)
- Recommendations for fixes

---

### Analytics Tracking

#### Error Analytics Events

**Event: `error_boundary_triggered`**
```typescript
analytics.track('error_boundary_triggered', {
  tier: 'tier_3',
  type: 'feature',
  feature_name: 'forecast',
  error_category: 'network',
  error_message: error.message,
  component_name: 'ForecastDisplay',
  user_id: userId,
  timestamp: Date.now(),
});
```

**Event: `error_recovery_attempted`**
```typescript
analytics.track('error_recovery_attempted', {
  tier: 'tier_3',
  recovery_action: 'retry',
  attempt_number: 2,
  feature_name: 'forecast',
  user_id: userId,
});
```

**Event: `error_recovery_success`**
```typescript
analytics.track('error_recovery_success', {
  tier: 'tier_3',
  recovery_action: 'retry',
  attempts_required: 2,
  time_to_recovery: 4500, // milliseconds
  feature_name: 'forecast',
  user_id: userId,
});
```

**Event: `error_recovery_failed`**
```typescript
analytics.track('error_recovery_failed', {
  tier: 'tier_3',
  recovery_action: 'retry',
  attempts_made: 3,
  fallback_used: 'cached_data',
  feature_name: 'forecast',
  user_id: userId,
});
```

---

### Performance Monitoring

#### Error Boundary Performance Metrics

**Metrics to Track**:
- Error boundary render time
- Fallback UI render time
- Recovery action latency
- Memory usage during errors
- Error logging overhead

**Example Measurement**:
```typescript
// Measure error boundary overhead
const renderStart = performance.now();

// Render error fallback
const fallbackUI = this.renderFallback();

const renderEnd = performance.now();
const renderTime = renderEnd - renderStart;

// Log if slow render
if (renderTime > 16) { // 1 frame at 60fps
  console.warn('Slow error boundary render:', renderTime);

  Sentry.captureMessage('Slow error boundary render', {
    level: 'warning',
    extra: {
      render_time: renderTime,
      boundary_type: 'feature',
      feature_name: this.props.featureName,
    },
  });
}
```

---

## Mobile Considerations

### iOS-Specific

#### 1. Safari Error Handling

**Issue**: Safari has stricter error handling than Chrome

**Solution**:
```typescript
// Detect Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Safari-specific error handling
if (isSafari) {
  // More aggressive error boundary wrapping
  // Shorter retry timeouts
  // More detailed logging
}
```

#### 2. Memory Constraints

**Issue**: iOS has stricter memory limits

**Solution**:
```typescript
// Monitor memory usage
if (performance.memory) {
  const usedMemory = performance.memory.usedJSHeapSize;
  const totalMemory = performance.memory.totalJSHeapSize;
  const percentUsed = (usedMemory / totalMemory) * 100;

  if (percentUsed > 80) {
    // Clear non-critical caches
    // Reduce feature complexity
    // Show low memory warning
  }
}
```

#### 3. Capacitor Integration

**Error Boundary for Capacitor Plugins**:
```typescript
// Wrap Capacitor plugin calls
async function safeCapacitorCall<T>(
  pluginFn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await pluginFn();
  } catch (error) {
    console.error('Capacitor plugin error:', error);
    Sentry.captureException(error, {
      tags: { error_type: 'capacitor_plugin' },
    });
    return fallback;
  }
}

// Usage
const location = await safeCapacitorCall(
  () => Geolocation.getCurrentPosition(),
  { coords: { latitude: 32.7157, longitude: -117.1611 } } // SD default
);
```

---

### Android-Specific

#### 1. WebView Errors

**Issue**: Android WebView can have rendering issues

**Solution**:
```typescript
// Detect Android WebView
const isAndroidWebView = /android.*wv/i.test(navigator.userAgent);

// WebView-specific handling
if (isAndroidWebView) {
  // Simpler rendering for complex components
  // More frequent boundary checks
  // Hardware acceleration detection
}
```

#### 2. Storage Quota

**Issue**: Android has variable storage quotas

**Solution**:
```typescript
// Check storage quota
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate();
  const percentUsed = (estimate.usage / estimate.quota) * 100;

  if (percentUsed > 90) {
    // Clear old cached data
    // Warn user about storage
    // Disable auto-save features temporarily
  }
}
```

---

### Cross-Platform

#### 1. Offline-First Architecture

**Pattern**: Cache-first, network-fallback
```typescript
async function fetchWithCache<T>(
  url: string,
  cacheKey: string,
  cacheDuration: number = 3600000 // 1 hour
): Promise<T> {
  // Try cache first
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age < cacheDuration) {
      // Return cached data immediately
      // Optionally fetch fresh data in background
      return data;
    }
  }

  // Fetch from network
  try {
    const response = await fetch(url);
    const data = await response.json();

    // Update cache
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ data, timestamp: Date.now() })
    );

    return data;
  } catch (error) {
    // Network failed, return stale cache if available
    if (cached) {
      const { data } = JSON.parse(cached);
      return { ...data, stale: true };
    }
    throw error;
  }
}
```

#### 2. Progressive Web App (PWA) Error Handling

**Service Worker Error Recovery**:
```typescript
// sw.js - Service worker
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return cached response
        if (response) {
          return response;
        }

        // Clone request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check valid response
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone response and cache
            const responseToCache = response.clone();
            caches.open('quiver-v1').then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch((error) => {
            // Network fetch failed
            console.error('Fetch failed:', error);

            // Return offline page if available
            return caches.match('/offline.html');
          });
      })
  );
});
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Days 1-2: Core Infrastructure**
- [ ] Create `components/error-boundaries/` directory
- [ ] Implement `ErrorBoundary.tsx` with tests
- [ ] Implement `DataErrorBoundary.tsx` with retry logic
- [ ] Implement `FormErrorBoundary.tsx` with state preservation
- [ ] Create `ErrorFallback.tsx` UI component
- [ ] Create `NetworkErrorFallback.tsx` UI component
- [ ] Create `DataLoadErrorFallback.tsx` UI component

**Days 3-4: Route-Level Boundaries**
- [ ] Create `app/error.tsx` (root route)
- [ ] Create `app/map/error.tsx`
- [ ] Create `app/beach/[slug]/error.tsx`
- [ ] Create `app/forecast/[beachId]/error.tsx`
- [ ] Create `app/sessions/error.tsx`
- [ ] Create `app/sessions/[id]/error.tsx`
- [ ] Create `app/profile/error.tsx`
- [ ] Create `app/admin/error.tsx`

**Day 5: Testing & Documentation**
- [ ] Unit tests for all boundary components
- [ ] Integration tests for error scenarios
- [ ] Update component documentation
- [ ] Create usage examples
- [ ] Developer guide for error boundaries

**Success Metrics**:
- ✅ All Tier 1 & 2 boundaries operational
- ✅ 100% test coverage for boundary components
- ✅ Zero console errors during error states
- ✅ Documentation complete and reviewed

---

### Phase 2: Feature Integration (Week 2)

**Days 1-2: Forecast Feature**
- [ ] Create `ForecastErrorBoundary.tsx`
- [ ] Wrap `ForecastDisplay` component
- [ ] Implement NOAA API error handling
- [ ] Add cached forecast fallback
- [ ] Test offline scenarios
- [ ] Verify Sentry logging

**Days 3-4: Map & Session Features**
- [ ] Create `MapErrorBoundary.tsx`
- [ ] Wrap `InteractiveMap` component
- [ ] Create `SessionFormErrorBoundary.tsx`
- [ ] Wrap `SessionForm` component
- [ ] Implement form state preservation
- [ ] Test auto-save functionality

**Day 5: Social & Profile Features**
- [ ] Create `SocialErrorBoundary.tsx`
- [ ] Wrap social feed components
- [ ] Create `ProfileErrorBoundary.tsx`
- [ ] Wrap profile components
- [ ] End-to-end testing

**Success Metrics**:
- ✅ 4 feature boundaries operational
- ✅ Form state preservation working
- ✅ Cached data fallbacks functional
- ✅ User testing shows 80%+ satisfaction with error UX

---

### Phase 3: Critical Components (Week 3)

**Days 1-3: Component Wrapping**
- [ ] Wrap `beach-hero.tsx` with `DataErrorBoundary`
- [ ] Wrap `forecast-display.tsx` with `DataErrorBoundary`
- [ ] Wrap `tide-chart-recharts.tsx` with `ErrorBoundary`
- [ ] Wrap `interactive-map.tsx` with `MapErrorBoundary`
- [ ] Wrap `SessionForm.tsx` with `FormErrorBoundary`
- [ ] Wrap `profile-edit-form.tsx` with `FormErrorBoundary`
- [ ] Wrap `calendar-heatmap.tsx` with `ErrorBoundary`
- [ ] Wrap `session-photo-gallery.tsx` with `ErrorBoundary`

**Days 4-5: Testing & Refinement**
- [ ] Regression testing for wrapped components
- [ ] Performance testing (ensure <5ms overhead)
- [ ] Error simulation testing
- [ ] User acceptance testing
- [ ] Fix any issues discovered

**Success Metrics**:
- ✅ 8+ critical components protected
- ✅ No functional regressions
- ✅ Performance impact <5ms per boundary
- ✅ Error rates decreased by 50%+

---

### Phase 4: Refinement & Monitoring (Week 4)

**Days 1-2: Monitoring Setup**
- [ ] Create Sentry error boundary dashboard
- [ ] Configure error rate alerts
- [ ] Set up error grouping rules
- [ ] Add custom Sentry tags
- [ ] Create weekly error reports

**Days 3-4: UX Optimization**
- [ ] A/B test error messages (3 variants)
- [ ] Optimize retry strategies based on data
- [ ] Refine fallback UI based on feedback
- [ ] Add error recovery analytics
- [ ] Measure user recovery success rates

**Day 5: Documentation & Launch**
- [ ] Complete error boundary usage guide
- [ ] Document error handling patterns
- [ ] Add examples to Storybook
- [ ] Create troubleshooting guide
- [ ] Team training session
- [ ] Production deployment

**Success Metrics**:
- ✅ Sentry dashboard fully operational
- ✅ Error messages A/B tested and optimized
- ✅ 90%+ developer adoption rate
- ✅ Complete documentation published

---

## Testing Strategy

### Unit Tests

#### Error Boundary Component Tests

**Test File**: `__tests__/components/error-boundaries/ErrorBoundary.test.tsx`

**Test Cases**:
```typescript
describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    // Arrange
    render(
      <ErrorBoundary>
        <div>Child Content</div>
      </ErrorBoundary>
    );

    // Assert
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('catches errors and displays fallback', () => {
    // Arrange
    const ThrowError = () => {
      throw new Error('Test error');
    };

    // Act
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Assert
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    // Arrange
    const onError = jest.fn();
    const ThrowError = () => {
      throw new Error('Test error');
    };

    // Act
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    // Assert
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' }),
      expect.any(Object)
    );
  });

  it('resets error state when reset is called', async () => {
    // Arrange
    let shouldThrow = true;
    const ThrowError = () => {
      if (shouldThrow) throw new Error('Test error');
      return <div>Success</div>;
    };

    // Act - Error occurs
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Assert - Error state
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Act - Reset
    shouldThrow = false;
    const retryButton = screen.getByRole('button', { name: /try again/i });
    await userEvent.click(retryButton);

    // Assert - Success state
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('auto-resets when resetKeys change', () => {
    // Arrange
    const { rerender } = render(
      <ErrorBoundary resetKeys={[1]}>
        <div>Content</div>
      </ErrorBoundary>
    );

    // Act - Trigger error
    // Then change resetKeys
    rerender(
      <ErrorBoundary resetKeys={[2]}>
        <div>Content</div>
      </ErrorBoundary>
    );

    // Assert - Error cleared
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('logs error to Sentry', () => {
    // Arrange
    const sentrySpy = jest.spyOn(Sentry, 'captureException');
    const ThrowError = () => {
      throw new Error('Test error');
    };

    // Act
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Assert
    expect(sentrySpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' })
    );
  });
});
```

---

### Integration Tests

#### Route-Level Error Boundary Tests

**Test File**: `__tests__/integration/error-boundaries/route-errors.test.tsx`

**Test Cases**:
```typescript
describe('Route Error Boundaries', () => {
  it('catches errors in map route', async () => {
    // Arrange
    mockMapBoxError();

    // Act
    render(<MapPage />);
    await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));

    // Assert
    expect(screen.getByText(/unable to load map/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('catches data errors in forecast route', async () => {
    // Arrange
    mockNOAAError();

    // Act
    render(<ForecastPage beachId="123" />);
    await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));

    // Assert
    expect(screen.getByText(/unable to load forecast/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('preserves navigation during route errors', async () => {
    // Arrange
    mockBeachDetailError();

    // Act
    render(<BeachDetailPage slug="ocean-beach" />);
    await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));

    // Assert
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Navigation still works
    const mapLink = screen.getByRole('link', { name: /back to map/i });
    expect(mapLink).toHaveAttribute('href', '/map');
  });
});
```

---

### E2E Tests (Playwright)

#### Error Scenario Tests

**Test File**: `e2e/error-boundaries.spec.ts`

**Test Cases**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Error Boundaries', () => {
  test('recovers from network error on forecast page', async ({ page }) => {
    // Navigate to forecast page
    await page.goto('/forecast/ocean-beach');

    // Wait for forecast to load
    await expect(page.getByText(/wave height/i)).toBeVisible();

    // Simulate network failure
    await page.route('**/api/forecasts/**', route => {
      route.abort('failed');
    });

    // Trigger re-fetch
    await page.reload();

    // Assert error UI shown
    await expect(page.getByText(/unable to load forecast/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();

    // Restore network
    await page.unroute('**/api/forecasts/**');

    // Click retry
    await page.getByRole('button', { name: /retry/i }).click();

    // Assert success
    await expect(page.getByText(/wave height/i)).toBeVisible();
  });

  test('preserves form data on session form error', async ({ page }) => {
    // Navigate to session form
    await page.goto('/plan-session');

    // Fill form
    await page.getByLabel(/beach/i).fill('Ocean Beach');
    await page.getByLabel(/date/i).fill('2025-11-20');
    await page.getByLabel(/notes/i).fill('Test notes');

    // Simulate component error
    await page.evaluate(() => {
      // Trigger error in component
      throw new Error('Simulated error');
    });

    // Assert error UI
    await expect(page.getByText(/form error/i)).toBeVisible();

    // Restore form
    await page.getByRole('button', { name: /restore/i }).click();

    // Assert form data preserved
    await expect(page.getByLabel(/beach/i)).toHaveValue('Ocean Beach');
    await expect(page.getByLabel(/notes/i)).toHaveValue('Test notes');
  });

  test('handles offline gracefully on map page', async ({ page, context }) => {
    // Navigate to map
    await page.goto('/map');
    await expect(page.getByText(/loading/i)).toBeHidden();

    // Go offline
    await context.setOffline(true);

    // Trigger refresh
    await page.reload();

    // Assert offline UI
    await expect(page.getByText(/connection lost/i)).toBeVisible();
    await expect(page.getByText(/offline/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Click retry
    await page.getByRole('button', { name: /retry/i }).click();

    // Assert success
    await expect(page.getByText(/loading/i)).toBeHidden();
  });
});
```

---

### Error Simulation Tests

#### Mock Error Scenarios

**Test File**: `__tests__/utils/error-simulation.ts`

**Utilities**:
```typescript
/**
 * Simulate network error
 */
export function simulateNetworkError() {
  jest.spyOn(global, 'fetch').mockRejectedValue(
    new Error('Network request failed')
  );
}

/**
 * Simulate data parsing error
 */
export function simulateParsingError() {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.reject(new Error('Invalid JSON')),
  } as Response);
}

/**
 * Simulate timeout error
 */
export function simulateTimeoutError() {
  jest.spyOn(global, 'fetch').mockImplementation(
    () => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 100);
    })
  );
}

/**
 * Simulate Supabase error
 */
export function simulateSupabaseError(errorCode: string) {
  jest.spyOn(supabase, 'from').mockReturnValue({
    select: jest.fn().mockRejectedValue({
      code: errorCode,
      message: 'Supabase error',
    }),
  } as any);
}

/**
 * Simulate out of memory error
 */
export function simulateMemoryError() {
  const originalArrayBuffer = global.ArrayBuffer;

  global.ArrayBuffer = function(size: number) {
    if (size > 1000000) {
      throw new RangeError('Out of memory');
    }
    return new originalArrayBuffer(size);
  } as any;
}
```

---

## Appendices

### Appendix A: Error Codes & Messages

#### Network Errors

| Code | User Message | Recovery Action |
|------|--------------|-----------------|
| `NET_001` | "Connection Lost" | Retry with backoff |
| `NET_002` | "Request Timeout" | Retry with longer timeout |
| `NET_003` | "Server Unavailable" | Show status page link |
| `NET_004` | "DNS Resolution Failed" | Check internet connection |

#### Data Errors

| Code | User Message | Recovery Action |
|------|--------------|-----------------|
| `DATA_001` | "Invalid Data Format" | Log to Sentry, show fallback |
| `DATA_002` | "Missing Required Field" | Show partial data |
| `DATA_003` | "Data Validation Failed" | Use cached data |
| `DATA_004` | "Unexpected Response" | Retry once, then fallback |

#### Rendering Errors

| Code | User Message | Recovery Action |
|------|--------------|-----------------|
| `RENDER_001` | "Display Error" | Reset component |
| `RENDER_002` | "Component Crash" | Show error boundary |
| `RENDER_003` | "Hydration Mismatch" | Force client-side render |
| `RENDER_004` | "Memory Leak Detected" | Reload page |

---

### Appendix B: Sentry Configuration

#### Error Boundary Tags Setup

**File**: `lib/sentry/error-boundary-config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

export function configureErrorBoundaryTags() {
  // Set global tags
  Sentry.setTag('app_version', process.env.NEXT_PUBLIC_APP_VERSION);
  Sentry.setTag('environment', process.env.NODE_ENV);

  // Configure sampling
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% of transactions

    // Error filtering
    beforeSend(event, hint) {
      // Filter out low-severity errors from Tier 4
      if (event.tags?.error_boundary_tier === 'tier_4') {
        // Only send 10% of Tier 4 errors
        if (Math.random() > 0.1) return null;
      }

      // Always send Tier 1 & 2 errors
      return event;
    },

    // Add error boundary context
    integrations: [
      new Sentry.BrowserTracing({
        tracingOrigins: ['localhost', 'quiver.surf'],
      }),
    ],
  });
}
```

---

### Appendix C: Performance Benchmarks

#### Error Boundary Overhead

**Target Metrics**:
- Component wrap overhead: <1ms
- Error catch overhead: <5ms
- Fallback render time: <16ms (1 frame)
- Logging overhead: <10ms
- Reset action latency: <100ms

**Measurement Code**:
```typescript
// Measure error boundary overhead
const measureErrorBoundary = () => {
  const start = performance.now();

  // Wrap component
  const wrapped = (
    <ErrorBoundary>
      <TestComponent />
    </ErrorBoundary>
  );

  const wrapEnd = performance.now();
  console.log('Wrap overhead:', wrapEnd - start, 'ms');

  // Trigger error
  const errorStart = performance.now();
  triggerError();
  const errorEnd = performance.now();
  console.log('Error catch overhead:', errorEnd - errorStart, 'ms');

  // Render fallback
  const renderStart = performance.now();
  // Fallback renders
  const renderEnd = performance.now();
  console.log('Fallback render time:', renderEnd - renderStart, 'ms');
};
```

**Results** (Target):
```
Wrap overhead: 0.5ms ✅
Error catch overhead: 3ms ✅
Fallback render time: 12ms ✅
Logging overhead: 8ms ✅
Reset action latency: 45ms ✅
```

---

### Appendix D: Migration Checklist

#### Pre-Implementation Checklist

- [ ] Review all components for error-prone code
- [ ] Identify critical user paths
- [ ] Document current error handling patterns
- [ ] Set baseline error metrics in Sentry
- [ ] Create error simulation test suite
- [ ] Design error UI mockups
- [ ] Get stakeholder approval on UX changes

#### Implementation Checklist

- [ ] Phase 1: Foundation complete
- [ ] Phase 2: Feature integration complete
- [ ] Phase 3: Component wrapping complete
- [ ] Phase 4: Refinement complete
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Documentation published
- [ ] Team training completed

#### Post-Implementation Checklist

- [ ] Monitor error rates for 1 week
- [ ] Gather user feedback
- [ ] Review Sentry dashboards
- [ ] Analyze recovery success rates
- [ ] Identify optimization opportunities
- [ ] Schedule follow-up improvements
- [ ] Document lessons learned

---

### Appendix E: References

#### Internal Documentation

- [Components Architecture](/components/ARCHITECTURE.md)
- [E2E Testing Patterns](/e2e/ARCHITECTURE.md)
- [Styles Architecture](/styles/ARCHITECTURE.md)
- [Supabase Database Architecture](/supabase/ARCHITECTURE.md)

#### External Resources

- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Next.js error.tsx](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- [Sentry Error Boundary](https://docs.sentry.io/platforms/javascript/guides/react/components/errorboundary/)
- [Error Boundary Best Practices (Kent C. Dodds)](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react)
- [WCAG 2.1 Error Handling](https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html)

#### Tools & Libraries

- **Sentry**: Error monitoring and tracking
- **React**: Error boundary APIs
- **Next.js**: App Router error handling
- **Playwright**: E2E error scenario testing
- **Jest**: Unit testing error boundaries

---

## Conclusion

This comprehensive error boundary strategy provides Quiver with:

1. **Granular Error Isolation**: Four-tier hierarchy prevents component failures from cascading
2. **Improved User Experience**: Clear messaging, recovery actions, and context preservation
3. **Effective Monitoring**: Sentry integration with rich context and actionable alerts
4. **Mobile Optimization**: Offline support, caching, and platform-specific handling
5. **Developer Efficiency**: Reusable boundaries, clear patterns, and comprehensive documentation

### Next Steps

1. **Review & Approval**: Stakeholder review of strategy document
2. **Design Mockups**: Create visual designs for error UI components
3. **Implementation**: Execute 4-week roadmap
4. **Monitoring**: Track error rates and user recovery success
5. **Iteration**: Continuously improve based on data and feedback

### Success Criteria

- ✅ 195+ components protected by error boundaries
- ✅ Error rates decreased by 50%+
- ✅ User recovery success rate >80%
- ✅ Zero data loss during form errors
- ✅ Performance overhead <5ms per boundary
- ✅ 90%+ developer adoption rate
- ✅ Comprehensive monitoring in place

---

**Document Status**: Design Phase Complete
**Next Review**: After Phase 1 Implementation
**Document Owner**: Next.js Developer Agent
**Last Updated**: 2025-11-14
