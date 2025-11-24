/**
 * Map Resource Hints Component
 * 
 * Provides DNS prefetch and preconnect hints for map-related services.
 * Should only be used in layouts/pages that render maps.
 * 
 * Services:
 * - Mapbox: Primary mapping service
 * - Google Maps: Geocoding and place data
 * - Geoapify: Alternative geocoding service
 * 
 * Performance Impact:
 * - Speeds up map tile loading by 50-100ms
 * - Should NOT be loaded on routes without maps (wastes connection slots)
 */
export function MapResourceHints() {
  return (
    <>
      <link rel="preconnect" href="https://api.mapbox.com" />
      <link rel="dns-prefetch" href="//maps.googleapis.com" />
      <link rel="dns-prefetch" href="//maps.geoapify.com" />
    </>
  )
}
