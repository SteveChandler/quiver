/**
 * Amenities Type Definitions
 *
 * Types for beach amenity data sourced from California Coastal Commission (CCC)
 * access location records. Mirrors the planned `mv_beach_amenities` materialized
 * view columns and provides display metadata for rendering amenity badges.
 *
 * Data pipeline: ccc_access_locations → mv_beach_amenities → BeachAmenities
 *
 * @module types/amenities
 */

// ================================================
// Core Amenities Interface
// ================================================

/**
 * Aggregated amenity flags for a beach, matching the `mv_beach_amenities`
 * materialized view schema.
 *
 * All `has_*` fields are derived from nearby CCC access location records.
 * A beach is considered to have an amenity if at least one source record
 * within range reports it.
 *
 * @example
 * const amenities: BeachAmenities = {
 *   beach_id: "abc-123",
 *   has_parking: true,
 *   has_restrooms: true,
 *   has_ada_access: false,
 *   // ...
 *   source_count: 3,
 *   nearest_source_m: 42.5,
 * };
 */
export interface BeachAmenities {
  beach_id: string;
  // Access
  has_parking: boolean;
  has_fee: boolean;
  has_restrooms: boolean;
  has_ada_access: boolean;
  has_dog_friendly: boolean;
  has_stroller_friendly: boolean;
  // Facilities
  has_campground: boolean;
  has_visitor_center: boolean;
  // Recreation
  has_boating: boolean;
  has_fishing: boolean;
  has_picnic_area: boolean;
  has_volleyball: boolean;
  has_bike_path: boolean;
  // Terrain
  has_tidepools: boolean;
  has_sandy_beach: boolean;
  has_rocky_shore: boolean;
  has_bluff_trail: boolean;
  has_wildlife_viewing: boolean;
  // Source metadata
  /** Number of CCC access location records that contributed to these flags */
  source_count: number;
  /** Distance in meters to the nearest contributing CCC access location */
  nearest_source_m: number;
}

// ================================================
// Display Types
// ================================================

/**
 * Visual category grouping for amenity display
 *
 * Used to render amenity badges in grouped sections on beach detail pages.
 */
export type AmenityCategory = "access" | "facilities" | "recreation" | "terrain";

/**
 * Display metadata for a single amenity flag
 *
 * Maps a `has_*` field to the label and icon shown in the UI.
 * The `icon` value is a Lucide icon component name.
 *
 * @example
 * const info: AmenityDisplayInfo = {
 *   label: "Parking",
 *   icon: "Car",
 *   category: "access",
 * };
 */
export interface AmenityDisplayInfo {
  /** Human-readable label shown in the badge */
  label: string;
  /** Lucide icon component name (e.g., "Car", "Bath") */
  icon: string;
  /** Visual grouping category */
  category: AmenityCategory;
}

// ================================================
// Amenity Display Map
// ================================================

/**
 * Union of all boolean amenity keys on BeachAmenities
 */
export type AmenityKey = keyof Pick<
  BeachAmenities,
  | "has_parking"
  | "has_fee"
  | "has_restrooms"
  | "has_ada_access"
  | "has_dog_friendly"
  | "has_stroller_friendly"
  | "has_campground"
  | "has_visitor_center"
  | "has_boating"
  | "has_fishing"
  | "has_picnic_area"
  | "has_volleyball"
  | "has_bike_path"
  | "has_tidepools"
  | "has_sandy_beach"
  | "has_rocky_shore"
  | "has_bluff_trail"
  | "has_wildlife_viewing"
>;

/**
 * Mapping from each `has_*` amenity key to its display metadata.
 *
 * Icon names reference Lucide React components. Import and render like:
 * ```tsx
 * import { Car } from "lucide-react";
 * const Icon = Icons[info.icon]; // dynamic lookup via lucide-react/dynamic if needed
 * ```
 *
 * Categories:
 * - access: Getting there and basic logistics
 * - facilities: On-site built infrastructure
 * - recreation: Activities available at the beach
 * - terrain: Natural features of the beach environment
 */
export const AMENITY_DISPLAY_MAP: Record<AmenityKey, AmenityDisplayInfo> = {
  // Access
  has_parking: { label: "Parking", icon: "Car", category: "access" },
  has_fee: { label: "Entry Fee", icon: "DollarSign", category: "access" },
  has_ada_access: { label: "ADA Accessible", icon: "Accessibility", category: "access" },
  has_stroller_friendly: { label: "Stroller Friendly", icon: "Baby", category: "access" },
  // Facilities
  has_restrooms: { label: "Restrooms", icon: "Bath", category: "facilities" },
  has_visitor_center: { label: "Visitor Center", icon: "Info", category: "facilities" },
  has_campground: { label: "Campground", icon: "Tent", category: "facilities" },
  // Recreation
  has_dog_friendly: { label: "Dog Friendly", icon: "Dog", category: "recreation" },
  has_boating: { label: "Boating", icon: "Ship", category: "recreation" },
  has_fishing: { label: "Fishing", icon: "Fish", category: "recreation" },
  has_picnic_area: { label: "Picnic Area", icon: "UtensilsCrossed", category: "recreation" },
  has_volleyball: { label: "Volleyball", icon: "CircleDot", category: "recreation" },
  has_bike_path: { label: "Bike Path", icon: "Bike", category: "recreation" },
  // Terrain
  has_tidepools: { label: "Tidepools", icon: "Droplets", category: "terrain" },
  has_sandy_beach: { label: "Sandy Beach", icon: "Sun", category: "terrain" },
  has_rocky_shore: { label: "Rocky Shore", icon: "Mountain", category: "terrain" },
  has_bluff_trail: { label: "Bluff Trail", icon: "TreePine", category: "terrain" },
  has_wildlife_viewing: { label: "Wildlife Viewing", icon: "Bird", category: "terrain" },
};

// ================================================
// Iteration Helpers
// ================================================

/**
 * Ordered list of all `has_*` amenity keys.
 *
 * Use this for iterating over amenities in a consistent order, e.g., when
 * rendering badge lists or building filter UIs.
 *
 * ```tsx
 * const activeAmenities = CCC_AMENITY_KEYS.filter(key => amenities[key]);
 * ```
 */
export const CCC_AMENITY_KEYS = [
  "has_parking",
  "has_fee",
  "has_ada_access",
  "has_stroller_friendly",
  "has_restrooms",
  "has_visitor_center",
  "has_campground",
  "has_dog_friendly",
  "has_boating",
  "has_fishing",
  "has_picnic_area",
  "has_volleyball",
  "has_bike_path",
  "has_tidepools",
  "has_sandy_beach",
  "has_rocky_shore",
  "has_bluff_trail",
  "has_wildlife_viewing",
] as const satisfies readonly AmenityKey[];

// ================================================
// Raw CCC Access Locations Table
// ================================================

/**
 * Raw row from the `ccc_access_locations` table.
 *
 * These records are ingested from the California Coastal Commission public
 * access dataset and represent individual access points near beaches.
 * The `mv_beach_amenities` view aggregates multiple rows per beach.
 *
 * @see https://www.coastal.ca.gov/publiced/map/map.html (CCC public access map)
 */
export interface CCCAccessLocation {
  /** UUID primary key */
  id: string;
  /** CCC's own identifier for the access point */
  ccc_id: string | null;
  /** Display name of the access location */
  name: string | null;
  /** WGS84 latitude of the access point */
  latitude: number;
  /** WGS84 longitude of the access point */
  longitude: number;
  /** Raw amenity flags from CCC source data */
  has_parking: boolean;
  has_fee: boolean;
  has_restrooms: boolean;
  has_ada_access: boolean;
  has_dog_friendly: boolean;
  has_stroller_friendly: boolean;
  has_campground: boolean;
  has_boating: boolean;
  has_fishing: boolean;
  has_picnic_area: boolean;
  has_volleyball: boolean;
  has_bike_path: boolean;
  has_tidepools: boolean;
  has_sandy_beach: boolean;
  has_rocky_shore: boolean;
  has_bluff_trail: boolean;
  has_wildlife_viewing: boolean;
  has_visitor_center: boolean;
  /** Raw JSON blob from CCC API response, stored for auditability */
  raw_data: Record<string, unknown> | null;
  /** Timestamp when this record was last synced from CCC */
  synced_at: string;
  /** Row creation timestamp */
  created_at: string;
}
