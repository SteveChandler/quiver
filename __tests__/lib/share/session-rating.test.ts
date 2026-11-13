import {
  SESSION_RATING_SCALE,
  sessionRatingLabel,
  sessionRatingStars,
} from "@/lib/share/session-rating";

// Same case table as quiver-native `src/__tests__/share/build-share-card-url.test.ts`
// (`getRatingLabel`); the two apps must name a session rating the same way.
describe("session rating words", () => {
  it.each([
    [1, "Rough"],
    [2, "Meh"],
    [3, "Fun"],
    [4, "Great"],
    [5, "Epic"],
  ])("names %i stars %s", (stars, word) => {
    expect(sessionRatingLabel(stars)).toBe(word);
  });

  it("gives the rating pickers the same words in star order", () => {
    expect(SESSION_RATING_SCALE).toEqual([
      "Rough",
      "Meh",
      "Fun",
      "Great",
      "Epic",
    ]);
  });

  it("has no word and no stars for a missing or out-of-range rating", () => {
    expect(sessionRatingLabel(0)).toBe("");
    expect(sessionRatingLabel(6)).toBe("");
    expect([null, undefined, "", 0, 6, "x"].map(sessionRatingStars)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
