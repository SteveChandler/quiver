import {
  pickCityEditorialPhoto,
  type CityEditorialPhotoRow,
} from "@/lib/data/server/city-editorial-photo";

const row = (overrides: Partial<CityEditorialPhotoRow>): CityEditorialPhotoRow => ({
  beach_id: "b1",
  image_url: "https://upload.wikimedia.org/x.jpg",
  title: "x",
  creator_name: "someone",
  creator_url: null,
  license_code: "CC BY 2.0",
  license_url: null,
  source: "wikimedia",
  ...overrides,
});

describe("pickCityEditorialPhoto", () => {
  it("never picks a generated image or a Places photo, even when it is the top beach", () => {
    const picked = pickCityEditorialPhoto(
      [
        row({ beach_id: "houda", source: "ai_generated", license_code: null, image_url: "https://q/houda-v1.webp" }),
        row({ beach_id: "places", source: "google_places", image_url: "https://maps.googleapis.com/p" }),
        row({ beach_id: "tsb", license_code: "Public domain", image_url: "https://upload.wikimedia.org/tsb.jpg" }),
      ],
      ["houda", "places", "tsb"],
    );
    expect(picked?.beachId).toBe("tsb");
  });

  it("prefers the cleanest licence, then a JPEG over a PNG, then the page's own ranking", () => {
    const picked = pickCityEditorialPhoto(
      [
        row({ beach_id: "moonstone", license_code: "CC0", image_url: "https://upload.wikimedia.org/Moonstone_Beach.png" }),
        row({ beach_id: "tsb", license_code: "Public domain", image_url: "https://upload.wikimedia.org/Trinidad.jpg" }),
        row({ beach_id: "cove", license_code: "CC BY-SA 4.0", image_url: "https://upload.wikimedia.org/cove.jpg" }),
      ],
      ["moonstone", "houda", "tsb", "cove"],
    );
    expect(picked?.beachId).toBe("tsb");
  });

  it("falls back to ranking when licences tie", () => {
    const picked = pickCityEditorialPhoto(
      [row({ beach_id: "second" }), row({ beach_id: "first" })],
      ["first", "second"],
    );
    expect(picked?.beachId).toBe("first");
  });

  it("refuses non-commercial and no-derivative licences and returns null when nothing is usable", () => {
    expect(pickCityEditorialPhoto([row({ license_code: "CC BY-NC 2.0" })], ["b1"])).toBeNull();
    expect(pickCityEditorialPhoto([row({ license_code: "CC BY-ND 4.0" })], ["b1"])).toBeNull();
    expect(pickCityEditorialPhoto([], ["b1"])).toBeNull();
  });
});
