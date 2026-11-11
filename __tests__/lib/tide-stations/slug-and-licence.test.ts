import { countrySlug, US_COUNTRY_SLUG } from "@/lib/tide-stations/geography";
import { classifyTiconLicence, geslaProvider, TICON_CITATION } from "@/lib/tide-stations/licence";
import {
  buildTideStationSlug,
  normalizeStationName,
  ticonContributorSuffix,
  ticonDisplayName,
  tideStationId,
  tideStationPath,
} from "@/lib/tide-stations/slug";

describe("tide station slugs", () => {
  it("joins readable name, place code and NOAA id", () => {
    expect(
      buildTideStationSlug({ source: "noaa", name: "La Jolla (Scripps Pier)", sourceStationId: "9410230", placeCode: "CA" })
    ).toBe("la-jolla-scripps-pier-ca-9410230");
  });

  it("keeps NOAA alphanumeric ids and strips accents", () => {
    expect(
      buildTideStationSlug({ source: "noaa", name: "Bahía de Jiquilisco", sourceStationId: "TWC0359", placeCode: "SV" })
    ).toBe("bahia-de-jiquilisco-sv-twc0359");
  });

  it("uses the TICON gauge name, which already carries site, code, country and contributor", () => {
    expect(
      buildTideStationSlug({ source: "ticon", name: "x", sourceStationId: "aberdeen-abe-gbr-bodc", placeCode: "GB" })
    ).toBe("aberdeen-abe-gbr-bodc");
    expect(buildTideStationSlug({ source: "ticon", name: "x", sourceStationId: "abashiri-347-jpn-uhslc_fd", placeCode: "JP" })).toBe(
      "abashiri-347-jpn-uhslc-fd"
    );
  });

  it("derives display names and contributor suffixes from TICON gauge names", () => {
    expect(ticonDisplayName("port_of_spain-pos-tto-uhslc")).toBe("Port Of Spain");
    expect(ticonDisplayName("a121tg-a12-nld-cmems")).toBe("A121tg");
    expect(ticonContributorSuffix("abashiri-347-jpn-uhslc_fd")).toBe("uhslc_fd");
  });

  it("lowers shouted NOAA names but keeps short codes", () => {
    expect(normalizeStationName("SAN DIEGO (Broadway)")).toBe("San Diego (Broadway)");
    expect(normalizeStationName("SAND ISLAND, MIDWAY  ISLANDS")).toBe("Sand Island, Midway Islands");
    expect(normalizeStationName("Ocean City, MD")).toBe("Ocean City, MD");
  });

  it("builds ids and paths", () => {
    expect(tideStationId("noaa", "9410230")).toBe("noaa:9410230");
    expect(tideStationPath("la-jolla-ca-9410230")).toBe("/tides/station/la-jolla-ca-9410230");
  });

  it("never produces a country slug that collides with the static station segment", () => {
    expect(countrySlug("US")).toBe(US_COUNTRY_SLUG);
    expect(countrySlug("JP")).toBe("japan");
    expect(countrySlug("GB")).toBe("united-kingdom");
    const codes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (const a of codes) for (const b of codes) expect(countrySlug(a + b)).not.toBe("station");
  });
});

describe("TICON licence filter", () => {
  it("parses the provider from gesla_source", () => {
    expect(geslaProvider("gesla4.CMEMS")).toBe("CMEMS");
    expect(geslaProvider("gesla4.JODC_JMA")).toBe("JODC_JMA");
  });

  it.each(["gesla4.CMEMS", "gesla4.UZ", "gesla4.CV"])("excludes research-only provider %s", (source) => {
    expect(classifyTiconLicence(source)).toEqual(expect.objectContaining({ included: false, reason: "research-only" }));
  });

  it("treats a research-only provider's delivery streams as research-only", () => {
    expect(classifyTiconLicence("gesla4.CMEMS_NRT")).toEqual(expect.objectContaining({ included: false, reason: "research-only" }));
  });

  it("maps GESLA-4 delivery streams onto their listed provider", () => {
    expect(classifyTiconLicence("gesla4.UHSLC_RQ")).toEqual(
      expect.objectContaining({ included: true, providerName: "University of Hawaii Sea Level Center" })
    );
  });

  it("excludes providers missing from the verified GESLA table", () => {
    expect(classifyTiconLicence("gesla4.SOMETHING_NEW")).toEqual({
      included: false,
      provider: "SOMETHING_NEW",
      reason: "unverified-provider",
    });
  });

  it("includes commercial providers with CC BY 4.0 attribution naming TICON-4 and the provider", () => {
    const decision = classifyTiconLicence("gesla4.BODC");
    expect(decision.included).toBe(true);
    if (!decision.included) return;
    expect(decision.licence).toBe("cc-by-4.0");
    expect(decision.licenceUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(decision.attribution).toContain(TICON_CITATION);
    expect(decision.attribution).toContain("British Oceanographic Data Centre");
    expect(decision.attribution).toContain("Quiver computes the predictions");
  });
});
