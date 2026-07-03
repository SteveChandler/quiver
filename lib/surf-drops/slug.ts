import { randomBytes } from "node:crypto";

export const SURF_DROP_SLUG_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const SURF_DROP_SLUG_LENGTH = 10;

type RandomBytesSource = (size: number) => Uint8Array;

export function generateSurfDropSlug(
  randomSource: RandomBytesSource = randomBytes,
): string {
  const bytes = randomSource(SURF_DROP_SLUG_LENGTH);
  let slug = "";

  for (const byte of bytes) {
    slug += SURF_DROP_SLUG_ALPHABET[byte % SURF_DROP_SLUG_ALPHABET.length];
  }

  return slug;
}
