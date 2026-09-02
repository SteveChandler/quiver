const rpc = jest.fn();
const upload = jest.fn();
const storageFrom = jest.fn(() => ({ upload }));
const getCommunityPhotoById = jest.fn();

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({
    rpc,
    storage: { from: storageFrom },
  }),
}));

jest.mock("@/lib/community-photos/resolver", () => ({
  getCommunityPhotoById: (...args: unknown[]) =>
    getCommunityPhotoById(...args),
}));

import {
  completeCommunityPhotoUpload,
  preflightCommunityPhotoUpload,
  removeCommunityPhoto,
  reportCommunityPhoto,
  reserveCommunityPhotoUpload,
  voteCommunityPhoto,
} from "@/lib/community-photos/repository";

const PHOTO_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "20000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_KEY = "30000000-0000-4000-8000-000000000001";

describe("community photo mutation repository envelopes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes the attempt idempotency key to upload preflight", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await preflightCommunityPhotoUpload({
      uploaderId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(rpc).toHaveBeenCalledWith(
      "preflight_community_spot_photo_upload_v1",
      {
        p_uploader_id: USER_ID,
        p_idempotency_key: IDEMPOTENCY_KEY,
      },
    );
  });

  it.each(["processing", "ready"] as const)(
    "maps an existing %s reservation without losing its stable storage path",
    async (processingStatus) => {
      rpc.mockResolvedValue({
        data: [{
          photo_id: PHOTO_ID,
          storage_path: `${USER_ID}/${PHOTO_ID}.webp`,
          replay: true,
          processing_status: processingStatus,
        }],
        error: null,
      });

      await expect(
        reserveCommunityPhotoUpload({
          uploaderId: USER_ID,
          targetType: "beach",
          targetId: PHOTO_ID,
          visibility: "public",
          termsVersion: "2026-07-25",
          rightsConfirmed: true,
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      ).resolves.toEqual({
        photoId: PHOTO_ID,
        storagePath: `${USER_ID}/${PHOTO_ID}.webp`,
        replay: true,
        processingStatus,
      });
    },
  );

  it("does not resolve or process an overlapping processing replay", async () => {
    await expect(
      completeCommunityPhotoUpload({
        uploaderId: USER_ID,
        reservation: {
          photoId: PHOTO_ID,
          storagePath: `${USER_ID}/${PHOTO_ID}.webp`,
          replay: true,
          processingStatus: "processing",
        },
        image: null,
      }),
    ).rejects.toMatchObject({
      code: "upload_in_progress",
      retryable: true,
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("uploads fresh image bytes as a Blob for serverless fetch compatibility", async () => {
    upload.mockResolvedValue({
      data: { path: `${USER_ID}/${PHOTO_ID}.webp` },
      error: null,
    });
    rpc.mockResolvedValue({ data: true, error: null });
    getCommunityPhotoById.mockResolvedValue({ id: PHOTO_ID });

    await completeCommunityPhotoUpload({
      uploaderId: USER_ID,
      reservation: {
        photoId: PHOTO_ID,
        storagePath: `${USER_ID}/${PHOTO_ID}.webp`,
        replay: false,
        processingStatus: "processing",
      },
      image: {
        bytes: Buffer.from("webp"),
        contentType: "image/webp",
        width: 1600,
        height: 900,
      },
    });

    expect(storageFrom).toHaveBeenCalledWith("community-spot-photos");
    expect(upload).toHaveBeenCalledWith(
      `${USER_ID}/${PHOTO_ID}.webp`,
      expect.any(Blob),
      {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      },
    );
    const body = upload.mock.calls[0]?.[1] as Blob;
    expect(body.type).toBe("image/webp");
    expect(body.size).toBe(Buffer.byteLength("webp"));
  });

  it("maps a durable failed-key reservation rejection to a terminal error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "upload_attempt_failed" },
    });

    await expect(
      reserveCommunityPhotoUpload({
        uploaderId: USER_ID,
        targetType: "beach",
        targetId: PHOTO_ID,
        visibility: "public",
        termsVersion: "2026-07-25",
        rightsConfirmed: true,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({
      code: "upload_attempt_failed",
      retryable: false,
    });
  });

  it("maps the vote RPC row to the exact camelCase API envelope", async () => {
    rpc.mockResolvedValue({
      data: [{
        photo_id: PHOTO_ID,
        vote: "up",
        upvotes: 7,
        downvotes: 2,
        vote_score: 0.51,
      }],
      error: null,
    });

    await expect(
      voteCommunityPhoto({
        photoId: PHOTO_ID,
        voterId: USER_ID,
        vote: "up",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).resolves.toEqual({
      photoId: PHOTO_ID,
      vote: "up",
      upvotes: 7,
      downvotes: 2,
      voteScore: 0.51,
    });
  });

  it("maps report and removal timestamps without leaking snake_case", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ photo_id: PHOTO_ID, status: "visible", report_count: 2 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          photo_id: PHOTO_ID,
          status: "removed",
          recoverable_until: "2026-08-25T12:00:00.000Z",
        }],
        error: null,
      });

    await expect(
      reportCommunityPhoto({
        photoId: PHOTO_ID,
        reporterId: USER_ID,
        reason: "stale",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).resolves.toEqual({
      photoId: PHOTO_ID,
      status: "visible",
      reportCount: 2,
    });
    await expect(
      removeCommunityPhoto({
        photoId: PHOTO_ID,
        uploaderId: USER_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).resolves.toEqual({
      photoId: PHOTO_ID,
      status: "removed",
      recoverableUntil: "2026-08-25T12:00:00.000Z",
    });
  });
});
