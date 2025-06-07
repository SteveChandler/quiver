import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";

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
  latitude: 32.7841,
  longitude: -117.2527,
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
  profile_id: "test-user-id",
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

// Utility functions for tests
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export const mockConsoleError = () => {
  const originalError = console.error;
  console.error = jest.fn();
  return () => {
    console.error = originalError;
  };
};

export const mockConsoleWarn = () => {
  const originalWarn = console.warn;
  console.warn = jest.fn();
  return () => {
    console.warn = originalWarn;
  };
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
