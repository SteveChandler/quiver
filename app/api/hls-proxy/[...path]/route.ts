import { isBlockedCameraUrl } from "@/lib/media/camera-provider-policy";
import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

/**
 * HLS Proxy API Route
 *
 * Proxies HLS streams from CORS-blocked CDNs (e.g., Surfline) so hls.js
 * can play them in Chrome/Firefox. Safari plays HLS natively without CORS issues.
 *
 * Path-based design: /api/hls-proxy/<hostname>/<path>
 * This lets relative URLs inside .m3u8 manifests resolve through the proxy
 * automatically. Allowlisted absolute URLs are rewritten to proxy-relative paths.
 *
 * Security:
 * - Strict hostname whitelist (prevents open proxy / SSRF)
 * - Rate limited per client IP
 * - Request timeout (15s)
 * - Response size limit (10MB for video segments)
 *
 * Monitoring:
 * - Structured console logs for every proxied request (Vercel Logs)
 * - X-HLS-Proxy-* headers on responses for debugging
 */

/** Hostnames allowed through the proxy, with required upstream headers */
const ALLOWED_HOSTS: Record<string, Record<string, string>> = {
  "hls.cdn-surfline.com": {
    Referer: "https://www.surfline.com/",
  },
  "watch.hdrelay.io": {},
};

function rewriteManifestUrls(manifest: string, source: string): string | null {
  // HLS URIs appear both on media lines and in attributes (keys, maps, variants).
  // An unresolved variable can construct a host after this check.
  if (/^#EXT-X-DEFINE:/m.test(manifest) || manifest.includes("{$")) return null;

  let blocked = false;
  function rewrite(uri: string): string {
    const url = new URL(uri, source);
    if (isBlockedCameraUrl(uri) || isBlockedCameraUrl(url.href) ||
        url.protocol !== "https:" || url.username || url.password || url.port) {
      blocked = true;
    }
    return /^(?:https?:)?[/\\]{2}/i.test(uri) && Object.hasOwn(ALLOWED_HOSTS, url.hostname)
      ? `/api/hls-proxy/${url.hostname}${url.pathname}${url.search}`
      : uri;
  }

  const rewritten = manifest.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith("#")) return rewrite(trimmed);
    return line.replace(/\b(?:[A-Z0-9-]+-)?URI\s*=\s*(?:"([^"]*)"|([^,\s]+))/gi,
      (_attribute, quoted: string | undefined, unquoted: string | undefined) =>
        _attribute.replace(quoted ?? unquoted ?? "", rewrite(quoted ?? unquoted ?? "")));
  }).join("\n");

  return blocked ? null : rewritten;
}

/** Max response size: 10MB (typical HLS segments are 2-6MB) */
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;

/** Request timeout in ms */
const REQUEST_TIMEOUT = 15_000;

async function hlsProxyHandler(
  request: NextRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
): Promise<NextResponse> {
  const start = Date.now();

  const rawParams = context?.params;
  const resolvedParams = rawParams && "then" in rawParams ? await rawParams : rawParams;
  const pathSegments = (resolvedParams as { path?: string[] } | undefined)?.path;

  if (!pathSegments || pathSegments.length < 2) {
    return NextResponse.json(
      { error: "Invalid proxy path" },
      { status: 400 }
    );
  }

  // Security: reject path traversal
  if (pathSegments.some((s) => s === ".." || s === ".")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const hostname = pathSegments[0];
  const resourcePath = "/" + pathSegments.slice(1).join("/");
  const queryString = request.nextUrl.search; // includes "?" prefix if present
  const isManifest = /\.m3u8$/i.test(resourcePath);
  const targetUrl = `https://${hostname}${resourcePath}${queryString}`;

  if (isBlockedCameraUrl(targetUrl) || isBlockedCameraUrl(request.nextUrl.href)) {
    return NextResponse.json({ error: "Camera unavailable" }, {
      status: 410, headers: { "Cache-Control": "no-store" },
    });
  }

  // Security: strict hostname whitelist
  const hostConfig = ALLOWED_HOSTS[hostname];
  if (!Object.hasOwn(ALLOWED_HOSTS, hostname) ||
      (hostname === "watch.hdrelay.io" && !resourcePath.startsWith("/live/"))) {
    console.warn("[hls-proxy] Blocked disallowed host:", hostname);
    return NextResponse.json(
      { error: "Host not allowed" },
      { status: 403 }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        ...hostConfig,
        ...(isManifest ? { "Cache-Control": "no-cache" } : {}),
        // Forward range requests for partial segment loads
        ...(request.headers.get("range")
          ? { Range: request.headers.get("range")! }
          : {}),
      },
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return new NextResponse("Redirects not followed", { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    if (!upstream.ok) {
      console.warn("[hls-proxy] Upstream error:", {
        url: targetUrl,
        status: upstream.status,
      });
      return new NextResponse(null, { status: upstream.status });
    }

    // Size check from Content-Length header
    const contentLength = upstream.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return new NextResponse("Response too large", { status: 413 });
    }

    const body = await upstream.arrayBuffer();

    if (body.byteLength > MAX_RESPONSE_SIZE) {
      return new NextResponse("Response too large", { status: 413 });
    }

    // Determine content type and caching
    const isSegment =
      resourcePath.endsWith(".ts") || resourcePath.endsWith(".aac");

    // Rewrite absolute URLs in manifests to proxy-relative paths so hls.js
    // follows them through the proxy instead of directly to the CDN
    let responseBody: ArrayBuffer = body;
    const isPlaylist = isManifest ||
      /mpegurl/i.test(upstream.headers.get("content-type") ?? "") ||
      new TextDecoder().decode(body.slice(0, 16)).trimStart().startsWith("#EXTM3U");
    if (isPlaylist) {
      const text = new TextDecoder().decode(body);
      // HDRelay's low-latency playlist is rejected by AVPlayer. Keep complete
      // fMP4 segments and omit partial-segment delivery for this provider.
      const compatible = hostname === "watch.hdrelay.io"
        ? text.split(/\r?\n/)
            .filter(line => !/^#EXT-X-(?:PART|PRELOAD-HINT|SERVER-CONTROL|RENDITION-REPORT|SKIP)(?::|-)/.test(line))
            .map(line => line.startsWith("#EXT-X-VERSION:") ? "#EXT-X-VERSION:6" : line)
            .join("\n")
        : text;
      const rewritten = rewriteManifestUrls(compatible, targetUrl);
      if (rewritten === null) {
        return new NextResponse("Invalid media source", {
          status: 502, headers: { "Cache-Control": "no-store" },
        });
      }
      const encoded = new TextEncoder().encode(rewritten);
      responseBody = encoded.buffer as ArrayBuffer;
    }

    const contentType = isPlaylist
      ? "application/vnd.apple.mpegurl"
      : isSegment
        ? "video/mp2t"
        : upstream.headers.get("content-type") || "application/octet-stream";

    // Manifests must not be cached long (live stream); segments are immutable
    const cacheControl = isPlaylist
      ? "no-store"
      : isSegment
        ? "public, max-age=3600, immutable"
        : "public, max-age=60";

    const elapsed = Date.now() - start;

    // Monitoring log
    console.log("[hls-proxy]", {
      host: hostname,
      path: resourcePath,
      type: isManifest ? "manifest" : isSegment ? "segment" : "other",
      bytes: responseBody.byteLength,
      ms: elapsed,
    });

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "Access-Control-Allow-Origin": "*",
        "X-HLS-Proxy-Host": hostname,
        "X-HLS-Proxy-Bytes": responseBody.byteLength.toString(),
        "X-HLS-Proxy-Ms": elapsed.toString(),
        "X-HLS-Proxy-Attempts": "1",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[hls-proxy] Timeout:", targetUrl);
      return new NextResponse("Gateway timeout", { status: 504, headers: { "Cache-Control": "no-store" } });
    }

    console.error("[hls-proxy] Error:", {
      url: targetUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse("Proxy error", { status: 502, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Type assertion needed: withRateLimit returns RouteHandler (Record<string, string> params)
// but Next.js catch-all routes require { path: string[] } params.
// The handler internally handles the string[] via pathSegments extraction.
export const GET = withRateLimit(hlsProxyHandler, "hls-proxy") as unknown as
  (request: NextRequest, context: { params: Promise<{ path: string[] }> }) => Promise<Response>;
