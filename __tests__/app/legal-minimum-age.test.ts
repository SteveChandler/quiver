import { PRIVACY_CONTENT, TERMS_CONTENT } from "@/lib/constants/content";

describe("minimum age in the legal pages", () => {
  it("gives 16 as the minimum age in the Terms and the Privacy Policy", () => {
    const terms = JSON.stringify(TERMS_CONTENT);
    const privacy = JSON.stringify(PRIVACY_CONTENT);

    expect(terms).toMatch(/at least 16 years old/);
    expect(privacy).toMatch(/under the age of 16/);
  });

  it("gives no other minimum age", () => {
    const legal = JSON.stringify([TERMS_CONTENT, PRIVACY_CONTENT]);

    expect(legal).not.toMatch(/at least 1[^6] years old/);
    expect(legal).not.toMatch(/under the age of 1[^6]\b/);
  });
});
