> Folded into [Coordinate Conventions](../../COORDINATE_CONVENTIONS.md#runtime-coordinate-validation).

# Coordinate Validation

Runtime validation for geographic coordinates in the Quiver application.

## Overview

This document describes the coordinate validation system implemented to catch invalid coordinate values early and provide helpful error messages during development.

## Validation Utilities

### Location
`/lib/coordinate-validation.ts`

### Functions

#### Core Validation Functions

**`isValidLatitude(lat)`**
- Type guard for valid latitude values
- Range: -90 to 90 degrees
- Rejects: undefined, null, NaN, Infinity, values outside range

**`isValidLongitude(lon)`**
- Type guard for valid longitude values
- Range: -180 to 180 degrees
- Rejects: undefined, null, NaN, Infinity, values outside range

**`isValidCoordinate(lat, lon)`**
- Validates both latitude and longitude together
- Returns true only if both are valid
- Type-safe: narrows type to `number` when true

#### Error Reporting

**`getCoordinateValidationError(lat, lon, context?)`**
- Returns detailed error message for invalid coordinates
- Returns null if coordinates are valid
- Optional context parameter adds context to error messages
- Example: `"Beach: Pacific Beach: Latitude 91 is out of range (-90 to 90)"`

**`validateCoordinates(lat, lon, context?)`**
- Validates coordinates with environment-aware logging
- **Development**: Logs detailed warnings to console with stack trace
- **Production**: Silent validation, no console output
- Returns boolean indicating validity

#### Advanced Functions

**`assertValidCoordinates(lat, lon, context?)`**
- TypeScript assertion function
- Throws error if coordinates are invalid
- Use for critical paths where invalid coordinates should halt execution

**`sanitizeCoordinates(lat, lon)`**
- Attempts to sanitize coordinates by clamping to valid ranges
- Returns null if coordinates cannot be sanitized (undefined, null, NaN)
- Logs warnings in development when clamping occurs
- Returns: `{ latitude: number, longitude: number } | null`

**`hasValidCoordinates(obj)`**
- Type guard for objects with coordinate properties
- Accepts objects with `lat`/`lon` or `latitude`/`longitude` properties
- Validates the coordinate values
- Useful for runtime validation of API responses

## Implementation

### 1. Hook-Level Validation

**Location**: `/hooks/use-intel-data.ts`

The `useIntelData` hook validates coordinates before making API calls:

```typescript
const fetchIntelData = useCallback(async (): Promise<IntelData | null> => {
  if (!enabled || !latitude || !longitude) {
    return null;
  }

  // Validate coordinates before making API call
  const validationError = getCoordinateValidationError(
    latitude,
    longitude,
    'useIntelData'
  );

  if (validationError) {
    // In development, log detailed warning
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Invalid coordinates detected in useIntelData:', validationError);
      console.error('  Latitude:', latitude);
      console.error('  Longitude:', longitude);
    }

    // Throw error to propagate to error boundary
    throw new Error(`Invalid coordinates: ${validationError}`);
  }

  // ... rest of implementation
}, [enabled, latitude, longitude, filters, user]);
```

The `setManualLocation` function in `useLocationIntelData` also validates:

```typescript
const setManualLocation = useCallback((lat: number, lng: number) => {
  // Validate coordinates before setting
  if (!validateCoordinates(lat, lng, 'setManualLocation')) {
    const error = getCoordinateValidationError(lat, lng, 'setManualLocation');
    console.error('❌ Attempted to set invalid location:', error);
    setLocationError(error || 'Invalid coordinates provided');
    return;
  }

  setLocation({ latitude: lat, longitude: lng });
  setLocationError(null);
  setGettingLocation(false);
}, []);
```

### 2. Component-Level Validation

**Development-only warnings** are added at component boundaries to help developers catch issues:

#### BeachIntelSection
**Location**: `/components/intel/beach-intel-section.tsx`

```typescript
// Validate coordinates in development
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    if (!validateCoordinates(latitude, longitude, `Beach: ${beachName}`)) {
      console.warn(`⚠️ BeachIntelSection received invalid coordinates for ${beachName}`);
      console.warn(`  Beach ID: ${beachId}`);
      console.warn(`  Latitude: ${latitude}`);
      console.warn(`  Longitude: ${longitude}`);
    }
  }
}, [latitude, longitude, beachName, beachId]);
```

#### IntelTab
**Location**: `/components/beach-detail/tabs/intel-tab.tsx`

```typescript
// Validate coordinates in development
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    if (!validateCoordinates(beach.lat, beach.lon, `IntelTab: ${beach.name}`)) {
      console.warn(`⚠️ IntelTab received beach with invalid coordinates`);
      console.warn(`  Beach: ${beach.name} (${beach.id})`);
      console.warn(`  Latitude: ${beach.lat}`);
      console.warn(`  Longitude: ${beach.lon}`);
    }
  }
}, [beach.lat, beach.lon, beach.name, beach.id]);
```

#### ForecastTab
**Location**: `/components/home-screen/forecast-tab.tsx`

```typescript
// Warn in development if coordinates look suspicious
if (process.env.NODE_ENV === 'development' && (lat === 0 || lon === 0)) {
  console.warn(`⚠️ ForecastTab: Beach ${effectiveBeach.name} has zero coordinates`);
  console.warn(`  Beach ID: ${effectiveBeach.id}`);
  console.warn(`  Latitude: ${lat}`);
  console.warn(`  Longitude: ${lon}`);
}
```

## Environment Behavior

### Development Mode
- **Verbose logging**: Detailed console warnings with coordinate values
- **Stack traces**: Help identify where invalid coordinates originate
- **Component warnings**: useEffect hooks warn about invalid props
- **No crashes**: Validation warnings don't break the application

### Production Mode
- **Silent validation**: No console output for invalid coordinates
- **Graceful handling**: Errors are logged to monitoring service (Sentry)
- **User experience**: Invalid coordinates don't crash the UI
- **Performance**: Minimal overhead from validation checks

## Testing

### Test Coverage
Location: `/__tests__/lib/coordinate-validation.test.ts`

**33 comprehensive tests** covering:
- Valid coordinate ranges
- Invalid values (NaN, undefined, null, Infinity)
- Out-of-range values
- Error message formatting
- Context inclusion in error messages
- Development vs production behavior
- Coordinate sanitization
- Object type guards
- Real-world scenarios (San Diego beaches, swapped coordinates)

### Running Tests

```bash
# Run validation utility tests
npx jest __tests__/lib/coordinate-validation.test.ts

# Run intel hook tests (includes validation)
npx jest __tests__/hooks/use-intel-data.test.ts

# Run all tests
yarn test:unit
```

## Common Validation Scenarios

### Valid Coordinates
```typescript
// San Diego beaches
isValidCoordinate(32.7157, -117.1611) // ✅ true
isValidCoordinate(32.7956, -117.2258) // ✅ true (Pacific Beach)
isValidCoordinate(32.7534, -117.2511) // ✅ true (Ocean Beach)

// Edge cases
isValidCoordinate(0, 0)       // ✅ true (Null Island)
isValidCoordinate(90, 180)    // ✅ true (Max values)
isValidCoordinate(-90, -180)  // ✅ true (Min values)
```

### Invalid Coordinates
```typescript
// Out of range
isValidCoordinate(91, -117.1611)  // ❌ false (lat > 90)
isValidCoordinate(32.7157, 181)   // ❌ false (lon > 180)

// Swapped coordinates (the bug we prevent)
isValidCoordinate(-117.1611, 32.7157)  // ❌ false (lon in lat field)

// Invalid values
isValidCoordinate(NaN, -117.1611)      // ❌ false
isValidCoordinate(undefined, -117.1611) // ❌ false
isValidCoordinate(null, -117.1611)     // ❌ false
```

### Development Warnings
```typescript
// Development console output when invalid coordinates detected:
⚠️ Invalid coordinates detected: useIntelData: Latitude 91 is out of range (-90 to 90)
  Latitude: 91
  Longitude: -117.1611
  Stack trace: [full stack trace follows]
```

## Best Practices

### When to Use Each Function

1. **`validateCoordinates()`** - Use for development warnings
   - Component prop validation
   - useEffect hooks
   - Development-time debugging

2. **`getCoordinateValidationError()`** - Use for error handling
   - API parameter validation
   - User input validation
   - Error messages to users

3. **`assertValidCoordinates()`** - Use for critical paths
   - Database writes
   - API calls that must not fail
   - When invalid data should halt execution

4. **`hasValidCoordinates()`** - Use for type guards
   - Runtime validation of API responses
   - Database query results
   - Type narrowing

5. **`sanitizeCoordinates()`** - Use for data cleanup
   - User input sanitization
   - Legacy data migration
   - When you need best-effort coordinate fixing

### Adding Validation to New Components

When adding a component that accepts coordinates:

1. **Import validation function**:
   ```typescript
   import { validateCoordinates } from '@/lib/coordinate-validation';
   ```

2. **Add validation in useEffect** (development only):
   ```typescript
   useEffect(() => {
     if (process.env.NODE_ENV === 'development') {
       validateCoordinates(latitude, longitude, `ComponentName: ${context}`);
     }
   }, [latitude, longitude, context]);
   ```

3. **Use in critical paths** (all environments):
   ```typescript
   const validationError = getCoordinateValidationError(lat, lon);
   if (validationError) {
     throw new Error(`Invalid coordinates: ${validationError}`);
   }
   ```

## Monitoring and Debugging

### Development
- Check browser console for validation warnings
- Warnings include full context (component, beach name, etc.)
- Stack traces help identify the source of invalid data

### Production
- Invalid coordinates are logged to Sentry
- Errors include context for debugging
- User sees graceful fallback (e.g., "Unable to load intel posts")

## Future Enhancements

Potential improvements to the validation system:

1. **Coordinate precision validation**: Warn if coordinates have suspicious precision (e.g., 0.0000000)
2. **Geographic bounds checking**: Validate coordinates are within expected regions (e.g., California beaches)
3. **Automatic correction**: Attempt to fix common mistakes (e.g., swapped lat/lon)
4. **Validation metrics**: Track validation failures in analytics
5. **Admin dashboard**: Show beaches with suspicious coordinates

## Related Documentation

- [Local Intel Feature](/docs/features/local-intel.md)
- [Beach Data Architecture](/supabase/ARCHITECTURE.md)
- [Testing Guidelines](/e2e/ARCHITECTURE.md)
- [Error Handling](/docs/error-handling.md)

## Changelog

### 2024-11-17
- Initial implementation of coordinate validation system
- Added 33 comprehensive unit tests
- Integrated validation into useIntelData hook
- Added component-level validation warnings
- Created documentation
