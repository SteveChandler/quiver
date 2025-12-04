/**
 * City Editorial Content Test Fixtures
 *
 * Mock data for testing city editorial actions and components.
 * Follows CityEditorialContent interface from actions/city/city-editorial-actions.ts
 */

import type {
  CityEditorialContent,
  SessionTimingModule,
  QuickLink,
} from "@/actions/city/city-editorial-actions";

/**
 * Complete San Diego editorial content
 */
export const mockSanDiegoEditorial: CityEditorialContent = {
  id: "editorial-san-diego-001",
  city_slug: "san-diego",
  state_slug: "ca",
  country_slug: "usa",
  city_name: "San Diego",
  region_label: "San Diego County, California",
  description: [
    "San Diego is a premier surf destination with over 70 miles of coastline.",
    "From beginner-friendly beach breaks to world-class reef breaks, there's something for every skill level.",
    "The consistent year-round swell and mild climate make it an ideal place to surf.",
  ],
  session_timing: [
    {
      icon: "sun",
      title: "Today",
      summary: "Morning glass with light offshore winds before 9am.",
    },
    {
      icon: "clock",
      title: "Now",
      summary: "2-3ft with moderate onshore winds. Good for longboards.",
    },
    {
      icon: "calendar",
      title: "Weekend",
      summary: "New south swell building Saturday. Head to beach breaks.",
    },
  ],
  quick_links: [
    { label: "Beginner spots", href: "/beginner/san-diego" },
    { label: "Tide charts", href: "/tide/san-diego" },
    { label: "Water temp", href: "/water-temp/san-diego" },
    { label: "Least crowded", href: "/least-crowded/san-diego" },
  ],
  featured_intents: ["beginner", "tide", "water-temp", "least-crowded"],
  planning_checklist: [
    "Check tide times before heading out",
    "Bring a wetsuit - water temp averages 60-70F",
    "Arrive early for parking at popular spots",
    "Respect local surf etiquette",
  ],
  created_at: "2024-12-01T00:00:00.000Z",
  updated_at: "2024-12-03T12:00:00.000Z",
};

/**
 * Orange County editorial content
 */
export const mockOrangeCountyEditorial: CityEditorialContent = {
  id: "editorial-orange-county-001",
  city_slug: "orange-county",
  state_slug: "ca",
  country_slug: "usa",
  city_name: "Orange County",
  region_label: "Orange County, California",
  description: [
    "Orange County is home to iconic surf spots like Huntington Beach, the Wedge, and Trestles.",
    "The coastline offers diverse conditions from beach breaks to world-class point breaks.",
  ],
  session_timing: [
    {
      icon: "sun",
      title: "Today",
      summary: "South swell pushing through, best at Huntington pier.",
    },
    {
      icon: "clock",
      title: "Now",
      summary: "3-4ft and glassy. Perfect conditions at Trestles.",
    },
    {
      icon: "calendar",
      title: "Weekend",
      summary: "Wind swell arriving Friday. Beach breaks will be fun.",
    },
  ],
  quick_links: [
    { label: "Surf spots", href: "/beaches/usa/ca/orange-county" },
    { label: "Tide info", href: "/tide/orange-county" },
  ],
  featured_intents: ["tide", "water-temp"],
  planning_checklist: [
    "Check swell direction - south swells light up different spots",
    "Parking at Trestles requires a walk from the lot",
  ],
  created_at: "2024-12-01T00:00:00.000Z",
  updated_at: "2024-12-02T10:00:00.000Z",
};

/**
 * Minimal editorial content (edge case)
 */
export const mockMinimalEditorial: CityEditorialContent = {
  id: "editorial-minimal-001",
  city_slug: "minimal-city",
  state_slug: "ca",
  country_slug: "usa",
  city_name: "Minimal City",
  region_label: "California",
  description: [],
  session_timing: [],
  quick_links: [],
  featured_intents: [],
  planning_checklist: [],
  created_at: "2024-12-01T00:00:00.000Z",
  updated_at: "2024-12-01T00:00:00.000Z",
};

/**
 * Session timing modules for component testing
 */
export const mockSessionTimingModules: SessionTimingModule[] = [
  {
    icon: "sun",
    title: "Today",
    summary: "Morning glass with light offshore winds.",
  },
  {
    icon: "clock",
    title: "Now",
    summary: "2-3ft with moderate conditions.",
  },
  {
    icon: "calendar",
    title: "Weekend",
    summary: "New swell building Saturday.",
  },
];

/**
 * Quick links for component testing
 */
export const mockQuickLinks: QuickLink[] = [
  { label: "Beginner spots", href: "/beginner/san-diego" },
  { label: "Tide charts", href: "/tide/san-diego" },
  { label: "Water temp", href: "/water-temp/san-diego" },
  { label: "Least crowded", href: "/least-crowded/san-diego" },
];

/**
 * Editorial content with string-encoded JSONB fields
 * (simulates what might come from some database responses)
 */
export const mockEditorialWithStringJsonb = {
  ...mockSanDiegoEditorial,
  session_timing: JSON.stringify(mockSanDiegoEditorial.session_timing),
  quick_links: JSON.stringify(mockSanDiegoEditorial.quick_links),
};

/**
 * Supabase RPC response mock - success
 */
export const mockRpcSuccessResponse = {
  data: mockSanDiegoEditorial,
  error: null,
};

/**
 * Supabase RPC response mock - not found
 */
export const mockRpcNotFoundResponse = {
  data: null,
  error: null,
};

/**
 * Supabase RPC response mock - error
 */
export const mockRpcErrorResponse = {
  data: null,
  error: {
    code: "PGRST116",
    message: "Database error",
    details: "Connection failed",
    hint: null,
  },
};

/**
 * Supabase table query response mock - exists
 */
export const mockTableExistsResponse = {
  data: { id: "editorial-san-diego-001" },
  error: null,
};

/**
 * Supabase table query response mock - not exists
 */
export const mockTableNotExistsResponse = {
  data: null,
  error: null,
};
