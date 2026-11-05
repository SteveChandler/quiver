import { renderHook, waitFor } from "@testing-library/react";
import { useCustomSpotCurrentDisplays } from "@/hooks/use-custom-spot-current-displays";

describe("useCustomSpotCurrentDisplays", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
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
});
