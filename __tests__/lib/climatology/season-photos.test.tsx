import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

import { SeasonPhotoFigure } from "@/components/best-time-to-surf/buoy-record/season-photo";
import { getSeasonPhotos } from "@/lib/climatology/season-photos";
import { parseApprovedRuntimePhotos } from "@/scripts/lib/beach-photo-candidates";

const ALLOWED_LICENSES = /^(Public domain|CC0 1\.0|CC BY \d\.\d|CC BY-SA \d\.\d)$/;
const MANIFEST_PATH = join(process.cwd(), "lib/data/surf-climatology/season-photos.json");

describe("season photo manifest", () => {
  it("is a valid approved-photo manifest for the downloader", () => {
    expect(() => parseApprovedRuntimePhotos(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")))).not.toThrow();
  });

  it.each(["cocoa-beach", "newport-beach"])("gives %s four photos in distinct slots with files on disk", (slug) => {
    const photos = getSeasonPhotos(slug);

    expect(photos).toHaveLength(4);
    expect(new Set(photos.map((photo) => photo.slot)).size).toBe(4);
    expect(photos.some((photo) => photo.slot === "hero")).toBe(true);
    for (const photo of photos) {
      expect(photo.licenseCode).toMatch(ALLOWED_LICENSES);
      expect(photo.src.startsWith(`/images/seasons/${slug}/`)).toBe(true);
      expect(existsSync(join(process.cwd(), "public", photo.src))).toBe(true);
    }
  });

  it("never captions a Newport photo as Blackies", () => {
    for (const photo of getSeasonPhotos("newport-beach")) {
      expect(`${photo.alt} ${photo.caption}`).not.toMatch(/blackies/i);
    }
  });

  it("has no photos for cities without season copy", () => {
    expect(getSeasonPhotos("honolulu")).toEqual([]);
  });
});

describe("SeasonPhotoFigure", () => {
  const [cocoaHero, , cocoaTypical] = getSeasonPhotos("cocoa-beach");

  it("credits a public-domain photo without a licence label", () => {
    const publicDomain = { ...cocoaHero, creator: "U.S. Air Force", licenseCode: "Public domain" };
    render(<SeasonPhotoFigure photo={publicDomain} />);

    expect(screen.getByRole("link", { name: "Photo: U.S. Air Force" })).toHaveAttribute("href", cocoaHero.sourceUrl);
    expect(screen.queryByText(/cropped/)).not.toBeInTheDocument();
  });

  it("uses a surf photo for the Cocoa Beach hero", () => {
    expect(cocoaHero.slot).toBe("hero");
    expect(cocoaHero.src).toBe("/images/seasons/cocoa-beach/surfer-after-sandy.webp");
  });

  it("names and links the licence of a Creative Commons photo and says it was cropped", () => {
    render(<SeasonPhotoFigure photo={cocoaTypical} />);

    expect(screen.getByRole("link", { name: "CC BY-SA 3.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/3.0/",
    );
    expect(screen.getByText(/cropped/)).toBeInTheDocument();
    expect(screen.getByAltText(cocoaTypical.alt)).toBeInTheDocument();
  });
});
