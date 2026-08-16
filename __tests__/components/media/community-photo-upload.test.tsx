import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CommunityPhotoUpload } from "@/components/media/community-photo-upload";
import { COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES } from "@/lib/community-photos/upload-constraints";

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-id" } }),
}));

type MockXhr = {
  upload: { addEventListener: jest.Mock };
  addEventListener: jest.Mock;
  open: jest.Mock;
  setRequestHeader: jest.Mock;
  send: jest.Mock;
  response: unknown;
  responseText: string;
  responseType: XMLHttpRequestResponseType;
  status: number;
};

describe("CommunityPhotoUpload", () => {
  let xhr: MockXhr;
  let sentFormData: FormData | null;
  let formDataAppendSpy: jest.SpyInstance;

  beforeEach(() => {
    sentFormData = null;
    formDataAppendSpy = jest.spyOn(FormData.prototype, "append");
    URL.createObjectURL = jest.fn(() => "blob:community-photo");
    URL.revokeObjectURL = jest.fn();

    const listeners = new Map<string, () => void>();
    xhr = {
      upload: { addEventListener: jest.fn() },
      addEventListener: jest.fn((type: string, listener: () => void) => {
        listeners.set(type, listener);
      }),
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn((body: FormData) => {
        sentFormData = body;
        xhr.status = 201;
        xhr.response = { photo: { id: "photo-id" } };
        listeners.get("load")?.();
      }),
      response: null,
      responseText: "",
      responseType: "json",
      status: 0,
    };

    global.XMLHttpRequest = jest.fn(() => xhr) as unknown as typeof XMLHttpRequest;
  });

  it("sends the selected original file in the photo multipart field", async () => {
    const originalFile = new File(["original-jpeg-bytes"], "dawn.jpg", {
      type: "image/jpeg",
    });

    render(
      <CommunityPhotoUpload
        targetType="beach"
        targetId="beach-id"
      />,
    );

    const fileInput = screen.getByLabelText("Choose a photo");
    expect(fileInput).toHaveAttribute(
      "accept",
      COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES.join(","),
    );
    fireEvent.change(fileInput, { target: { files: [originalFile] } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Share this photo" }));

    await waitFor(() => expect(xhr.send).toHaveBeenCalledTimes(1));

    const uploadedFile = sentFormData?.get("photo");
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe("dawn.jpg");
    expect((uploadedFile as File).type).toBe("image/jpeg");
    const photoAppend = formDataAppendSpy.mock.calls.find(
      ([fieldName]) => fieldName === "photo",
    );
    expect(photoAppend?.[1]).toBe(originalFile);
    expect(photoAppend?.[2]).toBe("dawn.jpg");
    expect(screen.getByText(/Photo submitted/)).toBeVisible();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
