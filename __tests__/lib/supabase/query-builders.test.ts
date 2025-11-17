/**
 * Unit tests for Supabase query builder utilities
 *
 * Purpose: Verify the withApprovedPhotos() and withNonDeleted() query builder
 * utilities correctly apply filters for beach photo access patterns.
 *
 * These utilities are critical for security as they enforce:
 * - Approved photos only (unless explicitly disabled)
 * - Non-deleted photos only (unless explicitly included)
 * - Consistent filtering across all beach photo queries
 *
 * @jest-environment node
 */

describe("Query Builder Utilities", () => {
  // Mock PostgrestFilterBuilder to test query modifications
  class MockQueryBuilder {
    private filters: Array<{ method: string; args: any[] }> = [];

    eq(column: string, value: any): this {
      this.filters.push({ method: "eq", args: [column, value] });
      return this;
    }

    is(column: string, value: any): this {
      this.filters.push({ method: "is", args: [column, value] });
      return this;
    }

    getFilters() {
      return this.filters;
    }

    hasFilter(method: string, column: string, value?: any): boolean {
      return this.filters.some(
        (f) =>
          f.method === method &&
          f.args[0] === column &&
          (value === undefined || f.args[1] === value)
      );
    }
  }

  // Import the functions to test
  // Note: We need to re-import for each test to ensure isolation
  let withApprovedPhotos: any;
  let withNonDeleted: any;

  beforeEach(() => {
    // Clear module cache to ensure fresh imports
    jest.resetModules();

    // Import the query builder functions
    const queryBuilders = require("@/lib/supabase/query-builders");
    withApprovedPhotos = queryBuilders.withApprovedPhotos;
    withNonDeleted = queryBuilders.withNonDeleted;
  });

  describe("withApprovedPhotos", () => {
    describe("Default Behavior", () => {
      it("should apply both approved=true and deleted_at=null filters by default", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery);

        expect(result).toBe(mockQuery); // Should return same instance
        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });

      it("should maintain query chain integrity", () => {
        const mockQuery = new MockQueryBuilder();

        // Add filter before applying withApprovedPhotos
        mockQuery.eq("beach_id", "test-beach-id");

        const result = withApprovedPhotos(mockQuery);

        const filters = mockQuery.getFilters();
        expect(filters).toHaveLength(3);
        expect(filters[0]).toEqual({ method: "eq", args: ["beach_id", "test-beach-id"] });
        expect(filters[1]).toEqual({ method: "eq", args: ["approved", true] });
        expect(filters[2]).toEqual({ method: "is", args: ["deleted_at", null] });
      });
    });

    describe("includeDeleted Option", () => {
      it("should include deleted photos when includeDeleted=true", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, { includeDeleted: true });

        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at")).toBe(false);
      });

      it("should exclude deleted photos when includeDeleted=false", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, { includeDeleted: false });

        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });

    describe("approvedOnly Option", () => {
      it("should filter for approved photos when approvedOnly=true", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, { approvedOnly: true });

        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });

      it("should include unapproved photos when approvedOnly=false", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, { approvedOnly: false });

        expect(mockQuery.hasFilter("eq", "approved")).toBe(false);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });

    describe("Combined Options", () => {
      it("should handle both options together: includeDeleted=true, approvedOnly=false", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, {
          includeDeleted: true,
          approvedOnly: false,
        });

        expect(mockQuery.hasFilter("eq", "approved")).toBe(false);
        expect(mockQuery.hasFilter("is", "deleted_at")).toBe(false);
        expect(mockQuery.getFilters()).toHaveLength(0);
      });

      it("should handle both options together: includeDeleted=true, approvedOnly=true", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, {
          includeDeleted: true,
          approvedOnly: true,
        });

        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at")).toBe(false);
      });

      it("should handle both options together: includeDeleted=false, approvedOnly=false", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, {
          includeDeleted: false,
          approvedOnly: false,
        });

        expect(mockQuery.hasFilter("eq", "approved")).toBe(false);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });

      it("should handle both options together: includeDeleted=false, approvedOnly=true (default)", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, {
          includeDeleted: false,
          approvedOnly: true,
        });

        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });

    describe("Empty Options Object", () => {
      it("should use default behavior with empty options object", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, {});

        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });

    describe("Type Safety", () => {
      it("should return the same query builder type", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery);

        expect(result).toBe(mockQuery);
        expect(result).toBeInstanceOf(MockQueryBuilder);
      });

      it("should allow chaining additional methods after withApprovedPhotos", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery);

        // Should be able to chain more filters
        result.eq("test_column", "test_value");

        expect(mockQuery.getFilters()).toHaveLength(3);
        expect(mockQuery.hasFilter("eq", "test_column", "test_value")).toBe(true);
      });
    });
  });

  describe("withNonDeleted", () => {
    describe("Basic Functionality", () => {
      it("should add deleted_at IS NULL filter", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withNonDeleted(mockQuery);

        expect(result).toBe(mockQuery);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
        expect(mockQuery.getFilters()).toHaveLength(1);
      });

      it("should maintain query chain integrity", () => {
        const mockQuery = new MockQueryBuilder();

        // Add filter before applying withNonDeleted
        mockQuery.eq("beach_id", "test-beach-id");

        const result = withNonDeleted(mockQuery);

        const filters = mockQuery.getFilters();
        expect(filters).toHaveLength(2);
        expect(filters[0]).toEqual({ method: "eq", args: ["beach_id", "test-beach-id"] });
        expect(filters[1]).toEqual({ method: "is", args: ["deleted_at", null] });
      });
    });

    describe("Type Safety", () => {
      it("should return the same query builder type", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withNonDeleted(mockQuery);

        expect(result).toBe(mockQuery);
        expect(result).toBeInstanceOf(MockQueryBuilder);
      });

      it("should allow chaining additional methods after withNonDeleted", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withNonDeleted(mockQuery);

        // Should be able to chain more filters
        result.eq("test_column", "test_value");

        expect(mockQuery.getFilters()).toHaveLength(2);
        expect(mockQuery.hasFilter("eq", "test_column", "test_value")).toBe(true);
      });
    });

    describe("Integration with withApprovedPhotos", () => {
      it("should work correctly when chained after withApprovedPhotos", () => {
        const mockQuery = new MockQueryBuilder();

        // This is a defensive pattern - double filtering for deleted_at
        const result = withNonDeleted(withApprovedPhotos(mockQuery));

        const filters = mockQuery.getFilters();
        expect(filters).toHaveLength(3);
        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);

        // Should have two deleted_at filters (redundant but safe)
        const deletedFilters = filters.filter(
          (f) => f.method === "is" && f.args[0] === "deleted_at"
        );
        expect(deletedFilters).toHaveLength(2);
      });

      it("should work correctly when applied to views", () => {
        const mockQuery = new MockQueryBuilder();

        // Simulate querying a view that should already exclude deleted
        // withNonDeleted provides defense-in-depth
        const result = withNonDeleted(mockQuery);

        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });
  });

  describe("Real-World Usage Patterns", () => {
    describe("Admin Views (Include Deleted)", () => {
      it("should support admin view pattern with all photos", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, {
          includeDeleted: true,
          approvedOnly: false,
        });

        // Admin should see everything
        expect(mockQuery.getFilters()).toHaveLength(0);
      });
    });

    describe("Moderation Views (Unapproved Only)", () => {
      it("should support moderation pattern with unapproved photos", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery, {
          approvedOnly: false,
          includeDeleted: false,
        });

        // Should exclude approved filter but keep deleted filter
        expect(mockQuery.hasFilter("eq", "approved")).toBe(false);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });

    describe("Public Views (Default)", () => {
      it("should support public view pattern with strict filtering", () => {
        const mockQuery = new MockQueryBuilder();
        const result = withApprovedPhotos(mockQuery);

        // Public should only see approved, non-deleted
        expect(mockQuery.hasFilter("eq", "approved", true)).toBe(true);
        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });

    describe("Featured Photos View (Defense-in-Depth)", () => {
      it("should support defense-in-depth pattern for views", () => {
        const mockQuery = new MockQueryBuilder();

        // Even though beach_photos_featured view already filters,
        // add explicit filter for data quality
        const result = withNonDeleted(mockQuery);

        expect(mockQuery.hasFilter("is", "deleted_at", null)).toBe(true);
      });
    });
  });
});
