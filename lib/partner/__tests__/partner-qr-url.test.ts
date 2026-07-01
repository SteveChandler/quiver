import {
  buildPartnerAppSchemeUrl,
  buildPartnerQrUrl,
  isValidPartnerCode,
} from "@/lib/partner/partner-qr-url";

describe("isValidPartnerCode", () => {
  it("accepts 4-12 alphanumeric codes (case-insensitive)", () => {
    expect(isValidPartnerCode("SURF12")).toBe(true);
    expect(isValidPartnerCode("surf12")).toBe(true);
    expect(isValidPartnerCode("ABCD")).toBe(true);
    expect(isValidPartnerCode("A1B2C3D4E5F6")).toBe(true);
  });

  it("rejects codes with wildcard/special chars, empty, or too short/long", () => {
    expect(isValidPartnerCode("%_")).toBe(false);
    expect(isValidPartnerCode("")).toBe(false);
    expect(isValidPartnerCode("ab")).toBe(false);
    expect(isValidPartnerCode("SURF-12")).toBe(false);
    expect(isValidPartnerCode("A1B2C3D4E5F6G")).toBe(false);
    expect(isValidPartnerCode(" SURF12 ")).toBe(false);
  });
});

describe("buildPartnerQrUrl", () => {
  it("builds a deterministic absolute attributed URL, uppercasing the code", () => {
    expect(
      buildPartnerQrUrl({
        partnerCode: "surf12",
        siteUrl: "https://www.quiversurf.app",
      }),
    ).toBe(
      "https://www.quiversurf.app/p/SURF12?utm_source=partner_qr&utm_medium=partner_qr&utm_campaign=partner_access&utm_content=SURF12",
    );
  });

  it("trims a trailing slash on siteUrl", () => {
    expect(
      buildPartnerQrUrl({
        partnerCode: "SURF12",
        siteUrl: "https://www.quiversurf.app/",
      }),
    ).toBe(
      "https://www.quiversurf.app/p/SURF12?utm_source=partner_qr&utm_medium=partner_qr&utm_campaign=partner_access&utm_content=SURF12",
    );
  });
});

describe("buildPartnerAppSchemeUrl", () => {
  it("builds the quiver:// deep-link scheme, uppercasing the code", () => {
    expect(buildPartnerAppSchemeUrl("surf12")).toBe("quiver://p/SURF12");
  });
});
