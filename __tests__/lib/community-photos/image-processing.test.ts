import sharp from "sharp";
import {
  processCommunityPhoto,
  COMMUNITY_PHOTO_MAX_OUTPUT_WIDTH,
} from "@/lib/community-photos/image-processing";

describe("community photo image processing", () => {
  it("rotates, bounds dimensions, converts to WebP, and removes EXIF/GPS metadata", async () => {
    const source = await sharp({
      create: {
        width: 3000,
        height: 1000,
        channels: 3,
        background: "#00aabb",
      },
    })
      .withMetadata({
        exif: {
          IFD0: { Artist: "private-surfer" },
          GPSIFD: {
            GPSLatitudeRef: "N",
            GPSLatitude: "32/1 42/1 0/1",
          },
        } as never,
      })
      .jpeg()
      .toBuffer();

    const result = await processCommunityPhoto(source);
    const metadata = await sharp(result.bytes).metadata();

    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(COMMUNITY_PHOTO_MAX_OUTPUT_WIDTH);
    expect(result.height).toBeLessThanOrEqual(COMMUNITY_PHOTO_MAX_OUTPUT_WIDTH);
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects undecodable and pixel-bomb input", async () => {
    await expect(
      processCommunityPhoto(Buffer.from("not an image")),
    ).rejects.toThrow("invalid_image");

    const hugeHeader = await sharp({
      create: {
        width: 5000,
        height: 5000,
        channels: 3,
        background: "#000000",
      },
    })
      .png()
      .toBuffer();
    await expect(processCommunityPhoto(hugeHeader)).rejects.toThrow(
      "image_pixel_limit_exceeded",
    );
  });
});
