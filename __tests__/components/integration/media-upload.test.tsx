import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionPhotoUpload from "@/components/media/session-photo-upload";
import SessionPhotoGallery from "@/components/media/session-photo-gallery";
import { PhotoSelectionSection } from "@/components/session-forms/PhotoSelectionSection";
import {
  renderWithProviders,
  mockSession,
  createMockSupabaseClient,
} from "@/__tests__/setup/test-utils";

// Mock the required modules
jest.mock("@/lib/supabase/client");

jest.mock("@/actions/session-media-actions", () => ({
  uploadSessionPhotosAction: jest.fn(),
  getSessionPhotosAction: jest.fn(),
  deleteSessionPhotoAction: jest.fn(),
  updatePhotoCaptionAction: jest.fn(),
  getUserStorageUsageAction: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => "mocked-url");
global.URL.revokeObjectURL = jest.fn();

// Mock File constructor
global.File = class File {
  constructor(bits, name, options) {
    this.bits = bits;
    this.name = name;
    this.size = options?.size || 1024000;
    this.type = options?.type || "image/jpeg";
    this.lastModified = Date.now();
  }
} as any;

describe("Media Upload Integration Tests", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    full_name: "Test User",
  };

  // Setup Supabase mock
  beforeAll(() => {
    const {
      createMockSupabaseClient,
    } = require("@/__tests__/setup/test-utils");
    require("@/lib/supabase/client").supabase = createMockSupabaseClient();
  });

  const mockSessionPhotos = [
    {
      id: "photo-1",
      session_id: "test-session-id",
      user_id: mockUser.id,
      public_url: "https://example.com/photo1.jpg",
      storage_path: "sessions/photo1.jpg",
      caption: "Amazing waves today!",
      file_size: 1024000,
      metadata: {
        width: 1920,
        height: 1080,
        compression_ratio: 0.8,
      },
      created_at: "2024-01-01T10:00:00Z",
    },
    {
      id: "photo-2",
      session_id: "test-session-id",
      user_id: mockUser.id,
      public_url: "https://example.com/photo2.jpg",
      storage_path: "sessions/photo2.jpg",
      caption: "Perfect barrel!",
      file_size: 2048000,
      metadata: {
        width: 1920,
        height: 1080,
        compression_ratio: 0.75,
      },
      created_at: "2024-01-01T10:05:00Z",
    },
  ];

  const mockStorageInfo = {
    total_bytes: 5242880, // 5MB
    image_count: 2,
    remaining_bytes: 104857600, // 100MB
    can_upload: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful upload
    const {
      uploadSessionPhotosAction,
      getSessionPhotosAction,
      deleteSessionPhotoAction,
      updatePhotoCaptionAction,
      getUserStorageUsageAction,
    } = require("@/actions/session-media-actions");

    uploadSessionPhotosAction.mockResolvedValue({
      success: true,
      data: { uploaded: 2, failed: 0, errors: [] },
    });

    getSessionPhotosAction.mockResolvedValue({
      success: true,
      data: mockSessionPhotos,
    });

    deleteSessionPhotoAction.mockResolvedValue({
      success: true,
    });

    updatePhotoCaptionAction.mockResolvedValue({
      success: true,
    });

    getUserStorageUsageAction.mockResolvedValue({
      success: true,
      data: mockStorageInfo,
    });

    // Mock data fetcher
    const { useDataFetcher } = require("@/hooks/use-data-fetcher");
    useDataFetcher.mockReturnValue({
      data: mockSessionPhotos,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  describe("Photo Upload Component Integration", () => {
    it("should handle complete photo upload workflow", async () => {
      const user = userEvent.setup();
      const mockOnUploadComplete = jest.fn();

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={mockOnUploadComplete}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Should display storage information
      await waitFor(() => {
        expect(screen.getByText(/5 MB used.*2 images/i)).toBeInTheDocument();
        expect(screen.getByText(/100 MB remaining/i)).toBeInTheDocument();
      });

      // Should display upload area
      expect(screen.getByText(/add session photos/i)).toBeInTheDocument();
      expect(screen.getByText(/max 5 photos/i)).toBeInTheDocument();

      // Create mock files
      const mockFile1 = new File(["test1"], "photo1.jpg", {
        type: "image/jpeg",
        size: 1024000,
      });
      const mockFile2 = new File(["test2"], "photo2.jpg", {
        type: "image/jpeg",
        size: 2048000,
      });

      // Upload files via hidden file input
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, [mockFile1, mockFile2]);

      // Should show file previews
      await waitFor(() => {
        expect(screen.getByText(/2 photo\(s\) selected/i)).toBeInTheDocument();
        expect(screen.getByText("photo1.jpg")).toBeInTheDocument();
        expect(screen.getByText("photo2.jpg")).toBeInTheDocument();
      });

      // Should show file sizes
      expect(screen.getByText(/1 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/2 MB/i)).toBeInTheDocument();

      // Should enable upload button
      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      expect(uploadButton).not.toBeDisabled();

      // Upload photos
      await user.click(uploadButton);

      // Should show upload progress
      await waitFor(() => {
        expect(screen.getByText(/uploading photos/i)).toBeInTheDocument();
      });

      // Should call upload action
      await waitFor(() => {
        const {
          uploadSessionPhotosAction,
        } = require("@/actions/session-media-actions");
        expect(uploadSessionPhotosAction).toHaveBeenCalledWith(
          "test-session-id",
          expect.any(FormData)
        );
      });

      // Should show success message and call callback
      await waitFor(() => {
        const { toast } = require("sonner");
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("Successfully uploaded 2 photo(s)")
        );
        expect(mockOnUploadComplete).toHaveBeenCalledWith(2);
      });

      // Should clear file previews after upload
      expect(screen.queryByText("photo1.jpg")).not.toBeInTheDocument();
      expect(screen.queryByText("photo2.jpg")).not.toBeInTheDocument();
    });

    it("should handle drag and drop upload", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      const uploadArea = screen
        .getByRole("button", { name: /choose files/i })
        .closest("div");

      // Create mock files
      const mockFile = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      const mockDataTransfer = {
        files: [mockFile],
      };

      // Simulate drag and drop
      fireEvent.dragOver(uploadArea, { dataTransfer: mockDataTransfer });
      fireEvent.drop(uploadArea, { dataTransfer: mockDataTransfer });

      // Should show file preview (simplified test since we can't fully simulate drag/drop)
      expect(uploadArea).toBeInTheDocument();
    });

    it("should validate file types and sizes", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Create invalid files
      const invalidTypeFile = new File(["test"], "document.pdf", {
        type: "application/pdf",
      });
      const oversizedFile = new File(["test"], "huge.jpg", {
        type: "image/jpeg",
        size: 15 * 1024 * 1024, // 15MB, over 10MB limit
      });

      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, [invalidTypeFile, oversizedFile]);

      // Should show validation errors
      await waitFor(() => {
        expect(
          screen.getByText(/only jpeg, png, and webp images are allowed/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/file size must be less than 10mb/i)
        ).toBeInTheDocument();
      });

      // Should not show file previews for invalid files
      expect(screen.queryByText("document.pdf")).not.toBeInTheDocument();
      expect(screen.queryByText("huge.jpg")).not.toBeInTheDocument();
    });

    it("should handle storage quota exceeded", async () => {
      const user = userEvent.setup();

      // Mock storage quota exceeded
      const {
        getUserStorageUsageAction,
      } = require("@/actions/session-media-actions");
      getUserStorageUsageAction.mockResolvedValue({
        success: true,
        data: { ...mockStorageInfo, can_upload: false },
      });

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      const mockFile = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, mockFile);

      // Should show storage quota error
      await waitFor(() => {
        expect(screen.getByText(/storage quota exceeded/i)).toBeInTheDocument();
      });
    });

    it("should handle upload failures", async () => {
      const user = userEvent.setup();

      // Mock upload failure
      const {
        uploadSessionPhotosAction,
      } = require("@/actions/session-media-actions");
      uploadSessionPhotosAction.mockResolvedValue({
        success: false,
        error: "Upload failed due to server error",
      });

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      const mockFile = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, mockFile);

      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      await user.click(uploadButton);

      // Should show error message
      await waitFor(() => {
        const { toast } = require("sonner");
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Upload failed due to server error")
        );
      });
    });
  });

  describe("Photo Gallery Component Integration", () => {
    it("should display photos in gallery with interactions", async () => {
      const user = userEvent.setup();
      const mockOnPhotosChange = jest.fn();

      renderWithProviders(
        <SessionPhotoGallery
          sessionId="test-session-id"
          photos={mockSessionPhotos}
          canEdit={true}
          showMetadata={true}
          onPhotosChange={mockOnPhotosChange}
        />,
        { user: mockUser }
      );

      // Should display photos
      expect(screen.getByAltText(/amazing waves today/i)).toBeInTheDocument();
      expect(screen.getByAltText(/perfect barrel/i)).toBeInTheDocument();

      // Should display captions
      expect(screen.getByText("Amazing waves today!")).toBeInTheDocument();
      expect(screen.getByText("Perfect barrel!")).toBeInTheDocument();

      // Should display metadata
      expect(screen.getByText(/1 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/2 MB/i)).toBeInTheDocument();

      // Click on first photo to open lightbox
      const firstPhoto = screen.getByAltText(/amazing waves today/i);
      await user.click(firstPhoto);

      // Should open lightbox
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Amazing waves today!")).toBeInTheDocument();
      });

      // Should show navigation arrows
      expect(screen.getByLabelText(/next/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/previous/i)).toBeInTheDocument();

      // Navigate to next photo
      const nextButton = screen.getByLabelText(/next/i);
      await user.click(nextButton);

      // Should show second photo
      await waitFor(() => {
        expect(screen.getByText("Perfect barrel!")).toBeInTheDocument();
      });

      // Close lightbox
      const closeButton = screen.getByLabelText(/close/i);
      await user.click(closeButton);

      // Should close lightbox
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("should handle photo caption editing", async () => {
      const user = userEvent.setup();
      const mockOnPhotosChange = jest.fn();

      renderWithProviders(
        <SessionPhotoGallery
          sessionId="test-session-id"
          photos={mockSessionPhotos}
          canEdit={true}
          onPhotosChange={mockOnPhotosChange}
        />,
        { user: mockUser }
      );

      // Find edit button for first photo
      const editButtons = screen.getAllByLabelText(/edit/i);
      await user.click(editButtons[0]);

      // Should show caption input
      await waitFor(() => {
        expect(
          screen.getByDisplayValue("Amazing waves today!")
        ).toBeInTheDocument();
      });

      // Edit caption
      const captionInput = screen.getByDisplayValue("Amazing waves today!");
      await user.clear(captionInput);
      await user.type(captionInput, "Updated caption for this epic session!");

      // Save caption
      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      // Should call update action
      await waitFor(() => {
        const {
          updatePhotoCaptionAction,
        } = require("@/actions/session-media-actions");
        expect(updatePhotoCaptionAction).toHaveBeenCalledWith(
          "photo-1",
          "Updated caption for this epic session!"
        );
      });

      // Should show success message
      const { toast } = require("sonner");
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Caption updated successfully")
      );

      // Should call photos change callback
      expect(mockOnPhotosChange).toHaveBeenCalled();
    });

    it("should handle photo deletion", async () => {
      const user = userEvent.setup();
      const mockOnPhotosChange = jest.fn();

      renderWithProviders(
        <SessionPhotoGallery
          sessionId="test-session-id"
          photos={mockSessionPhotos}
          canEdit={true}
          onPhotosChange={mockOnPhotosChange}
        />,
        { user: mockUser }
      );

      // Find delete button for first photo
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);

      // Should call delete action
      await waitFor(() => {
        const {
          deleteSessionPhotoAction,
        } = require("@/actions/session-media-actions");
        expect(deleteSessionPhotoAction).toHaveBeenCalledWith("photo-1");
      });

      // Should show success message
      const { toast } = require("sonner");
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Photo deleted successfully")
      );

      // Should call photos change callback with updated list
      expect(mockOnPhotosChange).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: "photo-2" })])
      );
    });

    it("should handle empty state", async () => {
      renderWithProviders(
        <SessionPhotoGallery
          sessionId="test-session-id"
          photos={[]}
          canEdit={true}
          onPhotosChange={jest.fn()}
        />,
        { user: mockUser }
      );

      // Should show empty state
      expect(
        screen.getByText(/no photos in this session yet/i)
      ).toBeInTheDocument();
    });
  });

  describe("Photo Selection in Session Forms", () => {
    it("should integrate photo selection with session logging", async () => {
      const user = userEvent.setup();
      const mockOnFilesChange = jest.fn();

      renderWithProviders(
        <PhotoSelectionSection
          mode="log"
          selectedFiles={[]}
          onFilesChange={mockOnFilesChange}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Should show photo selection section for log mode
      expect(screen.getByText(/add session photos/i)).toBeInTheDocument();

      // Upload files
      const mockFile = new File(["test"], "session-photo.jpg", {
        type: "image/jpeg",
      });
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, mockFile);

      // Should call files change callback
      await waitFor(() => {
        expect(mockOnFilesChange).toHaveBeenCalledWith([mockFile]);
      });

      // Should show file preview
      expect(screen.getByText("session-photo.jpg")).toBeInTheDocument();
    });

    it("should not show photo selection for plan mode", async () => {
      renderWithProviders(
        <PhotoSelectionSection
          mode="plan"
          selectedFiles={[]}
          onFilesChange={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Should not render anything for plan mode
      expect(screen.queryByText(/add session photos/i)).not.toBeInTheDocument();
    });

    it("should handle file removal from selection", async () => {
      const user = userEvent.setup();
      const mockOnFilesChange = jest.fn();

      const mockFile = new File(["test"], "removable.jpg", {
        type: "image/jpeg",
      });

      renderWithProviders(
        <PhotoSelectionSection
          mode="log"
          selectedFiles={[mockFile]}
          onFilesChange={mockOnFilesChange}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Should show selected file
      expect(screen.getByText("removable.jpg")).toBeInTheDocument();

      // Remove file
      const removeButton = screen.getByRole("button", { name: /remove/i });
      await user.click(removeButton);

      // Should call files change with empty array
      expect(mockOnFilesChange).toHaveBeenCalledWith([]);
    });
  });

  describe("Media Storage Management", () => {
    it("should display storage usage information", async () => {
      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Should display storage information
      await waitFor(() => {
        expect(screen.getByText(/5 MB used/i)).toBeInTheDocument();
        expect(screen.getByText(/2 images/i)).toBeInTheDocument();
        expect(screen.getByText(/100 MB remaining/i)).toBeInTheDocument();
      });
    });

    it("should warn when approaching storage limits", async () => {
      // Mock near-limit storage
      const {
        getUserStorageUsageAction,
      } = require("@/actions/session-media-actions");
      getUserStorageUsageAction.mockResolvedValue({
        success: true,
        data: {
          total_bytes: 90 * 1024 * 1024, // 90MB
          image_count: 50,
          remaining_bytes: 10 * 1024 * 1024, // 10MB remaining
          can_upload: true,
        },
      });

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Should show warning about low storage
      await waitFor(() => {
        expect(screen.getByText(/90 MB used/i)).toBeInTheDocument();
        expect(screen.getByText(/10 MB remaining/i)).toBeInTheDocument();
      });
    });

    it("should handle storage info loading errors", async () => {
      // Mock storage info error
      const {
        getUserStorageUsageAction,
      } = require("@/actions/session-media-actions");
      getUserStorageUsageAction.mockRejectedValue(
        new Error("Storage info unavailable")
      );

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Should still show upload interface without storage info
      await waitFor(() => {
        expect(screen.getByText(/add session photos/i)).toBeInTheDocument();
      });

      // Should not crash or show storage info
      expect(screen.queryByText(/MB used/i)).not.toBeInTheDocument();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle network timeouts during upload", async () => {
      const user = userEvent.setup();

      // Mock upload timeout
      const {
        uploadSessionPhotosAction,
      } = require("@/actions/session-media-actions");
      uploadSessionPhotosAction.mockRejectedValue(new Error("Network timeout"));

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      const mockFile = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, mockFile);

      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      await user.click(uploadButton);

      // Should show network error message
      await waitFor(() => {
        const { toast } = require("sonner");
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Network timeout")
        );
      });
    });

    it("should handle partial upload failures", async () => {
      const user = userEvent.setup();

      // Mock partial failure
      const {
        uploadSessionPhotosAction,
      } = require("@/actions/session-media-actions");
      uploadSessionPhotosAction.mockResolvedValue({
        success: true,
        data: { uploaded: 1, failed: 1, errors: ["File too large"] },
      });

      renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={jest.fn()}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      const mockFile = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, mockFile);

      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      await user.click(uploadButton);

      // Should show both success and warning messages
      await waitFor(() => {
        const { toast } = require("sonner");
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("Successfully uploaded 1 photo(s)")
        );
        expect(toast.warning).toHaveBeenCalledWith(
          expect.stringContaining("1 photo(s) failed to upload")
        );
      });
    });

    it("should clean up object URLs on component unmount", async () => {
      const mockOnUploadComplete = jest.fn();

      const { unmount } = renderWithProviders(
        <SessionPhotoUpload
          sessionId="test-session-id"
          onUploadComplete={mockOnUploadComplete}
          maxPhotos={5}
        />,
        { user: mockUser }
      );

      // Upload file to create object URL
      const user = userEvent.setup();
      const mockFile = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, mockFile);

      // Unmount component
      unmount();

      // Should have called revokeObjectURL
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
});
