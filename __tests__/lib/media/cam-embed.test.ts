import { buildCamEmbed, getViewableUrl, toProxiedHlsUrl } from "@/lib/media/cam-embed";

describe("buildCamEmbed", () => {
  it.each([
    ["https://flaglersurf.com/webcam/", "Flagler Surf"],
    ["https://www.corollalightresort.com/surf-cam/", "Corolla Light Resort"],
    ["https://7thstreetsurfshop.com/wave-cam/7th-street", "7th Street Surf Shop"],
    ["https://www.hilton.com/en/hotels/hnlwahf-hilton-waikiki-beach-resort-and-spa/resort/webcam/", "Hilton"],
    ["https://www.ozolio.com/explore/IDWX000000A6", "Ozolio"],
    ["https://brenneckes.com/beach-webcam/", "Brennecke’s"],
    ["https://www.napilisunset.com/live-webcam/", "Napili Sunset"],
    ["https://www.sigward.com/", "Muir Beach Webcam"],
    ["https://video.nest.com/live/JKTTcsayyN", "Nest"],
    ["https://vbbound.com/webcams/courtyard-virginia-beach-boardwalk-webcam/", "Virginia Beach Bound"],
    ["https://marriott.ozolio.com/mauna-kea-beach-hotel/", "Mauna Kea Beach Hotel"],
  ])("opens verified provider page %s externally", (pageUrl, provider) => {
    expect(buildCamEmbed(pageUrl)).toEqual({ kind: "external", pageUrl, provider });
  });

  it.each([
    "https://relay.ozolio.com/pub.cgi?cmd=iframe&oid=CID_XCLW000002D1",
    "https://marriott.ozolio.com/westin-hapuna-beach-resort/",
    "https://constructor/",
  ])("preserves iframe handling for unrelated host %s", (url) => {
    expect(buildCamEmbed(url)).toMatchObject({ kind: "iframe", src: url });
  });

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

  it("uses Brownrice HLS cam URLs directly", () => {
    const src =
      "https://live5.brownrice.com:444/pawleys1/pawleys1.stream/playlist.m3u8";

    expect(buildCamEmbed(src)).toEqual({ kind: "hls", src });
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

  it("classifies Surfline embed widgets as iframe cams", () => {
    const src =
      "https://embed.cdn-surfline.com/cams/5834a0733421b20545c4b584/64ba68ebf1c960a93d1faba8f86cc16a3ed05913";

    expect(buildCamEmbed(src)).toEqual({
      kind: "iframe",
      src,
      title: "Live Cam",
      allow: "autoplay; fullscreen; picture-in-picture",
    });
  });

  it("returns external kind for Surfline surf-report cam pages", () => {
    const result = buildCamEmbed(
      "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67"
    );

    expect(result).toEqual({
      kind: "external",
      pageUrl:
        "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67",
      provider: "Surfline",
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

  it("returns hdontap kind for obhotel.com webcam pages", () => {
    const result = buildCamEmbed("https://www.obhotel.com/Webcam-Oceanbeach.php");
    expect(result).toEqual({
      kind: "hdontap",
      pageUrl: "https://www.obhotel.com/Webcam-Oceanbeach.php",
    });
  });

  it("returns hdontap kind for portofbrookingsharbor.com camera pages", () => {
    const result = buildCamEmbed(
      "https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html"
    );
    expect(result).toEqual({
      kind: "hdontap",
      pageUrl: "https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html",
    });
  });

  it("returns external kind for Surfers View live-cam pages", () => {
    const result = buildCamEmbed(
      "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/"
    );
    expect(result).toEqual({
      kind: "external",
      pageUrl:
        "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
      provider: "The Surfers View",
    });
  });

  it("resolves the authorized Surfers View Ocean Beach page through the OB Hotel video resolver", () => {
    const result = buildCamEmbed(
      "https://www.thesurfersview.com/live-cams/california/ocean-beach-san-diego-webcam-and-surf-report?ref=test"
    );
    expect(result).toEqual({
      kind: "hdontap",
      pageUrl: "https://www.obhotel.com/Webcam-Oceanbeach.php",
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

  it("renders IPCamLive player URLs as iframe cams", () => {
    const src =
      "https://g1.ipcamlive.com/player/player.php?alias=southbeachcam&skin=white&autoplay=1";

    expect(buildCamEmbed(src)).toEqual({
      kind: "iframe",
      src,
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

describe("toProxiedHlsUrl", () => {
  it("rewrites live.hdontap.com URLs through the proxy", () => {
    const input =
      "https://live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999";
    expect(toProxiedHlsUrl(input)).toBe(
      "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999"
    );
  });

  it("preserves query string including token and expiry", () => {
    const input =
      "https://live.hdontap.com/hls/path/playlist.m3u8?t=TOKEN&e=1234567890";
    expect(toProxiedHlsUrl(input)).toContain("?t=TOKEN&e=1234567890");
  });

  it("passes through non-HDOnTap URLs unchanged", () => {
    const surflineUrl =
      "https://hls.cdn-surfline.com/cam/12345/playlist.m3u8";
    expect(toProxiedHlsUrl(surflineUrl)).toBe(surflineUrl);
  });

  it("passes through already-proxied HDOnTap URLs unchanged", () => {
    const already =
      "/api/hls-proxy/live.hdontap.com/hls/stream/playlist.m3u8?t=abc";
    expect(toProxiedHlsUrl(already)).toBe(already);
  });

  it("handles malformed URL input without throwing", () => {
    expect(() => toProxiedHlsUrl("not a url")).not.toThrow();
    expect(toProxiedHlsUrl("not a url")).toBe("not a url");
  });

  it("rewrites http:// HDOnTap URLs", () => {
    const httpUrl =
      "http://live.hdontap.com/hls/stream/playlist.m3u8?t=abc";
    expect(toProxiedHlsUrl(httpUrl)).toBe(
      "/api/hls-proxy/live.hdontap.com/hls/stream/playlist.m3u8?t=abc"
    );
  });

  it("handles HDOnTap URLs without query params", () => {
    const url = "https://live.hdontap.com/hls/stream/playlist.m3u8";
    expect(toProxiedHlsUrl(url)).toBe(
      "/api/hls-proxy/live.hdontap.com/hls/stream/playlist.m3u8"
    );
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
