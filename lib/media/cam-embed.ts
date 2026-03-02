export type CamEmbedIntent =
  | { kind: "none" }
  | { kind: "iframe"; src: string; title?: string; allow?: string }
  | { kind: "video"; src: string }
  | { kind: "hls"; src: string }
  | { kind: "hdontap"; pageUrl: string };

/**
 * Returns a browser-navigable URL for "Open cam" links.
 * Returns null for .m3u8 URLs (not useful in a browser tab) and invalid URLs.
 */
export function getViewableUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.pathname.endsWith(".m3u8")) return null;
    return url;
  } catch {
    return null;
  }
}

/** Route CORS-blocked HLS hosts through our proxy */
export function toProxiedHlsUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "live.hdontap.com") {
      return `/api/hls-proxy/${parsed.hostname}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

export function buildCamEmbed(url: string | null | undefined): CamEmbedIntent {
  if (!url) return { kind: "none" };
  let href = "";
  try {
    const u = new URL(url);
    // Only allow http(s) URLs — reject javascript:, data:, etc.
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { kind: "none" };
    }
    href = u.href;

    // YouTube
    if (href.includes("youtube.com/watch") || href.includes("youtu.be/")) {
      const id = href.includes("youtu.be/")
        ? u.pathname.slice(1)
        : u.searchParams.get("v");
      if (id) {
        return {
          kind: "iframe",
          src: `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1`,
          title: "Live Cam",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        };
      }
    }

    // Vimeo
    if (href.includes("vimeo.com/")) {
      const id = href.split("/").filter(Boolean).pop();
      if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}`, title: "Live Cam" };
    }

    // Direct media
    if (href.endsWith(".mp4") || href.endsWith(".webm") || href.endsWith(".ogg")) {
      return { kind: "video", src: href };
    }

    // HLS — route CORS-blocked hosts through our proxy
    if (href.endsWith(".m3u8")) {
      if (u.hostname === "hls.cdn-surfline.com") {
        return { kind: "hls", src: `/api/hls-proxy/${u.hostname}${u.pathname}` };
      }
      return { kind: "hls", src: href };
    }

    // HDOnTap - resolve to HLS stream server-side (iframe embedding blocked)
    if (
      (u.hostname === "hdontap.com" || u.hostname === "www.hdontap.com") &&
      u.pathname.startsWith("/stream/")
    ) {
      return { kind: "hdontap", pageUrl: href };
    }

    // HDOnTap portal embeds (private/customer streams)
    if (u.hostname === "portal.hdontap.com") {
      return { kind: "hdontap", pageUrl: href };
    }

    // OB Hotel webcam (HDRelay-powered) — resolve to HLS stream server-side.
    // Reuses "hdontap" kind since the cam-resolve pipeline handles both providers.
    if (u.hostname === "www.obhotel.com" || u.hostname === "obhotel.com") {
      return { kind: "hdontap", pageUrl: href };
    }

    // Default iframe attempt (may be blocked)
    return { kind: "iframe", src: href, title: "Live Cam", allow: "autoplay" };
  } catch {
    // If URL parsing fails, don't render — prevents unvalidated URI injection
    return { kind: "none" };
  }
}

