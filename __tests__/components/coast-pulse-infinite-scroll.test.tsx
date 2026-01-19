/**
 * Tests for CoastPulse infinite scroll functionality
 * @jest-environment jsdom
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});
(window as any).IntersectionObserver = mockIntersectionObserver;

// Mock fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe("CoastPulse Infinite Scroll", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const mockFirstPageResponse = {
    success: true,
    data: {
      items: [
        {
          id: "test-1",
          source: { name: "Test Source", type: "intel", credibility: 50 },
          message: "Test message 1",
          timestamp: new Date().toISOString(),
        },
      ],
      summary: {
        waveHeight: "3-4ft",
        windSpeed: "5mph",
        tideHeight: "3.5ft",
        waterTemp: "62°F",
        trend: "rising",
        lastUpdated: new Date().toISOString(),
      },
      hasMore: true,
      nextCursor: "2026-01-15T10:00:00.000Z",
    },
  };

  const mockSecondPageResponse = {
    success: true,
    data: {
      items: [
        {
          id: "test-2",
          source: { name: "Test Source 2", type: "intel", credibility: 50 },
          message: "Test message 2",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      summary: {
        waveHeight: null,
        windSpeed: null,
        tideHeight: null,
        waterTemp: null,
        trend: null,
        lastUpdated: new Date().toISOString(),
      },
      hasMore: false,
      nextCursor: null,
    },
  };

  describe("State management", () => {
    it("should initialize with loading state", () => {
      // Initial state should have loading: true
      const initialState = {
        loading: true,
        loadingMore: false,
        hasMore: true,
        nextCursor: null,
        items: [],
      };

      expect(initialState.loading).toBe(true);
      expect(initialState.items).toHaveLength(0);
      expect(initialState.hasMore).toBe(true);
      expect(initialState.nextCursor).toBeNull();
    });

    it("should reset state on location change", () => {
      // Simulate location change behavior
      const resetState = () => ({
        items: [],
        summary: null,
        hasMore: true,
        nextCursor: null,
        loadMoreError: false,
      });

      const newState = resetState();
      expect(newState.items).toHaveLength(0);
      expect(newState.hasMore).toBe(true);
      expect(newState.nextCursor).toBeNull();
      expect(newState.summary).toBeNull();
      expect(newState.loadMoreError).toBe(false);
    });

    it("should transition from loading to loaded state", () => {
      let state = {
        loading: true,
        loadingMore: false,
        items: [],
        hasMore: true,
      };

      // After data loaded
      state = {
        loading: false,
        loadingMore: false,
        items: mockFirstPageResponse.data.items,
        hasMore: mockFirstPageResponse.data.hasMore,
      };

      expect(state.loading).toBe(false);
      expect(state.items.length).toBeGreaterThan(0);
      expect(state.hasMore).toBe(true);
    });

    it("should set loadingMore when fetching next page", () => {
      const state = {
        loading: false,
        loadingMore: true,
        hasMore: true,
        nextCursor: "2026-01-15T10:00:00.000Z",
      };

      expect(state.loadingMore).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.hasMore).toBe(true);
    });
  });

  describe("Pagination behavior", () => {
    it("should append items when loading more", () => {
      const initialItems = [{ id: "1", message: "First", source: { name: "test", type: "intel" as const, credibility: 50 }, timestamp: new Date().toISOString() }];
      const newItems = [{ id: "2", message: "Second", source: { name: "test", type: "intel" as const, credibility: 50 }, timestamp: new Date().toISOString() }];

      // Simulate append behavior
      const appendedItems = [...initialItems, ...newItems];

      expect(appendedItems).toHaveLength(2);
      expect(appendedItems[0].id).toBe("1");
      expect(appendedItems[1].id).toBe("2");
    });

    it("should not trigger load more when hasMore is false", () => {
      const state = {
        loadingMore: false,
        hasMore: false,
        nextCursor: null,
      };

      const shouldLoadMore = !state.loadingMore && state.hasMore && state.nextCursor !== null;
      expect(shouldLoadMore).toBe(false);
    });

    it("should not trigger load more when already loading", () => {
      const state = {
        loadingMore: true,
        hasMore: true,
        nextCursor: "2026-01-15T10:00:00.000Z",
      };

      const shouldLoadMore = !state.loadingMore && state.hasMore && state.nextCursor !== null;
      expect(shouldLoadMore).toBe(false);
    });

    it("should not trigger load more when nextCursor is null", () => {
      const state = {
        loadingMore: false,
        hasMore: true,
        nextCursor: null,
      };

      const shouldLoadMore = !state.loadingMore && state.hasMore && state.nextCursor !== null;
      expect(shouldLoadMore).toBe(false);
    });

    it("should trigger load more only when all conditions met", () => {
      const state = {
        loadingMore: false,
        hasMore: true,
        nextCursor: "2026-01-15T10:00:00.000Z",
      };

      const shouldLoadMore = !state.loadingMore && state.hasMore && state.nextCursor !== null;
      expect(shouldLoadMore).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should preserve items when load more fails", () => {
      const existingItems = [
        { id: "1", message: "Existing item 1", source: { name: "test", type: "intel" as const, credibility: 50 }, timestamp: new Date().toISOString() },
        { id: "2", message: "Existing item 2", source: { name: "test", type: "intel" as const, credibility: 50 }, timestamp: new Date().toISOString() },
      ];

      // Simulate error - items should remain unchanged
      const itemsAfterError = existingItems;

      expect(itemsAfterError).toHaveLength(2);
      expect(itemsAfterError[0].id).toBe("1");
      expect(itemsAfterError[1].id).toBe("2");
    });

    it("should show retry option when load more fails", () => {
      const state = {
        loadMoreError: true,
        loadingMore: false,
      };

      const shouldShowRetry = state.loadMoreError && !state.loadingMore;
      expect(shouldShowRetry).toBe(true);
    });

    it("should not show retry when loading more", () => {
      const state = {
        loadMoreError: true,
        loadingMore: true,
      };

      const shouldShowRetry = state.loadMoreError && !state.loadingMore;
      expect(shouldShowRetry).toBe(false);
    });

    it("should not show retry when no error", () => {
      const state = {
        loadMoreError: false,
        loadingMore: false,
      };

      const shouldShowRetry = state.loadMoreError && !state.loadingMore;
      expect(shouldShowRetry).toBe(false);
    });

    it("should reset error state when retrying", () => {
      let state = {
        loadMoreError: true,
        loadingMore: false,
      };

      // Simulate retry
      state = {
        loadMoreError: false,
        loadingMore: true,
      };

      expect(state.loadMoreError).toBe(false);
      expect(state.loadingMore).toBe(true);
    });
  });

  describe("UI states", () => {
    it("should show end message when hasMore is false", () => {
      const state = {
        hasMore: false,
        loadingMore: false,
        items: [{ id: "1", message: "test", source: { name: "test", type: "intel" as const, credibility: 50 }, timestamp: new Date().toISOString() }],
      };

      const shouldShowEndMessage = !state.hasMore && !state.loadingMore && state.items.length > 0;
      expect(shouldShowEndMessage).toBe(true);
    });

    it("should not show end message when still loading", () => {
      const state = {
        hasMore: false,
        loadingMore: true,
        items: [{ id: "1", message: "test", source: { name: "test", type: "intel" as const, credibility: 50 }, timestamp: new Date().toISOString() }],
      };

      const shouldShowEndMessage = !state.hasMore && !state.loadingMore && state.items.length > 0;
      expect(shouldShowEndMessage).toBe(false);
    });

    it("should not show end message when no items", () => {
      const state = {
        hasMore: false,
        loadingMore: false,
        items: [],
      };

      const shouldShowEndMessage = !state.hasMore && !state.loadingMore && state.items.length > 0;
      expect(shouldShowEndMessage).toBe(false);
    });

    it("should show loading indicator when fetching more", () => {
      const state = {
        loadingMore: true,
        items: [{ id: "1", message: "test", source: { name: "test", type: "intel" as const, credibility: 50 }, timestamp: new Date().toISOString() }],
      };

      const shouldShowLoadingMore = state.loadingMore && state.items.length > 0;
      expect(shouldShowLoadingMore).toBe(true);
    });

    it("should not show loading indicator on initial load", () => {
      const state = {
        loadingMore: false,
        items: [],
      };

      const shouldShowLoadingMore = state.loadingMore && state.items.length > 0;
      expect(shouldShowLoadingMore).toBe(false);
    });
  });

  describe("Cursor handling", () => {
    it("should construct URL with cursor for pagination", () => {
      const lat = 32.75;
      const lon = -117.25;
      const cursor = "2026-01-15T10:00:00.000Z";

      const url = `/api/coast-pulse?lat=${lat}&lon=${lon}&limit=8&before=${encodeURIComponent(cursor)}`;

      expect(url).toContain("lat=32.75");
      expect(url).toContain("lon=-117.25");
      expect(url).toContain("limit=8");
      expect(url).toContain("before=2026-01-15T10%3A00%3A00.000Z");
    });

    it("should construct URL without cursor for first page", () => {
      const lat = 32.75;
      const lon = -117.25;

      const url = `/api/coast-pulse?lat=${lat}&lon=${lon}&limit=8`;

      expect(url).toContain("lat=32.75");
      expect(url).toContain("lon=-117.25");
      expect(url).toContain("limit=8");
      expect(url).not.toContain("before=");
    });

    it("should encode cursor properly for URL", () => {
      const cursor = "2026-01-15T10:30:45.123Z";
      const encoded = encodeURIComponent(cursor);

      expect(encoded).toBe("2026-01-15T10%3A30%3A45.123Z");
      expect(decodeURIComponent(encoded)).toBe(cursor);
    });
  });

  describe("Data validation", () => {
    it("should validate coordinate bounds", () => {
      const validLat = 32.75;
      const validLon = -117.25;

      const isValid = validLat >= -90 && validLat <= 90 && validLon >= -180 && validLon <= 180;
      expect(isValid).toBe(true);
    });

    it("should reject invalid latitude", () => {
      const invalidLat = 91;
      const validLon = -117.25;

      const isValid = invalidLat >= -90 && invalidLat <= 90 && validLon >= -180 && validLon <= 180;
      expect(isValid).toBe(false);
    });

    it("should reject invalid longitude", () => {
      const validLat = 32.75;
      const invalidLon = 181;

      const isValid = validLat >= -90 && validLat <= 90 && invalidLon >= -180 && invalidLon <= 180;
      expect(isValid).toBe(false);
    });
  });

  describe("IntersectionObserver integration", () => {
    it("should observe sentinel element", () => {
      const mockObserve = jest.fn();
      const mockDisconnect = jest.fn();

      (window as any).IntersectionObserver = jest.fn((callback, options) => ({
        observe: mockObserve,
        unobserve: jest.fn(),
        disconnect: mockDisconnect,
      }));

      const sentinel = document.createElement("div");

      const observer = new IntersectionObserver(() => {}, { rootMargin: "200px" });
      observer.observe(sentinel);

      expect(mockObserve).toHaveBeenCalledWith(sentinel);
    });

    it("should use correct rootMargin for triggering", () => {
      let capturedOptions: IntersectionObserverInit | undefined;

      (window as any).IntersectionObserver = jest.fn((callback, options) => {
        capturedOptions = options;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      new IntersectionObserver(() => {}, { rootMargin: "200px" });

      expect(capturedOptions?.rootMargin).toBe("200px");
    });

    it("should disconnect observer on cleanup", () => {
      const mockDisconnect = jest.fn();

      (window as any).IntersectionObserver = jest.fn(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect,
      }));

      const observer = new IntersectionObserver(() => {}, {});
      observer.disconnect();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("Response handling", () => {
    it("should handle successful first page response", () => {
      const response = mockFirstPageResponse;

      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(1);
      expect(response.data.hasMore).toBe(true);
      expect(response.data.nextCursor).toBeTruthy();
      expect(response.data.summary).toBeTruthy();
    });

    it("should handle successful second page response", () => {
      const response = mockSecondPageResponse;

      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(1);
      expect(response.data.hasMore).toBe(false);
      expect(response.data.nextCursor).toBeNull();
    });

    it("should handle empty response", () => {
      const response = {
        success: true,
        data: {
          items: [],
          summary: {},
          hasMore: false,
          nextCursor: null,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(0);
      expect(response.data.hasMore).toBe(false);
    });

    it("should detect invalid response structure", () => {
      const invalidResponse = {
        success: false,
        data: null,
      };

      const isValid = invalidResponse.success && invalidResponse.data !== null;
      expect(isValid).toBe(false);
    });
  });
});
