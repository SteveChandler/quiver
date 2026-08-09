import React, { ReactElement } from "react";
import { render, RenderOptions, screen } from "@testing-library/react";

// Mock Next.js components commonly used in tests
export const mockNextRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: "/",
  route: "/",
  query: {},
  asPath: "/",
  basePath: "",
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
};

// Mock Next.js Image component
export const MockImage = ({ src, alt, ...props }: any) => (
  <img src={src} alt={alt} {...props} />
);

// Mock Next.js Link component
export const MockLink = ({ children, href, ...props }: any) => (
  <a href={href} {...props}>
    {children}
  </a>
);

// Mock auth context provider for tests
export const MockAuthProvider = ({ children, user = null }: any) => {
  const mockAuthValue = {
    user,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  };

  return (
    <div
      data-testid="mock-auth-provider"
      data-user={user ? "authenticated" : "unauthenticated"}
    >
      {children}
    </div>
  );
};

// Custom render function that includes common providers
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  user?: any;
  router?: Partial<typeof mockNextRouter>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { user, router, ...renderOptions } = options;

  // Mock next/router
  if (router) {
    jest.mock("next/router", () => ({
      useRouter: () => ({
        ...mockNextRouter,
        ...router,
      }),
    }));
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MockAuthProvider user={user}>{children}</MockAuthProvider>;
  }

  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Mock Supabase client for tests
export const createMockSupabaseClient = () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
      })),
      order: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      gte: jest.fn(),
      lte: jest.fn(),
      maybeSingle: jest.fn(),
    })),
  })),
  auth: {
    getUser: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      remove: jest.fn(),
    })),
  },
});

// Mock beach data for tests
export const mockBeach = {
  id: "test-beach-id",
  name: "Test Beach",
  lat: 32.7841,
  lon: -117.2527,
  description: "A beautiful test beach",
  wave_quality_rating: 4.2,
  crowd_density_rating: 3.1,
  parking_rating: 3.8,
  accessibility_rating: 4.0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const mockForecasts = [
  {
    id: "forecast-1",
    beach_id: "test-beach-id",
    forecast_at: "2024-01-01T06:00Z",
    forecast_date: "2024-01-01",
    forecast_time: "06:00",
    wave_height: "3-4 ft",
    water_temp: "65°F",
    wind_speed: "10 mph",
    wind_direction: "SW",
    tide: "High",
    weather_condition: "Sunny",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "forecast-2",
    beach_id: "test-beach-id",
    forecast_at: "2024-01-01T12:00Z",
    forecast_date: "2024-01-01",
    forecast_time: "12:00",
    wave_height: "4-5 ft",
    water_temp: "66°F",
    wind_speed: "12 mph",
    wind_direction: "W",
    tide: "Low",
    weather_condition: "Partly Cloudy",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

export const mockSession = {
  id: "test-session-id",
  user_id: "test-user-id",
  beach_id: "test-beach-id",
  board_id: "test-board-id",
  status: "completed" as const,
  arrival_time: "2024-01-01T10:00:00Z",
  duration_minutes: 120,
  notes: "Great session!",
  rating: 4,
  wave_height: "3-4 ft",
  water_temp: "65°F",
  crowd_level: 3,
  is_public: true,
  likes_count: 5,
  comments_count: 2,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Centralized mock beaches data
export const createMockBeaches = (count: number = 6) =>
  [
    {
      id: "beach-1",
      name: "Ocean Beach",
      lat: 32.7503,
      lon: -117.2534,
      location_text: "San Diego",
      wave_quality_rating: 4.2,
      crowd_density_rating: 3.8,
      parking_rating: 3.5,
      accessibility_rating: 4.0,
      break_type: "beach",
      skill_level: "beginner-intermediate",
    },
    {
      id: "beach-2",
      name: "Mission Beach",
      lat: 32.7641,
      lon: -117.253,
      location_text: "San Diego",
      wave_quality_rating: 3.8,
      crowd_density_rating: 4.2,
      parking_rating: 3.0,
      accessibility_rating: 4.5,
      break_type: "beach",
      skill_level: "beginner",
    },
    {
      id: "beach-3",
      name: "La Jolla Cove",
      lat: 32.8509,
      lon: -117.2713,
      location_text: "La Jolla",
      wave_quality_rating: 4.5,
      crowd_density_rating: 4.0,
      parking_rating: 2.5,
      accessibility_rating: 3.5,
      break_type: "reef",
      skill_level: "intermediate",
    },
    {
      id: "beach-4",
      name: "Sunset Cliffs",
      lat: 32.7337,
      lon: -117.2553,
      location_text: "Point Loma",
      wave_quality_rating: 4.8,
      crowd_density_rating: 3.2,
      parking_rating: 2.8,
      accessibility_rating: 3.0,
      break_type: "reef",
      skill_level: "advanced",
    },
    {
      id: "beach-5",
      name: "Windansea Beach",
      lat: 32.8276,
      lon: -117.2797,
      location_text: "La Jolla",
      wave_quality_rating: 4.6,
      crowd_density_rating: 3.5,
      parking_rating: 3.2,
      accessibility_rating: 3.8,
      break_type: "point",
      skill_level: "intermediate",
    },
    {
      id: "beach-6",
      name: "Pacific Beach",
      lat: 32.7797,
      lon: -117.2531,
      location_text: "San Diego",
      wave_quality_rating: 3.9,
      crowd_density_rating: 4.5,
      parking_rating: 3.1,
      accessibility_rating: 4.2,
      break_type: "beach",
      skill_level: "beginner",
    },
  ].slice(0, count);

// Create mock review stats
export const createMockReviewStats = (beachIds: string[]) =>
  beachIds.reduce(
    (acc, id, index) => ({
      ...acc,
      [id]: {
        total_reviews: (index + 1) * 5,
        average_overall: Math.round((3.5 + index * 0.3) * 10) / 10,
        average_wave_quality: Math.round((4.0 + index * 0.2) * 10) / 10,
        average_crowd_density: Math.round((3.0 + index * 0.4) * 10) / 10,
        average_parking: Math.round((3.2 + index * 0.3) * 10) / 10,
        average_accessibility: Math.round((4.0 + index * 0.1) * 10) / 10,
        distribution: [5, 4, 3, 2, 1].map((rating, offset) => ({
          rating,
          count: Math.max(0, (index + 1) - offset),
        })),
      },
    }),
    {}
  );

// Common mock setups
export const mockMapUtils = () => ({
  getStaticMapImageUrl: jest.fn(() => "http://example.com/map.jpg"),
  resolveBeachCoordinates: jest.fn((beach) => ({
    lat: beach.lat,
    lon: beach.lon,
  })),
});

// Mock BeachCard component for tests
export const mockBeachCard = () => ({
  BeachCard: ({
    name,
    rating,
    reviewCount,
    distance,
    onViewDetails,
  }: {
    name: string;
    rating: number;
    reviewCount: number;
    distance: string;
    onViewDetails?: () => void;
  }) => (
    <div data-testid={`beach-card-${name}`}>
      <h3>{name}</h3>
      <span data-testid="rating">{rating}</span>
      <span data-testid="review-count">{reviewCount}</span>
      <span data-testid="distance">{distance}</span>
      {onViewDetails && <button onClick={onViewDetails}>View Details</button>}
    </div>
  ),
});

// Test assertion helpers
export const assertBeachCardRendered = (
  beachName: string,
  expectedRating: number,
  expectedReviewCount: number
) => {
  const card = screen.getByTestId(`beach-card-${beachName}`);
  expect(card).toBeInTheDocument();
  expect(card.querySelector('[data-testid="rating"]')).toHaveTextContent(
    expectedRating.toString()
  );
  expect(card.querySelector('[data-testid="review-count"]')).toHaveTextContent(
    expectedReviewCount.toString()
  );
};

export const assertHookCalledWithBeachIds = (
  mockHook: jest.Mock,
  expectedIds: string[]
) => {
  expect(mockHook).toHaveBeenCalledWith(expectedIds);
};

// Utility functions for tests
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Declare that this test intentionally triggers console.error matching the
 * given patterns.  Matched errors are cleared so the afterEach guard in
 * jest.setup.js won't fail the test.  Unmatched errors still fail.
 */
export const expectConsoleErrors = (patterns: RegExp[]) => {
  const tracked = (globalThis as any).__quiverConsoleErrors as
    | string[]
    | undefined;
  if (!tracked) return; // fallback if setup hasn't run yet

  const unmatched: string[] = [];
  for (const msg of tracked) {
    if (!patterns.some((p) => p.test(msg))) {
      unmatched.push(msg);
    }
  }
  // Clear the array so afterEach doesn't double-report
  tracked.length = 0;
  if (unmatched.length > 0) {
    throw new Error(
      `Unexpected console.error(s) not matching provided patterns:\n  ${unmatched.join("\n  ")}`
    );
  }
};

/**
 * Declare that this test intentionally triggers console.warn matching the
 * given patterns.  Matched warnings are cleared so the afterEach guard in
 * jest.setup.js won't fail the test.  Unmatched warnings still fail.
 */
export const expectConsoleWarnings = (patterns: RegExp[]) => {
  const tracked = (globalThis as any).__quiverConsoleWarns as
    | string[]
    | undefined;
  if (!tracked) return; // fallback if setup hasn't run yet

  const unmatched: string[] = [];
  for (const msg of tracked) {
    if (!patterns.some((p) => p.test(msg))) {
      unmatched.push(msg);
    }
  }
  // Clear the array so afterEach doesn't double-report
  tracked.length = 0;
  if (unmatched.length > 0) {
    throw new Error(
      `Unexpected console.warn(s) not matching provided patterns:\n  ${unmatched.join("\n  ")}`
    );
  }
};

// Mock window.matchMedia for responsive tests
export const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Mock window.navigator.geolocation
export const mockGeolocation = (position?: GeolocationPosition) => {
  const mockGeolocation = {
    getCurrentPosition: jest.fn((success, error) => {
      if (position) {
        success(position);
      } else {
        error(new Error("Geolocation not available"));
      }
    }),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  };

  Object.defineProperty(navigator, "geolocation", {
    value: mockGeolocation,
    writable: true,
  });

  return mockGeolocation;
};

// Mock intersection observer for lazy loading tests
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
  window.IntersectionObserverEntry = jest.fn();

  return mockIntersectionObserver;
};

// Re-export everything from React Testing Library
export * from "@testing-library/react";
export { renderWithProviders as render };

// This file contains test utilities and should not be treated as a test file
// Jest configuration should exclude files in setup/ directory from test discovery
