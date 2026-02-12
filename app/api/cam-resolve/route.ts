import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/middleware/api-wrappers";

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

/** Hostnames we're willing to scrape for stream URLs */
const ALLOWED_RESOLVE_HOSTS = ["hdontap.com", "www.hdontap.com"];

/** Regex to find HLS stream URL in HDOnTap pages */
const HDONTAP_HLS_RE =
  /https?:\/\/live\.hdontap\.com\/hls\/[^"'\\\s]+\.m3u8[^"'\\\s]*/;

async function camResolveHandler(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_RESOLVE_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  // Ensure we fetch the /embed/ version (lighter HTML)
  const embedUrl = url.includes("/embed/")
    ? url
    : url.replace(/\/?$/, "/embed/");

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
        { status: 502 }
      );
    }

    const html = await res.text();

    // Unescape unicode escapes (HDOnTap encodes & as \u0026)
    const unescaped = html.replace(/\\u0026/g, "&");

    const match = unescaped.match(HDONTAP_HLS_RE);
    if (!match) {
      console.warn("[cam-resolve] No HLS URL found in page:", embedUrl);
      return NextResponse.json(
        { error: "No stream found" },
        { status: 404 }
      );
    }

    const hlsUrl = match[0];

    console.log("[cam-resolve]", {
      source: parsed.hostname,
      stream: hlsUrl.split("?")[0],
    });

    return NextResponse.json(
      { hlsUrl },
      {
        headers: {
          // Signed URLs expire — cache briefly
          "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Timeout" }, { status: 504 });
    }

    console.error("[cam-resolve] Error:", {
      url: embedUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Resolve failed" }, { status: 502 });
  }
}

export const GET = withRateLimit(camResolveHandler, "cam-resolve");
