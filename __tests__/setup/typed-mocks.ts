/**
 * Type-Safe Mock Utilities for Quiver Tests
 *
 * This file provides strongly-typed mock factories that align with
 * the actual database types from database.generated.ts.
 */

import type { Database } from "@/types/database.generated";
import type {
  Beach,
  Profile,
  Session,
  IntelPost,
  BeachReview,
  Forecast,
} from "@/types/database";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

/** Generic query chain result */
export interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/** Query chain with chainable methods */
export interface MockQueryChain<T> {
  select: jest.Mock<MockQueryChain<T>>;
  insert: jest.Mock<MockQueryChain<T>>;
  update: jest.Mock<MockQueryChain<T>>;
  delete: jest.Mock<MockQueryChain<T>>;
  upsert: jest.Mock<MockQueryChain<T>>;
  eq: jest.Mock<MockQueryChain<T>>;
  neq: jest.Mock<MockQueryChain<T>>;
  gt: jest.Mock<MockQueryChain<T>>;
  gte: jest.Mock<MockQueryChain<T>>;
  lt: jest.Mock<MockQueryChain<T>>;
  lte: jest.Mock<MockQueryChain<T>>;
  like: jest.Mock<MockQueryChain<T>>;
  ilike: jest.Mock<MockQueryChain<T>>;
  in: jest.Mock<MockQueryChain<T>>;
  is: jest.Mock<MockQueryChain<T>>;
  order: jest.Mock<MockQueryChain<T>>;
  limit: jest.Mock<MockQueryChain<T>>;
  range: jest.Mock<MockQueryChain<T>>;
  textSearch: jest.Mock<MockQueryChain<T>>;
  single: jest.Mock<Promise<QueryResult<T>>>;
  maybeSingle: jest.Mock<Promise<QueryResult<T>>>;
  then: jest.Mock;
}

/** useDataFetcher return type for mocking */
export interface DataFetcherResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  retry: () => void;
  reset: () => void;
}

// =============================================================================
// QUERY CHAIN FACTORY
// =============================================================================

/**
 * Creates a type-safe mock query chain with proper method chaining
 */
export function createMockQueryChain<T>(
  data: T | null = null,
  error: { message: string; code?: string } | null = null
): MockQueryChain<T> {
  const result: QueryResult<T> = { data, error };

  const chain: MockQueryChain<T> = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    like: jest.fn(() => chain),
    ilike: jest.fn(() => chain),
    in: jest.fn(() => chain),
    is: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    range: jest.fn(() => chain),
    textSearch: jest.fn(() => chain),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: jest.fn((resolve) => Promise.resolve(resolve(result))),
  };

  return chain;
}

/**
 * Creates a mock query chain that returns array data
 */
export function createMockArrayQueryChain<T>(
  data: T[] = [],
  error: { message: string; code?: string } | null = null
): MockQueryChain<T[]> {
  return createMockQueryChain<T[]>(data, error);
}

// =============================================================================
// DATA FETCHER MOCK FACTORY
// =============================================================================

/**
 * Creates a mock return value for useDataFetcher hook
 */
export function createMockDataFetcherResult<T>(
  overrides: Partial<DataFetcherResult<T>> = {}
): DataFetcherResult<T> {
  return {
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  };
}

/**
 * Creates a loading state for useDataFetcher
 */
export function createMockDataFetcherLoading<T>(): DataFetcherResult<T> {
  return createMockDataFetcherResult<T>({ loading: true });
}

/**
 * Creates an error state for useDataFetcher
 */
export function createMockDataFetcherError<T>(
  error: string
): DataFetcherResult<T> {
  return createMockDataFetcherResult<T>({ error });
}

/**
 * Creates a success state for useDataFetcher
 */
export function createMockDataFetcherSuccess<T>(
  data: T
): DataFetcherResult<T> {
  return createMockDataFetcherResult<T>({ data });
}

// =============================================================================
// ENTITY FACTORIES - Type-safe mock data generators
// =============================================================================

import type { BeachWithMetrics } from "@/types/location";

/**
 * Creates a mock Beach with required fields
 */
export function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: `beach-${Date.now()}`,
    name: "Test Beach",
    slug: "test-beach",
    lat: 32.7198,
    lon: -117.2557,
    city: "San Diego",
    state: "CA",
    country: "USA",
    region: "San Diego County",
    description: "A beautiful test beach",
    skill_level: "Intermediate",
    crowd_level: "Moderate",
    break_type: "Beach Break",
    best_months: [6, 7, 8],
    best_conditions_prose: "Best in summer",
    wave_tips: "Watch for rip currents",
    hazards: ["Rip currents"],
    features: ["Parking", "Restrooms"],
    parking_tips: "Street parking available",
    access_tips: "Easy beach access",
    local_etiquette: "Respect locals",
    crowd_tips: "Busy on weekends",
    warnings: [],
    real_takeaways: [],
    average_rating: 4.0,
    review_count: 10,
    is_private: false,
    created_at: new Date().toISOString(),
    deleted_at: null,
    owner_id: null,
    region_id: null,
    geog: null,
    preference_model: null,
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    aspect_deg: null,
    swell_window_min_deg: null,
    swell_window_max_deg: null,
    swell_window_center_deg: null,
    swell_window_halfwidth_deg: null,
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    wind_cross_shore_ok_kt: null,
    wind_onshore_bad_kt: null,
    ...overrides,
  };
}

/**
 * Creates a mock BeachWithMetrics (Beach + ranking metrics)
 */
export function createMockBeachWithMetrics(
  overrides: Partial<BeachWithMetrics> = {}
): BeachWithMetrics {
  return {
    ...createMockBeach(overrides),
    composite_score: 0.75,
    recent_intel_count: 5,
    avg_confirmations: 3.0,
    rank: undefined,
    ...overrides,
  };
}

/**
 * Creates a mock Profile with required fields
 */
export function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: `profile-${Date.now()}`,
    full_name: "Test User",
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: "test@example.com",
    display_name: null,
    experience_level: "intermediate",
    home_beach_id: null,
    is_admin: false,
    is_mock: false,
    location: null,
    crowd_preference: null,
    preferred_break_type: null,
    preferred_wave_size: null,
    surf_styles: null,
    favorite_spot: null,
    favorite_spot_id: null,
    followers_count: 0,
    following_count: 0,
    instagram: null,
    phone_number: null,
    referral_code: null,
    onboarding_completed_at: null,
    preferences_v2_shown_at: null,
    // Notification settings
    notif_email_enabled: true,
    notif_inapp_enabled: true,
    notif_push_enabled: true,
    notif_follows: true,
    notif_likes: true,
    notif_reminders: true,
    notif_session_invites: true,
    notif_xp_updates: true,
    // Session invite preferences
    digest_session_invites: false,
    email_session_invites: true,
    inapp_session_invites: true,
    ...overrides,
  };
}

/**
 * Creates a mock Session with required fields
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `session-${Date.now()}`,
    user_id: "test-user-123",
    profile_id: "test-user-123",
    beach_id: "beach-123",
    beach_name: "Test Beach",
    board_id: null,
    arrival_time: new Date().toISOString(),
    rating: 4,
    notes: null,
    description: null,
    status: "completed",
    is_public: true,
    created_at: new Date().toISOString(),
    deleted_at: null,
    comments_count: 0,
    crowd_level: null,
    duration_minutes: 90,
    likes_count: 0,
    share_count: 0,
    water_temp: null,
    wave_height_ft: null,
    wave_quality: null,
    wind_direction: null,
    wind_speed_mph: null,
    parking_ease: null,
    forecast_accuracy: null,
    goals: [],
    invitee_ids: [],
    image_url: null,
    ...overrides,
  };
}

/**
 * Creates a mock Forecast with required fields
 */
export function createMockForecast(overrides: Partial<Forecast> = {}): Forecast {
  return {
    id: `forecast-${Date.now()}`,
    beach_id: "beach-123",
    forecast_date: new Date().toISOString().split("T")[0],
    forecast_time: "08:00:00",
    wave_height: "3-4ft",
    wave_direction: "SW",
    wave_period: "12s",
    wind_speed: "5-10mph",
    wind_direction: "NW",
    weather_condition: "sunny",
    confidence_score: 0.8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data_source: "surfline",
    air_temperature: "72",
    water_temp: "65",
    // Primary swell
    swell_1_height: "4ft",
    swell_1_period: "12s",
    swell_1_direction: "SW",
    // Secondary swell
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    // Wind waves
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    // Tide info
    tide_height: "3.2ft",
    tide_status: "rising",
    next_tide_height: "5.1ft",
    next_tide_time: "14:00:00",
    next_tide_type: "high",
    raw_forecast: null,
    ...overrides,
  };
}

/**
 * Creates a mock IntelPost with required fields
 */
export function createMockIntelPost(
  overrides: Partial<IntelPost> = {}
): IntelPost {
  return {
    id: `intel-${Date.now()}`,
    user_id: "test-user-123",
    beach_id: "beach-123",
    title: "Conditions Report",
    description: "Great waves today!",
    tag: "conditions",
    latitude: 32.7198,
    longitude: -117.2557,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    confirmations_count: 0,
    expires_at: null,
    dedupe_hash: null,
    photo_url: null,
    photo_storage_path: null,
    surf_conditions: null,
    ...overrides,
  };
}

/**
 * Creates a mock BeachReview with required fields
 */
export function createMockBeachReview(
  overrides: Partial<BeachReview> = {}
): BeachReview {
  return {
    id: `review-${Date.now()}`,
    user_id: "test-user-123",
    beach_id: "beach-123",
    title: "Great Surf Spot",
    content: "Amazing beach!",
    overall_rating: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    accessibility_rating: 4,
    crowd_density_rating: 3,
    helpful_count: 0,
    parking_rating: 4,
    wave_quality_rating: 5,
    visit_date: new Date().toISOString().split("T")[0],
    ...overrides,
  };
}

// =============================================================================
// MOCK SUPABASE CLIENT HELPERS
// =============================================================================

/**
 * Creates a type-safe mock for the Supabase `from` method
 */
export function createMockFromMethod<T extends TableName>(
  table: T,
  data: Tables[T]["Row"] | Tables[T]["Row"][] | null,
  error: { message: string; code?: string } | null = null
) {
  const chain = Array.isArray(data)
    ? createMockArrayQueryChain(data, error)
    : createMockQueryChain(data, error);

  return jest.fn().mockReturnValue(chain);
}

/**
 * Helper to mock a successful RPC call
 */
export function createMockRpc<T>(data: T) {
  return jest.fn().mockResolvedValue({ data, error: null });
}

/**
 * Helper to mock a failed RPC call
 */
export function createMockRpcError(message: string, code?: string) {
  return jest.fn().mockResolvedValue({
    data: null,
    error: { message, code },
  });
}

// =============================================================================
// EXPORTS FOR BACKWARDS COMPATIBILITY
// =============================================================================

export {
  createMockQueryChain as createTypedQueryChain,
  createMockDataFetcherResult as createTypedDataFetcherResult,
};
