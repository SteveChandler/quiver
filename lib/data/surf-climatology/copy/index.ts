import type { SeasonCopy } from "@/lib/climatology/season-copy";
import { COCOA_BEACH_SEASON_COPY } from "./cocoa-beach";
import { NEWPORT_BEACH_SEASON_COPY } from "./newport-beach";

const SEASON_COPY: Readonly<Record<string, SeasonCopy>> = {
  "cocoa-beach": COCOA_BEACH_SEASON_COPY,
  "newport-beach": NEWPORT_BEACH_SEASON_COPY,
};

export function getSeasonCopy(citySlug: string): SeasonCopy | null {
  return SEASON_COPY[citySlug] ?? null;
}
