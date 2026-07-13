/**
 * Type definitions for editorial content tables
 *
 * Migration: 20260205000000_add_editorial_content_for_city_hub.sql
 * Documentation: /docs/DATABASE_EDITORIAL_CONTENT.md
 */

// ================================================
// City Editorial Content
// ================================================

export type CityEditorialIntent =
  | 'beginner'
  | 'tide'
  | 'water-temp'
  | 'general'
  | 'least-crowded'
  | 'longboard'
  | 'dawn-patrol'
  | 'sunset'
  | 'best-time'
  | null;

export interface EditorialSource {
  url: string;
  publisher: string;
  retrievedAt: string;
}

export interface SessionTimingModule {
  icon: string; // Icon name (e.g., "sun", "clock", "calendar")
  title: string; // Module title (e.g., "Today", "Now", "Weekend")
  summary: string; // Short tactical advice
}

export interface QuickLink {
  label: string; // Link text
  href: string; // URL
  icon?: string; // Optional icon name
}

export interface CityEditorialContent {
  id: string; // UUID
  city_slug: string;
  state_slug: string;
  country_slug: string;
  city_name: string;
  region_label: string; // e.g., "San Diego County, California"
  intent?: CityEditorialIntent;
  seo_indexable?: boolean | null;
  editorial_reviewed_at?: string | null;
  editorial_sources?: EditorialSource[];
  seo_intro?: string | null;
  seo_local_guidance?: string | null;
  description: string[]; // Array of paragraphs
  session_timing: SessionTimingModule[]; // Today/Now/Weekend modules
  quick_links: QuickLink[]; // Navigation links
  featured_intents: string[]; // Intent slugs like ["beginner", "tide"]
  planning_checklist: string[]; // Checklist items
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// ================================================
// Beach Editorial Content
// ================================================

export type BeachEditorialContentType =
  | 'beginner_notes'
  | 'tide_notes'
  | 'safety_notes'
  | 'advanced_notes'
  | 'crowd_notes';

/**
 * Base structure for all beach editorial content
 * Individual content types can extend this with additional fields
 */
export interface BaseBeachEditorialContent {
  description?: string; // Main descriptive paragraph
  metadata?: Record<string, unknown>; // Optional extensible metadata
}

/**
 * Beginner notes content structure
 * Used for beginner_notes content_type
 */
export interface BeginnerNotesContent extends BaseBeachEditorialContent {
  why_beginners_love_it: string[]; // Array of reasons
  logistics: {
    parking: string; // Parking info and cost
    walk_distance: string; // Distance from parking to beach
    lifeguards: boolean; // Lifeguard presence
    best_hours: string; // Best time to surf
    facilities: string; // Available facilities (restrooms, showers, etc.)
  };
  description: string; // Detailed paragraph about the beach
  what_to_expect: {
    wave_size: string; // Typical wave size range
    wave_type: string; // Wave characteristics
    bottom: string; // Sand, reef, rock, etc.
    hazards: string[]; // Known hazards
    water_temp: string; // Seasonal water temperature range
    skill_level: string; // Skill level description
  };
  seasonal_guide: {
    summer: string; // Summer conditions
    fall: string; // Fall conditions
    winter: string; // Winter conditions
    spring: string; // Spring conditions
  };
  important_note?: string; // Optional special warnings or notes
}

/**
 * Tide notes content structure
 * Used for tide_notes content_type
 */
export interface TideNotesContent extends BaseBeachEditorialContent {
  best_tides: string[]; // e.g., ["Low tide", "Incoming mid-tide"]
  tide_timing: {
    low_tide: string; // Conditions at low tide
    mid_tide: string; // Conditions at mid tide
    high_tide: string; // Conditions at high tide
  };
  tide_tips: string[]; // Tactical advice for different tides
  description: string; // Detailed explanation of tide impact
}

/**
 * Safety notes content structure
 * Used for safety_notes content_type
 */
export interface SafetyNotesContent extends BaseBeachEditorialContent {
  hazards: string[]; // List of hazards
  rip_currents: {
    frequency: string; // How common are rip currents
    location: string; // Where they typically occur
    how_to_spot: string; // How to identify them
    what_to_do: string; // What to do if caught
  };
  emergency_contacts: {
    lifeguard: string;
    coastguard: string;
    local_police: string;
  };
  local_rules: string[]; // Local regulations and etiquette
  description: string; // Overall safety overview
}

/**
 * Advanced notes content structure
 * Used for advanced_notes content_type
 */
export interface AdvancedNotesContent extends BaseBeachEditorialContent {
  advanced_features: string[]; // What makes this spot challenging/interesting
  technique_tips: string[]; // Performance tips
  equipment_recommendations: {
    board_type: string;
    board_size: string;
    wetsuit: string;
  };
  local_secrets: string[]; // Advanced knowledge about the spot
  description: string; // Overview for advanced surfers
}

/**
 * Crowd notes content structure
 * Used for crowd_notes content_type
 */
export interface CrowdNotesContent extends BaseBeachEditorialContent {
  crowd_patterns: {
    weekday: string; // Weekday crowd levels
    weekend: string; // Weekend crowd levels
    peak_hours: string; // When it's most crowded
    off_hours: string; // When it's least crowded
  };
  best_times_to_avoid_crowds: string[];
  local_etiquette: string[]; // How to navigate the lineup
  alternative_spots: string[]; // Less crowded alternatives nearby
  description: string; // Overview of crowd dynamics
}

/**
 * Union type of all possible content structures
 */
export type BeachEditorialContentData =
  | BeginnerNotesContent
  | TideNotesContent
  | SafetyNotesContent
  | AdvancedNotesContent
  | CrowdNotesContent;

/**
 * Beach editorial content row from database
 */
export interface BeachEditorialContent<T extends BeachEditorialContentData = BeachEditorialContentData> {
  id: string; // UUID
  beach_id: string; // UUID reference to beaches.id
  content_type: BeachEditorialContentType;
  content: T; // JSONB content with specific structure
  generated_at: string; // ISO timestamp - when AI generated this
  updated_at: string; // ISO timestamp - last update
  created_at: string; // ISO timestamp - first creation
}

// ================================================
// Typed Accessor Utilities
// ================================================

/**
 * Type guard to check if content is beginner notes
 */
export function isBeginnerNotesContent(
  content: BeachEditorialContentData
): content is BeginnerNotesContent {
  return 'why_beginners_love_it' in content && 'logistics' in content;
}

/**
 * Type guard to check if content is tide notes
 */
export function isTideNotesContent(
  content: BeachEditorialContentData
): content is TideNotesContent {
  return 'best_tides' in content && 'tide_timing' in content;
}

/**
 * Type guard to check if content is safety notes
 */
export function isSafetyNotesContent(
  content: BeachEditorialContentData
): content is SafetyNotesContent {
  return 'hazards' in content && 'rip_currents' in content;
}

/**
 * Type guard to check if content is advanced notes
 */
export function isAdvancedNotesContent(
  content: BeachEditorialContentData
): content is AdvancedNotesContent {
  return 'advanced_features' in content && 'technique_tips' in content;
}

/**
 * Type guard to check if content is crowd notes
 */
export function isCrowdNotesContent(
  content: BeachEditorialContentData
): content is CrowdNotesContent {
  return 'crowd_patterns' in content && 'best_times_to_avoid_crowds' in content;
}

// ================================================
// Query Result Types
// ================================================

/**
 * Beach with beginner notes (for beach detail pages)
 */
export interface BeachWithBeginnerNotes {
  id: string;
  name: string;
  slug: string;
  location: string;
  latitude: number;
  longitude: number;
  skill_level: string;
  beginner_notes?: BeachEditorialContent<BeginnerNotesContent>[];
}

/**
 * City with editorial content (for city hub pages)
 */
export interface CityWithEditorial {
  city_slug: string;
  state_slug: string;
  country_slug: string;
  city_name: string;
  general_editorial?: CityEditorialContent; // intent = null
  beginner_editorial?: CityEditorialContent; // intent = 'beginner'
  tide_editorial?: CityEditorialContent; // intent = 'tide'
  water_temp_editorial?: CityEditorialContent; // intent = 'water-temp'
  least_crowded_editorial?: CityEditorialContent; // intent = 'least-crowded'
}

// ================================================
// Form/Input Types (for admin interfaces)
// ================================================

/**
 * Input type for creating/updating city editorial
 */
export interface CityEditorialInput {
  city_slug: string;
  state_slug: string;
  country_slug: string;
  city_name: string;
  region_label: string;
  intent: CityEditorialIntent;
  description: string[];
  session_timing: SessionTimingModule[];
  quick_links: QuickLink[];
  featured_intents: string[];
  planning_checklist: string[];
}

/**
 * Input type for creating/updating beach editorial
 */
export interface BeachEditorialInput<T extends BeachEditorialContentData = BeachEditorialContentData> {
  beach_id: string;
  content_type: BeachEditorialContentType;
  content: T;
}

// ================================================
// Validation Helpers
// ================================================

/**
 * Validate that beginner notes content has all required fields
 */
export function validateBeginnerNotesContent(content: any): content is BeginnerNotesContent {
  return (
    Array.isArray(content.why_beginners_love_it) &&
    typeof content.logistics === 'object' &&
    typeof content.logistics.parking === 'string' &&
    typeof content.logistics.lifeguards === 'boolean' &&
    typeof content.description === 'string' &&
    typeof content.what_to_expect === 'object' &&
    typeof content.seasonal_guide === 'object'
  );
}

/**
 * Validate city editorial intent value
 */
export function isValidCityEditorialIntent(intent: any): intent is CityEditorialIntent {
  return (
    intent === null ||
    intent === 'beginner' ||
    intent === 'tide' ||
    intent === 'water-temp' ||
    intent === 'general' ||
    intent === 'least-crowded'
  );
}

/**
 * Validate beach editorial content type
 */
export function isValidBeachEditorialContentType(type: any): type is BeachEditorialContentType {
  return (
    type === 'beginner_notes' ||
    type === 'tide_notes' ||
    type === 'safety_notes' ||
    type === 'advanced_notes' ||
    type === 'crowd_notes'
  );
}
