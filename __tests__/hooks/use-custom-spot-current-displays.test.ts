import { renderHook, waitFor } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { useCustomSpotCurrentDisplays } from "@/hooks/use-custom-spot-current-displays";

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

describe("useCustomSpotCurrentDisplays", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.mocked(Sentry.captureException).mockClear();
  });

  it("loads adjusted labels for the given spots with the caller's token", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { displays: { b: { label: "3ft" } } } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useCustomSpotCurrentDisplays(["b", "a", "b"], "k", () => "token"));

    await waitFor(() => expect(result.current.get("b")?.label).toBe("3ft"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-spots/current-display?ids=a,b",
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
  });

  it("retries as a guest when the token is rejected", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { displays: { a: { label: "2ft" } } } }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const onExpired = jest.fn();

    const { result } = renderHook(() => useCustomSpotCurrentDisplays(["a"], "k", () => "old", onExpired));

    await waitFor(() => expect(result.current.get("a")?.label).toBe("2ft"));
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/custom-spots/current-display?ids=a", expect.not.objectContaining({ headers: expect.anything() }));
  });

  it("refetches when the anchors' current rows change", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { displays: {} } }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { rerender } = renderHook(({ key }) => useCustomSpotCurrentDisplays(["a"], key), { initialProps: { key: "15:00" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender({ key: "15:00" });
    rerender({ key: "18:00" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("does not fetch without spots and keeps pins on the anchor label after a failure", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("offline"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const empty = renderHook(() => useCustomSpotCurrentDisplays([], "k"));
    expect(empty.result.current.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();

    const failed = renderHook(() => useCustomSpotCurrentDisplays(["a"], "k"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(failed.result.current.size).toBe(0);
  });

  it("drops the previous hour's labels when the browser cannot reach the route, without reporting", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { displays: { a: { label: "3ft" } } } }) })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result, rerender } = renderHook(({ key }) => useCustomSpotCurrentDisplays(["a"], key), { initialProps: { key: "15:00" } });
    await waitFor(() => expect(result.current.get("a")?.label).toBe("3ft"));

    rerender({ key: "18:00" });

    await waitFor(() => expect(result.current.size).toBe(0));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("drops the previous labels and reports a response body that is not JSON", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { displays: { a: { label: "3ft" } } } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result, rerender } = renderHook(({ key }) => useCustomSpotCurrentDisplays(["a"], key), { initialProps: { key: "15:00" } });
    await waitFor(() => expect(result.current.get("a")?.label).toBe("3ft"));

    rerender({ key: "18:00" });

    await waitFor(() => expect(result.current.size).toBe(0));
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(SyntaxError), expect.anything());
  });

  it("drops the previous labels and reports a server error response", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { displays: { a: { label: "3ft" } } } }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result, rerender } = renderHook(({ key }) => useCustomSpotCurrentDisplays(["a"], key), { initialProps: { key: "15:00" } });
    await waitFor(() => expect(result.current.get("a")?.label).toBe("3ft"));

    rerender({ key: "18:00" });

    await waitFor(() => expect(result.current.size).toBe(0));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("does not report a request it aborted itself", async () => {
    const fetchMock = jest.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { unmount } = renderHook(() => useCustomSpotCurrentDisplays(["a"], "k"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
