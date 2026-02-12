type CamEmbedIntent =
  | { kind: "none" }
  | { kind: "iframe"; src: string; title?: string; allow?: string }
  | { kind: "video"; src: string }
  | { kind: "hls"; src: string };

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

    // HLS
    if (href.endsWith(".m3u8")) {
      return { kind: "hls", src: href };
    }

    // HDOnTap - convert stream URL to embed URL
    if (href.includes("hdontap.com/stream/")) {
      const embedUrl = href.endsWith("/embed/") ? href : href.replace(/\/?$/, "/embed/");
      return {
        kind: "iframe",
        src: embedUrl,
        title: "Live Cam – HDOnTap",
        allow: "autoplay; fullscreen",
      };
    }

    // Default iframe attempt (may be blocked)
    return { kind: "iframe", src: href, title: "Live Cam", allow: "autoplay" };
  } catch {
    // If URL parsing fails, expose as link fallback
    return { kind: "iframe", src: String(url), title: "Live Cam" };
  }
}

