import React from "react";
import { render, waitFor } from "@testing-library/react";
import { PageTracker } from "@/components/page-tracker";

// Mock next/navigation
const mockUsePathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock useTrackEvent hook
const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
const originalSessionStorage = global.sessionStorage;

beforeAll(() => {
  Object.defineProperty(global, "sessionStorage", {
    value: {
      getItem: (key: string) => mockSessionStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockSessionStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        Object.keys(mockSessionStorage).forEach((key) => {
          delete mockSessionStorage[key];
        });
      },
    },
    writable: true,
  });
});

afterAll(() => {
  Object.defineProperty(global, "sessionStorage", {
    value: originalSessionStorage,
    writable: true,
  });
});

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn(() => "test-uuid-1234-5678-abcd-efgh");
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: mockRandomUUID,
  },
});

describe("PageTracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.__quiver_session_id = "";
    delete mockSessionStorage.__quiver_session_id;
    mockRandomUUID.mockClear();
  });

  describe("tracking behavior", () => {
    it("tracks page_view event on mount", async () => {
      mockUsePathname.mockReturnValue("/home");

      render(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith("page_view", {
          metadata: {
            page: "home",
            referrer: "",
            browser_session_id: expect.any(String),
          },
          debounceMs: 500,
        });
      });
    });
  });

  describe("page navigation", () => {
    it("tracks page_view event on pathname change", async () => {
      mockUsePathname.mockReturnValue("/home");

      const { rerender } = render(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(1);
      });

      // Change pathname
      mockUsePathname.mockReturnValue("/discover");
      rerender(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(2);
        expect(mockTrack).toHaveBeenLastCalledWith("page_view", {
          metadata: {
            page: "discover",
            referrer: "/home",
            browser_session_id: expect.any(String),
          },
          debounceMs: 500,
        });
      });
    });

    it("does not track duplicate navigations to same path", async () => {
      mockUsePathname.mockReturnValue("/home");

      const { rerender } = render(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(1);
      });

      // Re-render with same pathname
      rerender(<PageTracker />);

      // Should still only be called once
      expect(mockTrack).toHaveBeenCalledTimes(1);
    });

    it("does not track landing page views", async () => {
      mockUsePathname.mockReturnValue("/");

      render(<PageTracker />);

      // Wait for potential track calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTrack).not.toHaveBeenCalled();
    });
  });

  describe("session ID generation", () => {
    it("generates consistent session IDs within same session", async () => {
      mockUsePathname.mockReturnValue("/home");

      render(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalled();
      });

      const firstCall = mockTrack.mock.calls[0];
      const firstSessionId = firstCall[1].metadata.browser_session_id;

      // Navigate to new page
      mockUsePathname.mockReturnValue("/discover");
      render(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(2);
      });

      const secondCall = mockTrack.mock.calls[1];
      const secondSessionId = secondCall[1].metadata.browser_session_id;

      expect(firstSessionId).toBe(secondSessionId);
    });

    it("uses crypto.randomUUID() for session ID", async () => {
      // Clear session storage to force new ID generation
      delete mockSessionStorage.__quiver_session_id;

      mockUsePathname.mockReturnValue("/home");

      render(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalled();
      });

      // Check that the session ID stored matches UUID format
      const storedId = mockSessionStorage.__quiver_session_id;
      expect(storedId).toBe("test-uuid-1234-5678-abcd-efgh");
    });
  });

  describe("page name mapping", () => {
    const pageMappings = [
      { pathname: "/home", expected: "home" },
      { pathname: "/dashboard", expected: "home" },
      { pathname: "/discover", expected: "discover" },
      { pathname: "/explore", expected: "discover" },
      { pathname: "/beach/some-beach-slug", expected: "beach_detail" },
      { pathname: "/beaches/california", expected: "beaches" },
      { pathname: "/map", expected: "map" },
      { pathname: "/map/search", expected: "map" },
      { pathname: "/profile", expected: "profile" },
      { pathname: "/profile/settings", expected: "profile" },
      { pathname: "/settings", expected: "settings" },
      { pathname: "/session/new", expected: "session" },
      { pathname: "/forecast/daily", expected: "forecast" },
      { pathname: "/onboarding/step1", expected: "onboarding" },
      { pathname: "/login", expected: "auth" },
      { pathname: "/signup", expected: "auth" },
      { pathname: "/auth", expected: "auth" },
    ];

    it.each(pageMappings)(
      "maps $pathname to $expected",
      async ({ pathname, expected }) => {
        mockUsePathname.mockReturnValue(pathname);
        mockTrack.mockClear();

        render(<PageTracker />);

        await waitFor(() => {
          expect(mockTrack).toHaveBeenCalledWith("page_view", {
            metadata: {
              page: expected,
              referrer: expect.any(String),
              browser_session_id: expect.any(String),
            },
            debounceMs: 500,
          });
        });
      }
    );
  });

  describe("referrer tracking", () => {
    it("tracks previous pathname as referrer", async () => {
      mockUsePathname.mockReturnValue("/home");

      const { rerender } = render(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(1);
      });

      // First call should have empty referrer
      expect(mockTrack.mock.calls[0][1].metadata.referrer).toBe("");

      // Navigate to discover
      mockUsePathname.mockReturnValue("/discover");
      rerender(<PageTracker />);

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledTimes(2);
      });

      // Second call should have /home as referrer
      expect(mockTrack.mock.calls[1][1].metadata.referrer).toBe("/home");
    });
  });

  describe("component rendering", () => {
    it("renders null (no visible UI)", () => {
      mockUsePathname.mockReturnValue("/home");

      const { container } = render(<PageTracker />);

      expect(container.firstChild).toBeNull();
    });
  });
});
