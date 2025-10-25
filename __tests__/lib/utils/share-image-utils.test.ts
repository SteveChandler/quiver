import {
  downloadShareImage,
  prepareImageForPlatform,
  createShareImageFile,
  canShare,
  canShareFiles,
} from "@/lib/utils/share-image-utils";

// Mock fetch globally
global.fetch = jest.fn();

describe("Share Image Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("downloadShareImage", () => {
    it("should download image successfully", async () => {
      const mockBlob = new Blob(["test image data"], { type: "image/png" });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await downloadShareImage("https://example.com/image.png");

      expect(result).toEqual(mockBlob);
      expect(global.fetch).toHaveBeenCalledWith("https://example.com/image.png");
    });

    it("should throw error when fetch fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      await expect(
        downloadShareImage("https://example.com/missing.png")
      ).rejects.toThrow("Failed to download share image: Not Found");
    });

    it("should throw error when fetch rejects", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(
        downloadShareImage("https://example.com/error.png")
      ).rejects.toThrow("Network error");
    });
  });

  describe("prepareImageForPlatform", () => {
    it("should return blob as-is for most platforms", async () => {
      const mockBlob = new Blob(["test data"], { type: "image/png" });

      const resultInstagram = await prepareImageForPlatform(mockBlob, "instagram");
      const resultTwitter = await prepareImageForPlatform(mockBlob, "twitter");
      const resultFacebook = await prepareImageForPlatform(mockBlob, "facebook");

      expect(resultInstagram).toEqual(mockBlob);
      expect(resultTwitter).toEqual(mockBlob);
      expect(resultFacebook).toEqual(mockBlob);
    });

    it("should handle unknown platforms", async () => {
      const mockBlob = new Blob(["test data"], { type: "image/png" });

      const result = await prepareImageForPlatform(mockBlob, "unknown");

      expect(result).toEqual(mockBlob);
    });
  });

  describe("createShareImageFile", () => {
    it("should create File with correct properties", () => {
      const mockBlob = new Blob(["test image data"], { type: "image/png" });

      const file = createShareImageFile(mockBlob, "session-123", "story");

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe("quiver-session-session-123-story.png");
      expect(file.type).toBe("image/png");
      expect(file.size).toBe(mockBlob.size);
    });

    it("should create File for square variant", () => {
      const mockBlob = new Blob(["test"], { type: "image/png" });

      const file = createShareImageFile(mockBlob, "session-456", "square");

      expect(file.name).toBe("quiver-session-session-456-square.png");
      expect(file.type).toBe("image/png");
    });

    it("should handle different session IDs", () => {
      const mockBlob = new Blob(["test"], { type: "image/png" });

      const file1 = createShareImageFile(mockBlob, "abc-123", "story");
      const file2 = createShareImageFile(mockBlob, "xyz-789", "story");

      expect(file1.name).toBe("quiver-session-abc-123-story.png");
      expect(file2.name).toBe("quiver-session-xyz-789-story.png");
    });
  });

  describe("canShare", () => {
    it("should return true when navigator.share exists", () => {
      Object.defineProperty(global.navigator, "share", {
        value: jest.fn(),
        configurable: true,
      });

      expect(canShare()).toBe(true);
    });

    it("should return false when navigator.share does not exist", () => {
      Object.defineProperty(global.navigator, "share", {
        value: undefined,
        configurable: true,
      });

      expect(canShare()).toBe(false);
    });

    it("should return false when navigator is undefined", () => {
      const originalNavigator = global.navigator;
      // @ts-ignore
      delete global.navigator;

      expect(canShare()).toBe(false);

      global.navigator = originalNavigator;
    });
  });

  describe("canShareFiles", () => {
    it("should return true when canShare() returns true and navigator.canShare returns true", () => {
      Object.defineProperty(global.navigator, "share", {
        value: jest.fn(),
        configurable: true,
      });
      Object.defineProperty(global.navigator, "canShare", {
        value: jest.fn().mockReturnValue(true),
        configurable: true,
      });

      expect(canShareFiles()).toBe(true);
      expect(global.navigator.canShare).toHaveBeenCalledWith({ files: [] });
    });

    it("should return false when canShare() returns false", () => {
      Object.defineProperty(global.navigator, "share", {
        value: undefined,
        configurable: true,
      });

      expect(canShareFiles()).toBe(false);
    });

    it("should return false when navigator.canShare does not exist", () => {
      Object.defineProperty(global.navigator, "share", {
        value: jest.fn(),
        configurable: true,
      });
      Object.defineProperty(global.navigator, "canShare", {
        value: undefined,
        configurable: true,
      });

      expect(canShareFiles()).toBe(false);
    });

    it("should return false when navigator.canShare returns false", () => {
      Object.defineProperty(global.navigator, "share", {
        value: jest.fn(),
        configurable: true,
      });
      Object.defineProperty(global.navigator, "canShare", {
        value: jest.fn().mockReturnValue(false),
        configurable: true,
      });

      expect(canShareFiles()).toBe(false);
    });

    it("should handle navigator.canShare throwing error", () => {
      Object.defineProperty(global.navigator, "share", {
        value: jest.fn(),
        configurable: true,
      });
      Object.defineProperty(global.navigator, "canShare", {
        value: jest.fn().mockImplementation(() => {
          throw new Error("Not supported");
        }),
        configurable: true,
      });

      expect(canShareFiles()).toBe(false);
    });
  });
});
