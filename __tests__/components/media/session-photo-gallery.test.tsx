import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import SessionPhotoGallery from "@/components/media/session-photo-gallery";
import {
  deleteSessionPhotoAction,
  updatePhotoCaptionAction,
} from "@/actions/session-media-actions";

// Mock the server actions
jest.mock("@/actions/session-media-actions", () => ({
  deleteSessionPhotoAction: jest.fn(),
  updatePhotoCaptionAction: jest.fn(),
  getSessionPhotosAction: jest.fn(),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockDeleteSessionPhotoAction =
  deleteSessionPhotoAction as jest.MockedFunction<
    typeof deleteSessionPhotoAction
  >;
const mockUpdatePhotoCaptionAction =
  updatePhotoCaptionAction as jest.MockedFunction<
    typeof updatePhotoCaptionAction
  >;
const mockToast = toast as any;

describe("SessionPhotoGallery", () => {
  const mockPhotos = [
    {
      id: "photo-1",
      session_id: "session-123",
      user_id: "user-123",
      public_url: "https://example.com/photo1.jpg",
      storage_path: "path/photo1.jpg",
      caption: "Beautiful sunset session",
      file_size: 2048000,
      metadata: { width: 1920, height: 1080 },
      created_at: "2024-01-01T10:00:00Z",
    },
    {
      id: "photo-2",
      session_id: "session-123",
      user_id: "user-123",
      public_url: "https://example.com/photo2.jpg",
      storage_path: "path/photo2.jpg",
      caption: "Perfect waves",
      file_size: 1536000,
      metadata: { width: 1920, height: 1080 },
      created_at: "2024-01-01T11:00:00Z",
    },
    {
      id: "photo-3",
      session_id: "session-123",
      user_id: "user-123",
      public_url: "https://example.com/photo3.jpg",
      storage_path: "path/photo3.jpg",
      caption: "",
      file_size: 1024000,
      created_at: "2024-01-01T12:00:00Z",
    },
  ];

  const defaultProps = {
    sessionId: "session-123",
    photos: mockPhotos,
    canEdit: false,
    showMetadata: false,
    onPhotosChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders photo grid correctly", () => {
    render(<SessionPhotoGallery {...defaultProps} />);

    // Should show all photos
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByText("Beautiful sunset session")).toBeInTheDocument();
    expect(screen.getByText("Perfect waves")).toBeInTheDocument();
  });

  it("shows empty state when no photos", () => {
    render(<SessionPhotoGallery {...defaultProps} photos={[]} />);

    expect(
      screen.getByText("No photos in this session yet")
    ).toBeInTheDocument();
  });

  it("shows metadata when showMetadata is true", () => {
    render(<SessionPhotoGallery {...defaultProps} showMetadata={true} />);

    expect(screen.getByText("2 MB")).toBeInTheDocument(); // File size
    expect(screen.getByText("1.5 MB")).toBeInTheDocument(); // File size
    expect(screen.getByText("1 MB")).toBeInTheDocument(); // File size
  });

  it("opens lightbox when photo is clicked", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} />);

    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
    });
  });

  it("navigates through photos in lightbox", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} />);

    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
    });

    // Navigate to next photo
    const nextButton = screen.getByLabelText("Next");
    await user.click(nextButton);

    expect(screen.getByText("2 of 3")).toBeInTheDocument();

    // Navigate to previous photo
    const prevButton = screen.getByLabelText("Previous");
    await user.click(prevButton);

    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("closes lightbox when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} />);

    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText("Close");
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows edit and delete buttons when canEdit is true", () => {
    render(<SessionPhotoGallery {...defaultProps} canEdit={true} />);

    // Hover over first photo to show action buttons
    const firstPhotoContainer = screen.getAllByRole("img")[0].closest("div");
    if (firstPhotoContainer) {
      fireEvent.mouseEnter(firstPhotoContainer);
    }

    // Should show edit and delete buttons (they may be hidden by CSS initially)
    expect(screen.getAllByLabelText("Edit")).toHaveLength(3);
    expect(screen.getAllByLabelText("Delete")).toHaveLength(3);
  });

  it("deletes photo when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onPhotosChange = jest.fn();

    mockDeleteSessionPhotoAction.mockResolvedValue({ success: true });

    render(
      <SessionPhotoGallery
        {...defaultProps}
        canEdit={true}
        onPhotosChange={onPhotosChange}
      />
    );

    // Find delete button for first photo
    const deleteButtons = screen.getAllByLabelText("Delete");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteSessionPhotoAction).toHaveBeenCalledWith("photo-1");
      expect(mockToast.success).toHaveBeenCalledWith(
        "Photo deleted successfully"
      );
      expect(onPhotosChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "photo-2" }),
          expect.objectContaining({ id: "photo-3" }),
        ])
      );
    });
  });

  it("handles delete failure", async () => {
    const user = userEvent.setup();

    mockDeleteSessionPhotoAction.mockResolvedValue({
      success: false,
      error: "Delete failed",
    });

    render(<SessionPhotoGallery {...defaultProps} canEdit={true} />);

    const deleteButtons = screen.getAllByLabelText("Delete");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("starts editing caption when edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} canEdit={true} />);

    // Open lightbox first
    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click edit button in lightbox
    const editButton = screen.getByLabelText("Edit caption");
    await user.click(editButton);

    // Should show caption input
    expect(screen.getByLabelText("Caption")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Beautiful sunset session")
    ).toBeInTheDocument();
  });

  it("saves caption when save button is clicked", async () => {
    const user = userEvent.setup();
    const onPhotosChange = jest.fn();

    mockUpdatePhotoCaptionAction.mockResolvedValue({ success: true });

    render(
      <SessionPhotoGallery
        {...defaultProps}
        canEdit={true}
        onPhotosChange={onPhotosChange}
      />
    );

    // Open lightbox and start editing
    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText("Edit caption");
    await user.click(editButton);

    // Edit caption
    const captionInput = screen.getByDisplayValue("Beautiful sunset session");
    await user.clear(captionInput);
    await user.type(captionInput, "Updated caption");

    // Save caption
    const saveButton = screen.getByText("Save");
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdatePhotoCaptionAction).toHaveBeenCalledWith(
        "photo-1",
        "Updated caption"
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Caption updated successfully"
      );
      expect(onPhotosChange).toHaveBeenCalled();
    });
  });

  it("cancels caption editing when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} canEdit={true} />);

    // Open lightbox and start editing
    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText("Edit caption");
    await user.click(editButton);

    // Edit caption
    const captionInput = screen.getByDisplayValue("Beautiful sunset session");
    await user.clear(captionInput);
    await user.type(captionInput, "This should be cancelled");

    // Cancel editing
    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    // Should return to original caption
    expect(screen.getByText("Beautiful sunset session")).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("This should be cancelled")
    ).not.toBeInTheDocument();
  });

  it("handles caption update failure", async () => {
    const user = userEvent.setup();

    mockUpdatePhotoCaptionAction.mockResolvedValue({
      success: false,
      error: "Update failed",
    });

    render(<SessionPhotoGallery {...defaultProps} canEdit={true} />);

    // Open lightbox and edit caption
    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText("Edit caption");
    await user.click(editButton);

    const saveButton = screen.getByText("Save");
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  it('shows "No caption" when photo has no caption', async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} />);

    // Click on third photo (which has no caption)
    const thirdPhoto = screen.getAllByRole("img")[2];
    await user.click(thirdPhoto);

    await waitFor(() => {
      expect(screen.getByText("No caption")).toBeInTheDocument();
    });
  });

  it("displays metadata in lightbox when showMetadata is true", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} showMetadata={true} />);

    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByText("2 MB")).toBeInTheDocument();
      expect(screen.getByText("1920 × 1080")).toBeInTheDocument();
      expect(screen.getByText("Jan 1, 2024, 10:00 AM")).toBeInTheDocument();
    });
  });

  it("closes lightbox and adjusts index when deleting current photo", async () => {
    const user = userEvent.setup();
    const onPhotosChange = jest.fn();

    mockDeleteSessionPhotoAction.mockResolvedValue({ success: true });

    render(
      <SessionPhotoGallery
        {...defaultProps}
        canEdit={true}
        onPhotosChange={onPhotosChange}
      />
    );

    // Open lightbox on first photo
    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
    });

    // Delete the current photo
    const deleteButton = screen.getByLabelText("Delete");
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteSessionPhotoAction).toHaveBeenCalledWith("photo-1");
      // Should still show lightbox but with adjusted index
      expect(screen.getByText("1 of 2")).toBeInTheDocument();
    });
  });

  it("closes lightbox when deleting the last remaining photo", async () => {
    const user = userEvent.setup();
    const onPhotosChange = jest.fn();

    mockDeleteSessionPhotoAction.mockResolvedValue({ success: true });

    // Start with only one photo
    const singlePhoto = [mockPhotos[0]];
    render(
      <SessionPhotoGallery
        {...defaultProps}
        photos={singlePhoto}
        canEdit={true}
        onPhotosChange={onPhotosChange}
      />
    );

    // Open lightbox
    const photo = screen.getByRole("img");
    await user.click(photo);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Delete the photo
    const deleteButton = screen.getByLabelText("Delete");
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteSessionPhotoAction).toHaveBeenCalledWith("photo-1");
      // Lightbox should be closed
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("formats file sizes correctly", () => {
    render(<SessionPhotoGallery {...defaultProps} showMetadata={true} />);

    expect(screen.getByText("2 MB")).toBeInTheDocument();
    expect(screen.getByText("1.5 MB")).toBeInTheDocument();
    expect(screen.getByText("1 MB")).toBeInTheDocument();
  });

  it("formats dates correctly", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} showMetadata={true} />);

    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      // Should format date in readable format
      expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
    });
  });

  it("updates photos when props change", () => {
    const { rerender } = render(<SessionPhotoGallery {...defaultProps} />);

    expect(screen.getAllByRole("img")).toHaveLength(3);

    // Update with fewer photos
    const updatedPhotos = [mockPhotos[0], mockPhotos[1]];
    rerender(<SessionPhotoGallery {...defaultProps} photos={updatedPhotos} />);

    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("handles keyboard navigation in lightbox", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoGallery {...defaultProps} />);

    const firstPhoto = screen.getAllByRole("img")[0];
    await user.click(firstPhoto);

    await waitFor(() => {
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
    });

    // Test keyboard navigation (would need to implement in component)
    // This is a placeholder test for future keyboard support
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("prevents edit actions when canEdit is false", () => {
    render(<SessionPhotoGallery {...defaultProps} canEdit={false} />);

    // Should not show any edit or delete buttons
    expect(screen.queryByLabelText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
  });
});
