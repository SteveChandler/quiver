import {
  getTransformedStorageUrl,
  getTransformedUrl,
  isTransformableStorageUrl,
  isSupabaseStorageUrl,
  getProxiedImageUrl,
  isExternalImageUrl,
  IMAGE_TRANSFORM_PRESETS,
  type ImageTransformPreset,
} from "@/lib/utils/image-utils";
import { getOptimizedImageUrl } from "@/lib/image-proxy";

describe("Image Transformation Utils", () => {
  const SUPABASE_CO_URL =
    "https://xyz.supabase.co/storage/v1/object/public/photos/beach.jpg";
  const SUPABASE_IN_URL =
    "https://xyz.supabase.in/storage/v1/object/public/photos/beach.jpg";
  const ALREADY_TRANSFORMED_URL =
    "https://xyz.supabase.co/storage/v1/render/image/public/photos/beach.jpg?width=300";
  const EXTERNAL_URL = "https://example.com/photo.jpg";
  const RELATIVE_URL = "/images/local.png";

  describe("isSupabaseStorageUrl", () => {
    it("should return true for .supabase.co storage URLs", () => {
      expect(isSupabaseStorageUrl(SUPABASE_CO_URL)).toBe(true);
    });

    it("should return true for .supabase.in storage URLs", () => {
      expect(isSupabaseStorageUrl(SUPABASE_IN_URL)).toBe(true);
    });

    it("should return false for non-Supabase URLs", () => {
      expect(isSupabaseStorageUrl(EXTERNAL_URL)).toBe(false);
    });

    it("should return false for relative URLs", () => {
      expect(isSupabaseStorageUrl(RELATIVE_URL)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isSupabaseStorageUrl(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSupabaseStorageUrl(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isSupabaseStorageUrl("")).toBe(false);
    });
  });

  describe("isTransformableStorageUrl", () => {
    it("should return true for transformable .supabase.co URLs", () => {
      expect(isTransformableStorageUrl(SUPABASE_CO_URL)).toBe(true);
    });

    it("should return true for transformable .supabase.in URLs", () => {
      expect(isTransformableStorageUrl(SUPABASE_IN_URL)).toBe(true);
    });

    it("should return false for already-transformed URLs", () => {
      expect(isTransformableStorageUrl(ALREADY_TRANSFORMED_URL)).toBe(false);
    });

    it("should return false for non-Supabase URLs", () => {
      expect(isTransformableStorageUrl(EXTERNAL_URL)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isTransformableStorageUrl(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isTransformableStorageUrl(undefined)).toBe(false);
    });
  });

  describe("getTransformedStorageUrl", () => {
    it("should transform .supabase.co storage URLs", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, {
        width: 300,
        height: 300,
      });
      expect(result).toContain("/storage/v1/render/image/");
      expect(result).toContain("width=300");
      expect(result).toContain("height=300");
      expect(result).not.toContain("/storage/v1/object/");
    });

    it("should transform .supabase.in storage URLs", () => {
      const result = getTransformedStorageUrl(SUPABASE_IN_URL, { width: 300 });
      expect(result).toContain("/storage/v1/render/image/");
      expect(result).toContain("width=300");
    });

    it("should not transform non-Supabase URLs", () => {
      const result = getTransformedStorageUrl(EXTERNAL_URL, { width: 300 });
      expect(result).toBe(EXTERNAL_URL);
    });

    it("should not transform already-transformed URLs", () => {
      const result = getTransformedStorageUrl(ALREADY_TRANSFORMED_URL, {
        width: 500,
      });
      expect(result).toBe(ALREADY_TRANSFORMED_URL);
    });

    it("should handle null gracefully", () => {
      expect(getTransformedStorageUrl(null)).toBe("");
    });

    it("should handle undefined gracefully", () => {
      expect(getTransformedStorageUrl(undefined)).toBe("");
    });

    it("should handle empty string gracefully", () => {
      expect(getTransformedStorageUrl("")).toBe("");
    });

    it("should handle whitespace-only string gracefully", () => {
      expect(getTransformedStorageUrl("   ")).toBe("");
    });

    it("should clamp width to Supabase limit (2500)", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, { width: 5000 });
      expect(result).toContain("width=2500");
      expect(result).not.toContain("width=5000");
    });

    it("should clamp height to Supabase limit (2500)", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, { height: 3000 });
      expect(result).toContain("height=2500");
      expect(result).not.toContain("height=3000");
    });

    it("should clamp quality to max 100", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, { quality: 150 });
      expect(result).toContain("quality=100");
      expect(result).not.toContain("quality=150");
    });

    it("should clamp quality to min 1", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, { quality: 0 });
      expect(result).toContain("quality=1");
      expect(result).not.toContain("quality=0");
    });

    it("should add resize parameter when valid", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, {
        resize: "cover",
      });
      expect(result).toContain("resize=cover");
    });

    it("should add contain resize mode", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, {
        resize: "contain",
      });
      expect(result).toContain("resize=contain");
    });

    it("should add fill resize mode", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, {
        resize: "fill",
      });
      expect(result).toContain("resize=fill");
    });

    it("should add format parameter when valid", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, {
        format: "origin",
      });
      expect(result).toContain("format=origin");
    });

    it("should combine multiple parameters", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, {
        width: 300,
        height: 200,
        quality: 80,
        resize: "cover",
      });
      expect(result).toContain("width=300");
      expect(result).toContain("height=200");
      expect(result).toContain("quality=80");
      expect(result).toContain("resize=cover");
    });

    it("should preserve the original path after transformation", () => {
      const result = getTransformedStorageUrl(SUPABASE_CO_URL, { width: 300 });
      expect(result).toContain("photos/beach.jpg");
    });
  });

  describe("getTransformedUrl (presets)", () => {
    it("should apply thumbnail preset", () => {
      const result = getTransformedUrl(SUPABASE_CO_URL, "thumbnail");
      expect(result).toContain("width=80");
      expect(result).toContain("height=80");
      expect(result).toContain("quality=70");
      expect(result).toContain("resize=cover");
    });

    it("should apply avatar preset", () => {
      const result = getTransformedUrl(SUPABASE_CO_URL, "avatar");
      expect(result).toContain("width=96");
      expect(result).toContain("height=96");
      expect(result).toContain("quality=80");
    });

    it("should apply avatarLarge preset", () => {
      const result = getTransformedUrl(SUPABASE_CO_URL, "avatarLarge");
      expect(result).toContain("width=200");
      expect(result).toContain("height=200");
      expect(result).toContain("quality=85");
    });

    it("should apply sessionCard preset", () => {
      const result = getTransformedUrl(SUPABASE_CO_URL, "sessionCard");
      expect(result).toContain("width=300");
      expect(result).toContain("height=300");
      expect(result).toContain("quality=80");
    });

    it("should apply galleryPreview preset", () => {
      const result = getTransformedUrl(SUPABASE_CO_URL, "galleryPreview");
      expect(result).toContain("width=600");
      expect(result).toContain("height=600");
      expect(result).toContain("quality=85");
    });

    it("should apply fullWidth preset (width only)", () => {
      const result = getTransformedUrl(SUPABASE_CO_URL, "fullWidth");
      expect(result).toContain("width=1200");
      expect(result).toContain("quality=90");
      expect(result).not.toContain("height=");
    });

    it("should apply intelPost preset", () => {
      const result = getTransformedUrl(SUPABASE_CO_URL, "intelPost");
      expect(result).toContain("width=800");
      expect(result).toContain("height=600");
      expect(result).toContain("quality=85");
    });

    it("should return original URL for non-Supabase URLs", () => {
      const result = getTransformedUrl(EXTERNAL_URL, "thumbnail");
      expect(result).toBe(EXTERNAL_URL);
    });

    it("should handle null gracefully", () => {
      expect(getTransformedUrl(null, "thumbnail")).toBe("");
    });

    it("should handle undefined gracefully", () => {
      expect(getTransformedUrl(undefined, "avatar")).toBe("");
    });
  });

  describe("IMAGE_TRANSFORM_PRESETS", () => {
    it("should have all expected presets", () => {
      const expectedPresets: ImageTransformPreset[] = [
        "thumbnail",
        "thumbnailMedium",
        "avatar",
        "avatarLarge",
        "sessionCard",
        "galleryPreview",
        "fullWidth",
        "intelPost",
      ];
      expectedPresets.forEach((preset) => {
        expect(IMAGE_TRANSFORM_PRESETS).toHaveProperty(preset);
      });
    });

    it("should have valid width/height values within Supabase limits", () => {
      const widthsAreValid = Object.values(IMAGE_TRANSFORM_PRESETS).every(
        (preset) => preset.width > 0 && preset.width <= 2500
      );
      const heightsAreValid = Object.values(IMAGE_TRANSFORM_PRESETS).every(
        (preset) =>
          !("height" in preset) ||
          preset.height === undefined ||
          (preset.height > 0 && preset.height <= 2500)
      );

      expect(widthsAreValid).toBe(true);
      expect(heightsAreValid).toBe(true);
    });

    it("should have valid quality values (1-100)", () => {
      const qualitiesAreValid = Object.values(IMAGE_TRANSFORM_PRESETS).every(
        (preset) => preset.quality >= 1 && preset.quality <= 100
      );

      expect(qualitiesAreValid).toBe(true);
    });
  });
});

describe("Image Proxy Utils", () => {
  const SUPABASE_URL =
    "https://xyz.supabase.co/storage/v1/object/public/photos/beach.jpg";
  const SUPABASE_IN_URL =
    "https://xyz.supabase.in/storage/v1/object/public/photos/beach.jpg";
  const EXTERNAL_URL = "https://api.openverse.org/v1/images/abc123";
  const RELATIVE_URL = "/images/local.png";

  describe("getProxiedImageUrl", () => {
    it("should not proxy Supabase .co storage URLs", () => {
      const result = getProxiedImageUrl(SUPABASE_URL);
      expect(result).toBe(SUPABASE_URL);
      expect(result).not.toContain("/api/image-proxy");
    });

    it.each([
      "https://storage.hdontap.com/wowza_stream_thumbnails/snapshot.stream",
      "https://img.youtube.com/vi/abc123/mqdefault.jpg",
      "https://camstills.cdn-surfline.com/some-cam/latest_small.jpg",
    ])(
      "should not proxy cam-thumbnail hosts served by next/image remotePatterns (%s)",
      (url) => {
        const result = getProxiedImageUrl(url);
        expect(result).toBe(url);
        expect(result).not.toContain("/api/image-proxy");
      },
    );

    it("should not proxy Supabase .in storage URLs", () => {
      const result = getProxiedImageUrl(SUPABASE_IN_URL);
      expect(result).toBe(SUPABASE_IN_URL);
      expect(result).not.toContain("/api/image-proxy");
    });

    it("should proxy external URLs", () => {
      const result = getProxiedImageUrl(EXTERNAL_URL);
      expect(result).toContain("/api/image-proxy?url=");
      expect(result).toContain(encodeURIComponent(EXTERNAL_URL));
    });

    it("should not proxy relative URLs", () => {
      const result = getProxiedImageUrl(RELATIVE_URL);
      expect(result).toBe(RELATIVE_URL);
    });

    it("should handle null gracefully", () => {
      expect(getProxiedImageUrl(null)).toBe("");
    });

    it("should handle undefined gracefully", () => {
      expect(getProxiedImageUrl(undefined)).toBe("");
    });

    it("should handle empty string gracefully", () => {
      expect(getProxiedImageUrl("")).toBe("");
    });

    it("should clean Openverse thumbnail URLs with format=json", () => {
      const openverseUrl =
        "https://api.openverse.org/v1/images/abc123/thumb/?format=json";
      const result = getProxiedImageUrl(openverseUrl);
      // Should proxy but without format=json
      expect(result).toContain("/api/image-proxy");
      expect(result).not.toContain("format%3Djson");
    });

    it("should not re-proxy image proxy URLs", () => {
      const proxiedUrl =
        "/api/image-proxy?url=https%3A%2F%2Fapi.openverse.org%2Fv1%2Fimages%2Fabc123%2Fthumb%2F";

      expect(getProxiedImageUrl(proxiedUrl)).toBe(proxiedUrl);
      expect(getOptimizedImageUrl(proxiedUrl)).toBe(proxiedUrl);
    });
  });

  describe("isExternalImageUrl", () => {
    it("should return true for external URLs", () => {
      expect(isExternalImageUrl(EXTERNAL_URL)).toBe(true);
    });

    it("should return false for Supabase .co URLs", () => {
      expect(isExternalImageUrl(SUPABASE_URL)).toBe(false);
    });

    it("should return false for Supabase .in URLs", () => {
      expect(isExternalImageUrl(SUPABASE_IN_URL)).toBe(false);
    });

    it("should return false for relative URLs", () => {
      expect(isExternalImageUrl(RELATIVE_URL)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isExternalImageUrl(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isExternalImageUrl(undefined)).toBe(false);
    });
  });
});
