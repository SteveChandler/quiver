import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ClientApp from "@/app/client-app";
import { useAuth } from "@/context/auth-context";

// Mock the auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock performance utils
jest.mock("@/lib/utils/performance-utils", () => ({
  PerformanceUtils: {
    trackWebVitals: jest.fn(),
    preloadCriticalResources: jest.fn(),
    monitorMemoryUsage: jest.fn(),
  },
}));

// Mock loading utils
jest.mock("@/lib/utils/loading-utils", () => ({
  AuthLoadingStates: {
    checking: jest.fn(() => (
      <div data-testid="auth-loading">Checking authentication...</div>
    )),
  },
}));

// Mock lazy-loaded components to actually show loading states
jest.mock("@/components/home-screen", () => {
  // Create a component that never resolves to test Suspense
  const HomeScreen = () => <div data-testid="home-screen">Home Screen</div>;
  return { HomeScreen };
});

jest.mock("@/components/landing-page", () => {
  const LandingPage = () => <div data-testid="landing-page">Landing Page</div>;
  return { __esModule: true, default: LandingPage };
});

// Mock console methods to avoid noise in tests
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
Object.assign(console, mockConsole);

// Helper to create a mock auth return with all required properties
const createMockAuth = (overrides: {
  user?: { id: string; email: string } | null;
  isLoading?: boolean;
} = {}) => ({
  user: overrides.user !== undefined ? overrides.user as any : null,
  session: null,
  isLoading: overrides.isLoading ?? false,
  isAuthenticated: !!overrides.user,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
});

describe("ClientApp", () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Authentication States", () => {
    it("shows loading state when authentication is being checked", () => {
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      render(<ClientApp />);

      expect(screen.getByTestId("auth-loading")).toBeInTheDocument();
    });

    it("renders HomeScreen when user is authenticated", async () => {
      mockUseAuth.mockReturnValue(createMockAuth({
        user: { id: "user-1", email: "test@example.com" },
      }));

      render(<ClientApp />);

      await waitFor(() => {
        expect(screen.getByTestId("home-screen")).toBeInTheDocument();
      });
    });

    it("renders LandingPage when user is not authenticated", async () => {
      mockUseAuth.mockReturnValue(createMockAuth());

      render(<ClientApp />);

      await waitFor(() => {
        expect(screen.getByTestId("landing-page")).toBeInTheDocument();
      });
    });
  });

  describe("Performance Monitoring", () => {
    beforeEach(() => {
      const { PerformanceUtils } = require("@/lib/utils/performance-utils");
      PerformanceUtils.trackWebVitals.mockClear();
      PerformanceUtils.preloadCriticalResources.mockClear();
      PerformanceUtils.monitorMemoryUsage.mockClear();
    });

    it("initializes performance monitoring on mount", () => {
      mockUseAuth.mockReturnValue(createMockAuth());

      const { PerformanceUtils } = require("@/lib/utils/performance-utils");

      render(<ClientApp />);

      expect(PerformanceUtils.trackWebVitals).toHaveBeenCalledTimes(1);
      expect(PerformanceUtils.preloadCriticalResources).toHaveBeenCalledTimes(
        1
      );
    });

    it("monitors memory usage in development mode", () => {
      // Use Object.defineProperty to modify NODE_ENV safely
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "development",
        configurable: true,
      });

      mockUseAuth.mockReturnValue(createMockAuth());

      const { PerformanceUtils } = require("@/lib/utils/performance-utils");

      render(<ClientApp />);

      // Fast-forward time to trigger the timeout
      jest.advanceTimersByTime(5000);

      expect(PerformanceUtils.monitorMemoryUsage).toHaveBeenCalledTimes(1);

      // Restore
      Object.defineProperty(process.env, "NODE_ENV", {
        value: originalEnv,
        configurable: true,
      });
    });

    it("does not monitor memory usage in production mode", () => {
      // Use Object.defineProperty to modify NODE_ENV safely
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "production",
        configurable: true,
      });

      mockUseAuth.mockReturnValue(createMockAuth());

      const { PerformanceUtils } = require("@/lib/utils/performance-utils");

      render(<ClientApp />);

      // Fast-forward time
      jest.advanceTimersByTime(10000);

      // Memory monitoring should not be called in production
      expect(PerformanceUtils.monitorMemoryUsage).not.toHaveBeenCalled();

      // Restore
      Object.defineProperty(process.env, "NODE_ENV", {
        value: originalEnv,
        configurable: true,
      });
    });
  });

  describe("Component Rendering", () => {
    it("renders authenticated home screen", async () => {
      mockUseAuth.mockReturnValue(createMockAuth({
        user: { id: "user-1", email: "test@example.com" },
      }));

      render(<ClientApp />);

      await waitFor(() => {
        expect(screen.getByTestId("home-screen")).toBeInTheDocument();
      });
    });

    it("renders unauthenticated landing page", async () => {
      mockUseAuth.mockReturnValue(createMockAuth());

      render(<ClientApp />);

      await waitFor(() => {
        expect(screen.getByTestId("landing-page")).toBeInTheDocument();
      });
    });

    it("switches between authenticated and unauthenticated states correctly", async () => {
      const { rerender } = render(<ClientApp />);

      // Start with unauthenticated user
      mockUseAuth.mockReturnValue(createMockAuth());

      rerender(<ClientApp />);
      await waitFor(() => {
        expect(screen.getByTestId("landing-page")).toBeInTheDocument();
      });

      // Switch to authenticated user
      mockUseAuth.mockReturnValue(createMockAuth({
        user: { id: "user-1", email: "test@example.com" },
      }));

      rerender(<ClientApp />);
      await waitFor(() => {
        expect(screen.getByTestId("home-screen")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles authentication loading state gracefully", () => {
      mockUseAuth.mockReturnValue(createMockAuth({ isLoading: true }));

      render(<ClientApp />);

      expect(screen.getByTestId("auth-loading")).toBeInTheDocument();
      expect(
        screen.getByText("Checking authentication...")
      ).toBeInTheDocument();
    });

    it("renders without errors for authenticated users", () => {
      mockUseAuth.mockReturnValue(createMockAuth({
        user: { id: "user-1", email: "test@example.com" },
      }));

      expect(() => render(<ClientApp />)).not.toThrow();
    });

    it("renders without errors for unauthenticated users", () => {
      mockUseAuth.mockReturnValue(createMockAuth());

      expect(() => render(<ClientApp />)).not.toThrow();
    });
  });

  describe("Integration", () => {
    it("properly integrates with auth context", () => {
      const mockSignOut = jest.fn();
      const mockRefreshSession = jest.fn();

      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" } as any,
        isLoading: false,
        signOut: mockSignOut,
        refreshSession: mockRefreshSession,
      } as any);

      render(<ClientApp />);

      // Verify useAuth was called
      expect(mockUseAuth).toHaveBeenCalled();
    });

    it("respects loading state from auth context", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      render(<ClientApp />);

      expect(screen.getByTestId("auth-loading")).toBeInTheDocument();
    });

    it("properly handles user state changes", async () => {
      const { rerender } = render(<ClientApp />);

      // Test transition from loading to unauthenticated
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      rerender(<ClientApp />);
      expect(screen.getByTestId("auth-loading")).toBeInTheDocument();

      // Test transition to authenticated
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" } as any,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      rerender(<ClientApp />);
      await waitFor(() => {
        expect(screen.getByTestId("home-screen")).toBeInTheDocument();
      });
    });
  });

  describe("Performance Features", () => {
    it("initializes performance tracking on mount", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      const { PerformanceUtils } = require("@/lib/utils/performance-utils");

      render(<ClientApp />);

      expect(PerformanceUtils.trackWebVitals).toHaveBeenCalled();
      expect(PerformanceUtils.preloadCriticalResources).toHaveBeenCalled();
    });

    it("conditionally monitors memory in development", () => {
      (process.env as any).NODE_ENV = "development";

      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      const { PerformanceUtils } = require("@/lib/utils/performance-utils");

      render(<ClientApp />);

      // Fast-forward timers
      jest.advanceTimersByTime(5000);

      expect(PerformanceUtils.monitorMemoryUsage).toHaveBeenCalled();
    });
  });
});
