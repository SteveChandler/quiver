import { requirePhotoReview } from "@/scripts/lib/beach-photo-review";

describe("requirePhotoReview", () => {
  it("marks third-party fetched photos as unapproved before insert", () => {
    const record = requirePhotoReview({
      beach_id: "beach-1",
      source: "openverse" as const,
      source_id: "photo-1",
      image_url: "https://example.com/photo.jpg",
      fetched_at: "2026-05-06T12:00:00.000Z",
    });

    expect(record).toEqual({
      beach_id: "beach-1",
      source: "openverse",
      source_id: "photo-1",
      image_url: "https://example.com/photo.jpg",
      fetched_at: "2026-05-06T12:00:00.000Z",
      approved: false,
    });
  });

  it("overrides an accidental approved=true value", () => {
    const record = requirePhotoReview({
      beach_id: "beach-1",
      source: "flickr" as const,
      source_id: "photo-2",
      image_url: "https://example.com/photo-2.jpg",
      fetched_at: "2026-05-06T12:00:00.000Z",
      approved: true,
    });

    expect(record.approved).toBe(false);
  });
});
