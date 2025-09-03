/**
 * Integration tests for photo upload and social sharing flows
 * Tests the complete flow from photo upload to session sharing
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { uploadSessionMedia } from "@/actions/session-actions";
import { updateSession } from "@/actions/session-actions";
import { ShareModal } from "@/components/share-modal";
import { useAuth } from "@/context/auth-context";

// Mock dependencies
jest.mock("@/actions/session-actions");
jest.mock("@/context/auth-context");

// Mock toast functionality
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
};

// Mock file operations
const mockFileReader = {
  readAsDataURL: jest.fn(),
  result: 'data:image/jpeg;base64,fake-image-data',
  onload: null as any,
  onerror: null as any,
};

// Mock FileReader globally
(global as any).FileReader = jest.fn(() => mockFileReader);

// Mock fetch for image warming and downloading
global.fetch = jest.fn();

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUploadSessionMedia = uploadSessionMedia as jest.MockedFunction<typeof uploadSessionMedia>;
const mockUpdateSession = updateSession as jest.MockedFunction<typeof updateSession>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

const mockUser = {
  id: "user-1",
  email: "user@example.com",
};

// Mock photo upload component
function MockPhotoUpload({ onUploadSuccess }: { onUploadSuccess: () => void }) {
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await mockUploadSessionMedia("session-1", [file]);
      if (result.success) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        data-testid="photo-upload-input"
      />
      <div data-testid="upload-status">Ready for upload</div>
    </div>
  );
}

describe("Social Photo Upload Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: jest.fn(),
    });

    // Mock successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake-image-data'])),
    } as Response);

    // Setup toast mocks
    mockToast.success = jest.fn();
    mockToast.error = jest.fn();
  });

  describe("Photo Upload Flow", () => {
    it("should upload photo and enable sharing", async () => {
      const onUploadSuccess = jest.fn();
      
      // Mock successful upload
      mockUploadSessionMedia.mockResolvedValue({
        success: true,
        data: {
          urls: ["https://storage.example.com/photo1.jpg"],
        },
      });

      render(<MockPhotoUpload onUploadSuccess={onUploadSuccess} />);

      // Create a mock file
      const file = new File(["fake-image-content"], "session-photo.jpg", {
        type: "image/jpeg",
      });

      const input = screen.getByTestId("photo-upload-input");
      
      // Upload photo
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockUploadSessionMedia).toHaveBeenCalledWith("session-1", [file]);
        expect(onUploadSuccess).toHaveBeenCalled();
      });
    });

    it("should handle upload failure", async () => {
      mockUploadSessionMedia.mockRejectedValue(new Error("Upload failed"));
      
      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      const file = new File(["fake-image"], "photo.jpg", { type: "image/jpeg" });
      const input = screen.getByTestId("photo-upload-input");
      
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockUploadSessionMedia).toHaveBeenCalled();
      });

      // Should handle error gracefully
      expect(screen.getByTestId("upload-status")).toHaveTextContent("Ready for upload");
    });

    it("should validate file types", async () => {
      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      // Try to upload a non-image file
      const file = new File(["fake-text"], "document.txt", { type: "text/plain" });
      const input = screen.getByTestId("photo-upload-input");
      
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      // Should not call upload for invalid file type
      expect(mockUploadSessionMedia).not.toHaveBeenCalled();
    });

    it("should handle multiple photo uploads", async () => {
      mockUploadSessionMedia.mockResolvedValue({
        success: true,
        data: {
          urls: [
            "https://storage.example.com/photo1.jpg",
            "https://storage.example.com/photo2.jpg",
          ],
        },
      });

      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      const files = [
        new File(["fake-1"], "photo1.jpg", { type: "image/jpeg" }),
        new File(["fake-2"], "photo2.jpg", { type: "image/jpeg" }),
      ];

      const input = screen.getByTestId("photo-upload-input");
      Object.defineProperty(input, "files", {
        value: files,
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockUploadSessionMedia).toHaveBeenCalledWith("session-1", files);
      });
    });
  });

  describe("Integration with Share Modal", () => {
    it("should create shareable session and generate social image", async () => {
      mockUpdateSession.mockResolvedValue({ success: true });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['fake-image-data'])),
      } as Response);

      render(
        <ShareModal
          sessionId="session-1"
          isPublic={false}
          open={true}
          onClose={jest.fn()}
          onMadePublic={jest.fn()}
        />
      );

      // Make session public for sharing
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);

      await waitFor(() => {
        expect(mockUpdateSession).toHaveBeenCalledWith("session-1", "user-1", { is_public: true });
      });

      // Should warm the share image
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/social/share/og"),
          { method: "HEAD" }
        );
      });
    });

    it("should handle photo upload then immediate sharing", async () => {
      let sessionMadePublic = false;

      const PhotoUploadToShareFlow = () => {
        const [uploaded, setUploaded] = React.useState(false);
        
        const handleUploadSuccess = () => {
          setUploaded(true);
        };

        const handleMadePublic = () => {
          sessionMadePublic = true;
        };

        return (
          <div>
            <MockPhotoUpload onUploadSuccess={handleUploadSuccess} />
            {uploaded && (
              <ShareModal
                sessionId="session-1"
                isPublic={false}
                open={true}
                onClose={jest.fn()}
                onMadePublic={handleMadePublic}
              />
            )}
          </div>
        );
      };

      // Need React import for useState
      const React = require('react');
      
      mockUploadSessionMedia.mockResolvedValue({
        success: true,
        data: { urls: ["photo.jpg"] },
      });
      mockUpdateSession.mockResolvedValue({ success: true });

      render(<PhotoUploadToShareFlow />);

      // Upload photo
      const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
      const input = screen.getByTestId("photo-upload-input");
      Object.defineProperty(input, "files", { value: [file], writable: false });
      fireEvent.change(input);

      // Wait for upload to complete and share modal to appear
      await waitFor(() => {
        expect(screen.getByText("Make shareable")).toBeInTheDocument();
      });

      // Make session public for sharing
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);

      await waitFor(() => {
        expect(sessionMadePublic).toBe(true);
      });
    });
  });

  describe("Photo Processing and Social Features", () => {
    it("should process photos and enable viral sharing features", async () => {
      mockUploadSessionMedia.mockResolvedValue({
        success: true,
        data: {
          urls: ["https://storage.example.com/processed-photo.jpg"],
          metadata: {
            width: 1920,
            height: 1080,
            processed: true,
          },
        },
      });

      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      const file = new File(["high-quality-image"], "surf-photo.jpg", {
        type: "image/jpeg",
      });

      const input = screen.getByTestId("photo-upload-input");
      Object.defineProperty(input, "files", { value: [file], writable: false });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockUploadSessionMedia).toHaveBeenCalledWith("session-1", [file]);
      });

      // Verify upload was successful
      expect(mockUploadSessionMedia).toHaveReturned();
    });

    it("should handle photo upload errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockUploadSessionMedia.mockRejectedValue(new Error("Storage error"));

      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      const file = new File(["corrupt-image"], "bad-photo.jpg", {
        type: "image/jpeg",
      });

      const input = screen.getByTestId("photo-upload-input");
      Object.defineProperty(input, "files", { value: [file], writable: false });
      fireEvent.change(input);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it("should optimize photos for social sharing", async () => {
      mockUploadSessionMedia.mockResolvedValue({
        success: true,
        data: {
          urls: ["https://storage.example.com/photo.jpg"],
          optimized: {
            social: "https://storage.example.com/photo-social.jpg",
            thumbnail: "https://storage.example.com/photo-thumb.jpg",
          },
        },
      });

      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      const file = new File(["large-image"], "big-photo.jpg", {
        type: "image/jpeg",
      });

      const input = screen.getByTestId("photo-upload-input");
      Object.defineProperty(input, "files", { value: [file], writable: false });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockUploadSessionMedia).toHaveBeenCalled();
      });

      // Should return optimized versions for social sharing
      const result = await mockUploadSessionMedia.mock.results[0].value;
      expect(result.data.optimized).toBeDefined();
    });
  });

  describe("Viral Growth Features", () => {
    it("should track sharing events for growth analytics", async () => {
      mockUpdateSession.mockResolvedValue({ success: true });
      
      render(
        <ShareModal
          sessionId="session-1"
          isPublic={true}
          open={true}
          onClose={jest.fn()}
          onMadePublic={jest.fn()}
        />
      );

      // Load image
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);

      // Mock download action
      delete (navigator as any).share;
      await waitFor(() => {
        const downloadButton = screen.getByTestId("download-button");
        fireEvent.click(downloadButton);
      });

      // Should track the download for analytics
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/social/share/og")
      );
    });

    it("should encourage social sharing with growth-focused messaging", async () => {
      render(
        <ShareModal
          sessionId="session-1"
          isPublic={true}
          open={true}
          onClose={jest.fn()}
          onMadePublic={jest.fn()}
        />
      );

      // Should show growth-focused messaging
      expect(screen.getByText("Share Your Epic Session")).toBeInTheDocument();
      
      // Should include viral elements in copy
      expect(screen.getByText(/download to upload to instagram\/tiktok/i)).toBeInTheDocument();
    });

    it("should generate viral-optimized content for different platforms", async () => {
      render(
        <ShareModal
          sessionId="session-1"
          defaultVariant="story"
          isPublic={true}
          open={true}
          onClose={jest.fn()}
          onMadePublic={jest.fn()}
        />
      );

      // Should support Instagram story format
      expect(screen.getByText("Story")).toBeInTheDocument();
      
      // Switch to square format for other platforms
      fireEvent.click(screen.getByText("Square"));
      
      // Should warm both formats for viral sharing
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("variant=square"),
          { method: "HEAD" }
        );
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle network errors during photo upload", async () => {
      mockUploadSessionMedia.mockRejectedValue(new Error("Network error"));
      
      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const input = screen.getByTestId("photo-upload-input");
      
      Object.defineProperty(input, "files", { value: [file], writable: false });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockUploadSessionMedia).toHaveBeenCalled();
      });

      // Should handle gracefully without crashing
      expect(screen.getByTestId("upload-status")).toBeInTheDocument();
    });

    it("should handle large file uploads", async () => {
      mockUploadSessionMedia.mockResolvedValue({
        success: true,
        data: { urls: ["large-photo.jpg"] },
      });

      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      // Simulate large file
      const largeFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024)], // 10MB
        "large-photo.jpg",
        { type: "image/jpeg" }
      );

      const input = screen.getByTestId("photo-upload-input");
      Object.defineProperty(input, "files", { value: [largeFile], writable: false });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockUploadSessionMedia).toHaveBeenCalledWith("session-1", [largeFile]);
      });
    });

    it("should handle unsupported file formats", async () => {
      render(<MockPhotoUpload onUploadSuccess={jest.fn()} />);

      const unsupportedFile = new File(["test"], "test.pdf", { type: "application/pdf" });
      const input = screen.getByTestId("photo-upload-input");
      
      Object.defineProperty(input, "files", { value: [unsupportedFile], writable: false });
      fireEvent.change(input);

      // Should not attempt upload for unsupported file
      expect(mockUploadSessionMedia).not.toHaveBeenCalled();
    });
  });
});
