import {
  COMMUNITY_PHOTO_TERMS_VERSION,
  getCommunityPhotoFeatureFlags,
  parseCommunityPhotoReport,
  parseCommunityPhotoUploadFields,
  parseCommunityPhotoVote,
} from "@/lib/community-photos";

const UUID = "10000000-0000-4000-8000-000000000001";

describe("community photo contracts", () => {
  it("reports reads and writes on, the shape installed native apps read", () => {
    expect(getCommunityPhotoFeatureFlags()).toEqual({
      readEnabled: true,
      writeEnabled: true,
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
