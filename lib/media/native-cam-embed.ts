import type { buildCamEmbed } from "@/lib/media/cam-embed";

type CamEmbedIntent = ReturnType<typeof buildCamEmbed>;

/**
 * Additive `cam_embed` field on GET /api/beaches/[id]/sources. Consumed by
 * quiver-native for cams its own players cannot handle (direct video, HLS,
 * HDOnTap and Surfline embeds keep priority and yield `null` here).
 */
type NativeCamEmbed =
  | { kind: "iframe"; src: string; provider: string; title?: string }
  | { kind: "external"; pageUrl: string; provider: string };

const KNOWN_EMBED_PROVIDERS: ReadonlyArray<readonly [string, string]> = [
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["vimeo.com", "vimeo"],
  ["ozolio.com", "ozolio"],
  ["ipcamlive.com", "ipcamlive"],
  ["angelcam.com", "angelcam"],
  ["brownrice.com", "brownrice"],
  ["nest.com", "nest"],
];

function parseHttps(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

function providerFromHost(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  for (const [domain, provider] of KNOWN_EMBED_PROVIDERS) {
    if (host === domain || host.endsWith(`.${domain}`)) return provider;
  }
  return host;
}

function isNativelyPlayedIframe(url: URL): boolean {
  return url.hostname === "embed.cdn-surfline.com" && url.pathname.startsWith("/cams/");
}

// buildCamEmbed interpolates the video id unescaped, so confirm the result is
// still a plain youtube embed path before handing it to a native WebView.
function isWellFormedYouTubeEmbed(url: URL): boolean {
  return url.hostname === "www.youtube.com" && /^\/embed\/[^/]+$/.test(url.pathname);
}

function isKnownPlayerEndpoint(url: URL, provider: string): boolean {
  switch (provider) {
    case "youtube":
      return isWellFormedYouTubeEmbed(url);
    case "vimeo":
      return url.hostname === "player.vimeo.com" && url.pathname.startsWith("/video/");
    case "ozolio":
      // Ozolio streams are locked to the owner's site: on a device the player
      // loads and never plays ("The embedding method is not supported").
      return false;
    case "ipcamlive":
      return url.pathname.startsWith("/player/");
    case "angelcam":
      return url.pathname.startsWith("/iframe");
    case "brownrice":
      return url.pathname.startsWith("/embed/");
    default:
      return false;
  }
}

export function toNativeCamEmbed(intent: CamEmbedIntent): NativeCamEmbed | null {
  if (intent.kind === "external") {
    const page = parseHttps(intent.pageUrl);
    if (!page) return null;
    return { kind: "external", pageUrl: page.href, provider: intent.provider };
  }

  if (intent.kind !== "iframe") return null;

  const src = parseHttps(intent.src);
  if (!src || isNativelyPlayedIframe(src)) return null;

  const provider = providerFromHost(src.hostname);
  if (provider === "youtube" && !isWellFormedYouTubeEmbed(src)) return null;

  // buildCamEmbed's fallback iframes any unrecognised page. The web can frame a
  // whole site; the app hero cannot, so only known player endpoints embed.
  if (!isKnownPlayerEndpoint(src, provider)) {
    return { kind: "external", pageUrl: src.href, provider };
  }

  return {
    kind: "iframe",
    src: src.href,
    provider,
    ...(intent.title ? { title: intent.title } : {}),
  };
}
