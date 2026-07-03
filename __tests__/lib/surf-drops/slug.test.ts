import {
  SURF_DROP_SLUG_ALPHABET,
  generateSurfDropSlug,
} from "@/lib/surf-drops/slug";

describe("generateSurfDropSlug", () => {
  it("generates a 10-character slug using the unambiguous Surf Drop alphabet", () => {
    const slug = generateSurfDropSlug(() =>
      Uint8Array.from([0, 1, 2, 3, 4, 5, 30, 31, 32, 255]),
    );

    expect(slug).toHaveLength(10);
    expect(slug).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/);
  });

  it("excludes ambiguous characters from the alphabet", () => {
    expect(SURF_DROP_SLUG_ALPHABET).not.toMatch(/[01IO]/);
  });
});
