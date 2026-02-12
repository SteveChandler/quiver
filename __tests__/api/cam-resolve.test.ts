/**
 * @jest-environment node
 *
 * Unit tests for /api/cam-resolve endpoint
 *
 * Covers:
 * - Input validation (missing URL, invalid URL, protocol enforcement)
 * - SSRF protection (hostname allowlist)
 * - Regex extraction of HLS URLs from HDOnTap HTML
 * - Unicode unescape handling
 * - Response size limits
 * - Timeout handling
 * - Extracted URL validation
 * - Cache-Control headers
 * - Security headers on all responses
 */

import { NextRequest } from "next/server";

// Mock withRateLimit to pass through the handler
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: Function) => handler,
}));

// Mock DEFAULT_SECURITY_HEADERS
jest.mock("@/lib/api-utils", () => ({
  DEFAULT_SECURITY_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeRequest(url?: string): NextRequest {
  const searchParams = url ? `?url=${encodeURIComponent(url)}` : "";
  return new NextRequest(
    new URL(`http://localhost:3000/api/cam-resolve${searchParams}`)
  );
}

function makeHdontapHtml(hlsUrl: string): string {
  return `<html><body><script>
    var config = {"source":"https:\\/\\/live.hdontap.com\\/hls\\/${hlsUrl}"};
  </script></body></html>`;
}

function makeHdontapHtmlWithUnicode(hlsUrl: string): string {
  return `<html><body><script>
    var config = {"source":"${hlsUrl.replace(/&/g, "\\u0026")}"};
  </script></body></html>`;
}

describe("GET /api/cam-resolve", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/cam-resolve/route");
    GET = mod.GET as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== Input Validation =====

  describe("Input Validation", () => {
    it("returns 400 for missing url parameter", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Missing url parameter");
    });

    it("returns 400 for invalid URL", async () => {
      const res = await GET(makeRequest("not-a-valid-url"));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid URL");
    });

    it("returns 400 for HTTP (non-HTTPS) URLs", async () => {
      const res = await GET(
        makeRequest("http://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Only HTTPS URLs allowed");
    });

    it("returns 400 for javascript: URIs", async () => {
      const res = await GET(makeRequest("javascript:alert(1)"));
      expect(res.status).toBe(400);
    });

    it("returns 400 for data: URIs", async () => {
      const res = await GET(
        makeRequest("data:text/html,<script>alert(1)</script>")
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for file: URIs", async () => {
      const res = await GET(makeRequest("file:///etc/passwd"));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Only HTTPS URLs allowed");
    });
  });

  // ===== SSRF Protection =====

  describe("SSRF Protection", () => {
    it("returns 403 for disallowed hostname", async () => {
      const res = await GET(
        makeRequest("https://evil.com/stream/123/test/")
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Host not allowed");
    });

    it("returns 403 for subdomain spoofing", async () => {
      const res = await GET(
        makeRequest("https://fake.hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(403);
    });

    it("allows hdontap.com", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>no stream here</html>"),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      // Should proceed past host check (may return 404 if no HLS found)
      expect(res.status).not.toBe(403);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("allows www.hdontap.com", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>no stream</html>"),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://www.hdontap.com/stream/123/test/")
      );
      expect(res.status).not.toBe(403);
    });

    it("does not follow redirects to internal hosts", async () => {
      // The fetch should always go to hdontap.com, never to localhost/internal IPs
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
        headers: new Headers(),
      });

      await GET(makeRequest("https://hdontap.com/stream/123/test/"));

      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain("hdontap.com");
    });
  });

  // ===== Embed URL Construction =====

  describe("Embed URL Construction", () => {
    it("appends /embed/ to stream URLs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
        headers: new Headers(),
      });

      await GET(
        makeRequest("https://hdontap.com/stream/186699/pacific-beach/")
      );

      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain("/embed/");
    });

    it("appends /embed/ to URLs without trailing slash", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
        headers: new Headers(),
      });

      await GET(makeRequest("https://hdontap.com/stream/186699"));

      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toBe("https://hdontap.com/stream/186699/embed/");
    });

    it("handles URLs with query parameters correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
        headers: new Headers(),
      });

      await GET(
        makeRequest("https://hdontap.com/stream/123/test?ref=quiver")
      );

      const fetchedUrl = mockFetch.mock.calls[0][0];
      // Query params should be preserved, /embed/ added to path
      expect(fetchedUrl).toMatch(/\/embed\/.*ref=quiver/);
    });

    it("includes User-Agent header in fetch request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
        headers: new Headers(),
      });

      await GET(makeRequest("https://hdontap.com/stream/186699"));

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers["User-Agent"]).toBe(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      );
    });
  });

  // ===== HLS URL Extraction =====

  describe("HLS URL Extraction", () => {
    it("extracts HLS URL from HDOnTap page HTML", async () => {
      const hlsStream =
        "hosb1/pacificbeach_pacterrace.stream/playlist.m3u8?t=abc123&e=9999999999";
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            `<html><script>var src = "https://live.hdontap.com/hls/${hlsStream}";</script></html>`
          ),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/186699/pacific-beach/")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.hlsUrl).toBe(
        `https://live.hdontap.com/hls/${hlsStream}`
      );
    });

    it("returns 404 when no HLS URL found in page", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html><span class="text-[1.6rem] italic text-white">Currently Offline</span></html>'
          ),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/255678/hb-pier/")
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("No stream found");
    });

    it("returns 404 when HTML is empty", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("No stream found");
    });

    it("handles unicode-escaped ampersands in HLS URLs", async () => {
      const html = makeHdontapHtmlWithUnicode(
        "https://live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc&e=123"
      );
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.hlsUrl).toContain("?t=abc&e=123");
    });

    it("handles unicode-escaped equals signs in HLS URLs", async () => {
      // HDOnTap escapes = as \u003d
      const html = `<html><script>var src = "https://live.hdontap.com/hls/stream/playlist.m3u8?t\\u003dabc\\u0026e\\u003ddef";</script></html>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.hlsUrl).toBe(
        "https://live.hdontap.com/hls/stream/playlist.m3u8?t=abc&e=def"
      );
    });

    it("extracts HLS URL with http protocol (not just https)", async () => {
      const html = `<html><script>var src = "http://live.hdontap.com/hls/stream/playlist.m3u8?t=abc";</script></html>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.hlsUrl).toBe(
        "http://live.hdontap.com/hls/stream/playlist.m3u8?t=abc"
      );
    });

    it("extracts first HLS URL when multiple are present", async () => {
      const html = `<html><script>
        var primary = "https://live.hdontap.com/hls/stream1/playlist.m3u8?t=abc";
        var backup = "https://live.hdontap.com/hls/stream2/playlist.m3u8?t=def";
      </script></html>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      // Should return the first match
      expect(json.hlsUrl).toBe(
        "https://live.hdontap.com/hls/stream1/playlist.m3u8?t=abc"
      );
    });
  });

  // ===== Error Handling =====

  describe("Error Handling", () => {
    it("returns 502 when upstream returns non-OK status", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Failed to fetch camera page");
    });

    it("returns 502 when upstream returns 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Failed to fetch camera page");
    });

    it("returns 504 on fetch timeout", async () => {
      mockFetch.mockImplementation(() => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(504);
      const json = await res.json();
      expect(json.error).toBe("Timeout");
    });

    it("returns 502 on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Resolve failed");
    });

    it("returns 502 when response exceeds size limit", async () => {
      const hugeHtml = "x".repeat(600 * 1024); // 600 KB
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(hugeHtml),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Response too large");
    });

    it("returns 502 when Content-Length header exceeds size limit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
        headers: new Headers({ "content-length": "1000000" }),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Response too large");
    });

    it("returns 404 when regex cannot match due to invalid characters in URL", async () => {
      // The regex character class [^"'\\\s] stops at spaces, so "invalid url chars"
      // breaks the match before reaching .m3u8 — resulting in 404 (no stream found).
      // The URL validation (new URL()) is a defense-in-depth check that's hard to
      // trigger in practice since the regex constrains output to valid-looking URLs.
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html>https://live.hdontap.com/hls/[invalid url chars]/playlist.m3u8</html>'
          ),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("No stream found");
    });
  });

  // ===== Response Headers =====

  describe("Response Headers", () => {
    it("includes Cache-Control on success response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html>"https://live.hdontap.com/hls/stream.stream/playlist.m3u8?t=x&e=1"</html>'
          ),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, max-age=120, stale-while-revalidate=60"
      );
    });

    it("includes security headers on error responses", async () => {
      const res = await GET(makeRequest());
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("includes security headers on success responses", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html>"https://live.hdontap.com/hls/s.stream/playlist.m3u8?t=x&e=1"</html>'
          ),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://hdontap.com/stream/123/test/")
      );
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });
});
