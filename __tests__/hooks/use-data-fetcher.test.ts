import { renderHook, act, waitFor } from "@testing-library/react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

describe("useDataFetcher", () => {
  it("sets loading then data on success", async () => {
    const fetcher = jest.fn().mockResolvedValue({ hello: "world" });
    const { result } = renderHook(() => useDataFetcher(fetcher));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ hello: "world" });
    expect(result.current.error).toBeNull();
  });

  it("captures and exposes errors", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("Nope"));
    const { result } = renderHook(() => useDataFetcher(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Nope");
  });

  it("supports refetch and reset", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ a: 1 })
      .mockResolvedValueOnce({ a: 2 });

    const { result } = renderHook(() => useDataFetcher(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ a: 1 });

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({ a: 2 });

    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("respects skip and triggers when skip flips to false", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    const { result, rerender } = renderHook(
      ({ skip }) => useDataFetcher(fetcher, { immediate: true, skip }),
      {
        initialProps: { skip: true },
      }
    );

    expect(result.current.loading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ skip: false });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
