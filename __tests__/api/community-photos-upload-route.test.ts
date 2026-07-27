/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockPreflightCommunityPhotoUpload = jest.fn();
const mockReserveCommunityPhotoUpload = jest.fn();
const mockCompleteCommunityPhotoUpload = jest.fn();
const mockFailCommunityPhotoUpload = jest.fn();
const mockProcessCommunityPhoto = jest.fn();

jest.mock("@/lib/community-photos", () => {
  const actual = jest.requireActual("@/lib/community-photos");
  return {
    ...actual,
    getCommunityPhotoFeatureFlags: () => ({
      readEnabled: true,
      writeEnabled: true,
      termsVersion: "2026-07-25",
    }),
    preflightCommunityPhotoUpload: mockPreflightCommunityPhotoUpload,
    reserveCommunityPhotoUpload: mockReserveCommunityPhotoUpload,
    completeCommunityPhotoUpload: mockCompleteCommunityPhotoUpload,
    failCommunityPhotoUpload: mockFailCommunityPhotoUpload,
  };
});

jest.mock("@/lib/community-photos/image-processing", () => ({
  COMMUNITY_PHOTO_MAX_INPUT_BYTES: 15 * 1024 * 1024,
  processCommunityPhoto: mockProcessCommunityPhoto,
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, {
        params: context ?? {},
        user: { id: "10000000-0000-4000-8000-000000000001" },
        supabase: {},
      }),
  withRateLimit: (handler: (...args: unknown[]) => unknown) => handler,
}));

const TARGET_ID = "20000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_KEY = "30000000-0000-4000-8000-000000000001";

function request({
  headerKey = IDEMPOTENCY_KEY,
  bodyKey = IDEMPOTENCY_KEY,
  targetId = TARGET_ID,
}: {
  headerKey?: string | null;
  bodyKey?: string;
  targetId?: string;
} = {}): { request: NextRequest; formData: jest.Mock } {
  const form = new FormData();
  form.set("photo", new File([Buffer.from("image")], "photo.jpg", {
    type: "image/jpeg",
  }));
  form.set("targetType", "beach");
  form.set("targetId", targetId);
  form.set("visibility", "public");
  form.set("termsVersion", "2026-07-25");
  form.set("rightsConfirmed", "true");
  form.set("idempotencyKey", bodyKey);
  const nextRequest = new NextRequest(
    "https://example.com/api/community-photos/upload",
    {
      method: "POST",
      body: form,
      headers: headerKey ? { "Idempotency-Key": headerKey } : undefined,
    },
  );
  const formData = jest.fn(() => Promise.resolve(form));
  Object.defineProperty(nextRequest, "formData", { value: formData });
  return { request: nextRequest, formData };
}

describe("POST /api/community-photos/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessCommunityPhoto.mockResolvedValue({
      bytes: Buffer.from("webp"),
      contentType: "image/webp",
      width: 1600,
      height: 900,
    });
    mockPreflightCommunityPhotoUpload.mockResolvedValue(undefined);
    mockReserveCommunityPhotoUpload.mockResolvedValue({
      photoId: "40000000-0000-4000-8000-000000000001",
      storagePath:
        "10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.webp",
      replay: false,
      processingStatus: "processing",
    });
  });

  it.each([
    { replay: false, processingStatus: "processing", status: 201 },
    { replay: true, processingStatus: "ready", status: 200 },
  ])(
    "returns the shared ResolvedSpotPhoto envelope for replay=$replay and $processingStatus",
    async ({ replay, processingStatus, status }) => {
      const photo = {
        id: "40000000-0000-4000-8000-000000000001",
        source: "community",
        visibility: "public",
        imageUrl:
          "/api/community-photos/40000000-0000-4000-8000-000000000001/image",
        thumbUrl:
          "/api/community-photos/40000000-0000-4000-8000-000000000001/image",
        width: 1600,
        height: 900,
        title: null,
        creatorName: null,
        attributionHtml: null,
        attribution: {
          kind: "profile",
          displayName: "Local Surfer",
          profileId: "10000000-0000-4000-8000-000000000001",
        },
        community: {
          voteScore: 0,
          upvotes: 0,
          downvotes: 0,
          viewerVote: null,
          canVote: false,
          canReport: false,
          canRemove: true,
          isPinned: false,
        },
        createdAt: "2026-07-25T12:00:00.000Z",
      };
      mockReserveCommunityPhotoUpload.mockResolvedValue({
        photoId: photo.id,
        storagePath:
          "10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.webp",
        replay,
        processingStatus,
      });
      mockCompleteCommunityPhotoUpload.mockResolvedValue({ photo, replay });
      const { POST } = await import("@/app/api/community-photos/upload/route");
      const uploadRequest = request();
      const response = await POST(uploadRequest.request, { params: {} });

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ photo });
      expect(mockPreflightCommunityPhotoUpload).toHaveBeenCalledWith({
        uploaderId: "10000000-0000-4000-8000-000000000001",
        idempotencyKey: IDEMPOTENCY_KEY,
      });
      expect(mockReserveCommunityPhotoUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          uploaderId: "10000000-0000-4000-8000-000000000001",
          targetType: "beach",
          targetId: TARGET_ID,
          visibility: "public",
          termsVersion: "2026-07-25",
          rightsConfirmed: true,
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      );
      expect(
        mockPreflightCommunityPhotoUpload.mock.invocationCallOrder[0],
      ).toBeLessThan(uploadRequest.formData.mock.invocationCallOrder[0]);
      expect(
        mockReserveCommunityPhotoUpload.mock.invocationCallOrder[0],
      ).toBeLessThan(
        replay
          ? mockCompleteCommunityPhotoUpload.mock.invocationCallOrder[0]
          : mockProcessCommunityPhoto.mock.invocationCallOrder[0],
      );
      expect(mockProcessCommunityPhoto).toHaveBeenCalledTimes(
        replay ? 0 : 1,
      );
    },
  );

  it("returns retryable upload_in_progress for an overlapping same-key request", async () => {
    let markProcessingStarted: (() => void) | undefined;
    let releaseProcessing: (() => void) | undefined;
    const processingStarted = new Promise<void>((resolve) => {
      markProcessingStarted = resolve;
    });
    const processingReleased = new Promise<void>((resolve) => {
      releaseProcessing = resolve;
    });
    const processedImage = {
      bytes: Buffer.from("webp"),
      contentType: "image/webp",
      width: 1600,
      height: 900,
    };
    mockProcessCommunityPhoto.mockImplementationOnce(async () => {
      markProcessingStarted?.();
      await processingReleased;
      return processedImage;
    });
    mockCompleteCommunityPhotoUpload.mockResolvedValue({
      photo: { id: "40000000-0000-4000-8000-000000000001" },
      replay: false,
    });

    const { POST } = await import("@/app/api/community-photos/upload/route");
    const firstResponse = POST(request().request, { params: {} });
    await processingStarted;
    mockReserveCommunityPhotoUpload.mockResolvedValueOnce({
      photoId: "40000000-0000-4000-8000-000000000001",
      storagePath:
        "10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.webp",
      replay: true,
      processingStatus: "processing",
    });

    const overlappingResponse = await POST(request().request, { params: {} });

    expect(overlappingResponse.status).toBe(409);
    expect(await overlappingResponse.json()).toEqual({
      error: "upload in progress",
      code: "upload_in_progress",
      retryable: true,
    });
    expect(mockProcessCommunityPhoto).toHaveBeenCalledTimes(1);
    expect(mockCompleteCommunityPhotoUpload).not.toHaveBeenCalled();

    releaseProcessing?.();
    expect((await firstResponse).status).toBe(201);
  });

  it("rejects a failed key reused with a different payload before parsing or processing", async () => {
    const { CommunityPhotoError } = jest.requireActual(
      "@/lib/community-photos",
    ) as typeof import("@/lib/community-photos");
    mockPreflightCommunityPhotoUpload.mockRejectedValueOnce(
      new CommunityPhotoError("upload_attempt_failed"),
    );
    const uploadRequest = request({
      targetId: "20000000-0000-4000-8000-000000000002",
    });
    const { POST } = await import("@/app/api/community-photos/upload/route");

    const response = await POST(uploadRequest.request, { params: {} });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "upload attempt failed",
      code: "upload_attempt_failed",
      retryable: false,
    });
    expect(uploadRequest.formData).not.toHaveBeenCalled();
    expect(mockReserveCommunityPhotoUpload).not.toHaveBeenCalled();
    expect(mockProcessCommunityPhoto).not.toHaveBeenCalled();
  });

  it("rejects extra multipart fields before processing image bytes", async () => {
    const invalid = request();
    const body = await invalid.request.formData();
    body.set("coordinates", "32.7,-117.2");
    const responseRequest = new NextRequest(
      "https://example.com/api/community-photos/upload",
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": IDEMPOTENCY_KEY },
      },
    );
    const { POST } = await import("@/app/api/community-photos/upload/route");
    const response = await POST(responseRequest, { params: {} });

    expect(response.status).toBe(400);
    expect(mockProcessCommunityPhoto).not.toHaveBeenCalled();
    expect(mockReserveCommunityPhotoUpload).not.toHaveBeenCalled();
  });

  it("rejects a missing idempotency header before parsing the body", async () => {
    const uploadRequest = request({ headerKey: null });
    const { POST } = await import("@/app/api/community-photos/upload/route");
    const response = await POST(uploadRequest.request, { params: {} });

    expect(response.status).toBe(400);
    expect(uploadRequest.formData).not.toHaveBeenCalled();
    expect(mockReserveCommunityPhotoUpload).not.toHaveBeenCalled();
  });

  it("rejects a header that does not match the multipart idempotency key", async () => {
    const uploadRequest = request({
      headerKey: "30000000-0000-4000-8000-000000000002",
    });
    const { POST } = await import("@/app/api/community-photos/upload/route");
    const response = await POST(uploadRequest.request, { params: {} });

    expect(response.status).toBe(400);
    expect(mockReserveCommunityPhotoUpload).not.toHaveBeenCalled();
  });

  it("compensates a reservation when image processing rejects the bytes", async () => {
    mockProcessCommunityPhoto.mockRejectedValue(new Error("invalid_image"));
    const uploadRequest = request();
    const { POST } = await import("@/app/api/community-photos/upload/route");
    const response = await POST(uploadRequest.request, { params: {} });

    expect(response.status).toBe(415);
    expect(mockFailCommunityPhotoUpload).toHaveBeenCalledWith({
      photoId: "40000000-0000-4000-8000-000000000001",
      uploaderId: "10000000-0000-4000-8000-000000000001",
      reasonCode: "invalid_image",
    });
    expect(mockCompleteCommunityPhotoUpload).not.toHaveBeenCalled();
  });
});
