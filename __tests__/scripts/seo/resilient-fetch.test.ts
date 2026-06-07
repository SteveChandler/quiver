import {
  fetchWithRetry,
  getLocalNetworkBlocker,
  isRemoteFetchError,
  normalizeFetchError,
} from "@/scripts/seo/resilient-fetch";

describe("resilient-fetch", () => {
  const originalFetch = global.fetch;
  const originalNetworkDisabled = process.env.CODEX_SANDBOX_NETWORK_DISABLED;

  beforeEach(() => {
    delete process.env.CODEX_SANDBOX_NETWORK_DISABLED;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    if (originalNetworkDisabled === undefined) {
      delete process.env.CODEX_SANDBOX_NETWORK_DISABLED;
    } else {
      process.env.CODEX_SANDBOX_NETWORK_DISABLED = originalNetworkDisabled;
    }
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

  it("reports Codex shell sandbox network disablement before remote fetch retries", async () => {
    process.env.CODEX_SANDBOX_NETWORK_DISABLED = "1";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(fetchWithRetry("https://example.com", {}, {
      retries: 3,
      retryDelayMs: 1,
      timeoutMs: 1000,
    })).rejects.toThrow("CODEX_SANDBOX_NETWORK_DISABLED=1");

    expect(getLocalNetworkBlocker()).toContain("CODEX_SANDBOX_NETWORK_DISABLED=1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
