import {
  isPublicDomainLicense,
  requiresLicenseNotice,
  stripPublicDomainNotice,
} from "@/lib/photos/license-notice";

describe("licence notices on photo credits", () => {
  it("recognises the public-domain family and keeps CC BY as requiring a notice", () => {
    for (const code of ["Public domain", "CC0", "CC0 1.0", "PDM 1.0", "public-domain"]) {
      expect(isPublicDomainLicense(code)).toBe(true);
      expect(requiresLicenseNotice(code)).toBe(false);
    }
    for (const code of ["CC BY 2.0", "BY-SA 4.0", "CC BY-SA 3.0", "BY 2.5"]) {
      expect(isPublicDomainLicense(code)).toBe(false);
      expect(requiresLicenseNotice(code)).toBe(true);
    }
    expect(requiresLicenseNotice(null)).toBe(false);
    expect(requiresLicenseNotice("openai-generated")).toBe(false);
  });

  it.each([
    ["Public-domain image by TrinidadMike via Wikimedia Commons.", "Image by TrinidadMike via Wikimedia Commons."],
    [
      "Image by NP2026, dedicated to the public domain under CC0 via Wikimedia Commons.",
      "Image by NP2026 via Wikimedia Commons.",
    ],
    ['"Marshall Beach Sunset" by romainguy · CC0 via Openverse', '"Marshall Beach Sunset" by romainguy via Openverse'],
    ['"Some Pier" by someone · PDM 1.0 via Openverse', '"Some Pier" by someone via Openverse'],
    ["DXR / CC0 1.0", "DXR"],
    ["Photo by Jane (Public domain)", "Photo by Jane"],
  ])("strips public-domain wording: %s", (input, expected) => {
    expect(stripPublicDomainNotice(input)).toBe(expected);
  });

  it.each([
    "Image by Clyde Charles Brown, licensed CC BY-SA 4.0 via Wikimedia Commons.",
    '"Surfing Santa Cruz" by Richard Masoner · CC BY-SA 2.0 via Openverse',
    "dpstyles™ / CC BY 2.0",
    "Photo by Daniel Casey",
  ])("leaves CC BY credits and plain credits untouched: %s", (input) => {
    expect(stripPublicDomainNotice(input)).toBe(input);
  });
});
