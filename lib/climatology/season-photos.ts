import manifest from "@/lib/data/surf-climatology/season-photos.json";

export type SeasonPhotoSlot =
  | "hero"
  | "big-swell"
  | "typical-day"
  | "south-swell"
  | "comparison-north"
  | "comparison-south"
  | "buoy-limits";

const SLOTS: readonly SeasonPhotoSlot[] = [
  "hero",
  "big-swell",
  "typical-day",
  "south-swell",
  "comparison-north",
  "comparison-south",
  "buoy-limits",
];

export interface SeasonPhoto {
  citySlug: string;
  slot: SeasonPhotoSlot;
  src: string;
  alt: string;
  caption: string;
  creator: string;
  licenseCode: string;
  licenseUrl: string;
  sourceUrl: string;
}

function toSeasonPhoto(entry: (typeof manifest)[number]): SeasonPhoto {
  const slot = SLOTS.find((candidate) => candidate === entry.slot);
  if (!slot) throw new Error(`Unknown season photo slot ${entry.slot}`);
  return {
    citySlug: entry.citySlug,
    slot,
    // The manifest stores the repo path the downloader writes to.
    src: entry.runtimeAssetPath.replace(/^public/, ""),
    alt: entry.alt,
    caption: entry.caption,
    creator: entry.creator,
    licenseCode: entry.licenseCode,
    licenseUrl: entry.licenseUrl,
    sourceUrl: entry.sourceUrl,
  };
}

const PHOTOS: readonly SeasonPhoto[] = manifest.map(toSeasonPhoto);

export function getSeasonPhotos(citySlug: string): SeasonPhoto[] {
  return PHOTOS.filter((photo) => photo.citySlug === citySlug);
}
