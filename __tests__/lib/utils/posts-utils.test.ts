import { transformApiPosts, fetchRecentPosts } from "@/lib/utils/posts-utils";
import { FALLBACK_POSTS } from "@/lib/constants/mock-data";

// Mock fetch globally
global.fetch = jest.fn();

describe("posts-utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("transformApiPosts", () => {
    it("transforms API posts correctly", () => {
      const apiPosts = [
        {
          id: "1",
          author: {
            name: "John Doe",
            avatar: "/avatar.jpg",
          },
          caption: "Great surf session!",
          imageUrl: "/surf.jpg",
        },
        {
          id: "2",
          author: {
            name: "Jane Smith",
          },
          caption: "Amazing waves today",
        },
      ];

      const result = transformApiPosts(apiPosts);

      expect(result).toEqual([
        {
          id: "1",
          name: "John Doe",
          activity: "Great surf session!",
          imageUrl: "/surf.jpg",
          avatar: "/avatar.jpg",
        },
        {
          id: "2",
          name: "Jane Smith",
          activity: "Amazing waves today",
          imageUrl: "/placeholder.jpg",
          avatar: "/placeholder-user.jpg",
        },
      ]);
    });

    it("handles missing author data with defaults", () => {
      const apiPosts = [
        {
          id: "1",
          caption: "Solo surf session",
        },
      ];

      const result = transformApiPosts(apiPosts);

      expect(result).toEqual([
        {
          id: "1",
          name: "Surfer",
          activity: "Solo surf session",
          imageUrl: "/placeholder.jpg",
          avatar: "/placeholder-user.jpg",
        },
      ]);
    });

    it("handles empty posts array", () => {
      const result = transformApiPosts([]);
      expect(result).toEqual([]);
    });
  });

  describe("fetchRecentPosts", () => {
    it("fetches and transforms API posts successfully", async () => {
      const mockApiResponse = {
        posts: [
          {
            id: "1",
            author: { name: "Test User", avatar: "/test.jpg" },
            caption: "Test post",
            imageUrl: "/test-image.jpg",
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockApiResponse),
      });

      const result = await fetchRecentPosts();

      expect(fetch).toHaveBeenCalledWith("/api/recent-posts");
      expect(result).toEqual([
        {
          id: "1",
          name: "Test User",
          activity: "Test post",
          imageUrl: "/test-image.jpg",
          avatar: "/test.jpg",
        },
      ]);
    });

    it("returns fallback posts when API returns empty posts", async () => {
      const mockApiResponse = { posts: [] };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockApiResponse),
      });

      const result = await fetchRecentPosts();

      expect(result).toEqual(FALLBACK_POSTS);
    });

    it("returns fallback posts when API returns null/undefined posts", async () => {
      const mockApiResponse = { posts: null };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockApiResponse),
      });

      const result = await fetchRecentPosts();

      expect(result).toEqual(FALLBACK_POSTS);
    });

    it("returns fallback posts when fetch fails", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await fetchRecentPosts();

      expect(result).toEqual(FALLBACK_POSTS);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching posts:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("returns fallback posts when response.json() fails", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockRejectedValueOnce(new Error("JSON parse error")),
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await fetchRecentPosts();

      expect(result).toEqual(FALLBACK_POSTS);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching posts:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
