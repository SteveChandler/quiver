// __tests__/lib/validation/intel-vote-schema.test.ts
//
// Tests for IntelVoteSchema and IntelReportSchemaV2 from lib/validation/schemas.ts
// Validates the Zod schemas used in the 3-way intel voting and reporting system.

import {
  IntelVoteSchema,
  IntelReportSchemaV2,
  INTEL_REPORT_REASONS,
} from "@/lib/validation/schemas";

// =============================================================================
// IntelVoteSchema
// =============================================================================

describe("IntelVoteSchema", () => {
  describe("Valid vote types", () => {
    test("accepts 'helpful'", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: "helpful" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vote_type).toBe("helpful");
      }
    });

    test("accepts 'off'", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: "off" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vote_type).toBe("off");
      }
    });

    test("accepts 'confirmed'", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: "confirmed" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vote_type).toBe("confirmed");
      }
    });
  });

  describe("Invalid vote types", () => {
    test("rejects an unknown string value", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: "invalid_type" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Invalid vote type");
      }
    });

    test("rejects an empty string", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Invalid vote type");
      }
    });

    test("rejects when vote_type is missing entirely", () => {
      const result = IntelVoteSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    test("rejects a numeric value", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: 1 });
      expect(result.success).toBe(false);
    });

    test("rejects null", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: null });
      expect(result.success).toBe(false);
    });

    test("rejects case-variant strings (enum is case-sensitive)", () => {
      const result = IntelVoteSchema.safeParse({ vote_type: "Helpful" });
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// IntelReportSchemaV2
// =============================================================================

describe("IntelReportSchemaV2", () => {
  describe("Valid reason types", () => {
    test.each(INTEL_REPORT_REASONS)(
      "accepts reason '%s'",
      (reason) => {
        const result = IntelReportSchemaV2.safeParse({ reason });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.reason).toBe(reason);
        }
      }
    );

    test("accepts reason with optional details", () => {
      const result = IntelReportSchemaV2.safeParse({
        reason: "spam",
        details: "This post is clearly spam advertising a product.",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reason).toBe("spam");
        expect(result.data.details).toBe(
          "This post is clearly spam advertising a product."
        );
      }
    });

    test("accepts reason without details", () => {
      const result = IntelReportSchemaV2.safeParse({ reason: "dangerous" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.details).toBeUndefined();
      }
    });

    test("accepts reason with details set to undefined explicitly", () => {
      const result = IntelReportSchemaV2.safeParse({
        reason: "other",
        details: undefined,
      });
      expect(result.success).toBe(true);
    });

    test("trims leading/trailing whitespace from details", () => {
      const result = IntelReportSchemaV2.safeParse({
        reason: "false_info",
        details: "  Some context here.  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.details).toBe("Some context here.");
      }
    });
  });

  describe("Invalid reason types", () => {
    test("rejects an unknown reason string", () => {
      const result = IntelReportSchemaV2.safeParse({ reason: "bad_vibes" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Please select a report reason"
        );
      }
    });

    test("rejects an empty reason string", () => {
      const result = IntelReportSchemaV2.safeParse({ reason: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Please select a report reason"
        );
      }
    });

    test("rejects missing reason field", () => {
      const result = IntelReportSchemaV2.safeParse({});
      expect(result.success).toBe(false);
    });

    test("rejects numeric reason", () => {
      const result = IntelReportSchemaV2.safeParse({ reason: 42 });
      expect(result.success).toBe(false);
    });
  });

  describe("Details field validation", () => {
    test("rejects details that exceed 500 characters", () => {
      const tooLong = "a".repeat(501);
      const result = IntelReportSchemaV2.safeParse({
        reason: "spam",
        details: tooLong,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const detailsIssue = result.error.issues.find((i) =>
          i.path.includes("details")
        );
        expect(detailsIssue).toBeDefined();
      }
    });

    test("accepts details at exactly 500 characters", () => {
      const exactly500 = "b".repeat(500);
      const result = IntelReportSchemaV2.safeParse({
        reason: "harassment",
        details: exactly500,
      });
      expect(result.success).toBe(true);
    });

    test("accepts empty string for details (treated as optional)", () => {
      // Empty string is technically valid (not undefined, but zero-length after trim)
      const result = IntelReportSchemaV2.safeParse({
        reason: "other",
        details: "",
      });
      // Zod .optional() allows empty string to pass max(500).trim()
      expect(result.success).toBe(true);
    });
  });

  describe("INTEL_REPORT_REASONS constant", () => {
    test("contains exactly 5 reason values", () => {
      expect(INTEL_REPORT_REASONS).toHaveLength(5);
    });

    test("contains all expected reason strings", () => {
      expect(INTEL_REPORT_REASONS).toContain("spam");
      expect(INTEL_REPORT_REASONS).toContain("harassment");
      expect(INTEL_REPORT_REASONS).toContain("dangerous");
      expect(INTEL_REPORT_REASONS).toContain("false_info");
      expect(INTEL_REPORT_REASONS).toContain("other");
    });
  });
});
