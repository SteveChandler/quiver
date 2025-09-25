const CACHE_NAME = "quiver-forecast-cache-v1";
const FORECAST_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (!isForecastRequest(url)) {
    return;
  }

  event.respondWith(handleForecastRequest(request));
});

function isForecastRequest(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/api/forecasts");
}

async function handleForecastRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const stamped = await stampResponse(networkResponse.clone());
      await cache.put(request, stamped);
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (!cachedResponse) {
      throw error;
    }

    const timestamp = cachedResponse.headers.get("x-quiver-cache-timestamp");
    if (!timestamp) {
      return cachedResponse;
    }

    const age = Date.now() - Number(timestamp);
    if (Number.isFinite(age) && age > FORECAST_TTL_MS) {
      return markResponseStale(cachedResponse, age);
    }

    return cachedResponse;
  }
}

async function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("x-quiver-cache-timestamp", Date.now().toString());
  headers.set("x-quiver-cache-source", "network");
  const body = await response.clone().arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function markResponseStale(response, ageMs) {
  const headers = new Headers(response.headers);
  headers.set("x-quiver-cache-stale", "true");
  headers.set("x-quiver-cache-age", ageMs.toString());
  headers.set("x-quiver-cache-source", "offline");
  const body = await response.clone().arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
