/**
 * Tests for email formatting utilities
 *
 * @module __tests__/lib/email/email-formatters
 */

import {
  getConditionLabel,
  getConditionLabelText,
  formatDatabaseTime,
  formatActionableBestWindow,
} from "@/lib/email/email-formatters";

describe("email-formatters", () => {
  describe("getConditionLabel", () => {
    describe("EPIC tier (score >= 80)", () => {
      it("returns EPIC label for score 100", () => {
        const result = getConditionLabel(100);

        expect(result.label).toBe("EPIC");
        expect(result.color).toBe("#00D4AA");
      });

      it("returns EPIC label at the 80 boundary", () => {
        expect(getConditionLabel(80).label).toBe("EPIC");
      });

      it("treats scores above 100 as EPIC", () => {
        const result = getConditionLabel(110);

        expect(result.label).toBe("EPIC");
        expect(result.color).toBe("#00D4AA");
      });
    });

    describe("GOOD tier (70 <= score < 80)", () => {
      it("returns GOOD label for score 75", () => {
        const result = getConditionLabel(75);

        expect(result.label).toBe("GOOD");
        expect(result.color).toBe("#1D9E75");
      });

      it("returns GOOD label at the 70 boundary", () => {
        expect(getConditionLabel(70).label).toBe("GOOD");
      });

      it("returns GOOD label just below 80", () => {
        expect(getConditionLabel(79).label).toBe("GOOD");
      });
    });

    describe("FAIR tier (55 <= score < 70)", () => {
      it("returns FAIR label for score 60", () => {
        const result = getConditionLabel(60);

        expect(result.label).toBe("FAIR");
        expect(result.color).toBe("#FDB84B");
      });

      it("returns FAIR label at the 55 boundary", () => {
        expect(getConditionLabel(55).label).toBe("FAIR");
      });

      it("returns FAIR label just below 70", () => {
        expect(getConditionLabel(69).label).toBe("FAIR");
      });
    });

    describe("RIDEABLE tier (40 <= score < 55)", () => {
      it("returns RIDEABLE label for score 45", () => {
        const result = getConditionLabel(45);

        expect(result.label).toBe("RIDEABLE");
        expect(result.color).toBe("#888780");
      });

      it("returns RIDEABLE label at the 40 boundary", () => {
        expect(getConditionLabel(40).label).toBe("RIDEABLE");
      });
    });

    describe("MEH tier (score < 40)", () => {
      it("returns MEH label for score 30", () => {
        const result = getConditionLabel(30);

        expect(result.label).toBe("MEH");
        expect(result.color).toBe("#5F5E5A");
      });

      it("returns MEH label for score 0", () => {
        expect(getConditionLabel(0).label).toBe("MEH");
      });

      it("treats negative scores as MEH", () => {
        expect(getConditionLabel(-1).label).toBe("MEH");
      });
    });

    describe("Brand voice", () => {
      it("uses brand-vocabulary labels in descending order with no emoji", () => {
        const labels = [100, 79, 60, 45, 10].map(
          (score) => getConditionLabel(score).label
        );

        expect(labels).toEqual(["EPIC", "GOOD", "FAIR", "RIDEABLE", "MEH"]);
        for (const label of labels) {
          expect(label).toMatch(/^[A-Z]+$/);
        }
      });
    });

    describe("Fractional scores", () => {
      it("handles fractional scores at the EPIC boundary", () => {
        expect(getConditionLabel(79.9).label).toBe("GOOD");
        expect(getConditionLabel(80.1).label).toBe("EPIC");
      });
    });
  });

  describe("getConditionLabelText", () => {
    it("returns just the label string for score 100", () => {
      expect(getConditionLabelText(100)).toBe("EPIC");
    });

    it("returns just the label string for score 75", () => {
      expect(getConditionLabelText(75)).toBe("GOOD");
    });

    it("returns just the label string for score 60", () => {
      expect(getConditionLabelText(60)).toBe("FAIR");
    });

    it("returns just the label string for score 30", () => {
      expect(getConditionLabelText(30)).toBe("MEH");
    });

    it("does not return color or emoji characters", () => {
      const result = getConditionLabelText(90);

      expect(result).toBe("EPIC");
      expect(result).not.toContain("#");
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

        expect(result).toBe("2:30 PM");
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

  describe("formatActionableBestWindow", () => {
    it("formats normal morning best windows", () => {
      expect(formatActionableBestWindow("06:00:00", "09:00:00")).toEqual({
        start: "6:00 AM",
        end: "9:00 AM",
      });
    });

    it("suppresses overnight stored best windows", () => {
      expect(formatActionableBestWindow("02:00:00", "04:00:00")).toBeNull();
    });
  });
});
