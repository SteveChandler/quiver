/**
 * Example: API Endpoint with Branded Coordinates
 *
 * This demonstrates how to use branded coordinates in a real API endpoint
 * to prevent coordinate swap bugs at compile time.
 *
 * BEFORE: app/api/beaches/nearby/route.ts (simplified)
 * AFTER: This file shows the branded coordinate version
 *
 * @see /docs/BRANDED_COORDINATES.md for full migration guide
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from '@/lib/api-utils';
import { withRateLimit } from '@/lib/middleware/api-wrappers';
import {
  validateAndBrandCoordinates,
  calculateBrandedDistance,
  type BrandedCoordinates,
} from '@/lib/utils/branded-coordinate-utils';

/**
 * EXAMPLE 1: Enhanced nearby beaches endpoint with branded coordinates
 *
 * Benefits:
 * 1. Compile-time prevention of coordinate swaps
 * 2. Validation happens once at the boundary
 * 3. Type-safe throughout the request lifecycle
 * 4. Better error messages for invalid coordinates
 */
async function nearbyBeachesHandlerBranded(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const latParam = searchParams.get('latitude');
  const lonParam = searchParams.get('longitude');
  const maxDistance = parseFloat(searchParams.get('maxDistance') || '30');
  const limit = parseInt(searchParams.get('limit') || '20');

  // Validate latitude and longitude are provided
  if (!latParam || !lonParam) {
    return createValidationError('Latitude and longitude are required');
  }

  // Parse to numbers
  const lat = parseFloat(latParam);
  const lon = parseFloat(lonParam);

  // ========================================================================
  // BRANDED COORDINATES: Validate and brand at the API boundary
  // ========================================================================
  const validationResult = validateAndBrandCoordinates({ lat, lon });

  if (!validationResult.valid) {
    // Return detailed error message from validation
    return createValidationError(validationResult.error);
  }

  // Now we have branded coordinates - compile-time safe from swaps!
  const userLocation: BrandedCoordinates = validationResult.coordinates;

  try {
    const supabase = await createSupabaseServerClient();

    // Fetch all beaches (in production, you might use PostGIS query for better performance)
    const { data: allBeaches, error: fetchError } = await supabase
      .from('beaches')
      .select('id, name, center_lat, center_lon');

    if (fetchError) throw fetchError;

    // ========================================================================
    // BRANDED COORDINATES: Use typed distance calculation
    // ========================================================================
    const nearbyBeaches = (allBeaches || [])
      .map((beach) => {
        // Validate and brand each beach's coordinates
        const beachCoords = validateAndBrandCoordinates({
          lat: beach.center_lat,
          lon: beach.center_lon,
        });

        if (!beachCoords.valid) {
          // Skip beaches with invalid coordinates
          console.warn(
            `Beach ${beach.id} has invalid coordinates:`,
            beachCoords.error
          );
          return null;
        }

        // ====================================================================
        // COMPILE-TIME SAFETY: Can't accidentally swap coordinates here!
        // ====================================================================
        // If we tried: calculateBrandedDistance(beachCoords.coordinates, userLocation)
        // TypeScript would catch the swap because both parameters are the same type
        const distance = calculateBrandedDistance(
          userLocation, // Type: BrandedCoordinates
          beachCoords.coordinates, // Type: BrandedCoordinates
          'miles'
        );

        return {
          id: beach.id,
          name: beach.name,
          lat: beach.center_lat,
          lon: beach.center_lon,
          distance,
        };
      })
      .filter((beach): beach is NonNullable<typeof beach> => beach !== null)
      .filter((beach) => isFinite(beach.distance) && beach.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map((beach) => ({
        id: beach.id,
        name: beach.name,
        lat: beach.lat,
        lon: beach.lon,
        distance: beach.distance,
      }));

    return createSuccessResponse(nearbyBeaches);
  } catch (error) {
    console.error('Error fetching nearby beaches:', error);
    return handleApiError(error, 'Error fetching nearby beaches');
  }
}

// Apply rate limiting
export const GET_BRANDED = withRateLimit(
  nearbyBeachesHandlerBranded,
  'public-default'
);

// ============================================================================
// EXAMPLE 2: Alternative approach with helper function
// ============================================================================

/**
 * Helper function to filter beaches by distance
 * Uses branded coordinates for type safety
 */
async function fetchNearbyBeaches(
  userLocation: BrandedCoordinates,
  maxDistance: number,
  limit: number
): Promise<
  Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    distance: number;
  }>
> {
  const supabase = await createSupabaseServerClient();

  const { data: allBeaches, error } = await supabase
    .from('beaches')
    .select('id, name, center_lat, center_lon');

  if (error) throw error;

  return (allBeaches || [])
    .map((beach) => {
      const beachCoords = validateAndBrandCoordinates({
        lat: beach.center_lat,
        lon: beach.center_lon,
      });

      if (!beachCoords.valid) return null;

      const distance = calculateBrandedDistance(
        userLocation,
        beachCoords.coordinates,
        'miles'
      );

      return {
        id: beach.id,
        name: beach.name,
        lat: beach.center_lat,
        lon: beach.center_lon,
        distance,
      };
    })
    .filter((beach): beach is NonNullable<typeof beach> => beach !== null)
    .filter((beach) => isFinite(beach.distance) && beach.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Simplified handler using the helper function
 */
async function nearbyBeachesHandlerSimplified(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const latParam = searchParams.get('latitude');
  const lonParam = searchParams.get('longitude');
  const maxDistance = parseFloat(searchParams.get('maxDistance') || '30');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!latParam || !lonParam) {
    return createValidationError('Latitude and longitude are required');
  }

  // Validate and brand at the boundary
  const validationResult = validateAndBrandCoordinates({
    lat: parseFloat(latParam),
    lon: parseFloat(lonParam),
  });

  if (!validationResult.valid) {
    return createValidationError(validationResult.error);
  }

  try {
    // Pass branded coordinates to helper
    const beaches = await fetchNearbyBeaches(
      validationResult.coordinates,
      maxDistance,
      limit
    );

    return createSuccessResponse(beaches);
  } catch (error) {
    console.error('Error fetching nearby beaches:', error);
    return handleApiError(error, 'Error fetching nearby beaches');
  }
}

// ============================================================================
// EXAMPLE 3: POST endpoint with request body
// ============================================================================

/**
 * POST endpoint that accepts coordinates in request body
 * Shows how to validate JSON body with branded coordinates
 */
async function nearbyBeachesPostHandler(request: NextRequest) {
  try {
    const body = await request.json();

    // ========================================================================
    // BRANDED COORDINATES: Validate request body
    // ========================================================================
    const validationResult = validateAndBrandCoordinates(body);

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    const userLocation = validationResult.coordinates;

    // Extract optional parameters with defaults
    const maxDistance = body.maxDistance || 30;
    const limit = body.limit || 20;

    // Use the branded coordinates
    const beaches = await fetchNearbyBeaches(userLocation, maxDistance, limit);

    return NextResponse.json(beaches);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    console.error('Error fetching nearby beaches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST_BRANDED = withRateLimit(
  nearbyBeachesPostHandler,
  'public-default'
);

// ============================================================================
// COMPARISON: What Could Go Wrong Without Branded Types
// ============================================================================

/**
 * ❌ DANGEROUS: Without branded types, this compiles but is WRONG
 */
function calculateDistanceUnsafe(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // ... implementation
  return 0;
}

// This compiles but is WRONG - coordinates are swapped!
// const distance = calculateDistanceUnsafe(
//   userLongitude,  // ❌ Swapped!
//   userLatitude,   // ❌ Swapped!
//   beachLatitude,
//   beachLongitude
// );

/**
 * ✅ SAFE: With branded types, swap is caught at compile time
 */
function calculateDistanceSafe(
  from: BrandedCoordinates,
  to: BrandedCoordinates
): number {
  // ... implementation
  return 0;
}

// This won't compile - TypeScript catches the error!
// const userCoords: BrandedCoordinates = {
//   lat: longitude(-117.25),  // ❌ TypeScript error!
//   lon: latitude(32.75),     // ❌ TypeScript error!
// };

// ============================================================================
// TESTING EXAMPLE
// ============================================================================

/**
 * Example test showing type safety in action
 */
describe('Branded Coordinates in API', () => {
  it('should prevent coordinate swaps at compile time', () => {
    const validCoords = validateAndBrandCoordinates({
      lat: 32.75,
      lon: -117.25,
    });

    expect(validCoords.valid).toBe(true);

    if (validCoords.valid) {
      // This is type-safe - can't accidentally swap
      const coords = validCoords.coordinates;
      expect(coords.lat).toBe(32.75);
      expect(coords.lon).toBe(-117.25);

      // The following would be compile errors:
      // const swapped: BrandedCoordinates = {
      //   lat: coords.lon,  // ❌ Error
      //   lon: coords.lat,  // ❌ Error
      // };
    }
  });

  it('should return detailed validation errors', () => {
    const invalidLat = validateAndBrandCoordinates({
      lat: 91, // Out of range
      lon: -117.25,
    });

    expect(invalidLat.valid).toBe(false);
    if (!invalidLat.valid) {
      expect(invalidLat.error).toMatch(/latitude.*out of range/i);
    }
  });
});

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/**
 * When migrating an API endpoint to branded coordinates:
 *
 * ✅ 1. Add validation at the boundary (query params or body)
 * ✅ 2. Use validateAndBrandCoordinates() for type-safe validation
 * ✅ 3. Return detailed error messages from validation
 * ✅ 4. Use branded coordinate types in helper functions
 * ✅ 5. Use calculateBrandedDistance() for distance calculations
 * ✅ 6. Add tests to verify validation and type safety
 * ✅ 7. Update API documentation to reflect validation rules
 *
 * Benefits:
 * ✅ Compile-time prevention of coordinate swaps
 * ✅ Runtime validation at API boundary
 * ✅ Better error messages for clients
 * ✅ Type safety throughout request lifecycle
 * ✅ Self-documenting code via types
 */
