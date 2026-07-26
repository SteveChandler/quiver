import { PRIVACY_CONTENT, TERMS_CONTENT } from "@/lib/constants/content";

describe("community spot-photo legal disclosure", () => {
  it("discloses the contributor license, rights confirmation, and moderation rules", () => {
    const terms = JSON.stringify(TERMS_CONTENT);

    expect(terms).toMatch(/confirm.*rights.*photo/i);
    expect(terms).toMatch(/worldwide.*non-exclusive.*royalty-free.*license/i);
    expect(terms).toMatch(/immediately.*published/i);
    expect(terms).toMatch(/vote.*report.*moderation/i);
    expect(terms).toMatch(/remove.*30 days.*recover/i);
    expect(terms).toMatch(/investigation.*hold/i);
  });

  it("discloses photo processing, visibility, attribution, ranking, and retention", () => {
    const privacy = JSON.stringify(PRIVACY_CONTENT);

    expect(privacy).toMatch(/strip.*exif.*gps/i);
    expect(privacy).toMatch(/current.*safe display name.*dynamically/i);
    expect(privacy).toMatch(/no safe.*name.*non-linked.*Quiver community/i);
    expect(privacy).not.toMatch(/snapshot of your display name/i);
    expect(privacy).toMatch(/private custom spot.*owner/i);
    expect(privacy).toMatch(/upvote.*downvote.*report/i);
    expect(privacy).toMatch(/confidence-adjusted.*no recency/i);
    expect(privacy).toMatch(/administrator.*pin/i);
    expect(privacy).toMatch(/30-day.*recovery.*investigation hold/i);
  });
});
