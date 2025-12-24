import { renderHook, waitFor } from "@testing-library/react";
import { useSessionPhotos } from "@/hooks/use-session-photos";
import type { SessionPhoto } from "@/lib/supabase/storage";

describe("useSessionPhotos", () => {
  const mockPhotos = [
    {
      id: "photo-1",
      public_url: "https://example.com/photo1.jpg",
      caption: "First photo",
      session_id: "session-123",
      user_id: "user-123",
      storage_path: "sessions/session-123/photo1.jpg",
      file_size: 1024,
      created_at: "2024-01-15T10:00:00Z",
    },
    {
      id: "photo-2",
      public_url: "https://example.com/photo2.jpg",
      caption: "Second photo",
      session_id: "session-123",
      user_id: "user-123",
      storage_path: "sessions/session-123/photo2.jpg",
      file_size: 2048,
      created_at: "2024-01-15T10:01:00Z",
    },
  ] as SessionPhoto[];

  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
  });

  it("should fetch photos successfully and return data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { photos: mockPhotos } }),
    });

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.photos).toEqual([]);
    expect(result.current.error).toBeNull();

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual(mockPhotos);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sessions/session-123/photos",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should handle loading state correctly", async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ success: true, data: { photos: mockPhotos } }),
            });
          }, 100);
        })
    );

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    // Should start loading
    expect(result.current.loading).toBe(true);
    expect(result.current.photos).toEqual([]);

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual(mockPhotos);
  });

  it("should handle error state when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "Server error" }),
    });

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.error).toContain("Failed to load photos");
  });

  it("should handle exception during fetch", async () => {
    const error = new Error("Network error");
    mockFetch.mockRejectedValue(error);

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.error).toBe("Network error");
  });

  it("should return empty array when sessionId is undefined", async () => {
    const { result } = renderHook(() => useSessionPhotos(undefined));

    // Should not call fetch
    expect(mockFetch).not.toHaveBeenCalled();

    // Should have empty photos
    expect(result.current.photos).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should refetch photos when refetch function is called", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { photos: mockPhotos } }),
    });

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Call refetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          photos: [
            ...mockPhotos,
            {
              id: "photo-3",
              public_url: "https://example.com/photo3.jpg",
              session_id: "session-123",
              user_id: "user-123",
              storage_path: "sessions/session-123/photo3.jpg",
              file_size: 3072,
              created_at: "2024-01-15T10:02:00Z",
            } as SessionPhoto,
          ],
        },
      }),
    });

    result.current.refetch();

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.photos.length).toBe(3);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should refetch when sessionId changes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { photos: mockPhotos } }),
    });

    const { result, rerender } = renderHook(
      ({ sessionId }) => useSessionPhotos(sessionId),
      { initialProps: { sessionId: "session-123" } }
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Change sessionId
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { photos: [mockPhotos[0]] } }),
    });

    rerender({ sessionId: "session-456" });

    // Wait for new load
    await waitFor(() => {
      expect(result.current.photos.length).toBe(1);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should clear photos when sessionId changes to undefined", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { photos: mockPhotos } }),
    });

    const { result, rerender } = renderHook(
      ({ sessionId }) => useSessionPhotos(sessionId),
      { initialProps: { sessionId: "session-123" as string | undefined } }
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.photos).toEqual(mockPhotos);
    });

    // Change to undefined
    rerender({ sessionId: undefined });

    // Photos should be cleared immediately
    expect(result.current.photos).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
