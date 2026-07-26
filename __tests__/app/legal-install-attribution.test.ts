import { PRIVACY_CONTENT, TERMS_CONTENT } from "@/lib/constants/content";

describe("install attribution legal disclosure", () => {
  it("discloses the PII-free, single-use Play install attribution lifecycle", () => {
    const privacy = JSON.stringify(PRIVACY_CONTENT);
    const terms = JSON.stringify(TERMS_CONTENT);

    expect(privacy).toMatch(/opaque.*install attribution token/i);
    expect(privacy).toMatch(/single-use.*30 days/i);
    expect(privacy).toMatch(/does not contain.*email.*user id.*location/i);
    expect(terms).toMatch(/google play.*install attribution/i);
    expect(terms).toMatch(/opaque.*single-use/i);
  });
});
