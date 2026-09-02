"use client";

import {
  useState,
  useMemo,
  useCallback,
  Suspense,
  Component,
  ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Beach } from "@/types/database";
import type { SurfSpot } from "@/lib/data/surf-spots";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";
import type { IntentForecastSummary } from "@/actions/forecast/intent-forecast-actions";

// Simple Error Boundary for map component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

class MapErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Map component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Dynamic import for InteractiveMap (no SSR for Mapbox)
const InteractiveMap = dynamic(
  () =>
    import("@/components/map/interactive-map").then((mod) => ({
      default: mod.InteractiveMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600 mx-auto" />
          <p className="text-sm text-slate-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";

interface CityMapViewProps {
  spots: SurfSpot[];
  cityName: string;
  citySlug: string;
  stateSlug?: string;
  countrySlug?: string;
  /** Controls what data map markers display: 'wave-height' (default) or 'water-temp' */
  displayMode?: "wave-height" | "water-temp";
  forecastTopPicks?: IntentForecastSummary["topPicks"];
}

/**
 * Transform SurfSpot to Beach-compatible format for the map.
 *
 * Uses createBeachWithDefaults to ensure all required Beach fields are present.
 * Only maps the fields that exist in SurfSpot data.
 */
function transformSpotToBeach(spot: SurfSpot): Beach {
  return createBeachWithDefaults({
    id: spot.id || spot.slug, // Use UUID for forecast lookups, fallback to slug
    name: spot.name,
    lat: spot.coordinates.lat,
    lon: spot.coordinates.lon,
    slug: spot.slug,
    city: spot.region.split(",")[0]?.trim() || null,
    state: "California",
    country: "USA",
    skill_level: spot.skillLevel,
    description: spot.overview,
    crowd_level: spot.crowdFactor,
    // Use fixed date to prevent hydration mismatch
    created_at: "2023-01-01T00:00:00.000Z",
    // Map SurfSpot-specific fields
    access_tips: spot.parking,
    best_conditions_prose: spot.conditions,
    features: spot.amenities,
    hazards: spot.hazards,
    parking_tips: spot.parking,
    region: spot.region,
    wave_tips: spot.swellAdvice,
  });
}

// Beach list item component - uses Link for SEO crawlability
function BeachListItem({
  spot,
  href,
  isSelected,
  isHovered,
  onHover,
  onSelect,
}: {
  spot: SurfSpot;
  href: string;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (spot: SurfSpot | null) => void;
  onSelect: (spot: SurfSpot) => void;
}) {
  // Ink-on-tint pairs that clear 4.5:1 on the paper page (the pastel-100 sets did not).
  const skillLevelStyles = {
    "Beginner friendly": "bg-[#2F6B3A]/10 text-[#25562E]",
    Intermediate: "bg-[#B65F1A]/12 text-[#8F4A13]",
    "Intermediate to expert": "bg-[#8F4A13]/12 text-[#7A3D0F]",
    Advanced: "bg-[#9B2C2C]/10 text-[#8A2626]",
    "Longboard friendly": "bg-[#0B3A75]/10 text-[#0B3A75]",
  };

  return (
    <Link
      href={href}
      className={cn(
        "group block p-4 transition-colors duration-200",
        isSelected && "bg-sky-50 border-l-4 border-sky-500",
        isHovered && !isSelected && "bg-slate-50",
        !isSelected && "border-l-4 border-transparent"
      )}
      onMouseEnter={() => onHover(spot)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(spot)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 truncate">{spot.name}</h3>
          <span
            className={cn(
              "inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1",
              skillLevelStyles[spot.skillLevel] || "bg-slate-100 text-slate-600"
            )}
          >
            {spot.skillLevel}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-slate-600 motion-reduce:transition-none" />
      </div>
      <p className="text-sm text-slate-600 mt-2 line-clamp-2">
        {spot.overview}
      </p>
    </Link>
  );
}

export function CityMapView({
  spots,
  cityName,
  citySlug,
  stateSlug = "ca",
  countrySlug = "usa",
  displayMode,
  forecastTopPicks = [],
}: CityMapViewProps) {
  const [selectedSpot, setSelectedSpot] = useState<SurfSpot | null>(null);
  const [hoveredSpot, setHoveredSpot] = useState<SurfSpot | null>(null);

  // Transform spots to Beach format for the map
  const beaches = useMemo(
    () =>
      spots.map((spot) => ({
        ...transformSpotToBeach(spot),
        city: cityName, // Ensure we have the city name for URL generation
        state: stateSlug.toUpperCase(), // Default to CA if not provided, but used for URL gen
      })),
    [spots, cityName, stateSlug]
  );

  // Generate URL for each spot (memoized for performance).
  // Use each spot's own city (populated from DB) so La Jolla beaches on a San Diego
  // hub page get /ca/la-jolla/<slug> rather than /ca/san-diego/<slug>.
  // Fall back to the page's citySlug only when the spot has no city of its own.
  const spotUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    spots.forEach((spot) => {
      const beachForUrl = {
        slug: spot.slug,
        city: spot.city || citySlug,
        state: stateSlug,
        country: countrySlug,
      };
      urls[spot.slug] = getBeachUrlSafe(beachForUrl) ?? `/beach/${spot.slug}`;
    });
    return urls;
  }, [spots, citySlug, stateSlug, countrySlug]);

  const conditionsRows = useMemo(
    () =>
      forecastTopPicks
        .filter((pick) => pick.slug && pick.name)
        .map((pick) => ({
          ...pick,
          href: spotUrls[pick.slug] ?? `/${stateSlug}/${citySlug}/${pick.slug}`,
        })),
    [forecastTopPicks, spotUrls, stateSlug, citySlug]
  );

  // Calculate map center from spots
  const mapCenter = useMemo((): [number, number] => {
    if (spots.length === 0) return [32.7157, -117.1611]; // San Diego default

    const avgLat =
      spots.reduce((sum, s) => sum + s.coordinates.lat, 0) / spots.length;
    const avgLng =
      spots.reduce((sum, s) => sum + s.coordinates.lon, 0) / spots.length;

    return [avgLat, avgLng];
  }, [spots]);

  // Handle beach click from map
  const handleMapBeachClick = useCallback(
    (beach: Beach) => {
      const spot = spots.find((s) => s.slug === beach.id);
      if (spot) {
        setSelectedSpot(spot);
      }
    },
    [spots]
  );

  // Handle spot selection (for map highlighting, Link handles navigation)
  const handleSpotSelect = useCallback((spot: SurfSpot) => {
    setSelectedSpot(spot);
  }, []);

  // Handle hover from list
  const handleListHover = useCallback((spot: SurfSpot | null) => {
    setHoveredSpot(spot);
  }, []);

  return (
    <div className="space-y-4">
      {conditionsRows.length > 0 && (
        <section
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          aria-label={`${cityName} surf report today`}
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">
              {cityName} surf report today
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table
              className="min-w-full divide-y divide-slate-200 text-sm"
              aria-label={`${cityName} surf conditions`}
            >
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Beach</th>
                  <th scope="col" className="px-4 py-3">Height</th>
                  <th scope="col" className="px-4 py-3">Wind</th>
                  <th scope="col" className="px-4 py-3">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {conditionsRows.map((row) => (
                  <tr key={row.slug}>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-slate-900">
                      <Link href={row.href} className="hover:text-sky-700">
                        {row.name}
                      </Link>
                    </th>
                    <td className="px-4 py-3 text-slate-700">{row.waveHeight}</td>
                    <td className="px-4 py-3 text-slate-700">{row.windDirection}</td>
                    <td className="px-4 py-3 text-slate-700">{row.score}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-[380px_1fr] gap-0 rounded-xl overflow-hidden border border-slate-200 shadow-lg">
        {/* Mobile: Map first, then horizontal beach scroll */}
        {/* Desktop: Beach list on left, map on right */}

        {/* Desktop Beach List (hidden on mobile) */}
        <div className="hidden lg:block overflow-y-auto bg-white border-r border-slate-200 h-[600px]">
          <div className="p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-sky-600" />
              <div>
                <h2 className="font-semibold text-slate-900">Featured Beaches</h2>
                <p className="text-xs text-slate-500">{spots.length} spots</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {spots.map((spot) => (
              <BeachListItem
                key={spot.slug}
                spot={spot}
                href={spotUrls[spot.slug]}
                isSelected={selectedSpot?.slug === spot.slug}
                isHovered={hoveredSpot?.slug === spot.slug}
                onHover={handleListHover}
                onSelect={handleSpotSelect}
              />
            ))}
          </div>
        </div>

        {/* Interactive Map */}
        <div className="relative bg-slate-100 h-[350px] lg:h-[600px]">
          <MapErrorBoundary
            fallback={
              <div className="flex h-full items-center justify-center bg-slate-100">
                <div className="text-center p-8">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <p className="text-slate-700 font-medium">
                    Map temporarily unavailable
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Browse the beach list to explore spots
                  </p>
                </div>
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600 mx-auto" />
                    <p className="text-sm text-slate-500">Loading map...</p>
                  </div>
                </div>
              }
            >
              <InteractiveMap
                initialCenter={mapCenter}
                initialZoom={10}
                beaches={beaches}
                disableBeachClustering
                onLocationClick={handleMapBeachClick}
                className="h-full w-full"
                displayMode={displayMode}
              />
            </Suspense>
          </MapErrorBoundary>
        </div>

        {/* Mobile Beach Scroll (visible only on mobile) */}
        <div className="lg:hidden bg-white">
          <div className="p-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-sky-600" />
              <span className="font-medium text-sm text-slate-900">
                Featured Beaches
              </span>
              <span className="text-xs text-slate-500">({spots.length})</span>
            </div>
          </div>
          <div className="flex overflow-x-auto gap-3 p-3 snap-x snap-mandatory scrollbar-hide">
            {spots.map((spot) => (
              <Link
                key={spot.slug}
                href={spotUrls[spot.slug]}
                className={cn(
                  "flex-none w-[280px] p-4 rounded-lg border snap-start transition-colors",
                  selectedSpot?.slug === spot.slug
                    ? "border-sky-500 bg-sky-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
                onClick={() => handleSpotSelect(spot)}
              >
                <h3 className="font-semibold text-slate-900 truncate">
                  {spot.name}
                </h3>
                <span
                  className={cn(
                    "inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1",
                    spot.skillLevel === "Beginner friendly" &&
                      "bg-green-100 text-green-700",
                    spot.skillLevel === "Intermediate" &&
                      "bg-amber-100 text-amber-700",
                    spot.skillLevel === "Intermediate to expert" &&
                      "bg-orange-100 text-orange-700",
                    spot.skillLevel === "Advanced" && "bg-red-100 text-red-700",
                    ![
                      "Beginner friendly",
                      "Intermediate",
                      "Intermediate to expert",
                      "Advanced",
                    ].includes(spot.skillLevel) && "bg-slate-100 text-slate-600"
                  )}
                >
                  {spot.skillLevel}
                </span>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                  {spot.overview}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
