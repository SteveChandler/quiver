import {
  fetchWithRetry,
  isRemoteFetchError,
  normalizeFetchError,
} from "@/scripts/seo/resilient-fetch";

describe("resilient-fetch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("retries transient fetch failures and eventually succeeds", async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND example.com"))
      .mockResolvedValue(new Response("ok", { status: 200 }));

    global.fetch = fetchMock as typeof fetch;

    const response = await fetchWithRetry("https://example.com", {}, {
      retries: 3,
      retryDelayMs: 1,
      timeoutMs: 1000,
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry clear 4xx auth/config errors", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    global.fetch = fetchMock as typeof fetch;

    const response = await fetchWithRetry("https://example.com", {}, {
      retries: 3,
      retryDelayMs: 1,
      timeoutMs: 1000,
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes unknown errors", () => {
    expect(normalizeFetchError(new Error("boom"))).toBe("boom");
    expect(normalizeFetchError("plain string")).toBe("plain string");
  });

  it("separates remote fetch failures from local code errors", () => {
    expect(isRemoteFetchError(new Error("getaddrinfo ENOTFOUND example.com"))).toBe(true);
    expect(isRemoteFetchError(new Error("HTTP 503"))).toBe(true);
    expect(isRemoteFetchError(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });
});
