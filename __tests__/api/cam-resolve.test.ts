/**
 * @jest-environment node
 *
 * Unit tests for /api/cam-resolve endpoint
 *
 * Covers:
 * - Input validation (missing URL, invalid URL, protocol enforcement)
 * - SSRF protection (hostname allowlist)
 * - Retired provider blocked before requests
 * - Response size limits
 * - Timeout handling
 * - Extracted URL validation
 * - Cache-Control headers
 * - Security headers on all responses
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

// Mock withRateLimit to pass through the handler
jest.mock("@/lib/middleware/api-wrappers", () => ({
  DEFAULT_SECURITY_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  },
  withRateLimit: (handler: (request: NextRequest) => Promise<Response>) =>
    handler,
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

describe("GET /api/cam-resolve", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  it("uses the shared API wrapper module for security headers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/cam-resolve/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  beforeAll(async () => {
    const mod = await import("@/app/api/cam-resolve/route");
    GET = mod.GET as any;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it.each([
    "https://hdontap.com/stream/123/",
    "https://PORTAL.HDONTAP.COM./s/embed",
    "https://live.%68dontap.com/playlist.m3u8",
    "https://edge123.us.nginx.hdontap.com/segment.ts",
    "https://storage.hdontap.com/preview.jpg",
    "/api/hls-proxy/live.hdontap.com/playlist.m3u8",
    "/_next/image?url=https%253A%252F%252Fstorage.hdontap.com%252Fstill.jpg",
  ])("returns 410 before fetch for %s", async (url) => {
    const res = await GET(makeRequest(url));
    expect(res.status).toBe(410);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a partner page redirect to the retired provider", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { Location: "https://hdontap.com/stream/123/" },
    }));
    const res = await GET(makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php"));
    expect(res.status).toBe(502);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1].redirect).toBe("manual");
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
        makeRequest("http://obhotel.com/webcam")
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
        makeRequest("https://hdontap.com.example.org/stream/123/test/")
      );
      expect(res.status).toBe(403);
    });

    it("does not follow redirects to internal hosts", async () => {
      // The fetch should always go to obhotel.com, never to localhost/internal IPs
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
        headers: new Headers(),
      });

      await GET(makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php"));

      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain("obhotel.com");
    });
  });

  // ===== Embed URL Construction =====

  describe("Error Handling", () => {
    it("returns 502 when upstream returns non-OK status", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
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
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Failed to fetch camera page");
    });

    it("returns 502 when primary fetch returns a redirect response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 301,
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Redirects not followed");
    });

    it("returns 504 on fetch timeout", async () => {
      mockFetch.mockImplementation(() => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(504);
      const json = await res.json();
      expect(json.error).toBe("Timeout");
    });

    it("returns 502 on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
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
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
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
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
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
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("No stream found");
    });
  });

  // ===== HDRelay (OB Hotel) =====

  describe("HDRelay (Port of Brookings Harbor)", () => {
    it("admits portofbrookingsharbor.com (not 403)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>no stream here</html>"),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html")
      );
      expect(res.status).not.toBe(403);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("does NOT append /embed/ to portofbrookingsharbor.com URLs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>no stream here</html>"),
        headers: new Headers(),
      });

      await GET(
        makeRequest("https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html")
      );

      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).not.toContain("/embed/");
      expect(fetchedUrl).toBe("https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html");
    });
  });

  describe("HDRelay (OB Hotel)", () => {
    it("admits obhotel.com (not 403)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>no stream here</html>"),
        headers: new Headers(),
      });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).not.toBe(403);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("does NOT append /embed/ to obhotel.com URLs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>no stream here</html>"),
        headers: new Headers(),
      });

      await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );

      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).not.toContain("/embed/");
      expect(fetchedUrl).toBe("https://www.obhotel.com/Webcam-Oceanbeach.php");
    });

    it("resolves HDRelay stream via manage.hdrelay.com config", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;
      const hdrelayConfig = {
        camera: { id: "1549b2bd-baa9-4eb6-a6bf-c7500a22dc90" },
        server: { hls: "//b16.hdrelay.com" },
      };

      mockFetch
        // First call: fetch the obhotel.com page
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        // Second call: fetch the HDRelay config
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(hdrelayConfig)),
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.hlsUrl).toBe(
        "https://b16.hdrelay.com/camera/1549b2bd-baa9-4eb6-a6bf-c7500a22dc90/relay/playlist.m3u8"
      );
    });

    it("sets longer Cache-Control for HDRelay streams", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;
      const hdrelayConfig = {
        camera: { id: "1549b2bd-baa9-4eb6-a6bf-c7500a22dc90" },
        server: { hls: "//b16.hdrelay.com" },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(hdrelayConfig)),
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, max-age=300, stale-while-revalidate=120"
      );
    });

    it("returns 502 when HDRelay config fetch fails", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("HDRelay config unavailable");
    });

    it("returns 502 when HDRelay config is missing camera field", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ server: { hls: "//b16.hdrelay.com" } })),
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("HDRelay config incomplete");
    });

    it("returns 502 when HDRelay config is missing servers.hls field", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ camera: { id: "1549b2bd-baa9-4eb6-a6bf-c7500a22dc90" } })),
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("HDRelay config incomplete");
    });

    it("fetches the HDRelay player config at the correct manage.hdrelay.com URL", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'ca0364a0-1c13-4e74-9ef1-2b1eac33423a'})
      </script></body></html>`;
      const hdrelayConfig = {
        camera: { id: "1549b2bd-baa9-4eb6-a6bf-c7500a22dc90" },
        server: { hls: "//b16.hdrelay.com" },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(hdrelayConfig)),
        });

      await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );

      const configFetchUrl = mockFetch.mock.calls[1][0];
      expect(configFetchUrl).toBe(
        "https://manage.hdrelay.com/player/ca0364a0-1c13-4e74-9ef1-2b1eac33423a"
      );
    });

    it("sends redirect: manual on the HDRelay config fetch", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;
      const hdrelayConfig = {
        camera: { id: "1549b2bd-baa9-4eb6-a6bf-c7500a22dc90" },
        server: { hls: "//b16.hdrelay.com" },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(hdrelayConfig)),
        });

      await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );

      const configFetchOptions = mockFetch.mock.calls[1][1];
      expect(configFetchOptions.redirect).toBe("manual");
    });

    it("returns 502 when HDRelay config fetch returns a redirect", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 302,
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Redirects not followed");
    });

    it("returns 502 when HDRelay config body exceeds 64 KB", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("x".repeat(65 * 1024)),
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("HDRelay config too large");
    });

    it("returns 502 when HDRelay hls server is not a trusted hdrelay.com subdomain", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;
      const maliciousConfig = {
        camera: { id: "1549b2bd-baa9-4eb6-a6bf-c7500a22dc90" },
        server: { hls: "//evil.example.com" },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(maliciousConfig)),
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Untrusted stream server");
    });

    it("accepts a valid *.hdrelay.com hls server", async () => {
      const pageHtml = `<html><body><script>
        HDRelay.create({target:'webcam_holder',id:'aabb1122-cc33-dd44-ee55-ff6677889900'})
      </script></body></html>`;
      const hdrelayConfig = {
        camera: { id: "1549b2bd-baa9-4eb6-a6bf-c7500a22dc90" },
        server: { hls: "//relay99.hdrelay.com" },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(pageHtml),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(hdrelayConfig)),
        });

      const res = await GET(
        makeRequest("https://www.obhotel.com/Webcam-Oceanbeach.php")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.hlsUrl).toContain("relay99.hdrelay.com");
    });
  });

  // ===== Surfline Embed Support =====

  describe("Surfline Embed Support", () => {
    it("resolves Surfline embed widgets to their native HLS stream", async () => {
      const camId = "5834a0733421b20545c4b584";
      const configId = "64ba68ebf1c960a93d1faba8f86cc16a3ed05913";
      const hlsUrl = "https://hls.cdn-surfline.com/oregon/wc-scripps/playlist.m3u8";

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ camId })),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                cam: {
                  streamUrl: hlsUrl,
                  isDown: { status: false },
                  isPremium: false,
                },
              })
            ),
        });

      const res = await GET(
        makeRequest(`https://embed.cdn-surfline.com/cams/${camId}/${configId}`)
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.hlsUrl).toBe(hlsUrl);
      expect(mockFetch.mock.calls[0][0]).toBe(
        `https://embed.cdn-surfline.com/cam-config/${configId}.json`
      );
      expect(mockFetch.mock.calls[1][0]).toBe(
        `https://embed.cdn-surfline.com/cam-details/${camId}.json`
      );
    });

    it("rejects Surfline config when the config cam id does not match the embed URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ camId: "different-surfline-cam-id" })
          ),
      });

      const res = await GET(
        makeRequest(
          "https://embed.cdn-surfline.com/cams/5834a0733421b20545c4b584/64ba68ebf1c960a93d1faba8f86cc16a3ed05913"
        )
      );

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Surfline config mismatch");
    });
  });

  // ===== Response Headers =====

  describe("Response Headers", () => {

    it("includes security headers on error responses", async () => {
      const res = await GET(makeRequest());
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

  });
});
