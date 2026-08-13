import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SessionPhotoGallery from "@/components/media/session-photo-gallery";
import SessionPhotoUpload from "@/components/media/session-photo-upload";
import {
  deleteSessionPhotoAction,
  getUserStorageUsageAction,
} from "@/actions/session-media-actions";

jest.mock("@/actions/session-media-actions", () => ({
  deleteSessionPhotoAction: jest.fn(),
  getSessionPhotosAction: jest.fn(),
  getUserStorageUsageAction: jest.fn(),
  updatePhotoCaptionAction: jest.fn(),
  uploadSessionPhotosAction: jest.fn(),
}));

jest.mock("@/lib/utils/image-utils", () => ({
  getTransformedUrl: jest.fn((url: string) => url),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

const mockedDeleteSessionPhotoAction = jest.mocked(deleteSessionPhotoAction);
const mockedGetUserStorageUsageAction = jest.mocked(
  getUserStorageUsageAction,
);

describe("session photo touch controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetUserStorageUsageAction.mockResolvedValue({
      success: true,
      data: {
        total_bytes: 0,
        image_count: 0,
        remaining_bytes: 1000000,
        can_upload: true,
      },
    });
    mockedDeleteSessionPhotoAction.mockResolvedValue({ success: true });
    global.URL.createObjectURL = jest.fn(() => "mock-photo-url");
    global.URL.revokeObjectURL = jest.fn();
  });

  it("keeps the upload preview removal control named and touch-sized", async () => {
    const file = new File(["photo"], "sunset.jpg", { type: "image/jpeg" });
    const { container } = render(
      <SessionPhotoUpload
        sessionId="session-1"
        onUploadComplete={jest.fn()}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Storage:/)).toBeInTheDocument();
    });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    const removeButton = await screen.findByRole("button", {
      name: "Remove sunset.jpg",
    });

    expect(
      screen.getByAltText("Selected photo: sunset.jpg"),
    ).toBeInTheDocument();
    expect(removeButton).not.toHaveClass("opacity-0");
    expect(removeButton).not.toHaveClass("group-hover:opacity-100");
    expect(removeButton).toHaveClass(
      "h-8",
      "w-8",
      "after:absolute",
      "after:-inset-[6px]",
      "after:content-['']",
    );

    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(
        screen.queryByAltText("Selected photo: sunset.jpg"),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps gallery edit and delete actions visible, named, and touch-sized", async () => {
    const photo = {
      id: "photo-1",
      session_id: "session-1",
      user_id: "user-1",
      public_url: "https://example.com/photo.jpg",
      storage_path: "sessions/session-1/photo.jpg",
      caption: "Sunset at the pier",
      file_size: 1024,
      created_at: "2026-08-13T12:00:00.000Z",
    };

    render(
      <SessionPhotoGallery
        sessionId="session-1"
        photos={[photo]}
        canEdit
      />,
    );

    const editButton = screen.getByRole("button", {
      name: "Edit caption for session photo 1",
    });
    const deleteButton = screen.getByRole("button", {
      name: "Delete session photo 1",
    });
    const actionContainer = editButton.parentElement;

    expect(actionContainer).not.toHaveClass("opacity-0");
    expect(actionContainer).not.toHaveClass("group-hover:opacity-100");

    for (const button of [editButton, deleteButton]) {
      expect(button).toHaveClass(
        "h-8",
        "w-8",
        "after:absolute",
        "after:-inset-[6px]",
        "after:content-['']",
      );
    }

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockedDeleteSessionPhotoAction).toHaveBeenCalledWith("photo-1");
    });
  });
});
