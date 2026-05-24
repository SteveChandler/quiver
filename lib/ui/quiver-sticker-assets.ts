export interface QuiverStickerAsset {
  slug: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

export const QUIVER_STICKER_ASSETS = {
  breakingWave: {
    slug: "breaking-wave",
    src: "/images/quiver-stickers/breaking-wave.png",
    alt: "Breaking wave sticker",
    width: 428,
    height: 258,
  },
  singleFin: {
    slug: "single-fin",
    src: "/images/quiver-stickers/single-fin.png",
    alt: "Single fin sticker",
    width: 287,
    height: 267,
  },
  surfWax: {
    slug: "surf-wax",
    src: "/images/quiver-stickers/surf-wax.png",
    alt: "Surf wax sticker",
    width: 189,
    height: 146,
  },
  orangeMap: {
    slug: "orange-map",
    src: "/images/quiver-stickers/orange-map.png",
    alt: "Orange map sticker",
    width: 128,
    height: 197,
  },
  orangeRightArrow: {
    slug: "orange-right-arrow",
    src: "/images/quiver-stickers/orange-right-arrow.png",
    alt: "Orange arrow sticker",
    width: 284,
    height: 127,
  },
  goldRightArrow: {
    slug: "gold-right-arrow",
    src: "/images/quiver-stickers/gold-right-arrow.png",
    alt: "Gold arrow sticker",
    width: 248,
    height: 90,
  },
  goldDownArrow: {
    slug: "gold-down-arrow",
    src: "/images/quiver-stickers/gold-down-arrow.png",
    alt: "Gold down arrow sticker",
    width: 99,
    height: 170,
  },
  spotSwellMatch: {
    slug: "spot-swell-match",
    src: "/images/quiver-stickers/spot-swell-match.png",
    alt: "Swell match icon",
    width: 256,
    height: 256,
  },
  spotWindRead: {
    slug: "spot-wind-read",
    src: "/images/quiver-stickers/spot-wind-read.png",
    alt: "Wind read icon",
    width: 256,
    height: 256,
  },
  spotTideWindow: {
    slug: "spot-tide-window",
    src: "/images/quiver-stickers/spot-tide-window.png",
    alt: "Tide window icon",
    width: 256,
    height: 256,
  },
  spotWaterTemp: {
    slug: "spot-water-temp",
    src: "/images/quiver-stickers/spot-water-temp.png",
    alt: "Water temperature icon",
    width: 256,
    height: 256,
  },
  spotBestSeason: {
    slug: "spot-best-season",
    src: "/images/quiver-stickers/spot-best-season.png",
    alt: "Best season icon",
    width: 256,
    height: 256,
  },
  spotLocation: {
    slug: "spot-location",
    src: "/images/quiver-stickers/spot-location.png",
    alt: "Location icon",
    width: 256,
    height: 256,
  },
  creamTape: {
    slug: "cream-tape",
    src: "/images/quiver-stickers/cream-tape.png",
    alt: "Cream tape sticker",
    width: 395,
    height: 103,
  },
  navyTape: {
    slug: "navy-tape",
    src: "/images/quiver-stickers/navy-tape.png",
    alt: "Navy tape sticker",
    width: 383,
    height: 98,
  },
  orangeTape: {
    slug: "orange-tape",
    src: "/images/quiver-stickers/orange-tape.png",
    alt: "Orange tape sticker",
    width: 388,
    height: 81,
  },
  creamCoastMap: {
    slug: "cream-coast-map",
    src: "/images/quiver-stickers/cream-coast-map.png",
    alt: "Coast map sticker",
    width: 304,
    height: 215,
  },
} as const satisfies Record<string, QuiverStickerAsset>;

export type QuiverStickerKey = keyof typeof QUIVER_STICKER_ASSETS;

export function getQuiverStickerAsset(
  sticker: QuiverStickerKey
): QuiverStickerAsset {
  return QUIVER_STICKER_ASSETS[sticker];
}
