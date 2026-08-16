import type { Beach } from "@/types/database";

interface CoordinateCorrection {
  lat: number;
  lon: number;
}

const LA_JOLLA_SHORES: CoordinateCorrection = { lat: 32.8567, lon: -117.2575 };
const TOURMALINE: CoordinateCorrection = { lat: 32.805149, lon: -117.262364 };
const BIRDROCK: CoordinateCorrection = { lat: 32.815031, lon: -117.273505 };

const CORRECTIONS: Readonly<Record<string, CoordinateCorrection>> = {
  lajollashores: LA_JOLLA_SHORES,
  d291411dd3314bf1ad1a302da3c69de0: LA_JOLLA_SHORES,
  tourmaline: TOURMALINE,
  tourmalinebeach: TOURMALINE,
  tourmalinesurfpark: TOURMALINE,
  "17628f359ed14257aad6070c4bd73bb8": TOURMALINE,
  birdrock: BIRDROCK,
  ca2b1d6f24284273ab027555eeec4323: BIRDROCK,
};

function correctionKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

export function applyBeachCoordinateCorrection<T extends Pick<Beach, "id" | "name" | "slug" | "lat" | "lon">>(
  beach: T,
): T {
  const keys = [beach.slug, beach.name, beach.id]
    .map(correctionKey)
    .filter(Boolean);
  const correction = keys
    .map((key) => CORRECTIONS[key])
    .find((candidate): candidate is CoordinateCorrection => Boolean(candidate));
  if (!correction) return beach;

  return {
    ...beach,
    lat: correction.lat,
    lon: correction.lon,
  };
}
