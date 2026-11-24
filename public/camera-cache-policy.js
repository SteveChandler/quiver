(() => {
  /** Recognize the retired provider in direct URLs and Quiver media URLs. */
  function isHdontapHostname(hostname) {
    const host = hostname.toLowerCase().replace(/\.+$/, "");
    return host === "hdontap.com" || host.endsWith(".hdontap.com");
  }

  function decodeUrl(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function blockedUrl(value, depth) {
    if (depth === 5) return true;
    const url = new URL(value, "https://www.quiversurf.app");
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (isHdontapHostname(url.hostname)) return true;

    const pathname = decodeUrl(url.pathname);
    // This resort page embeds the provider rather than exposing its URL directly.
    if (url.hostname.toLowerCase().replace(/\.+$/, "").replace(/^www\./, "") === "hanaleibayresort.com" &&
        pathname.replace(/\/+$/, "") === "/live-web-camera") return true;
    const proxyHost = pathname.match(/^\/api\/hls-proxy\/([^/]+)/)?.[1];
    if (proxyHost && isHdontapHostname(proxyHost)) return true;

    if (["/api/cam-resolve", "/api/image-proxy", "/_next/image"].includes(pathname)) {
      const source = url.searchParams.get("url");
      return source !== null && blockedUrl(source, depth + 1);
    }

    // WordPress image CDN encodes the source host as the first path segment.
    if (/^i[012]\.wp\.com$/.test(url.hostname)) {
      return isHdontapHostname(pathname.split("/")[1] ?? "");
    }

    if (!/^(?:https?:)?[/\\]{2}/i.test(value.trim())) {
      const decoded = decodeUrl(value);
      return decoded !== value && blockedUrl(decoded, depth + 1);
    }
    return false;
  }

  function isBlockedCameraUrl(value) {
    if (!value) return false;
    try {
      return blockedUrl(value, 0);
    } catch {
      // Invalid URLs cannot be fetched by the media boundaries.
      return false;
    }
  }

  async function evictCameraCacheEntries() {
    await Promise.all(["beaches-api", "images"].map(async (name) => {
      if (!(await caches.has(name))) return;
      const cache = await caches.open(name);
      const requests = await cache.keys();
      await Promise.all(requests.filter((request) => {
        const url = new URL(request.url);
        return isBlockedCameraUrl(request.url) ||
          (name === "beaches-api" && /^\/api\/beaches\/[^/]+\/sources\/?$/.test(url.pathname));
      }).map((request) => cache.delete(request)));
    }));
  }

  if (typeof window === "undefined") {
    self.addEventListener("fetch", (event) => {
      if (!isBlockedCameraUrl(event.request.url)) return;
      event.stopImmediatePropagation();
      event.respondWith(new Response("Camera unavailable", {
        status: 410, headers: { "Cache-Control": "no-store" },
      }));
    });
    self.addEventListener("activate", (event) => {
      event.waitUntil(evictCameraCacheEntries());
    });
  } else if ("caches" in window) {
    void evictCameraCacheEntries().catch(() => {
      // Cache storage can be disabled by browser settings.
    });
  }
})();
