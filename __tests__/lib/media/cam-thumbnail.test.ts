import {
  getCamThumbnailUrl,
  getDisplayCamThumbnailUrl,
  getYouTubeVideoId,
  getYouTubeWatchUrl,
  isYouTubeCameraUrl,
} from "@/lib/media/cam-thumbnail";

describe("getCamThumbnailUrl", () => {
  // --- Null / undefined / empty ---
  it("returns null for null", () => {
    expect(getCamThumbnailUrl(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(getCamThumbnailUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getCamThumbnailUrl("")).toBeNull();
  });

  // --- YouTube watch URLs ---
  it("extracts thumbnail from youtube.com/watch URL", () => {
    expect(getCamThumbnailUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://img.youtube.com/vi/abc123/mqdefault.jpg"
    );
  });

  it("extracts thumbnail from youtube.com/watch with extra params", () => {
    expect(
      getCamThumbnailUrl("https://www.youtube.com/watch?v=xyz789&list=PLfoo")
    ).toBe("https://img.youtube.com/vi/xyz789/mqdefault.jpg");
  });

  // --- YouTube short URLs ---
  it("extracts thumbnail from youtu.be short URL", () => {
    expect(getCamThumbnailUrl("https://youtu.be/abc123")).toBe(
      "https://img.youtube.com/vi/abc123/mqdefault.jpg"
    );
  });

  it("extracts thumbnail from youtu.be short URL with query params", () => {
    expect(getCamThumbnailUrl("https://youtu.be/abc123?t=30")).toBe(
      "https://img.youtube.com/vi/abc123/mqdefault.jpg"
    );
  });

  // --- YouTube live URLs ---
  it("extracts thumbnail from youtube.com/live URL", () => {
    expect(getCamThumbnailUrl("https://www.youtube.com/live/def456")).toBe(
      "https://img.youtube.com/vi/def456/mqdefault.jpg"
    );
  });

  it("extracts thumbnail from youtube.com/live URL with query params", () => {
    expect(
      getCamThumbnailUrl("https://www.youtube.com/live/def456?feature=share")
    ).toBe("https://img.youtube.com/vi/def456/mqdefault.jpg");
  });

  // --- YouTube embed URLs ---
  it("extracts thumbnail from youtube.com/embed URL", () => {
    expect(getCamThumbnailUrl("https://www.youtube.com/embed/ghi789")).toBe(
      "https://img.youtube.com/vi/ghi789/mqdefault.jpg"
    );
  });

  // --- Non-YouTube URLs ---
  it("returns null for vimeo URLs", () => {
    expect(getCamThumbnailUrl("https://vimeo.com/123456")).toBeNull();
  });

  it("returns null for hdontap URLs", () => {
    expect(
      getCamThumbnailUrl("https://hdontap.com/stream/994481/dana-point")
    ).toBeNull();
  });

  it("returns null for HLS stream URLs", () => {
    expect(
      getCamThumbnailUrl(
        "https://hls.cdn-surfline.com/oregon/wc-blacksov/playlist.m3u8"
      )
    ).toBeNull();
  });

  it("returns null for direct video URLs", () => {
    expect(getCamThumbnailUrl("https://example.com/cam.mp4")).toBeNull();
  });

  it("returns null for generic URLs", () => {
    expect(getCamThumbnailUrl("https://example.com/some-cam")).toBeNull();
  });

  // --- Invalid URLs ---
  it("returns null for invalid URL strings", () => {
    expect(getCamThumbnailUrl("not-a-valid-url")).toBeNull();
  });
});

describe("getYouTubeVideoId", () => {
  it("extracts IDs from supported YouTube URL formats", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe(
      "abc123"
    );
    expect(getYouTubeVideoId("https://youtu.be/def456?t=30")).toBe("def456");
    expect(
      getYouTubeVideoId("https://www.youtube.com/live/ghi789?feature=share")
    ).toBe("ghi789");
    expect(getYouTubeVideoId("https://www.youtube.com/embed/jkl012")).toBe(
      "jkl012"
    );
  });

  it("returns null for non-video YouTube pages", () => {
    expect(
      getYouTubeVideoId("https://www.youtube.com/@QuiverSurf/streams")
    ).toBeNull();
  });
});

describe("getYouTubeWatchUrl", () => {
  it("normalizes supported YouTube URLs to watch URLs", () => {
    expect(getYouTubeWatchUrl("https://www.youtube.com/embed/abc123")).toBe(
      "https://www.youtube.com/watch?v=abc123"
    );
  });
});

describe("isYouTubeCameraUrl", () => {
  it("detects YouTube hosts", () => {
    expect(isYouTubeCameraUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      true
    );
    expect(isYouTubeCameraUrl("https://youtu.be/abc123")).toBe(true);
  });

  it("rejects non-YouTube hosts and invalid URLs", () => {
    expect(isYouTubeCameraUrl("https://vimeo.com/123456")).toBe(false);
    expect(isYouTubeCameraUrl("not-a-url")).toBe(false);
  });
});

describe("getDisplayCamThumbnailUrl", () => {
  it("ignores stored OB Hotel page captures", () => {
    expect(
      getDisplayCamThumbnailUrl({
        cameraUrl: "https://www.obhotel.com/Webcam-Oceanbeach.php",
        thumbnailUrl:
          "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/cam-thumbnails/65d177de-e75a-4ad8-aa0d-48a67c0851b0.jpg",
      })
    ).toBeNull();
  });

  it("keeps real provider thumbnails for OB Hotel if one is supplied", () => {
    expect(
      getDisplayCamThumbnailUrl({
        cameraUrl: "https://www.obhotel.com/Webcam-Oceanbeach.php",
        thumbnailUrl:
          "https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_obhotel.stream.jpg",
      })
    ).toBe(
      "https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_obhotel.stream.jpg"
    );
  });

  it("keeps stored thumbnails for other camera hosts", () => {
    expect(
      getDisplayCamThumbnailUrl({
        cameraUrl: "https://streams.surfchex.com:8443/live/wb3.stream/playlist.m3u8",
        thumbnailUrl:
          "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/cam-thumbnails/4b88f10a-c794-4144-b17a-133af9fee9f9.jpg",
      })
    ).toBe(
      "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/cam-thumbnails/4b88f10a-c794-4144-b17a-133af9fee9f9.jpg"
    );
  });
});
