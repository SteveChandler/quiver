/**
 * @jest-environment node
 */

import {
  buildStationDescription,
  buildStationTitle,
  CC_BY_4,
  licenseLabel,
  licenseRequiresChangeNote,
  licenseUrl,
  stationCode,
} from "@/lib/seo/buoy-meta";
import { sourceStationUrl } from "@/lib/services/wave-stations/source-links";

describe("licence rendering for non-US sources", () => {
  it("links CC BY 4.0 and asks for a change note; US public domain needs none", () => {
    expect(licenseUrl(CC_BY_4)).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(licenseLabel(CC_BY_4)).toBe("CC BY 4.0");
    expect(licenseRequiresChangeNote(CC_BY_4)).toBe(true);
    expect(licenseRequiresChangeNote("public-domain-us-gov")).toBe(false);
  });
});

describe("station codes in titles", () => {
  it("shows a real code, hides a name-derived id, and does not repeat a code the name has", () => {
    expect(stationCode({ source_station_id: "46225" })).toBe("46225");
    expect(stationCode({ source_station_id: "wooli" })).toBeNull();
    expect(buildStationTitle({ name: "Torrey Pines, CA", source_station_id: "46225" })).toBe(
      "Torrey Pines, CA Buoy 46225: Live Swell & Waves",
    );
    expect(buildStationTitle({ name: "Wooli", source_station_id: "wooli" })).toBe("Wooli Buoy: Live Swell & Waves");
    expect(buildStationTitle({ name: "M6 West Coast", source_station_id: "M6" })).toBe("M6 West Coast Buoy: Live Swell & Waves");
    expect(buildStationDescription({ name: "Wooli", source_station_id: "wooli", has_swell_split: false })).not.toMatch(/WOOLI/);
  });
});

describe("sourceStationUrl", () => {
  it("links NDBC station pages and the provider dataset pages", () => {
    expect(sourceStationUrl({ source: "ndbc", source_station_id: "46225" })).toBe(
      "https://www.ndbc.noaa.gov/station_page.php?station=46225",
    );
    expect(sourceStationUrl({ source: "marine_ie", source_station_id: "M6" })).toMatch(/^https:\/\/erddap\.marine\.ie\//);
  });
});
