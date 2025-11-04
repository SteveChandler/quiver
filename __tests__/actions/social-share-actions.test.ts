/**
 * Unit tests for social-share-actions.ts
 * Tests the fixes for Instagram sharing errors (400 & 500 status codes)
 *
 * Focus: Variant normalization, platform support, URL generation
 */

import { describe, it, expect } from "@jest/globals";
import {
  generateShareUrl,
  generateShareImageUrl,
  type ShareVariantInput,
} from "@/actions/social-share-actions";
import type { SharePlatform, ShareVariant } from "@/types/session-share";

describe("social-share-actions - Instagram sharing fixes", () => {
  describe("normalizeVariant (implicit through functions)", () => {
    it("should handle numeric variants (1-6)", async () => {
      const url = await generateShareUrl({
        sessionId: "test-session-id",
        platform: "instagram",
        variant: 3 as ShareVariant,
      });

      expect(url).toContain("utm_content=3");
    });

    it("should convert legacy 'story' variant to numeric 1", async () => {
      const url = await generateShareUrl({
        sessionId: "test-session-id",
        platform: "instagram",
        variant: "story" as ShareVariantInput,
      });

      expect(url).toContain("utm_content=1");
    });

    it("should convert legacy 'square' variant to numeric 2", async () => {
      const url = await generateShareUrl({
        sessionId: "test-session-id",
        platform: "instagram",
        variant: "square" as ShareVariantInput,
      });

      expect(url).toContain("utm_content=2");
    });

    it("should default to variant 1 when not specified", async () => {
      const url = await generateShareUrl({
        sessionId: "test-session-id",
        platform: "instagram",
      });

      expect(url).toContain("utm_content=1");
    });
  });

  describe("generateShareUrl", () => {
    it("should generate URL with all UTM parameters", async () => {
      const url = await generateShareUrl({
        sessionId: "abc123",
        platform: "instagram",
        variant: 2,
      });

      expect(url).toContain("/sessions/abc123");
      expect(url).toContain("utm_source=instagram");
      expect(url).toContain("utm_medium=social");
      expect(url).toContain("utm_campaign=session_share");
      expect(url).toContain("utm_content=2");
    });

    it("should support all platform types", async () => {
      const platforms: SharePlatform[] = [
        "instagram",
        "x",
        "twitter",
        "facebook",
        "tiktok",
        "copy",
        "native",
        "other",
        "generic",
        "download",
      ];

      for (const platform of platforms) {
        const url = await generateShareUrl({
          sessionId: "test-id",
          platform,
          variant: 1,
        });

        expect(url).toContain(`utm_source=${platform}`);
      }
    });

    it("should use NEXT_PUBLIC_SITE_URL when available", async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com";

      const url = await generateShareUrl({
        sessionId: "test-id",
        platform: "instagram",
        variant: 1,
      });

      expect(url).toContain("https://test.example.com/sessions/test-id");

      // Restore original value
      process.env.NEXT_PUBLIC_SITE_URL = originalUrl;
    });
  });

  describe("generateShareImageUrl", () => {
    const originalSecret = process.env.SOCIAL_SHARE_SECRET;

    beforeEach(() => {
      process.env.SOCIAL_SHARE_SECRET = "test-secret-key";
    });

    afterEach(() => {
      process.env.SOCIAL_SHARE_SECRET = originalSecret;
    });

    it("should throw error when SOCIAL_SHARE_SECRET is not configured", async () => {
      delete process.env.SOCIAL_SHARE_SECRET;

      await expect(
        generateShareImageUrl("test-session-id", 1)
      ).rejects.toThrow("SOCIAL_SHARE_SECRET not configured");
    });

    it("should generate signed URL with variant parameter", async () => {
      const url = await generateShareImageUrl("test-session-id", 3);

      expect(url).toContain("sessionId=test-session-id");
      expect(url).toContain("variant=3");
      expect(url).toContain("t="); // Signature present
    });

    it("should normalize legacy variant to numeric", async () => {
      const url = await generateShareImageUrl(
        "test-session-id",
        "story" as ShareVariantInput
      );

      expect(url).toContain("variant=1");
    });

    it("should include aspect ratio when provided", async () => {
      const url = await generateShareImageUrl("test-session-id", 1, "9:16");

      expect(url).toContain("ratio=9%3A16"); // URL encoded
    });

    it("should generate different signatures for different inputs", async () => {
      const url1 = await generateShareImageUrl("session-1", 1);
      const url2 = await generateShareImageUrl("session-2", 1);

      const sig1 = new URL(url1).searchParams.get("t");
      const sig2 = new URL(url2).searchParams.get("t");

      expect(sig1).not.toBe(sig2);
    });

    it("should include aspect ratio in signature", async () => {
      const url1 = await generateShareImageUrl("session-1", 1, "9:16");
      const url2 = await generateShareImageUrl("session-1", 1, "1:1");

      const sig1 = new URL(url1).searchParams.get("t");
      const sig2 = new URL(url2).searchParams.get("t");

      expect(sig1).not.toBe(sig2);
    });
  });


  describe("Platform Type Safety", () => {
    it("should accept all valid platform values", async () => {
      const validPlatforms: SharePlatform[] = [
        "instagram",
        "x",
        "twitter",
        "facebook",
        "tiktok",
        "copy",
        "native",
        "other",
        "generic",
        "download",
      ];

      for (const platform of validPlatforms) {
        const url = await generateShareUrl({
          sessionId: "test-id",
          platform,
        });
        expect(url).toBeTruthy();
      }
    });

    it("should accept all valid variant values", async () => {
      const validVariants: ShareVariant[] = [1, 2, 3, 4, 5, 6];

      for (const variant of validVariants) {
        const url = await generateShareUrl({
          sessionId: "test-id",
          platform: "instagram",
          variant,
        });
        expect(url).toContain(`utm_content=${variant}`);
      }
    });
  });
});
