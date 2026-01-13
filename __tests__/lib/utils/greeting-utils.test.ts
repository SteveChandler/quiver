/**
 * Tests for greeting utilities
 */

import {
  getTimeOfDay,
  getGreeting,
  getGreetingWithName,
  type TimeOfDay,
} from "@/lib/utils/greeting-utils";

describe("greeting-utils", () => {
  describe("getTimeOfDay", () => {
    it("should return 'morning' between 5am and 11:59am", () => {
      expect(getTimeOfDay(new Date("2024-01-15T05:00:00"))).toBe("morning");
      expect(getTimeOfDay(new Date("2024-01-15T08:00:00"))).toBe("morning");
      expect(getTimeOfDay(new Date("2024-01-15T11:59:59"))).toBe("morning");
    });

    it("should return 'afternoon' between 12pm and 4:59pm", () => {
      expect(getTimeOfDay(new Date("2024-01-15T12:00:00"))).toBe("afternoon");
      expect(getTimeOfDay(new Date("2024-01-15T14:30:00"))).toBe("afternoon");
      expect(getTimeOfDay(new Date("2024-01-15T16:59:59"))).toBe("afternoon");
    });

    it("should return 'evening' between 5pm and 4:59am", () => {
      expect(getTimeOfDay(new Date("2024-01-15T17:00:00"))).toBe("evening");
      expect(getTimeOfDay(new Date("2024-01-15T20:00:00"))).toBe("evening");
      expect(getTimeOfDay(new Date("2024-01-15T23:59:59"))).toBe("evening");
      expect(getTimeOfDay(new Date("2024-01-15T00:00:00"))).toBe("evening");
      expect(getTimeOfDay(new Date("2024-01-15T04:59:59"))).toBe("evening");
    });

    it("should use current time when no date provided", () => {
      const result = getTimeOfDay();
      expect(["morning", "afternoon", "evening"]).toContain(result);
    });
  });

  describe("getGreeting", () => {
    it("should return correct greeting for each time of day", () => {
      expect(getGreeting("morning")).toBe("Good morning");
      expect(getGreeting("afternoon")).toBe("Good afternoon");
      expect(getGreeting("evening")).toBe("Good evening");
    });
  });

  describe("getGreetingWithName", () => {
    it("should include user name when provided", () => {
      const greeting = getGreetingWithName("John", "morning");
      expect(greeting).toBe("Good morning, John.");
    });

    it("should use 'Surfer' when user name is null", () => {
      const greeting = getGreetingWithName(null, "afternoon");
      expect(greeting).toBe("Good afternoon, Surfer.");
    });

    it("should detect time of day automatically when not provided", () => {
      const greeting = getGreetingWithName("Jane");
      expect(greeting).toMatch(/^Good (morning|afternoon|evening), Jane\.$/);
    });

    it("should treat empty string as null and use 'Surfer'", () => {
      const greeting = getGreetingWithName("", "evening");
      // Empty string is falsy, so it falls back to "Surfer"
      expect(greeting).toBe("Good evening, Surfer.");
    });
  });
});
