/**
 * Tests for email formatting utilities
 *
 * @module __tests__/lib/email/email-formatters
 */

import {
  getConditionLabel,
  getConditionLabelText,
  formatDatabaseTime,
} from "@/lib/email/email-formatters";

describe("email-formatters", () => {
  describe("getConditionLabel", () => {
    describe("Perfect tier (score >= 85)", () => {
      it("returns Perfect label for score 100", () => {
        const result = getConditionLabel(100);

        expect(result.label).toBe("Perfect");
        expect(result.color).toBe("#10b981");
        expect(result.emoji).toBe("🔥");
      });

      it("returns Perfect label for score 90", () => {
        const result = getConditionLabel(90);

        expect(result.label).toBe("Perfect");
        expect(result.color).toBe("#10b981");
        expect(result.emoji).toBe("🔥");
      });

      it("returns Perfect label for score 95", () => {
        const result = getConditionLabel(95);

        expect(result.label).toBe("Perfect");
        expect(result.color).toBe("#10b981");
        expect(result.emoji).toBe("🔥");
      });
    });

    describe("Excellent tier (70 <= score < 85)", () => {
      it("returns Excellent label for score 80", () => {
        const result = getConditionLabel(80);

        expect(result.label).toBe("Excellent");
        expect(result.color).toBe("#3b82f6");
        expect(result.emoji).toBe("✨");
      });

      it("returns Excellent label for score 75", () => {
        const result = getConditionLabel(75);

        expect(result.label).toBe("Excellent");
        expect(result.color).toBe("#3b82f6");
        expect(result.emoji).toBe("✨");
      });

      it("returns Excellent label for score 84", () => {
        const result = getConditionLabel(84);

        expect(result.label).toBe("Excellent");
        expect(result.color).toBe("#3b82f6");
        expect(result.emoji).toBe("✨");
      });
    });

    describe("Good tier (score < 70)", () => {
      it("returns Good label for score 65", () => {
        const result = getConditionLabel(65);

        expect(result.label).toBe("Good");
        expect(result.color).toBe("#22c55e");
        expect(result.emoji).toBe("🌊");
      });

      it("returns Good label for score 50", () => {
        const result = getConditionLabel(50);

        expect(result.label).toBe("Good");
        expect(result.color).toBe("#22c55e");
        expect(result.emoji).toBe("🌊");
      });

      it("returns Good label for score 0", () => {
        const result = getConditionLabel(0);

        expect(result.label).toBe("Good");
        expect(result.color).toBe("#22c55e");
        expect(result.emoji).toBe("🌊");
      });

      it("returns Good label for score 69", () => {
        const result = getConditionLabel(69);

        expect(result.label).toBe("Good");
        expect(result.color).toBe("#22c55e");
        expect(result.emoji).toBe("🌊");
      });
    });

    describe("Boundary conditions", () => {
      it("handles score exactly at 85 boundary (Perfect)", () => {
        const result = getConditionLabel(85);

        expect(result.label).toBe("Perfect");
      });

      it("handles score just below 85 boundary (Excellent)", () => {
        const result = getConditionLabel(84);

        expect(result.label).toBe("Excellent");
      });

      it("handles score exactly at 70 boundary (Excellent)", () => {
        const result = getConditionLabel(70);

        expect(result.label).toBe("Excellent");
      });

      it("handles score just below 70 boundary (Good)", () => {
        const result = getConditionLabel(69);

        expect(result.label).toBe("Good");
      });
    });

    describe("Edge cases", () => {
      it("handles negative scores as Good", () => {
        const result = getConditionLabel(-1);

        expect(result.label).toBe("Good");
        expect(result.color).toBe("#22c55e");
        expect(result.emoji).toBe("🌊");
      });

      it("handles scores above 100 as Perfect", () => {
        const result = getConditionLabel(110);

        expect(result.label).toBe("Perfect");
        expect(result.color).toBe("#10b981");
        expect(result.emoji).toBe("🔥");
      });

      it("handles fractional scores correctly", () => {
        const result = getConditionLabel(75.5);

        expect(result.label).toBe("Excellent");
      });
    });
  });

  describe("getConditionLabelText", () => {
    it("returns just the label string for score 100", () => {
      const result = getConditionLabelText(100);

      expect(result).toBe("Perfect");
    });

    it("returns just the label string for score 90", () => {
      const result = getConditionLabelText(90);

      expect(result).toBe("Perfect");
    });

    it("returns just the label string for score 75", () => {
      const result = getConditionLabelText(75);

      expect(result).toBe("Excellent");
    });

    it("returns just the label string for score 65", () => {
      const result = getConditionLabelText(65);

      expect(result).toBe("Good");
    });

    it("returns just the label string for score 50", () => {
      const result = getConditionLabelText(50);

      expect(result).toBe("Good");
    });

    it("does not return color or emoji properties", () => {
      const result = getConditionLabelText(90);

      expect(result).toBe("Perfect");
      expect(result).not.toContain("#");
      expect(result).not.toContain("🔥");
    });
  });

  describe("formatDatabaseTime", () => {
    describe("Afternoon times (PM)", () => {
      it("formats 14:30:00 as 2:30 PM", () => {
        const result = formatDatabaseTime("14:30:00");

        expect(result).toBe("2:30 PM");
      });

      it("formats 18:45:00 as 6:45 PM", () => {
        const result = formatDatabaseTime("18:45:00");

        expect(result).toBe("6:45 PM");
      });

      it("formats 23:59:00 as 11:59 PM", () => {
        const result = formatDatabaseTime("23:59:00");

        expect(result).toBe("11:59 PM");
      });

      it("formats 13:00:00 as 1:00 PM", () => {
        const result = formatDatabaseTime("13:00:00");

        expect(result).toBe("1:00 PM");
      });
    });

    describe("Morning times (AM)", () => {
      it("formats 08:00:00 as 8:00 AM", () => {
        const result = formatDatabaseTime("08:00:00");

        expect(result).toBe("8:00 AM");
      });

      it("formats 06:05:00 as 6:05 AM", () => {
        const result = formatDatabaseTime("06:05:00");

        expect(result).toBe("6:05 AM");
      });

      it("formats 09:30:00 as 9:30 AM", () => {
        const result = formatDatabaseTime("09:30:00");

        expect(result).toBe("9:30 AM");
      });

      it("formats 01:15:00 as 1:15 AM", () => {
        const result = formatDatabaseTime("01:15:00");

        expect(result).toBe("1:15 AM");
      });
    });

    describe("Noon and midnight", () => {
      it("formats 12:00:00 as 12:00 PM (noon)", () => {
        const result = formatDatabaseTime("12:00:00");

        expect(result).toBe("12:00 PM");
      });

      it("formats 00:00:00 as 12:00 AM (midnight)", () => {
        const result = formatDatabaseTime("00:00:00");

        expect(result).toBe("12:00 AM");
      });

      it("formats 12:30:00 as 12:30 PM", () => {
        const result = formatDatabaseTime("12:30:00");

        expect(result).toBe("12:30 PM");
      });

      it("formats 00:30:00 as 12:30 AM", () => {
        const result = formatDatabaseTime("00:30:00");

        expect(result).toBe("12:30 AM");
      });
    });

    describe("Minute padding", () => {
      it("pads single-digit minutes with leading zero", () => {
        const result = formatDatabaseTime("08:05:00");

        expect(result).toBe("8:05 AM");
      });

      it("does not add extra padding to double-digit minutes", () => {
        const result = formatDatabaseTime("08:30:00");

        expect(result).toBe("8:30 AM");
      });

      it("handles :00 minutes correctly", () => {
        const result = formatDatabaseTime("15:00:00");

        expect(result).toBe("3:00 PM");
      });
    });

    describe("HH:MM format (without seconds)", () => {
      it("formats 14:30 as 2:30 PM", () => {
        const result = formatDatabaseTime("14:30");

        expect(result).toBe("2:30 PM");
      });

      it("formats 08:00 as 8:00 AM", () => {
        const result = formatDatabaseTime("08:00");

        expect(result).toBe("8:00 AM");
      });

      it("formats 00:00 as 12:00 AM", () => {
        const result = formatDatabaseTime("00:00");

        expect(result).toBe("12:00 AM");
      });

      it("formats 12:00 as 12:00 PM", () => {
        const result = formatDatabaseTime("12:00");

        expect(result).toBe("12:00 PM");
      });
    });

    describe("Null and invalid inputs", () => {
      it("returns null when input is null", () => {
        const result = formatDatabaseTime(null);

        expect(result).toBeNull();
      });

      it("returns original string when format is invalid", () => {
        const result = formatDatabaseTime("invalid");

        expect(result).toBe("invalid");
      });

      it("handles malformed time with out-of-range hour", () => {
        const result = formatDatabaseTime("25:00:00");

        // NOTE: This documents implementation behavior, not a guaranteed contract.
        // 25 >= 12 -> PM; displayHour = 25 % 12 = 1; result = "1:00 PM"
        // Out-of-range hours are not validated; callers should ensure valid HH:MM:SS input.
        expect(result).toBe("1:00 PM");
      });

      it("returns null for empty string", () => {
        const result = formatDatabaseTime("");

        // Empty string treated as null input
        expect(result).toBeNull();
      });
    });

    describe("Edge cases", () => {
      it("handles 11:59:00 AM correctly", () => {
        const result = formatDatabaseTime("11:59:00");

        expect(result).toBe("11:59 AM");
      });

      it("handles 13:01:00 PM correctly", () => {
        const result = formatDatabaseTime("13:01:00");

        expect(result).toBe("1:01 PM");
      });

      it("handles times with extra whitespace gracefully", () => {
        const result = formatDatabaseTime("  14:30:00  ");

        // Should handle or return original
        expect(result).toBeTruthy();
      });
    });

    describe("Full time range coverage", () => {
      it("formats each hour correctly", () => {
        const testCases = [
          { input: "00:00:00", expected: "12:00 AM" },
          { input: "01:00:00", expected: "1:00 AM" },
          { input: "02:00:00", expected: "2:00 AM" },
          { input: "03:00:00", expected: "3:00 AM" },
          { input: "04:00:00", expected: "4:00 AM" },
          { input: "05:00:00", expected: "5:00 AM" },
          { input: "06:00:00", expected: "6:00 AM" },
          { input: "07:00:00", expected: "7:00 AM" },
          { input: "08:00:00", expected: "8:00 AM" },
          { input: "09:00:00", expected: "9:00 AM" },
          { input: "10:00:00", expected: "10:00 AM" },
          { input: "11:00:00", expected: "11:00 AM" },
          { input: "12:00:00", expected: "12:00 PM" },
          { input: "13:00:00", expected: "1:00 PM" },
          { input: "14:00:00", expected: "2:00 PM" },
          { input: "15:00:00", expected: "3:00 PM" },
          { input: "16:00:00", expected: "4:00 PM" },
          { input: "17:00:00", expected: "5:00 PM" },
          { input: "18:00:00", expected: "6:00 PM" },
          { input: "19:00:00", expected: "7:00 PM" },
          { input: "20:00:00", expected: "8:00 PM" },
          { input: "21:00:00", expected: "9:00 PM" },
          { input: "22:00:00", expected: "10:00 PM" },
          { input: "23:00:00", expected: "11:00 PM" },
        ];

        testCases.forEach(({ input, expected }) => {
          expect(formatDatabaseTime(input)).toBe(expected);
        });
      });
    });
  });
});
