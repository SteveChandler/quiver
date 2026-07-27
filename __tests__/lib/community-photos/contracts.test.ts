import {
  COMMUNITY_PHOTO_TERMS_VERSION,
  getCommunityPhotoFeatureFlags,
  parseCommunityPhotoReport,
  parseCommunityPhotoUploadFields,
  parseCommunityPhotoVote,
} from "@/lib/community-photos";

const UUID = "10000000-0000-4000-8000-000000000001";

describe("community photo contracts", () => {
  const originalRead = process.env.COMMUNITY_PHOTOS_READ_ENABLED;
  const originalWrite = process.env.COMMUNITY_PHOTOS_WRITE_ENABLED;
  const originalCanary = process.env.COMMUNITY_PHOTOS_CANARY_USER_IDS;

  afterEach(() => {
    process.env.COMMUNITY_PHOTOS_READ_ENABLED = originalRead;
    process.env.COMMUNITY_PHOTOS_WRITE_ENABLED = originalWrite;
    process.env.COMMUNITY_PHOTOS_CANARY_USER_IDS = originalCanary;
  });

  it("fails closed and never enables writes without reads", () => {
    delete process.env.COMMUNITY_PHOTOS_READ_ENABLED;
    delete process.env.COMMUNITY_PHOTOS_WRITE_ENABLED;
    expect(getCommunityPhotoFeatureFlags()).toEqual({
      readEnabled: false,
      writeEnabled: false,
      termsVersion: "2026-07-25",
    });

    process.env.COMMUNITY_PHOTOS_WRITE_ENABLED = "true";
    expect(getCommunityPhotoFeatureFlags().writeEnabled).toBe(false);

    process.env.COMMUNITY_PHOTOS_READ_ENABLED = "true";
    expect(getCommunityPhotoFeatureFlags().writeEnabled).toBe(true);
  });

  it("supports an exact UUID canary allowlist without globally enabling reads", () => {
    delete process.env.COMMUNITY_PHOTOS_READ_ENABLED;
    process.env.COMMUNITY_PHOTOS_WRITE_ENABLED = "true";
    process.env.COMMUNITY_PHOTOS_CANARY_USER_IDS = `${UUID},not-a-uuid`;

    expect(getCommunityPhotoFeatureFlags(UUID)).toEqual({
      readEnabled: true,
      writeEnabled: true,
      termsVersion: COMMUNITY_PHOTO_TERMS_VERSION,
    });
    expect(
      getCommunityPhotoFeatureFlags(
        "20000000-0000-4000-8000-000000000001",
      ),
    ).toEqual({
      readEnabled: false,
      writeEnabled: false,
      termsVersion: COMMUNITY_PHOTO_TERMS_VERSION,
    });
  });

  it("accepts only the current versioned rights confirmation and bounded target fields", () => {
    expect(
      parseCommunityPhotoUploadFields({
        targetType: "beach",
        targetId: UUID,
        visibility: "public",
        termsVersion: COMMUNITY_PHOTO_TERMS_VERSION,
        rightsConfirmed: "true",
        idempotencyKey: UUID,
      }),
    ).toEqual({
      targetType: "beach",
      targetId: UUID,
      visibility: "public",
      termsVersion: COMMUNITY_PHOTO_TERMS_VERSION,
      rightsConfirmed: true,
      idempotencyKey: UUID,
    });

    expect(() =>
      parseCommunityPhotoUploadFields({
        targetType: "beach",
        targetId: UUID,
        visibility: "private",
        termsVersion: "old",
        rightsConfirmed: "false",
        idempotencyKey: UUID,
      }),
    ).toThrow();
  });

  it("bounds mutable votes and reports to the approved vocabulary", () => {
    expect(parseCommunityPhotoVote({ vote: null, idempotencyKey: UUID })).toEqual({
      vote: null,
      idempotencyKey: UUID,
    });
    expect(parseCommunityPhotoVote({ vote: "up", idempotencyKey: UUID }).vote).toBe(
      "up",
    );
    expect(() =>
      parseCommunityPhotoVote({ vote: "useful", idempotencyKey: UUID }),
    ).toThrow();

    expect(
      parseCommunityPhotoReport({
        reason: "privacy",
        idempotencyKey: UUID,
      }).reason,
    ).toBe("privacy");
    expect(() =>
      parseCommunityPhotoReport({
        reason: "free form",
        idempotencyKey: UUID,
      }),
    ).toThrow();
  });
});
