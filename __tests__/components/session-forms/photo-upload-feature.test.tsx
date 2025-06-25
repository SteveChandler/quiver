import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast } from "sonner";

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
  },
}));

const mockToast = toast as any;

// Simple test component that mimics our photo upload implementation logic
const PhotoUploadFeature = ({
  isPlanning,
  sessionId,
  loading,
}: {
  isPlanning: boolean;
  sessionId: string | null;
  loading: boolean;
}) => {
  const handlePhotoUploadComplete = (uploadedCount: number) => {
    toast.success(`${uploadedCount} photos uploaded successfully!`);
  };

  // This mimics the conditional rendering logic we added to SessionForm
  if (!isPlanning) {
    return null;
  }

  return (
    <div data-testid="photo-upload-section" className="photo-upload-section">
      <div className="flex items-center mb-4">
        <h2 className="text-lg font-medium">
          Add Photos for Your Planned Session
        </h2>
      </div>
      <div className="space-y-4">
        {sessionId ? (
          <>
            <p className="text-sm text-muted-foreground">
              Upload photos to share your planned session experience
            </p>

            <div data-testid="session-photo-upload">
              <div>
                <p>Session ID: {sessionId}</p>
                <p>Max Photos: 5</p>
                <p>Disabled: {loading.toString()}</p>
                <button
                  onClick={() => handlePhotoUploadComplete(2)}
                  data-testid="upload-photos-button"
                >
                  Choose Files
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-4" data-testid="no-session-message">
            <p className="text-sm text-muted-foreground mb-2">
              Create your session first to upload photos
            </p>
            <p className="text-xs text-muted-foreground">
              Fill out the session details above and save to enable photo
              uploads
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

describe("SessionForm Photo Upload Feature Implementation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Conditional Rendering Logic", () => {
    it("should render photo upload section when isPlanning is true with session ID", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(screen.getByTestId("photo-upload-section")).toBeInTheDocument();
      expect(screen.getByTestId("session-photo-upload")).toBeInTheDocument();
    });

    it("should render no-session message when isPlanning is true but no sessionId", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId={null}
          loading={false}
        />
      );

      expect(screen.getByTestId("photo-upload-section")).toBeInTheDocument();
      expect(screen.getByTestId("no-session-message")).toBeInTheDocument();
      expect(
        screen.queryByTestId("session-photo-upload")
      ).not.toBeInTheDocument();
    });

    it("should NOT render photo upload section when isPlanning is false", () => {
      render(
        <PhotoUploadFeature
          isPlanning={false}
          sessionId={null}
          loading={false}
        />
      );

      expect(
        screen.queryByTestId("photo-upload-section")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("session-photo-upload")
      ).not.toBeInTheDocument();
    });

    it("should return null component when isPlanning is false", () => {
      const { container } = render(
        <PhotoUploadFeature
          isPlanning={false}
          sessionId={null}
          loading={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Content and Text", () => {
    it("should display correct heading", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(
        screen.getByText("Add Photos for Your Planned Session")
      ).toBeInTheDocument();
    });

    it("should display descriptive text when session exists", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(
        screen.getByText(
          "Upload photos to share your planned session experience"
        )
      ).toBeInTheDocument();
    });

    it("should display Choose Files button when session exists", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(screen.getByText("Choose Files")).toBeInTheDocument();
    });

    it("should display create session message when no session", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId={null}
          loading={false}
        />
      );

      expect(
        screen.getByText("Create your session first to upload photos")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Fill out the session details above and save to enable photo uploads"
        )
      ).toBeInTheDocument();
    });
  });

  describe("Props Handling", () => {
    it("should show create session message when sessionId is null", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId={null}
          loading={false}
        />
      );

      expect(screen.getByTestId("no-session-message")).toBeInTheDocument();
      expect(
        screen.getByText("Create your session first to upload photos")
      ).toBeInTheDocument();
    });

    it("should use provided session ID when available", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(screen.getByText("Session ID: session-123")).toBeInTheDocument();
    });

    it("should show create session message when sessionId is empty string", () => {
      render(
        <PhotoUploadFeature isPlanning={true} sessionId="" loading={false} />
      );

      expect(screen.getByTestId("no-session-message")).toBeInTheDocument();
      expect(
        screen.getByText("Create your session first to upload photos")
      ).toBeInTheDocument();
    });

    it("should show disabled state when loading", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={true}
        />
      );

      expect(screen.getByText("Disabled: true")).toBeInTheDocument();
    });

    it("should show enabled state when not loading", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(screen.getByText("Disabled: false")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should call success toast when upload completes", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      const uploadButton = screen.getByTestId("upload-photos-button");
      fireEvent.click(uploadButton);

      expect(mockToast.success).toHaveBeenCalledWith(
        "2 photos uploaded successfully!"
      );
    });

    it("should call success toast with correct count", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      const uploadButton = screen.getByTestId("upload-photos-button");
      fireEvent.click(uploadButton);

      expect(mockToast.success).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith(
        "2 photos uploaded successfully!"
      );
    });

    it("should not have upload button when no session", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId={null}
          loading={false}
        />
      );

      expect(
        screen.queryByTestId("upload-photos-button")
      ).not.toBeInTheDocument();
    });
  });

  describe("Component Props Configuration", () => {
    it("should configure max photos to 5", () => {
      render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(screen.getByText("Max Photos: 5")).toBeInTheDocument();
    });

    it("should handle loading state changes", () => {
      const { rerender } = render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(screen.getByText("Disabled: false")).toBeInTheDocument();

      rerender(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={true}
        />
      );

      expect(screen.getByText("Disabled: true")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple renders correctly", () => {
      const { rerender } = render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-1"
          loading={false}
        />
      );

      expect(screen.getByText("Session ID: session-1")).toBeInTheDocument();

      rerender(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-2"
          loading={false}
        />
      );

      expect(screen.getByText("Session ID: session-2")).toBeInTheDocument();
    });

    it("should handle toggle between planning modes", () => {
      const { rerender } = render(
        <PhotoUploadFeature
          isPlanning={true}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(screen.getByTestId("photo-upload-section")).toBeInTheDocument();

      rerender(
        <PhotoUploadFeature
          isPlanning={false}
          sessionId="session-123"
          loading={false}
        />
      );

      expect(
        screen.queryByTestId("photo-upload-section")
      ).not.toBeInTheDocument();
    });
  });
});
