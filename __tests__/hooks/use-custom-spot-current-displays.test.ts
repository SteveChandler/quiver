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

    const { result } = renderHook(() => useCustomSpotCurrentDisplays(["b", "a", "b"], () => "token"));

    await waitFor(() => expect(result.current.get("b")?.label).toBe("3ft"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-spots/current-display?ids=a,b",
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
  });

  it("does not fetch without spots and keeps pins on the anchor label after a failure", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("offline"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const empty = renderHook(() => useCustomSpotCurrentDisplays([]));
    expect(empty.result.current.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();

    const failed = renderHook(() => useCustomSpotCurrentDisplays(["a"]));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(failed.result.current.size).toBe(0);
  });
});
