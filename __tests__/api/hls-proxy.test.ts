/**
 * @jest-environment node
 *
 * Tests for /api/hls-proxy/[...path] route
 *
 * Covers:
 * - Hostname whitelist validation (prevents open proxy / SSRF)
 * - Path traversal prevention (.. and . segments blocked)
 * - Missing/insufficient path segments
 * - Content-type determination (manifest vs segment vs other)
 * - Cache-Control header policies
 * - Response size limits (10MB)
 * - Upstream error handling (non-ok status, timeout, network error)
 * - Range request forwarding
 * - CORS headers
 * - Debug headers (X-HLS-Proxy-*)
 */

import { NextRequest } from "next/server";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock withRateLimit to pass through the handler
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: any) => handler,
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after mocks
let GET: any;

beforeAll(async () => {
  const route = await import(
    "@/app/api/hls-proxy/[...path]/route"
  );
  GET = route.GET;
});

// =============================================================================
// TEST HELPERS
// =============================================================================

function createRequest(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "GET",
    headers,
  });
}

function createContext(pathSegments: string[]) {
  return { params: Promise.resolve({ path: pathSegments }) };
}

function mockUpstreamResponse(
  body: ArrayBuffer | string,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
) {
  const { status = 200, headers = {} } = options;
  const buffer =
    typeof body === "string" ? new TextEncoder().encode(body).buffer : body;

  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    arrayBuffer: () => Promise.resolve(buffer),
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe("HLS Proxy Route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Hostname whitelist
  // ---------------------------------------------------------------------------
  describe("Hostname Whitelist", () => {
    it("should allow requests to whitelisted host (hls.cdn-surfline.com)", async () => {
      mockUpstreamResponse("#EXTM3U\n#EXT-X-VERSION:3\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/some/stream.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "some",
        "stream.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should reject requests to non-whitelisted hosts", async () => {
      const request = createRequest(
        "http://localhost/api/hls-proxy/evil.example.com/steal-data"
      );
      const context = createContext(["evil.example.com", "steal-data"]);

      const response = await GET(request, context);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe("Host not allowed");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject hosts that are substrings of allowed hosts", async () => {
      const request = createRequest(
        "http://localhost/api/hls-proxy/not-hls.cdn-surfline.com/path"
      );
      const context = createContext(["not-hls.cdn-surfline.com", "path"]);

      const response = await GET(request, context);
      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should forward Referer header for surfline CDN", async () => {
      mockUpstreamResponse("segment-data");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/segment.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "segment.ts",
      ]);

      await GET(request, context);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Referer).toBe("https://www.surfline.com/");
    });
  });

  // ---------------------------------------------------------------------------
  // Path traversal prevention
  // ---------------------------------------------------------------------------
  describe("Path Traversal Prevention", () => {
    it("should reject paths containing '..'", async () => {
      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/../../../etc/passwd"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "..",
        "..",
        "..",
        "etc",
        "passwd",
      ]);

      const response = await GET(request, context);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Invalid path");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject paths containing '.'", async () => {
      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/./hidden"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        ".",
        "hidden",
      ]);

      const response = await GET(request, context);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Invalid path");
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid path segments
  // ---------------------------------------------------------------------------
  describe("Invalid Path Segments", () => {
    it("should return 400 when path has fewer than 2 segments", async () => {
      const request = createRequest(
        "http://localhost/api/hls-proxy/single-segment"
      );
      const context = createContext(["single-segment"]);

      const response = await GET(request, context);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Invalid proxy path");
    });

    it("should return 400 when path is empty", async () => {
      const request = createRequest("http://localhost/api/hls-proxy/");
      const context = createContext([]);

      const response = await GET(request, context);
      expect(response.status).toBe(400);
    });

    it("should return 400 when params are missing", async () => {
      const request = createRequest("http://localhost/api/hls-proxy/");
      const context = { params: Promise.resolve({ path: undefined }) };

      const response = await GET(request, context as any);
      expect(response.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Content-type handling
  // ---------------------------------------------------------------------------
  describe("Content-Type Handling", () => {
    it("should return application/vnd.apple.mpegurl for .m3u8 files", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/stream/playlist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "stream",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Content-Type")).toBe(
        "application/vnd.apple.mpegurl"
      );
    });

    it("should return application/vnd.apple.mpegurl for .M3U8 (uppercase)", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/stream/playlist.M3U8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "stream",
        "playlist.M3U8",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Content-Type")).toBe(
        "application/vnd.apple.mpegurl"
      );
    });

    it("should return video/mp2t for .ts segment files", async () => {
      mockUpstreamResponse(new ArrayBuffer(1024));

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/stream/segment0.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "stream",
        "segment0.ts",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Content-Type")).toBe("video/mp2t");
    });

    it("should return video/mp2t for .aac audio segments", async () => {
      mockUpstreamResponse(new ArrayBuffer(512));

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/stream/audio.aac"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "stream",
        "audio.aac",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Content-Type")).toBe("video/mp2t");
    });

    it("should pass through upstream content-type for other files", async () => {
      mockUpstreamResponse("key-data", {
        headers: { "content-type": "application/octet-stream" },
      });

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/stream/enc.key"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "stream",
        "enc.key",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Content-Type")).toBe(
        "application/octet-stream"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Cache-Control policies
  // ---------------------------------------------------------------------------
  describe("Cache-Control Policies", () => {
    it("should set short cache for manifests (live stream)", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/playlist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=2, stale-while-revalidate=5"
      );
    });

    it("should set long immutable cache for segments", async () => {
      mockUpstreamResponse(new ArrayBuffer(1024));

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/segment.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "segment.ts",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=3600, immutable"
      );
    });

    it("should set medium cache for other files", async () => {
      mockUpstreamResponse("key-data");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/enc.key"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "enc.key",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=60"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // CORS headers
  // ---------------------------------------------------------------------------
  describe("CORS Headers", () => {
    it("should include Access-Control-Allow-Origin: *", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/playlist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  // ---------------------------------------------------------------------------
  // Debug headers
  // ---------------------------------------------------------------------------
  describe("Debug Headers", () => {
    it("should include X-HLS-Proxy-Host header", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/playlist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("X-HLS-Proxy-Host")).toBe(
        "hls.cdn-surfline.com"
      );
    });

    it("should include X-HLS-Proxy-Bytes header", async () => {
      const data = new ArrayBuffer(2048);
      mockUpstreamResponse(data);

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/segment.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "segment.ts",
      ]);

      const response = await GET(request, context);
      expect(response.headers.get("X-HLS-Proxy-Bytes")).toBe("2048");
    });

    it("should include X-HLS-Proxy-Ms header (timing)", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/playlist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      const ms = parseInt(response.headers.get("X-HLS-Proxy-Ms") || "0", 10);
      expect(ms).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Response size limits
  // ---------------------------------------------------------------------------
  describe("Response Size Limits", () => {
    it("should reject response exceeding 10MB via Content-Length header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-length": String(11 * 1024 * 1024),
        }),
        arrayBuffer: () =>
          Promise.resolve(new ArrayBuffer(11 * 1024 * 1024)),
      });

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/large-segment.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "large-segment.ts",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(413);
    });

    it("should reject response exceeding 10MB via body size", async () => {
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}), // No content-length header
        arrayBuffer: () => Promise.resolve(largeBuffer),
      });

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/large-segment.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "large-segment.ts",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(413);
    });

    it("should allow response under 10MB", async () => {
      const buffer = new ArrayBuffer(5 * 1024 * 1024);
      mockUpstreamResponse(buffer);

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/segment.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "segment.ts",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Upstream error handling
  // ---------------------------------------------------------------------------
  describe("Upstream Error Handling", () => {
    it("should return upstream status on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({}),
      });

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/missing.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "missing.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(404);
    });

    it("should return 504 on request timeout (AbortError)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/slow.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "slow.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(504);
    });

    it("should return 502 on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/stream.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "stream.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(502);
    });
  });

  // ---------------------------------------------------------------------------
  // Range request forwarding
  // ---------------------------------------------------------------------------
  describe("Range Request Forwarding", () => {
    it("should forward Range header to upstream", async () => {
      mockUpstreamResponse(new ArrayBuffer(1024), {
        status: 206,
      });

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/segment.ts",
        { Range: "bytes=0-1023" }
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "segment.ts",
      ]);

      await GET(request, context);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Range).toBe("bytes=0-1023");
    });

    it("should not send Range header if not present in request", async () => {
      mockUpstreamResponse(new ArrayBuffer(1024));

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/segment.ts"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "segment.ts",
      ]);

      await GET(request, context);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Range).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // URL construction
  // ---------------------------------------------------------------------------
  describe("URL Construction", () => {
    it("should construct correct upstream URL from path segments", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/cam/12345/chunklist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "cam",
        "12345",
        "chunklist.m3u8",
      ]);

      await GET(request, context);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe(
        "https://hls.cdn-surfline.com/cam/12345/chunklist.m3u8"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // HDOnTap support
  // ---------------------------------------------------------------------------
  describe("HDOnTap Support", () => {
    it("should allow live.hdontap.com through the whitelist", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8"
      );
      const context = createContext([
        "live.hdontap.com",
        "hls",
        "hosb1",
        "stream.stream",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not send Referer header for HDOnTap (no extra headers configured)", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/live.hdontap.com/hls/stream/playlist.m3u8"
      );
      const context = createContext([
        "live.hdontap.com",
        "hls",
        "stream",
        "playlist.m3u8",
      ]);

      await GET(request, context);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Referer).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Query string forwarding
  // ---------------------------------------------------------------------------
  describe("Query String Forwarding", () => {
    it("should forward query string to upstream for HDOnTap signed URLs", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999"
      );
      const context = createContext([
        "live.hdontap.com",
        "hls",
        "hosb1",
        "stream.stream",
        "playlist.m3u8",
      ]);

      await GET(request, context);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe(
        "https://live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999"
      );
    });

    it("should not append query string when none is present (Surfline regression)", async () => {
      mockUpstreamResponse("#EXTM3U\n");

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/cam/12345/playlist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "cam",
        "12345",
        "playlist.m3u8",
      ]);

      await GET(request, context);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe(
        "https://hls.cdn-surfline.com/cam/12345/playlist.m3u8"
      );
    });
  });
});
