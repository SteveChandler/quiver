import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { HDONTAP_HLS_RE } from "@/lib/media/cam-constants";

export const dynamic = "force-dynamic";

/**
 * Cam Resolve API Route
 *
 * Resolves camera page URLs (e.g. HDOnTap) to their underlying HLS stream URLs.
 * HDOnTap blocks iframe embedding (X-Frame-Options: DENY), but their actual
 * HLS streams at live.hdontap.com have CORS `*` — so we just need to extract
 * the signed HLS URL from the page HTML server-side.
 *
 * GET /api/cam-resolve?url=https://hdontap.com/stream/186699/...
 * → { hlsUrl: "https://live.hdontap.com/hls/.../playlist.m3u8?t=...&e=..." }
 */

const REQUEST_TIMEOUT = 10_000;
const MAX_HTML_SIZE = 512 * 1024; // 512 KB — HDOnTap pages are ~50-100 KB

/** Hostnames we're willing to scrape for stream URLs */
const ALLOWED_RESOLVE_HOSTS = ["hdontap.com", "www.hdontap.com"];

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

  // Ensure we fetch the /embed/ version (lighter HTML)
  parsed.pathname = parsed.pathname.replace(/\/?$/, "/embed/");
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
    });

    clearTimeout(timeoutId);

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

    const match = unescaped.match(HDONTAP_HLS_RE);
    if (!match) {
      console.warn("[cam-resolve] No HLS URL found in page:", embedUrl);
      return NextResponse.json(
        { error: "No stream found" },
        { status: 404, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    const hlsUrl = match[0];

    // Validate extracted URL is well-formed
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
          // Signed URLs expire — cache briefly
          "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
        },
      }
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
