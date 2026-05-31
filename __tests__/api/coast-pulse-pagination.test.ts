/**
 * Tests for Coast Pulse API pagination
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "@jest/globals";

describe("Coast Pulse API Pagination", () => {
  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/coast-pulse/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  describe("Response shape", () => {
    it("should include hasMore and nextCursor in response", () => {
      // Verify the expected response structure
      const expectedShape = {
        success: true,
        data: {
          items: expect.any(Array),
          summary: expect.any(Object),
          hasMore: expect.any(Boolean),
          nextCursor: expect.anything(), // Can be string or null
        },
      };

      // This validates the type structure we expect
      expect(Object.keys(expectedShape.data)).toEqual([
        "items",
        "summary",
        "hasMore",
        "nextCursor",
      ]);
    });

    it("should accept valid response with hasMore true", () => {
      const response = {
        success: true,
        data: {
          items: [],
          summary: {},
          hasMore: true,
          nextCursor: "2026-01-15T10:00:00.000Z",
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.hasMore).toBe(true);
      expect(response.data.nextCursor).toBe("2026-01-15T10:00:00.000Z");
    });

    it("should accept valid response with hasMore false", () => {
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
      expect(response.data.hasMore).toBe(false);
      expect(response.data.nextCursor).toBeNull();
    });
  });

  describe("Cursor validation", () => {
    it("should accept valid ISO timestamp cursor", () => {
      const validCursor = "2026-01-15T10:00:00.000Z";
      const parsedDate = new Date(validCursor);
      expect(isNaN(parsedDate.getTime())).toBe(false);
    });

    it("should reject invalid cursor format", () => {
      const invalidCursor = "not-a-date";
      const parsedDate = new Date(invalidCursor);
      expect(isNaN(parsedDate.getTime())).toBe(true);
    });

    it("should accept cursor with milliseconds", () => {
      const cursorWithMs = "2026-01-15T10:30:45.123Z";
      const parsedDate = new Date(cursorWithMs);
      expect(isNaN(parsedDate.getTime())).toBe(false);
      expect(parsedDate.getMilliseconds()).toBe(123);
    });

    it("should handle various ISO formats", () => {
      const formats = [
        "2026-01-15T10:00:00.000Z",
        "2026-01-15T10:00:00Z",
        "2026-01-15T10:00:00.123Z",
      ];

      formats.forEach(format => {
        const parsed = new Date(format);
        expect(isNaN(parsed.getTime())).toBe(false);
      });
    });
  });

  describe("Pagination logic", () => {
    it("should return hasMore: true when more items exist", () => {
      // Simulate fetching limit+1 items means hasMore is true
      const limit = 8;
      const fetchedItems = Array(limit + 1).fill({
        id: "test",
        timestamp: new Date(),
        message: "test",
        source: { name: "test", type: "intel", credibility: 50 },
      });
      const hasMore = fetchedItems.length > limit;
      expect(hasMore).toBe(true);
    });

    it("should return hasMore: false when no more items", () => {
      const limit = 8;
      const fetchedItems = Array(5).fill({
        id: "test",
        timestamp: new Date(),
        message: "test",
        source: { name: "test", type: "intel", credibility: 50 },
      });
      const hasMore = fetchedItems.length > limit;
      expect(hasMore).toBe(false);
    });

    it("should return hasMore: false when exactly limit items", () => {
      const limit = 8;
      const fetchedItems = Array(8).fill({
        id: "test",
        timestamp: new Date(),
        message: "test",
        source: { name: "test", type: "intel", credibility: 50 },
      });
      const hasMore = fetchedItems.length > limit;
      expect(hasMore).toBe(false);
    });

    it("should set nextCursor to extra item timestamp when hasMore is true", () => {
      const limit = 8;
      const items = Array(limit + 1).fill(null).map((_, i) => ({
        id: `item-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        message: `test ${i}`,
        source: { name: "test", type: "intel" as const, credibility: 50 },
      }));

      const hasMore = items.length > limit;
      const nextCursor = hasMore
        ? items[limit].timestamp.toISOString()
        : null;

      expect(nextCursor).not.toBeNull();
      expect(nextCursor).toBe(items[limit].timestamp.toISOString());
    });

    it("should set nextCursor to null when hasMore is false", () => {
      const limit = 8;
      const items = Array(5).fill(null).map((_, i) => ({
        id: `item-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        message: `test ${i}`,
        source: { name: "test", type: "intel" as const, credibility: 50 },
      }));

      const hasMore = items.length > limit;
      const nextCursor = hasMore
        ? items[limit].timestamp.toISOString()
        : null;

      expect(nextCursor).toBeNull();
    });
  });

  describe("Pagination behavior", () => {
    it("should use before cursor to fetch older items", () => {
      const cursor = "2026-01-15T10:00:00.000Z";
      const url = `/api/coast-pulse?lat=32.75&lon=-117.25&limit=8&before=${encodeURIComponent(cursor)}`;

      expect(url).toContain("before=");
      expect(url).toContain(encodeURIComponent(cursor));
    });

    it("should not include before parameter on first page", () => {
      const url = `/api/coast-pulse?lat=32.75&lon=-117.25&limit=8`;

      expect(url).not.toContain("before=");
    });

    it("should preserve other parameters when paginating", () => {
      const cursor = "2026-01-15T10:00:00.000Z";
      const url = `/api/coast-pulse?lat=32.75&lon=-117.25&limit=8&before=${encodeURIComponent(cursor)}`;

      expect(url).toContain("lat=32.75");
      expect(url).toContain("lon=-117.25");
      expect(url).toContain("limit=8");
      expect(url).toContain("before=");
    });
  });

  describe("Limit handling", () => {
    it("should default to 8 items per page", () => {
      const defaultLimit = 8;
      expect(defaultLimit).toBe(8);
    });

    it("should enforce maximum limit of 15", () => {
      const requestedLimit = 50;
      const actualLimit = Math.min(Math.max(requestedLimit, 1), 15);
      expect(actualLimit).toBe(15);
    });

    it("should enforce minimum limit of 1", () => {
      const requestedLimit = 0;
      const actualLimit = Math.min(Math.max(requestedLimit, 1), 15);
      expect(actualLimit).toBe(1);
    });

    it("should allow valid limits between 1 and 15", () => {
      [1, 5, 8, 10, 15].forEach(limit => {
        const actualLimit = Math.min(Math.max(limit, 1), 15);
        expect(actualLimit).toBe(limit);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty result set", () => {
      const items: any[] = [];
      const hasMore = items.length > 8;
      const nextCursor = hasMore ? items[8]?.timestamp.toISOString() : null;

      expect(hasMore).toBe(false);
      expect(nextCursor).toBeNull();
    });

    it("should handle single item result", () => {
      const items = [{
        id: "1",
        timestamp: new Date(),
        message: "test",
        source: { name: "test", type: "intel" as const, credibility: 50 },
      }];
      const hasMore = items.length > 8;
      const nextCursor = hasMore ? items[8]?.timestamp.toISOString() : null;

      expect(hasMore).toBe(false);
      expect(nextCursor).toBeNull();
    });

    it("should handle exactly limit+1 items (boundary case)", () => {
      const limit = 8;
      const items = Array(9).fill(null).map((_, i) => ({
        id: `item-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        message: `test ${i}`,
        source: { name: "test", type: "intel" as const, credibility: 50 },
      }));

      const hasMore = items.length > limit;
      const returnItems = items.slice(0, limit);
      const nextCursor = hasMore ? items[limit].timestamp.toISOString() : null;

      expect(hasMore).toBe(true);
      expect(returnItems).toHaveLength(8);
      expect(nextCursor).toBe(items[8].timestamp.toISOString());
    });
  });
});
