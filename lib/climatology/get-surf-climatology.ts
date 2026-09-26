import cocoaBeach from "@/lib/data/surf-climatology/cocoa-beach.json";
import honolulu from "@/lib/data/surf-climatology/honolulu.json";
import newportBeach from "@/lib/data/surf-climatology/newport-beach.json";
import type { SurfClimatologyDataset } from "./types";

// JSON imports widen tuples and literals, so check the parts the page relies on.
function asDataset(input: unknown, citySlug: string): SurfClimatologyDataset {
  const value = input as Partial<SurfClimatologyDataset>;
  if (
    value.schemaVersion !== 1 ||
    value.citySlug !== citySlug ||
    !Array.isArray(value.months) ||
    value.months.length !== 12 ||
    !Array.isArray(value.stations)
  ) {
    throw new Error(`Invalid surf climatology dataset for ${citySlug}`);
  }
  return value as SurfClimatologyDataset;
}

const DATASETS: Readonly<Record<string, SurfClimatologyDataset>> = {
  "cocoa-beach": asDataset(cocoaBeach, "cocoa-beach"),
  "newport-beach": asDataset(newportBeach, "newport-beach"),
  honolulu: asDataset(honolulu, "honolulu"),
};

export function getSurfClimatology(citySlug: string): SurfClimatologyDataset | null {
  return DATASETS[citySlug] ?? null;
}
