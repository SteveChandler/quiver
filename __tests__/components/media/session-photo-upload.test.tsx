import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import SessionPhotoUpload from "@/components/media/session-photo-upload";
import {
  uploadSessionPhotosAction,
  getUserStorageUsageAction,
} from "@/actions/session-media-actions";

// Mock the server actions
jest.mock("@/actions/session-media-actions", () => ({
  uploadSessionPhotosAction: jest.fn(),
  getUserStorageUsageAction: jest.fn(),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(global.URL, "createObjectURL", {
  writable: true,
  value: jest.fn(() => "mocked-url"),
});

Object.defineProperty(global.URL, "revokeObjectURL", {
  writable: true,
  value: jest.fn(),
});

const mockUploadSessionPhotosAction =
  uploadSessionPhotosAction as jest.MockedFunction<
    typeof uploadSessionPhotosAction
  >;
const mockGetUserStorageUsageAction =
  getUserStorageUsageAction as jest.MockedFunction<
    typeof getUserStorageUsageAction
  >;
const mockToast = toast as any;

describe("SessionPhotoUpload", () => {
  const defaultProps = {
    sessionId: "session-123",
    onUploadComplete: jest.fn(),
    maxPhotos: 5,
    disabled: false,
  };

  const mockStorageInfo = {
    total_bytes: 10000000,
    image_count: 5,
    remaining_bytes: 90000000,
    can_upload: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserStorageUsageAction.mockResolvedValue({
      success: true,
      data: mockStorageInfo,
    });
  });

  it("renders upload area with storage info", async () => {
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Storage:/)).toBeInTheDocument();
      expect(screen.getByText(/9.5 MB used/)).toBeInTheDocument();
      expect(screen.getByText(/85.8 MB remaining/)).toBeInTheDocument();
    });

    expect(screen.getByText("Add session photos")).toBeInTheDocument();
    expect(screen.getByText("Choose Files")).toBeInTheDocument();
  });

  it("loads storage information on mount", async () => {
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetUserStorageUsageAction).toHaveBeenCalled();
    });
  });

  it("handles file selection via input", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    expect(input).toBeInTheDocument();

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("1 photo(s) selected")).toBeInTheDocument();
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });
    }
  });

  it("validates file types and rejects invalid files", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const invalidFile = new File(["test"], "test.txt", { type: "text/plain" });
    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, invalidFile);

      await waitFor(() => {
        expect(
          screen.getByText(/Only JPEG, PNG, and WebP images are allowed/)
        ).toBeInTheDocument();
      });
    }
  });

  it("validates file size and rejects large files", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    // Mock a large file (>10MB)
    const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });

    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, largeFile);

      await waitFor(() => {
        expect(screen.getByText(/File is too large/)).toBeInTheDocument();
      });
    }
  });

  it("prevents upload when storage quota is exceeded", async () => {
    mockGetUserStorageUsageAction.mockResolvedValue({
      success: true,
      data: {
        ...mockStorageInfo,
        can_upload: false,
      },
    });

    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/Storage quota exceeded/)).toBeInTheDocument();
      });
    }
  });

  it("limits number of files to maxPhotos", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} maxPhotos={2} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const files = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
      new File(["test3"], "test3.jpg", { type: "image/jpeg" }),
    ];

    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, files);

      await waitFor(() => {
        expect(
          screen.getByText(/Maximum 2 photos allowed/)
        ).toBeInTheDocument();
      });
    }
  });

  it("shows compression simulation", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      // Should show compressing initially
      await waitFor(() => {
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });

      // Should show compression result after timeout
      await waitFor(
        () => {
          expect(screen.getByText(/→/)).toBeInTheDocument(); // Arrow showing size reduction
        },
        { timeout: 2000 }
      );
    }
  });

  it("allows removing selected files", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });

      // Find and click remove button
      const removeButton = screen.getByRole("button", { name: "" }); // X button
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText("test.jpg")).not.toBeInTheDocument();
        expect(screen.getByText("Add session photos")).toBeInTheDocument();
      });
    }
  });

  it("clears all files when Clear All button is clicked", async () => {
    const user = userEvent.setup();
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const files = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ];

    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, files);

      await waitFor(() => {
        expect(screen.getByText("2 photo(s) selected")).toBeInTheDocument();
      });

      const clearButton = screen.getByRole("button", { name: /clear all/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText("Add session photos")).toBeInTheDocument();
        expect(screen.queryByText("test1.jpg")).not.toBeInTheDocument();
        expect(screen.queryByText("test2.jpg")).not.toBeInTheDocument();
      });
    }
  });

  it("handles successful upload", async () => {
    const user = userEvent.setup();
    const onUploadComplete = jest.fn();

    mockUploadSessionPhotosAction.mockResolvedValue({
      success: true,
      data: {
        uploaded: 2,
        failed: 0,
        errors: [],
      },
    });

    render(
      <SessionPhotoUpload
        {...defaultProps}
        onUploadComplete={onUploadComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const files = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ];

    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, files);

      await waitFor(() => {
        expect(screen.getByText("2 photo(s) selected")).toBeInTheDocument();
      });

      // Wait for compression simulation to complete
      await waitFor(
        () => {
          expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      await user.click(uploadButton);

      await waitFor(() => {
        expect(mockUploadSessionPhotosAction).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith(
          "Successfully uploaded 2 photo(s)"
        );
        expect(onUploadComplete).toHaveBeenCalledWith(2);
      });
    }
  });

  it("handles upload with partial failures", async () => {
    const user = userEvent.setup();

    mockUploadSessionPhotosAction.mockResolvedValue({
      success: true,
      data: {
        uploaded: 1,
        failed: 1,
        errors: ["Upload failed for test2.jpg"],
      },
    });

    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const files = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ];

    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, files);

      await waitFor(() => {
        expect(screen.getByText("2 photo(s) selected")).toBeInTheDocument();
      });

      // Wait for compression simulation
      await waitFor(
        () => {
          expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      await user.click(uploadButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          "Successfully uploaded 1 photo(s)"
        );
        expect(mockToast.warning).toHaveBeenCalledWith(
          "1 photo(s) failed to upload"
        );
      });
    }
  });

  it("handles upload failure", async () => {
    const user = userEvent.setup();

    mockUploadSessionPhotosAction.mockResolvedValue({
      success: false,
      error: "Upload failed",
    });

    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("1 photo(s) selected")).toBeInTheDocument();
      });

      // Wait for compression simulation
      await waitFor(
        () => {
          expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      await user.click(uploadButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Upload failed");
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });
    }
  });

  it("handles drag and drop functionality", async () => {
    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const dropZone = screen.getByText("Add session photos").closest("div");
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    // Mock drag events
    const dragOverEvent = new Event("dragover", { bubbles: true });
    const dropEvent = new Event("drop", { bubbles: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: [file],
      },
    });

    if (dropZone) {
      fireEvent(dropZone, dragOverEvent);
      fireEvent(dropZone, dropEvent);

      await waitFor(() => {
        expect(screen.getByText("test.jpg")).toBeInTheDocument();
      });
    }
  });

  it("disables functionality when disabled prop is true", async () => {
    render(<SessionPhotoUpload {...defaultProps} disabled={true} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const chooseFilesButton = screen.getByRole("button", {
      name: /choose files/i,
    });
    expect(chooseFilesButton).toBeDisabled();
  });

  it("shows upload progress during upload", async () => {
    const user = userEvent.setup();

    // Mock a delayed upload to see progress
    mockUploadSessionPhotosAction.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                data: { uploaded: 1, failed: 0, errors: [] },
              }),
            1000
          )
        )
    );

    render(<SessionPhotoUpload {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add session photos")).toBeInTheDocument();
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = screen
      .getByRole("button", { name: /choose files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("1 photo(s) selected")).toBeInTheDocument();
      });

      // Wait for compression
      await waitFor(
        () => {
          expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const uploadButton = screen.getByRole("button", {
        name: /upload photos/i,
      });
      await user.click(uploadButton);

      // Should show uploading state
      expect(screen.getByText("Uploading photos...")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Wait for upload to complete
      await waitFor(
        () => {
          expect(
            screen.queryByText("Uploading photos...")
          ).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    }
  });
});
