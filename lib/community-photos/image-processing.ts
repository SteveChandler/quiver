import sharp, { type Metadata } from "sharp";

import { COMMUNITY_PHOTO_MAX_INPUT_BYTES } from "./upload-constraints";

export { COMMUNITY_PHOTO_MAX_INPUT_BYTES } from "./upload-constraints";

export const COMMUNITY_PHOTO_MAX_PIXELS = 20_000_000;
export const COMMUNITY_PHOTO_MAX_OUTPUT_WIDTH = 2400;

export interface ProcessedCommunityPhoto {
  bytes: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
}

export async function processCommunityPhoto(
  input: Buffer,
): Promise<ProcessedCommunityPhoto> {
  if (input.byteLength > COMMUNITY_PHOTO_MAX_INPUT_BYTES) {
    throw new Error("image_too_large");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: COMMUNITY_PHOTO_MAX_PIXELS,
    }).metadata();
  } catch (error) {
    if (
      error instanceof Error &&
      /pixel limit|input image exceeds pixel limit/i.test(error.message)
    ) {
      throw new Error("image_pixel_limit_exceeded");
    }
    throw new Error("invalid_image");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("invalid_image");
  }
  if (metadata.width * metadata.height > COMMUNITY_PHOTO_MAX_PIXELS) {
    throw new Error("image_pixel_limit_exceeded");
  }

  try {
    const { data, info } = await sharp(input, {
      failOn: "warning",
      limitInputPixels: COMMUNITY_PHOTO_MAX_PIXELS,
    })
      .rotate()
      .resize({
        width: COMMUNITY_PHOTO_MAX_OUTPUT_WIDTH,
        height: COMMUNITY_PHOTO_MAX_OUTPUT_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return {
      bytes: data,
      contentType: "image/webp",
      width: info.width,
      height: info.height,
    };
  } catch {
    throw new Error("invalid_image");
  }
}
