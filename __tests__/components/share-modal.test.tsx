import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareModal } from "@/components/share-modal";
import { useAuth } from "@/context/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { updateSession } from "@/actions/session-actions";
// Migrate to app toast system mock
const mockToastHook = { toasts: [] as any[], toast: jest.fn(), dismiss: jest.fn() };
jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => mockToastHook,
}));

// Mock dependencies
jest.mock("@/context/auth-context");
jest.mock("@/hooks/use-mobile");
jest.mock("@/actions/session-actions");
// No longer using react-hot-toast in component

// Mock fetch globally
global.fetch = jest.fn();

// Mock Web Share API
Object.defineProperty(navigator, 'share', {
  writable: true,
  configurable: true,
  value: jest.fn(),
});

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'mock-blob-url'),
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn(),
});

// Mock user agent for device detection
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>;
const mockUpdateSession = updateSession as jest.MockedFunction<typeof updateSession>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockNavigatorShare = navigator.share as jest.MockedFunction<typeof navigator.share>;

const mockUser = {
  id: "user-1",
  email: "user@example.com",
};

const defaultProps = {
  sessionId: "session-1",
  isPublic: true,
  open: true,
  onClose: jest.fn(),
  onMadePublic: jest.fn(),
};

describe("ShareModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: jest.fn(),
    });
    
    mockUseIsMobile.mockReturnValue(false);
    
    // Mock successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake-image-data'])),
    } as Response);
    
    // Mock successful session update
    mockUpdateSession.mockResolvedValue({ success: true });
    
    // Reset toast mock
    mockToastHook.toast.mockReset();
  });

  describe("Rendering", () => {
    it("should render when open", () => {
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByTestId("share-modal")).toBeInTheDocument();
      expect(screen.getByText("Share Your Epic Session")).toBeInTheDocument();
    });

    it("should not render when closed", () => {
      render(<ShareModal {...defaultProps} open={false} />);
      
      expect(screen.queryByTestId("share-modal")).not.toBeInTheDocument();
    });

    it("should show variant tabs", () => {
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByText("Story")).toBeInTheDocument();
      expect(screen.getByText("Square")).toBeInTheDocument();
    });

    it("should use mobile default variant", () => {
      mockUseIsMobile.mockReturnValue(true);
      
      render(<ShareModal {...defaultProps} defaultVariant={undefined} />);
      
      // Story tab should be selected by default on mobile
      const storyTab = screen.getByRole("tab", { name: /story/i });
      expect(storyTab).toHaveAttribute("data-state", "active");
    });

    it("should use desktop default variant", () => {
      mockUseIsMobile.mockReturnValue(false);
      
      render(<ShareModal {...defaultProps} defaultVariant={undefined} />);
      
      // Square tab should be selected by default on desktop
      const squareTab = screen.getByRole("tab", { name: /square/i });
      expect(squareTab).toHaveAttribute("data-state", "active");
    });

    it("should respect defaultVariant prop", () => {
      render(<ShareModal {...defaultProps} defaultVariant="story" />);
      
      const storyTab = screen.getByRole("tab", { name: /story/i });
      expect(storyTab).toHaveAttribute("data-state", "active");
    });
  });

  describe("Public Session Sharing", () => {
    it("should show sharing controls for public session", () => {
      render(<ShareModal {...defaultProps} isPublic={true} />);
      
      expect(screen.queryByText("Session needs to be public to share")).not.toBeInTheDocument();
    });

    it("should warm the image on modal open", async () => {
      render(<ShareModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/social/share/og"),
          { method: "HEAD" }
        );
      });
    });

    it("should show download button when Web Share is not available", () => {
      // Remove Web Share API
      delete (navigator as any).share;
      
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByTestId("download-button")).toBeInTheDocument();
      expect(screen.getByText("Download")).toBeInTheDocument();
    });

    it("should show share button when Web Share is available", () => {
      // Ensure Web Share API is available
      Object.defineProperty(navigator, 'share', {
        writable: true,
        configurable: true,
        value: jest.fn(),
      });
      
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByTestId("web-share-button")).toBeInTheDocument();
      expect(screen.getByText("Share")).toBeInTheDocument();
    });
  });

  describe("Private Session Flow", () => {
    it("should show make public prompt for private session", () => {
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      expect(screen.getByText("Session needs to be public to share")).toBeInTheDocument();
      expect(screen.getByText("Make shareable")).toBeInTheDocument();
    });

    it("should make session public when clicked", async () => {
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);
      
      await waitFor(() => {
        expect(mockUpdateSession).toHaveBeenCalledWith("session-1", { is_public: true });
      });
    });

    it("should show loading state while making public", async () => {
      mockUpdateSession.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);
      
      expect(screen.getByText("Making public...")).toBeInTheDocument();
    });

    it("should handle make public success", async () => {
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Session is now shareable! 🏄‍♂️" })
        );
      });
    });

    it("should handle make public failure", async () => {
      mockUpdateSession.mockResolvedValue({ success: false });
      
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Failed to make session shareable", variant: "destructive" })
        );
      });
    });

    it("should handle make public error", async () => {
      mockUpdateSession.mockRejectedValue(new Error("Network error"));
      
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Failed to make session shareable", variant: "destructive" })
        );
      });
    });

    it("should call onMadePublic callback on success", async () => {
      const onMadePublic = jest.fn();
      render(<ShareModal {...defaultProps} isPublic={false} onMadePublic={onMadePublic} />);
      
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);
      
      await waitFor(() => {
        expect(onMadePublic).toHaveBeenCalled();
      });
    });
  });

  describe("Image Loading", () => {
    it("should show loading state initially", () => {
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByText("Generating your epic session...")).toBeInTheDocument();
    });

    it("should show success toast when image loads", async () => {
      render(<ShareModal {...defaultProps} />);
      
      // Find and trigger the image onLoad event
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Your session image is ready! 🏄‍♂️" })
        );
      });
    });

    it("should show error toast when image fails to load", async () => {
      render(<ShareModal {...defaultProps} />);
      
      const image = screen.getByAltText(/share preview/i);
      fireEvent.error(image);
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Failed to generate image", variant: "destructive" })
        );
      });
    });

    it("should update image when variant changes", async () => {
      render(<ShareModal {...defaultProps} />);
      
      // Switch to story variant
      const storyTab = screen.getByText("Story");
      fireEvent.click(storyTab);
      
      // Should warm the new variant
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("variant=story"),
          { method: "HEAD" }
        );
      });
    });
  });

  describe("Download Functionality", () => {
    it("should download image when download button is clicked", async () => {
      // Remove Web Share API to show download button
      delete (navigator as any).share;
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(() => {
        const downloadButton = screen.getByTestId("download-button");
        fireEvent.click(downloadButton);
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/social/share/og")
      );
    });

    it("should show loading state while downloading", async () => {
      delete (navigator as any).share;
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const downloadButton = screen.getByTestId("download-button");
        fireEvent.click(downloadButton);
        
        expect(screen.getByText("Downloading...")).toBeInTheDocument();
      });
    });

    it("should show success message after download", async () => {
      delete (navigator as any).share;
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const downloadButton = screen.getByTestId("download-button");
        fireEvent.click(downloadButton);
      });
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Image downloaded! 📸" })
        );
      });
    });

    it("should handle download errors", async () => {
      delete (navigator as any).share;
      mockFetch.mockRejectedValue(new Error("Download failed"));
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const downloadButton = screen.getByTestId("download-button");
        fireEvent.click(downloadButton);
      });
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Failed to download image", variant: "destructive" })
        );
      });
    });

    it("should not download if image is not ready", async () => {
      delete (navigator as any).share;
      
      render(<ShareModal {...defaultProps} />);
      
      // Don't load image, try to download immediately
      const downloadButton = screen.getByTestId("download-button");
      fireEvent.click(downloadButton);
      
      // Should not call fetch for download
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        { method: "HEAD" } // Only the warmup call
      );
    });
  });

  describe("Web Share Functionality", () => {
    beforeEach(() => {
      // Ensure Web Share API is available
      Object.defineProperty(navigator, 'share', {
        writable: true,
        configurable: true,
        value: mockNavigatorShare,
      });
    });

    it("should share image when share button is clicked", async () => {
      mockNavigatorShare.mockResolvedValue(undefined);
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const shareButton = screen.getByTestId("web-share-button");
        fireEvent.click(shareButton);
      });
      
      expect(mockNavigatorShare).toHaveBeenCalledWith({
        title: "Check out my surf session!",
        text: "Had an epic surf session - check it out on Quiver! 🏄‍♂️",
        files: [expect.any(File)],
      });
    });

    it("should show loading state while sharing", async () => {
      mockNavigatorShare.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const shareButton = screen.getByTestId("web-share-button");
        fireEvent.click(shareButton);
        
        expect(screen.getByText("Sharing...")).toBeInTheDocument();
      });
    });

    it("should show success message after sharing", async () => {
      mockNavigatorShare.mockResolvedValue(undefined);
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const shareButton = screen.getByTestId("web-share-button");
        fireEvent.click(shareButton);
      });
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Shared successfully! 🤙" })
        );
      });
    });

    it("should handle share cancellation gracefully", async () => {
      const abortError = new Error("User cancelled");
      abortError.name = "AbortError";
      mockNavigatorShare.mockRejectedValue(abortError);
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const shareButton = screen.getByTestId("web-share-button");
        fireEvent.click(shareButton);
      });
      
      // Should not show error for cancellation
      expect(mockToastHook.toast).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to share image" })
      );
    });

    it("should handle share errors", async () => {
      mockNavigatorShare.mockRejectedValue(new Error("Share failed"));
      
      render(<ShareModal {...defaultProps} />);
      
      // Load image first
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      
      await waitFor(async () => {
        const shareButton = screen.getByTestId("web-share-button");
        fireEvent.click(shareButton);
      });
      
      await waitFor(() => {
        expect(mockToastHook.toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Failed to share image", variant: "destructive" })
        );
      });
    });

    it("should not share if image is not ready", async () => {
      render(<ShareModal {...defaultProps} />);
      
      // Don't load image, try to share immediately
      const shareButton = screen.getByTestId("web-share-button");
      fireEvent.click(shareButton);
      
      // Should not call navigator.share
      expect(mockNavigatorShare).not.toHaveBeenCalled();
    });
  });

  describe("Platform Detection", () => {
    it("should show iOS Safari specific copy", () => {
      // Mock iOS Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      });
      
      // Remove Web Share API to show iOS-specific behavior
      delete (navigator as any).share;
      
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByText("Use the Share Sheet to save image")).toBeInTheDocument();
    });

    it("should show generic copy for other platforms", () => {
      // Mock desktop user agent
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });
      
      delete (navigator as any).share;
      
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByText("Download to upload to Instagram/TikTok")).toBeInTheDocument();
    });

    it("should show Web Share copy when available", () => {
      Object.defineProperty(navigator, 'share', {
        writable: true,
        configurable: true,
        value: jest.fn(),
      });
      
      render(<ShareModal {...defaultProps} />);
      
      expect(screen.getByText("Tap Share to post to social media")).toBeInTheDocument();
    });
  });

  describe("Modal Controls", () => {
    it("should call onClose when close button is clicked", () => {
      const onClose = jest.fn();
      render(<ShareModal {...defaultProps} onClose={onClose} />);
      
      const closeButtons = screen.getAllByText("Close");
      fireEvent.click(closeButtons[0]);
      
      expect(onClose).toHaveBeenCalled();
    });

    it("should switch variants correctly", () => {
      render(<ShareModal {...defaultProps} defaultVariant="square" />);
      
      // Initially square should be active
      expect(screen.getByRole("tab", { name: /square/i })).toHaveAttribute("data-state", "active");
      
      // Click story tab
      fireEvent.click(screen.getByRole("tab", { name: /story/i }));
      
      expect(screen.getByRole("tab", { name: /story/i })).toHaveAttribute("data-state", "active");
    });

    it("should prevent duplicate success toasts", async () => {
      render(<ShareModal {...defaultProps} />);
      
      // Load image multiple times
      const image = screen.getByAltText(/share preview/i);
      fireEvent.load(image);
      fireEvent.load(image);
      
      await waitFor(() => {
        // Should only show toast once
        expect(mockToastHook.toast).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Authentication", () => {
    it("should handle unauthenticated user", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });
      
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      // Should still render but make public button should be disabled
      expect(screen.getByText("Make shareable")).toBeInTheDocument();
    });

    it("should not make public without user", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });
      
      render(<ShareModal {...defaultProps} isPublic={false} />);
      
      const makePublicButton = screen.getByText("Make shareable");
      fireEvent.click(makePublicButton);
      
      // Should not call updateSession
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should reset states when modal opens", () => {
      const { rerender } = render(<ShareModal {...defaultProps} open={false} />);
      
      // Open modal
      rerender(<ShareModal {...defaultProps} open={true} />);
      
      // Should call HEAD request to warm image
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        { method: "HEAD" }
      );
    });

    it("should handle warming request failures gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Warming failed"));
      
      render(<ShareModal {...defaultProps} />);
      
      // Should not crash or show errors for warming failures
      await waitFor(() => {
        expect(screen.getByText("Loading preview...")).toBeInTheDocument();
      });
    });
  });
});
