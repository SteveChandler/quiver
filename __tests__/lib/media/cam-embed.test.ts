import { buildCamEmbed, getViewableUrl } from "@/lib/media/cam-embed";

describe("buildCamEmbed", () => {
  // --- Null / undefined ---
  it("returns none for null", () => {
    expect(buildCamEmbed(null)).toEqual({ kind: "none" });
  });

  it("returns none for undefined", () => {
    expect(buildCamEmbed(undefined)).toEqual({ kind: "none" });
  });

  // --- YouTube ---
  it("converts a youtube.com/watch URL to an embed iframe", () => {
    const result = buildCamEmbed("https://www.youtube.com/watch?v=abc123");
    expect(result).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/abc123?rel=0&autoplay=1&mute=1",
      title: "Live Cam",
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    });
  });

  it("converts a youtu.be short URL to an embed iframe", () => {
    const result = buildCamEmbed("https://youtu.be/abc123");
    expect(result).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/abc123?rel=0&autoplay=1&mute=1",
      title: "Live Cam",
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    });
  });

  // --- Vimeo ---
  it("converts a vimeo.com URL to a player embed", () => {
    const result = buildCamEmbed("https://vimeo.com/123456");
    expect(result).toEqual({
      kind: "iframe",
      src: "https://player.vimeo.com/video/123456",
      title: "Live Cam",
    });
  });

  // --- Direct media ---
  it("returns video kind for .mp4 URLs", () => {
    const result = buildCamEmbed("https://example.com/cam.mp4");
    expect(result).toEqual({ kind: "video", src: "https://example.com/cam.mp4" });
  });

  // --- HLS ---
  it("returns hls kind for .m3u8 URLs", () => {
    const result = buildCamEmbed("https://example.com/stream.m3u8");
    expect(result).toEqual({ kind: "hls", src: "https://example.com/stream.m3u8" });
  });

  it("rewrites Surfline HLS URLs through the proxy", () => {
    const result = buildCamEmbed(
      "https://hls.cdn-surfline.com/oregon/wc-blacksov/playlist.m3u8"
    );
    expect(result).toEqual({
      kind: "hls",
      src: "/api/hls-proxy/hls.cdn-surfline.com/oregon/wc-blacksov/playlist.m3u8",
    });
  });

  // --- HDOnTap ---
  it("returns hdontap kind with pageUrl for HDOnTap stream URLs", () => {
    const result = buildCamEmbed(
      "https://hdontap.com/stream/994481/dana-point-harbor-laguna-cliffs-resort-live-webcam/"
    );
    expect(result).toEqual({
      kind: "hdontap",
      pageUrl: "https://hdontap.com/stream/994481/dana-point-harbor-laguna-cliffs-resort-live-webcam/",
    });
  });

  it("returns hdontap kind for HDOnTap URL without trailing slash", () => {
    const result = buildCamEmbed(
      "https://hdontap.com/stream/994481/dana-point-harbor"
    );
    expect(result).toEqual({
      kind: "hdontap",
      pageUrl: "https://hdontap.com/stream/994481/dana-point-harbor",
    });
  });

  it("returns hdontap kind with pageUrl for portal.hdontap.com embed URLs", () => {
    const result = buildCamEmbed(
      "https://portal.hdontap.com/s/embed?stream=cardiffreef_hs-CUST"
    );
    expect(result).toEqual({
      kind: "hdontap",
      pageUrl: "https://portal.hdontap.com/s/embed?stream=cardiffreef_hs-CUST",
    });
  });

  // --- Protocol validation ---
  it("rejects javascript: URIs", () => {
    expect(buildCamEmbed("javascript:alert(1)")).toEqual({ kind: "none" });
  });

  it("rejects data: URIs", () => {
    expect(buildCamEmbed("data:text/html,<script>alert(1)</script>")).toEqual({ kind: "none" });
  });

  // --- Default fallback ---
  it("returns a default iframe for unknown URLs", () => {
    const result = buildCamEmbed("https://example.com/some-cam");
    expect(result).toEqual({
      kind: "iframe",
      src: "https://example.com/some-cam",
      title: "Live Cam",
      allow: "autoplay",
    });
  });

  // --- Invalid URL catch branch ---
  it("returns none for invalid URL strings", () => {
    const result = buildCamEmbed("not-a-valid-url");
    expect(result).toEqual({ kind: "none" });
  });
});

describe("getViewableUrl", () => {
  it("returns null for null input", () => {
    expect(getViewableUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getViewableUrl(undefined)).toBeNull();
  });

  it("returns null for .m3u8 URLs", () => {
    expect(getViewableUrl("https://hls.cdn-surfline.com/stream.m3u8")).toBeNull();
  });

  it("returns null for invalid URL strings", () => {
    expect(getViewableUrl("not-a-url")).toBeNull();
  });

  it("passes through YouTube URLs", () => {
    const url = "https://www.youtube.com/watch?v=abc123";
    expect(getViewableUrl(url)).toBe(url);
  });

  it("passes through HDOnTap URLs", () => {
    const url = "https://hdontap.com/stream/994481/dana-point";
    expect(getViewableUrl(url)).toBe(url);
  });

  it("passes through generic HTTPS URLs", () => {
    const url = "https://example.com/cam";
    expect(getViewableUrl(url)).toBe(url);
  });
});
