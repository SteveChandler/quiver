import {
  getBestTimeSeoScene,
  getBestTimeSessionSeoScene,
} from "@/lib/constants/seo-scenes";

describe("seo-scenes", () => {
  describe("getBestTimeSeoScene", () => {
    it("returns approved hero scenes for best-time city pages", () => {
      expect(getBestTimeSeoScene("santa-cruz")?.imageSrc).toBe(
        "/images/seo-scenes/santa-cruz-steamer-lane.webp"
      );
      expect(getBestTimeSeoScene("cocoa-beach")?.imageSrc).toBe(
        "/images/seo-scenes/cocoa-beach-pier.webp"
      );
      expect(getBestTimeSeoScene("westport")?.imageSrc).toBe(
        "/images/seo-scenes/westport-jetty.webp"
      );
      expect(getBestTimeSeoScene("rincon")?.imageSrc).toBe(
        "/images/seo-scenes/rincon-domes.webp"
      );
      expect(getBestTimeSeoScene("pacifica")?.imageSrc).toBe(
        "/images/seo-scenes/pacifica-linda-mar.webp"
      );
      expect(getBestTimeSeoScene("san-onofre")?.imageSrc).toBe(
        "/images/seo-scenes/san-onofre-clean.webp"
      );
    });

    it("leaves Malibu unmapped until a replacement scene is approved", () => {
      expect(getBestTimeSeoScene("malibu")).toBeNull();
    });
  });

  describe("getBestTimeSessionSeoScene", () => {
    it("uses a distinct Maria's scene for the Rincon session section", () => {
      const heroScene = getBestTimeSeoScene("rincon");
      const sessionScene = getBestTimeSessionSeoScene("rincon");

      expect(sessionScene?.imageSrc).toBe("/images/seo-scenes/rincon-marias.webp");
      expect(sessionScene?.imageSrc).not.toBe(heroScene?.imageSrc);
    });

    it("does not invent session scenes for cities without approved second images", () => {
      expect(getBestTimeSessionSeoScene("cocoa-beach")).toBeNull();
      expect(getBestTimeSessionSeoScene("westport")).toBeNull();
      expect(getBestTimeSessionSeoScene("pacifica")).toBeNull();
    });
  });
});
