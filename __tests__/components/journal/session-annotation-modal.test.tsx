import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SessionAnnotationModal } from "@/components/journal/session-annotation-modal";
import { SESSION_PHOTO_MAX_PER_SESSION } from "@/lib/media/session-photo-policy";
import type { SessionWithDetails } from "@/types/database";

jest.mock("date-fns", () => ({
  format: jest.fn(() => "Monday, August 18, 2026"),
}));
jest.mock("date-fns/format", () => ({
  __esModule: true,
  default: jest.fn(() => "Monday, August 18, 2026"),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/components/media/session-photo-upload", () => ({
  __esModule: true,
  default: ({ maxPhotos }: { maxPhotos: number }) => (
    <div data-testid="session-photo-upload" data-max-photos={maxPhotos} />
  ),
}));

jest.mock("@/components/media/session-photo-gallery", () => ({
  __esModule: true,
  default: () => null,
}));

const session = {
  id: "session-1",
  notes: "",
  is_public: true,
  rating: 4,
  arrival_time: "2026-08-18T08:00:00.000Z",
  beach_name: "Ocean Beach",
  duration_minutes: 60,
} as unknown as SessionWithDetails;

function createPhotoRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index + 1}`,
    session_id: "session-1",
    user_id: "user-1",
    public_url: `https://example.com/photo-${index + 1}.jpg`,
    storage_path: `sessions/session-1/photo-${index + 1}.jpg`,
    file_size: 1024,
    created_at: `2026-08-18T08:0${index + 1}:00.000Z`,
  }));
}

function photoResponse(count: number) {
  return {
    ok: true,
    json: async () => ({ data: { photos: createPhotoRows(count) } }),
  };
}

describe("SessionAnnotationModal photo limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(photoResponse(2));
  });

  it("passes only the remaining shared session-photo slots to the uploader", async () => {
    render(
      <SessionAnnotationModal
        session={session}
        isOpen
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    const addPhotoButton = await screen.findByRole("button", {
      name: "Add Photo",
    });
    await waitFor(() => expect(addPhotoButton).not.toBeDisabled());

    fireEvent.click(addPhotoButton);

    expect(await screen.findByTestId("session-photo-upload")).toHaveAttribute(
      "data-max-photos",
      String(SESSION_PHOTO_MAX_PER_SESSION - 2),
    );
  });

  it("keeps Add Photo disabled until the existing photo count loads", async () => {
    let resolvePhotoRequest!: (response: unknown) => void;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolvePhotoRequest = resolve;
        }),
    ) as jest.Mock;

    render(
      <SessionAnnotationModal
        session={session}
        isOpen
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    const addPhotoButton = screen.getByRole("button", {
      name: "Add Photo",
    });
    expect(addPhotoButton).toBeDisabled();
    expect(screen.queryByTestId("session-photo-upload")).not.toBeInTheDocument();

    resolvePhotoRequest(photoResponse(2));

    await waitFor(() => expect(addPhotoButton).not.toBeDisabled());
  });

  it("keeps Add Photo disabled when the session already has five photos", async () => {
    global.fetch = jest.fn().mockResolvedValue(photoResponse(5));

    render(
      <SessionAnnotationModal
        session={session}
        isOpen
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    const addPhotoButton = await screen.findByRole("button", {
      name: "Add Photo",
    });
    await waitFor(() => expect(addPhotoButton).toBeDisabled());
    expect(screen.queryByTestId("session-photo-upload")).not.toBeInTheDocument();
  });
});
