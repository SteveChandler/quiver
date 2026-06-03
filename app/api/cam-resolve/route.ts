import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SECURITY_HEADERS,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";
import { HDONTAP_HLS_RE, HDRELAY_PLAYER_RE } from "@/lib/media/cam-constants";

export const dynamic = "force-dynamic";

/**
 * Cam Resolve API Route
 *
 * Resolves camera page URLs (e.g. HDOnTap) to their underlying HLS stream URLs.
 * HDOnTap blocks iframe embedding (X-Frame-Options: DENY) and their HLS
 * streams at live.hdontap.com are CORS-blocked. We extract the signed HLS URL
 * from the page HTML server-side, then the client proxies it via /api/hls-proxy/.
 * Surfline embed widgets expose a cam-config JSON and cam-details JSON; native
 * uses this route to resolve those iframe widgets to the underlying HLS stream.
 *
 * GET /api/cam-resolve?url=https://hdontap.com/stream/186699/...
 * → { hlsUrl: "https://live.hdontap.com/hls/.../playlist.m3u8?t=...&e=..." }
 */

const REQUEST_TIMEOUT = 10_000;
const MAX_HTML_SIZE = 512 * 1024; // 512 KB — HDOnTap pages are ~50-100 KB
const MAX_JSON_SIZE = 64 * 1024;
const HDRELAY_CONFIG_BASE = "https://manage.hdrelay.com/player";
const SURFLINE_EMBED_HOST = "embed.cdn-surfline.com";
const SURFLINE_HLS_HOST = "hls.cdn-surfline.com";

/** Hostnames we're willing to scrape for stream URLs */
const ALLOWED_RESOLVE_HOSTS = [
  "hdontap.com",
  "www.hdontap.com",
  "portal.hdontap.com",
  "www.obhotel.com",
  "obhotel.com",
  "www.portofbrookingsharbor.com",
  "portofbrookingsharbor.com",
  SURFLINE_EMBED_HOST,
];

function parseSurflineEmbedPath(parsed: URL): {
  camId: string;
  configId: string | null;
} | null {
  const match = parsed.pathname.match(
    /^\/cams\/([0-9a-f]{24})(?:\/([0-9a-f]{40}))?\/?$/i
  );
  if (!match) return null;
  return { camId: match[1], configId: match[2] ?? null };
}

async function fetchSurflineJson(url: string): Promise<{
  data: any | null;
  response: NextResponse | null;
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    redirect: "manual",
  });

  if (res.status >= 300 && res.status < 400) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "Redirects not followed" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      ),
    };
  }

  if (!res.ok) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "Surfline config unavailable" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      ),
    };
  }

  const contentLength = res.headers?.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_JSON_SIZE) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "Surfline config too large" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      ),
    };
  }

  const text = await res.text();
  if (text.length > MAX_JSON_SIZE) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "Surfline config too large" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      ),
    };
  }

  try {
    return { data: JSON.parse(text), response: null };
  } catch {
    return {
      data: null,
      response: NextResponse.json(
        { error: "Surfline config malformed" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      ),
    };
  }
}

async function resolveSurflineEmbed(parsed: URL): Promise<NextResponse> {
  const ids = parseSurflineEmbedPath(parsed);
  if (!ids) {
    return NextResponse.json(
      { error: "Invalid Surfline embed URL" },
      { status: 400, headers: DEFAULT_SECURITY_HEADERS }
    );
  }

  if (ids.configId) {
    const config = await fetchSurflineJson(
      `https://${SURFLINE_EMBED_HOST}/cam-config/${ids.configId}.json`
    );
    if (config.response) return config.response;

    if (config.data?.camId !== ids.camId) {
      return NextResponse.json(
        { error: "Surfline config mismatch" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      );
    }
  }

  const details = await fetchSurflineJson(
    `https://${SURFLINE_EMBED_HOST}/cam-details/${ids.camId}.json`
  );
  if (details.response) return details.response;

  if (details.data?.cam?.isDown?.status === true) {
    return NextResponse.json(
      { error: "Stream unavailable" },
      { status: 404, headers: DEFAULT_SECURITY_HEADERS }
    );
  }

  const hlsUrl = details.data?.cam?.streamUrl;
  if (typeof hlsUrl !== "string") {
    return NextResponse.json(
      { error: "No stream found" },
      { status: 404, headers: DEFAULT_SECURITY_HEADERS }
    );
  }

  try {
    const stream = new URL(hlsUrl);
    if (
      stream.protocol !== "https:" ||
      stream.hostname !== SURFLINE_HLS_HOST ||
      !stream.pathname.endsWith(".m3u8")
    ) {
      return NextResponse.json(
        { error: "Untrusted stream server" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid stream URL" },
      { status: 502, headers: DEFAULT_SECURITY_HEADERS }
    );
  }

  return NextResponse.json(
    { hlsUrl },
    {
      headers: {
        ...DEFAULT_SECURITY_HEADERS,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=120",
      },
    }
  );
}

async function camResolveHandler(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400, headers: DEFAULT_SECURITY_HEADERS });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400, headers: DEFAULT_SECURITY_HEADERS });
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only HTTPS URLs allowed" }, { status: 400, headers: DEFAULT_SECURITY_HEADERS });
  }

  if (!ALLOWED_RESOLVE_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403, headers: DEFAULT_SECURITY_HEADERS });
  }

  if (parsed.hostname === SURFLINE_EMBED_HOST) {
    return resolveSurflineEmbed(parsed);
  }

  // Ensure we fetch the /embed/ version (lighter HTML)
  // Only rewrite pathname for standard HDOnTap /stream/ URLs
  const isHdontap = parsed.hostname === "hdontap.com" || parsed.hostname === "www.hdontap.com";
  if (isHdontap) {
    parsed.pathname = parsed.pathname.replace(/\/?$/, "/embed/");
  }
  const embedUrl = parsed.toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json(
        { error: "Redirects not followed" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    if (!res.ok) {
      console.warn("[cam-resolve] Upstream error:", {
        url: embedUrl,
        status: res.status,
      });
      return NextResponse.json(
        { error: "Failed to fetch camera page" },
        { status: 502, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    // Pre-check Content-Length header before buffering
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_HTML_SIZE) {
      return NextResponse.json({ error: "Response too large" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
    }

    const html = await res.text();
    if (html.length > MAX_HTML_SIZE) {
      return NextResponse.json({ error: "Response too large" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
    }

    // Unescape unicode escapes (HDOnTap encodes & as \u0026, = as \u003d, etc.)
    const unescaped = html.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    // Strategy 1: Look for HDOnTap HLS URL directly in page HTML
    const hdontapMatch = unescaped.match(HDONTAP_HLS_RE);
    if (hdontapMatch) {
      const hlsUrl = hdontapMatch[0];
      try {
        new URL(hlsUrl);
      } catch {
        console.warn("[cam-resolve] Extracted malformed HLS URL:", hlsUrl);
        return NextResponse.json({ error: "Invalid stream URL extracted" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
      }
      return NextResponse.json(
        { hlsUrl },
        {
          headers: {
            ...DEFAULT_SECURITY_HEADERS,
            "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
          },
        }
      );
    }

    // Strategy 2: Look for HDRelay player initialization
    const hdrelayMatch = unescaped.match(HDRELAY_PLAYER_RE);
    if (hdrelayMatch) {
      const playerId = hdrelayMatch[1];
      try {
        const configRes = await fetch(
          `${HDRELAY_CONFIG_BASE}/${playerId}`,
          {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT),
            redirect: "manual",
          }
        );

        if (configRes.status >= 300 && configRes.status < 400) {
          return NextResponse.json(
            { error: "Redirects not followed" },
            { status: 502, headers: DEFAULT_SECURITY_HEADERS }
          );
        }

        if (!configRes.ok) {
          console.warn("[cam-resolve] HDRelay config fetch failed:", configRes.status);
          return NextResponse.json({ error: "HDRelay config unavailable" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
        }

        const configText = await configRes.text();
        if (configText.length > 64 * 1024) {
          return NextResponse.json({ error: "HDRelay config too large" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
        }
        const config = JSON.parse(configText);
        const cameraId = config?.camera?.id;
        const hlsServer = config?.server?.hls?.replace(/^\/\//, "https://");
        if (!cameraId || !hlsServer) {
          console.warn("[cam-resolve] HDRelay config missing camera/server:", { playerId });
          return NextResponse.json({ error: "HDRelay config incomplete" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
        }

        // Validate HLS server is a trusted HDRelay domain
        try {
          const serverUrl = new URL(hlsServer.startsWith("http") ? hlsServer : `https://${hlsServer}`);
          if (!serverUrl.hostname.endsWith(".hdrelay.com")) {
            console.warn("[cam-resolve] Untrusted HDRelay HLS server:", serverUrl.hostname);
            return NextResponse.json({ error: "Untrusted stream server" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
          }
        } catch {
          console.warn("[cam-resolve] Invalid HDRelay HLS server URL:", hlsServer);
          return NextResponse.json({ error: "Invalid stream server" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
        }

        const hlsUrl = `${hlsServer}/camera/${cameraId}/relay/playlist.m3u8`;
        try {
          new URL(hlsUrl);
        } catch {
          console.warn("[cam-resolve] HDRelay constructed malformed HLS URL:", hlsUrl);
          return NextResponse.json({ error: "Invalid stream URL" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
        }
        return NextResponse.json(
          { hlsUrl },
          {
            headers: {
              ...DEFAULT_SECURITY_HEADERS,
              // HDRelay HLS URLs don't have signed expiry — cache longer
              "Cache-Control": "public, max-age=300, stale-while-revalidate=120",
            },
          }
        );
      } catch (err) {
        console.warn("[cam-resolve] HDRelay resolution failed:", err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: "HDRelay resolution failed" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
      }
    }

    // No strategy matched
    console.warn("[cam-resolve] No HLS URL found in page:", embedUrl);
    return NextResponse.json(
      { error: "No stream found" },
      { status: 404, headers: DEFAULT_SECURITY_HEADERS }
    );
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Timeout" }, { status: 504, headers: DEFAULT_SECURITY_HEADERS });
    }

    console.error("[cam-resolve] Error:", {
      url: embedUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Resolve failed" }, { status: 502, headers: DEFAULT_SECURITY_HEADERS });
  }
}

export const GET = withRateLimit(camResolveHandler, "cam-resolve");
