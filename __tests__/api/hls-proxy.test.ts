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

const mockDelay = jest.fn();
jest.mock("node:timers/promises", () => ({
  setTimeout: (...args: unknown[]) => mockDelay(...args),
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
    mockDelay.mockReset().mockResolvedValue(undefined);
  });

  describe("HDOnTap cold source playlists", () => {
    const context = () => createContext(["live.hdontap.com", "hls", "cam", "chunklist.m3u8"]);
    const request = () => createRequest("/api/hls-proxy/live.hdontap.com/hls/cam/chunklist.m3u8");
    const manifest = (segment: string) => `#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:10,\n${segment}\n`;
    const edge = "https://edge01.virginia.nginx.hdontap.com/cam/";

    it("replaces an expired HTTP 200 playlist before the browser sees its broken segment", async () => {
      mockUpstreamResponse(manifest(`${edge}expired.ts`));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockUpstreamResponse(manifest(`${edge}current.ts`));
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      const response = await GET(request(), context());
      expect(response.status).toBe(200);
      expect(response.headers.get("X-HLS-Proxy-Attempts")).toBe("2");
      const body = await response.text();
      expect(body).toContain("current.ts");
      expect(body).not.toContain("expired.ts");
      const signal = mockFetch.mock.calls[0][1].signal;
      expect(mockDelay).toHaveBeenCalledWith(2000, undefined, { signal });
      expect(mockFetch.mock.calls[1]).toEqual([`${edge}expired.ts`, { method: "HEAD", cache: "no-store", redirect: "error", signal }]);
      expect(mockFetch.mock.calls[3][1].signal).toBe(signal);
    });

    it("stops after four expired playlists and returns an uncached source failure", async () => {
      for (let i = 0; i < 4; i++) {
        mockUpstreamResponse(manifest(`${edge}expired.ts`));
        mockFetch.mockResolvedValueOnce({ ok: false, status: 410 });
      }
      const response = await GET(request(), context());
      expect(response.status).toBe(502);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).not.toContain("expired.ts");
      expect(mockFetch).toHaveBeenCalledTimes(8);
      expect(mockDelay.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000, 6000]);
    });

    it.each([
      "https://edge01.nginx.hdontap.com.evil.test/segment.ts",
      "https://user@edge01.nginx.hdontap.com/segment.ts",
      "https://127.0.0.1/segment.ts",
      "https://edge01.nginx.hdontap.com:8443/segment.ts",
      "http://edge01.nginx.hdontap.com/segment.ts",
    ])("never probes an untrusted media URL: %s", async (url) => {
      mockUpstreamResponse(manifest(url));
      expect((await GET(request(), context())).status).toBe(502);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockDelay).not.toHaveBeenCalled();
    });

    it("does not retry unrelated source failures", async () => {
      mockUpstreamResponse(manifest(`${edge}unavailable.ts`));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      const response = await GET(request(), context());
      expect(response.status).toBe(502);
      expect(mockFetch.mock.calls[1][1].redirect).toBe("error");
      expect(mockDelay).not.toHaveBeenCalled();
    });

    it.each(["probe", "backoff"])("keeps the original deadline during %s", async (phase) => {
      jest.useFakeTimers();
      try {
        mockUpstreamResponse(manifest(`${edge}expired.ts`));
        const waitForAbort = (signal: AbortSignal): Promise<never> => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })), { once: true });
        });
        if (phase === "probe") {
          mockFetch.mockImplementationOnce((_url, { signal }) => waitForAbort(signal));
        } else {
          mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
          mockDelay.mockImplementationOnce((_ms, _value, { signal }) => waitForAbort(signal));
        }
        const response = GET(request(), context());
        await jest.advanceTimersByTimeAsync(15000);
        expect((await response).status).toBe(504);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
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

    it.each(["evil.example.com", "constructor", "__proto__"])("rejects non-whitelisted host %s before fetching", async (hostname) => {
      const request = createRequest(
        `http://localhost/api/hls-proxy/${hostname}/steal-data`
      );
      const context = createContext([hostname, "steal-data"]);

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
    it("must not serve cached live manifests", async () => {
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
        "no-store"
      );
    });

    it("refreshes HDOnTap playlists without losing provider query parameters", async () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date("2026-09-07T16:10:00Z"));
        const request = createRequest("/api/hls-proxy/live.hdontap.com/hls/cam/chunklist.m3u8?token=a%2Bb&quality=high");
        const context = createContext(["live.hdontap.com", "hls", "cam", "chunklist.m3u8"]);
        mockUpstreamResponse("#EXTM3U\nold.ts");
        const first = await GET(request, context);
        jest.advanceTimersByTime(12_000);
        mockUpstreamResponse("#EXTM3U\nnew.ts");
        const second = await GET(request, context);
        const urls = mockFetch.mock.calls.map(([url]) => new URL(url));
        expect(urls[0].searchParams.get("_quiver_live")).toBe("1788797400000");
        expect(urls[1].searchParams.get("_quiver_live")).toBe("1788797412000");
        for (const [url, options] of mockFetch.mock.calls) {
          expect(new URL(url).searchParams.get("token")).toBe("a+b");
          expect(new URL(url).searchParams.get("quality")).toBe("high");
          expect(options.cache).toBe("no-store");
          expect(options.headers["Cache-Control"]).toBe("no-cache");
        }
        expect(await first.text()).toContain("old.ts");
        expect(await second.text()).toContain("new.ts");
        expect(second.headers.get("Cache-Control")).toBe("no-store");
      } finally {
        jest.useRealTimers();
      }
    });

    it("times out a source whose headers arrive but body stalls", async () => {
      jest.useFakeTimers();
      try {
        mockFetch.mockImplementationOnce(async (_url, { signal }) => ({
          ok: true, status: 200, headers: new Headers(),
          arrayBuffer: () => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })), { once: true });
          }),
        }));
        const response = GET(createRequest("/api/hls-proxy/live.hdontap.com/playlist.m3u8"), createContext(["live.hdontap.com", "playlist.m3u8"]));
        await jest.advanceTimersByTimeAsync(15_000);
        expect((await response).status).toBe(504);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
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
  // Manifest URL rewriting (absolute → proxy-relative)
  // ---------------------------------------------------------------------------
  describe("Manifest URL Rewriting", () => {
    it("should rewrite absolute HDOnTap URLs to proxy-relative paths", async () => {
      const manifest = [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:BANDWIDTH=2000000",
        "https://live.hdontap.com/hls/hosb1/stream.stream/chunklist.m3u8",
        "",
      ].join("\n");
      mockUpstreamResponse(manifest);

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
      const body = await response.text();

      expect(body).toContain(
        "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/chunklist.m3u8"
      );
      expect(body).not.toContain("https://live.hdontap.com");
    });

    it("should preserve relative URLs unchanged (Surfline compatibility)", async () => {
      const manifest = [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:BANDWIDTH=2000000",
        "chunklist_w123.m3u8",
        "",
      ].join("\n");
      mockUpstreamResponse(manifest);

      const request = createRequest(
        "http://localhost/api/hls-proxy/hls.cdn-surfline.com/cam/12345/playlist.m3u8"
      );
      const context = createContext([
        "hls.cdn-surfline.com",
        "cam",
        "12345",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      const body = await response.text();

      expect(body).toContain("chunklist_w123.m3u8");
      expect(body).not.toContain("/api/hls-proxy/");
    });

    it("should NOT rewrite URLs for non-allowed hosts", async () => {
      const manifest = [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:BANDWIDTH=2000000",
        "https://evil.example.com/hls/stream/chunklist.m3u8",
        "",
      ].join("\n");
      mockUpstreamResponse(manifest);

      const request = createRequest(
        "http://localhost/api/hls-proxy/live.hdontap.com/hls/stream/playlist.m3u8"
      );
      const context = createContext([
        "live.hdontap.com",
        "hls",
        "stream",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      const body = await response.text();

      expect(body).toContain("https://evil.example.com/hls/stream/chunklist.m3u8");
    });

    it("should NOT modify binary .ts segment responses", async () => {
      const binaryData = new Uint8Array([0x47, 0x40, 0x00, 0x10, 0xff]);
      mockUpstreamResponse(binaryData.buffer);

      const request = createRequest(
        "http://localhost/api/hls-proxy/live.hdontap.com/hls/stream/segment0.ts"
      );
      const context = createContext([
        "live.hdontap.com",
        "hls",
        "stream",
        "segment0.ts",
      ]);

      const response = await GET(request, context);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      expect(bytes).toEqual(binaryData);
    });

    it("should handle multiple absolute URLs in multivariant manifests", async () => {
      const manifest = [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:BANDWIDTH=800000",
        "https://live.hdontap.com/hls/hosb1/stream.stream/chunklist_low.m3u8",
        "#EXT-X-STREAM-INF:BANDWIDTH=2000000",
        "https://live.hdontap.com/hls/hosb1/stream.stream/chunklist_high.m3u8",
        "",
      ].join("\n");
      mockUpstreamResponse(manifest);

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
      const body = await response.text();

      expect(body).toContain(
        "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/chunklist_low.m3u8"
      );
      expect(body).toContain(
        "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/chunklist_high.m3u8"
      );
      expect(body).not.toContain("https://live.hdontap.com");
    });

    it("should preserve query parameters with signed tokens", async () => {
      const manifest = [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:BANDWIDTH=2000000",
        "https://live.hdontap.com/hls/hosb1/stream/chunklist.m3u8?t=abc123&e=9999999999",
        "",
      ].join("\n");
      mockUpstreamResponse(manifest);

      const request = createRequest(
        "http://localhost/api/hls-proxy/live.hdontap.com/hls/hosb1/stream/playlist.m3u8"
      );
      const context = createContext([
        "live.hdontap.com",
        "hls",
        "hosb1",
        "stream",
        "playlist.m3u8",
      ]);

      const response = await GET(request, context);
      const body = await response.text();

      expect(body).toContain(
        "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream/chunklist.m3u8?t=abc123&e=9999999999"
      );
      expect(body).not.toContain("https://live.hdontap.com");
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
      const upstreamUrl = new URL(fetchCall[0]);
      expect(upstreamUrl.origin + upstreamUrl.pathname).toBe("https://live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8");
      expect(upstreamUrl.searchParams.get("t")).toBe("abc123");
      expect(upstreamUrl.searchParams.get("e")).toBe("9999999999");
      expect(upstreamUrl.searchParams.get("_quiver_live")).toMatch(/^\d+$/);
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


describe('HDRelay Apple playlist compatibility', () => {
  beforeEach(() => mockFetch.mockReset());
  it('rejects non-media HDRelay paths', async () => {
    const response = await GET(createRequest('/api/hls-proxy/watch.hdrelay.io/api/player'), createContext(['watch.hdrelay.io', 'api', 'player']));
    expect(response.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('keeps complete segments and initialization while dropping low-latency tags', async () => {
    const manifest = '#EXTM3U\n#EXT-X-VERSION:10\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:10\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES\n#EXT-X-PART-INF:PART-TARGET=0.2\n#EXTINF:2.0,\nsegment.mp4\n#EXT-X-PART:DURATION=0.2,URI="part.mp4"\n#EXT-X-PRELOAD-HINT:TYPE=PART,URI="next.mp4"\n';
    mockUpstreamResponse(manifest);
    const response = await GET(createRequest('/api/hls-proxy/watch.hdrelay.io/live/cam/stream.m3u8'), createContext(['watch.hdrelay.io', 'live', 'cam', 'stream.m3u8']));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('#EXT-X-VERSION:6');
    expect(text).toContain('#EXT-X-MAP:URI="init.mp4"');
    expect(text).toContain('#EXT-X-MEDIA-SEQUENCE:10');
    expect(text).toContain('#EXTINF:2.0,\nsegment.mp4');
    expect(text).not.toMatch(/EXT-X-(PART|PRELOAD-HINT|SERVER-CONTROL)/);
  });
});
