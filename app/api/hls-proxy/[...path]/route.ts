import { NextRequest, NextResponse } from "next/server";
import { setTimeout as delay } from "node:timers/promises";
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
 * automatically. For providers that use absolute URLs in manifests (e.g.,
 * HDOnTap), we rewrite them server-side to proxy-relative paths.
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
  "live.hdontap.com": {},
  "watch.hdrelay.io": {},
};

/**
 * Regex matching absolute URLs for any allowed host.
 * Built from ALLOWED_HOSTS keys so it stays in sync automatically.
 * Captures: (1) hostname, (2) path+query
 */
const ABSOLUTE_URL_REGEX = new RegExp(
  `https?://(${Object.keys(ALLOWED_HOSTS)
    .map((h) => h.replace(/\./g, "\\."))
    .join("|")})(/[^\\s"']*)`,
  "g"
);

/** Rewrite absolute URLs in HLS manifests to proxy-relative paths */
function rewriteManifestUrls(manifest: string): string {
  return manifest.replace(
    ABSOLUTE_URL_REGEX,
    (_match, host: string, pathAndQuery: string) =>
      `/api/hls-proxy/${host}${pathAndQuery}`
  );
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
    for (let attempt = 0; attempt < 4; attempt++) {
      let requestUrl = targetUrl;
      if (isManifest && hostname === "live.hdontap.com") {
        requestUrl += `${queryString ? "&" : "?"}_quiver_live=${Date.now()}`;
      }
      const upstream = await fetch(requestUrl, {
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
        ...(hostname === "watch.hdrelay.io" ? { redirect: "error" as const } : {}),
        cache: "no-store",
      });

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
      if (isManifest) {
        const text = new TextDecoder().decode(body);
        // A cold HDOnTap edge can return expired segments with HTTP 200/no-store.
        if (hostname === "live.hdontap.com" && text.includes("#EXT-X-MEDIA-SEQUENCE:")) {
          const firstMedia = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith("#"));
          const media = firstMedia ? new URL(firstMedia, targetUrl) : null;
          if (!media || media.protocol !== "https:" || media.username || media.password || media.port ||
            !(media.hostname === "live.hdontap.com" || /^edge\d+(?:\.[a-z0-9-]+)?\.nginx\.hdontap\.com$/.test(media.hostname))) {
            return new NextResponse("Invalid media source", { status: 502, headers: { "Cache-Control": "no-store" } });
          }
          const probe = await fetch(media.href, {
            method: "HEAD", cache: "no-store", redirect: "error", signal: controller.signal,
          });
          if (!probe.ok) {
            if ((probe.status === 404 || probe.status === 410) && attempt < 3) {
              await delay(2000 * (attempt + 1), undefined, { signal: controller.signal });
              continue;
            }
            return new NextResponse("Live playlist unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
          }
        }
        // HDRelay's low-latency playlist is rejected by AVPlayer. Keep complete
        // fMP4 segments and omit partial-segment delivery for this provider.
        const compatible = hostname === "watch.hdrelay.io"
          ? text.split(/\r?\n/)
              .filter(line => !/^#EXT-X-(?:PART|PRELOAD-HINT|SERVER-CONTROL|RENDITION-REPORT|SKIP)(?::|-)/.test(line))
              .map(line => line.startsWith("#EXT-X-VERSION:") ? "#EXT-X-VERSION:6" : line)
              .join("\n")
          : text;
        const rewritten = rewriteManifestUrls(compatible);
        const encoded = new TextEncoder().encode(rewritten);
        responseBody = encoded.buffer as ArrayBuffer;
      }

      const contentType = isManifest
        ? "application/vnd.apple.mpegurl"
        : isSegment
          ? "video/mp2t"
          : upstream.headers.get("content-type") || "application/octet-stream";

      // Manifests must not be cached long (live stream); segments are immutable
      const cacheControl = isManifest
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
          "X-HLS-Proxy-Attempts": (attempt + 1).toString(),
        },
      });
    }
    return new NextResponse("Live playlist unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
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
