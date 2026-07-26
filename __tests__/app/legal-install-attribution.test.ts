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

  it("discloses the private Android tester roster purpose, safeguards, evidence limits, retention, and deletion", () => {
    const privacy = JSON.stringify(PRIVACY_CONTENT);
    const terms = JSON.stringify(TERMS_CONTENT);

    expect(privacy).toMatch(/private android tester roster/i);
    expect(privacy).toMatch(/aes-256-gcm/i);
    expect(privacy).toMatch(/no reversible.*hash/i);
    expect(privacy).toMatch(/linked.*immediately delete.*email.*member id/i);
    expect(privacy).toMatch(/leaves.*exactly 30 days/i);
    expect(privacy).toMatch(/eligibility.*play opt-in.*install.*first open.*account join/i);
    expect(privacy).toMatch(/independent.*never infer/i);
    expect(privacy).toMatch(/play opt-in.*manual evidence/i);
    expect(privacy).toMatch(/account deletion.*removes.*roster/i);
    expect(privacy).toMatch(/aggregate.*without personal information/i);

    expect(terms).toMatch(/direct user membership.*google group.*eligibility/i);
    expect(terms).toMatch(/google play opt-in.*separate/i);
  });
});
