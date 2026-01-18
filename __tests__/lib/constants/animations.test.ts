import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

describe("HOME_HEADER_MOTION", () => {
  describe("timeSlot", () => {
    it("has spring configuration for bouncy feel", () => {
      expect(HOME_HEADER_MOTION.timeSlot.spring).toEqual({
        stiffness: 400,
        damping: 17,
      });
    });

    it("has tap and selected variants", () => {
      expect(HOME_HEADER_MOTION.timeSlot.tap).toBeDefined();
      expect(HOME_HEADER_MOTION.timeSlot.selected).toBeDefined();
    });
  });

  describe("button", () => {
    it("has press animation with scale", () => {
      expect(HOME_HEADER_MOTION.button.tap.scale).toBeLessThan(1);
    });

    it("has hover animation", () => {
      expect(HOME_HEADER_MOTION.button.hover).toBeDefined();
    });
  });

  describe("hero", () => {
    it("has score glow animation", () => {
      expect(HOME_HEADER_MOTION.hero.scoreGlow).toBeDefined();
    });

    it("has badge stagger configuration", () => {
      expect(HOME_HEADER_MOTION.hero.badgeStagger.staggerChildren).toBeGreaterThan(0);
    });
  });

  describe("entry", () => {
    it("has staggered entry configuration", () => {
      expect(HOME_HEADER_MOTION.entry.staggerChildren).toBeGreaterThan(0);
    });
  });
});
