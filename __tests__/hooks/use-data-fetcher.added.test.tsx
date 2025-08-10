import { renderHook, act } from "@testing-library/react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

describe("useDataFetcher (added tests)", () => {
  test("success path sets data and clears loading", async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() =>
      useDataFetcher(fetchFn, { immediate: true })
    );

    // Allow the promise to resolve
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ ok: true });
  });

  test("error path sets error and allows retry", async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() =>
      useDataFetcher(fetchFn, { immediate: true })
    );

    // Wait for first failure
    await act(async () => {});
    expect(result.current.error).toBe("boom");
    expect(result.current.loading).toBe(false);

    // Retry should set loading then succeed
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ ok: true });
  });

  test("skip prevents immediate fetch, then unskip triggers fetch", async () => {
    let skip = true;
    const fetchFn = jest.fn().mockResolvedValue({ ok: true });
    const { result, rerender } = renderHook(
      ({ s }) => useDataFetcher(fetchFn, { immediate: true, skip: s }),
      {
        initialProps: { s: skip },
      }
    );

    expect(result.current.loading).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();

    // Unskip triggers fetch
    skip = false;
    rerender({ s: skip });
    await act(async () => {});
    expect(fetchFn).toHaveBeenCalled();
    expect(result.current.data).toEqual({ ok: true });
  });
});
