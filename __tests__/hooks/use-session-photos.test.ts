import { renderHook, waitFor } from "@testing-library/react";
import { useSessionPhotos } from "@/hooks/use-session-photos";
import { getSessionPhotosAction } from "@/actions/session-media-actions";
import type { SessionPhoto } from "@/lib/supabase/storage";

// Mock the session media actions
jest.mock("@/actions/session-media-actions", () => ({
  getSessionPhotosAction: jest.fn(),
}));

const mockGetSessionPhotosAction = getSessionPhotosAction as jest.MockedFunction<
  typeof getSessionPhotosAction
>;

describe("useSessionPhotos", () => {
  const mockPhotos: SessionPhoto[] = [
    {
      id: "photo-1",
      public_url: "https://example.com/photo1.jpg",
      caption: "First photo",
    },
    {
      id: "photo-2",
      public_url: "https://example.com/photo2.jpg",
      caption: "Second photo",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch photos successfully and return data", async () => {
    mockGetSessionPhotosAction.mockResolvedValue({
      success: true,
      data: mockPhotos,
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
    expect(mockGetSessionPhotosAction).toHaveBeenCalledWith("session-123");
    expect(mockGetSessionPhotosAction).toHaveBeenCalledTimes(1);
  });

  it("should handle loading state correctly", async () => {
    mockGetSessionPhotosAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ success: true, data: mockPhotos }),
            100
          );
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
    const errorMessage = "Failed to fetch photos";
    mockGetSessionPhotosAction.mockResolvedValue({
      success: false,
      error: errorMessage,
    });

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.error).toBe(errorMessage);
  });

  it("should handle exception during fetch", async () => {
    const error = new Error("Network error");
    mockGetSessionPhotosAction.mockRejectedValue(error);

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.error).toBe("Network error");
  });

  it("should return empty array when sessionId is undefined", async () => {
    const { result } = renderHook(() => useSessionPhotos(undefined));

    // Should not call the action
    expect(mockGetSessionPhotosAction).not.toHaveBeenCalled();

    // Should have empty photos
    expect(result.current.photos).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should refetch photos when refetch function is called", async () => {
    mockGetSessionPhotosAction.mockResolvedValue({
      success: true,
      data: mockPhotos,
    });

    const { result } = renderHook(() => useSessionPhotos("session-123"));

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetSessionPhotosAction).toHaveBeenCalledTimes(1);

    // Call refetch
    mockGetSessionPhotosAction.mockResolvedValue({
      success: true,
      data: [
        ...mockPhotos,
        {
          id: "photo-3",
          public_url: "https://example.com/photo3.jpg",
        },
      ],
    });

    result.current.refetch();

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.photos.length).toBe(3);
    });

    expect(mockGetSessionPhotosAction).toHaveBeenCalledTimes(2);
  });

  it("should refetch when sessionId changes", async () => {
    mockGetSessionPhotosAction.mockResolvedValue({
      success: true,
      data: mockPhotos,
    });

    const { result, rerender } = renderHook(
      ({ sessionId }) => useSessionPhotos(sessionId),
      { initialProps: { sessionId: "session-123" } }
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetSessionPhotosAction).toHaveBeenCalledWith("session-123");
    expect(mockGetSessionPhotosAction).toHaveBeenCalledTimes(1);

    // Change sessionId
    mockGetSessionPhotosAction.mockResolvedValue({
      success: true,
      data: [mockPhotos[0]],
    });

    rerender({ sessionId: "session-456" });

    // Wait for new load
    await waitFor(() => {
      expect(result.current.photos.length).toBe(1);
    });

    expect(mockGetSessionPhotosAction).toHaveBeenCalledWith("session-456");
    expect(mockGetSessionPhotosAction).toHaveBeenCalledTimes(2);
  });

  it("should clear photos when sessionId changes to undefined", async () => {
    mockGetSessionPhotosAction.mockResolvedValue({
      success: true,
      data: mockPhotos,
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
