interface SessionShareDetail {
  label: string;
  value: string;
}

// Both apps log wave height in feet and send it as a bare number ("3" or "3-4").
const BARE_WAVE_HEIGHT = /^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\+?$/;
const FEET_WAVE_HEIGHT = /^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\+?\s*ft$/i;

/** Feet only: any other text ("3-4m", "Chest-Head") is not a height the app logged. */
export function formatShareWaveSize(size: string | null | undefined): string {
  const trimmed = size?.trim() ?? "";
  if (BARE_WAVE_HEIGHT.test(trimmed)) return `${trimmed} ft`;
  return FEET_WAVE_HEIGHT.test(trimmed) ? trimmed : "";
}

/** Only details the surfer actually logged; an empty field is left off, never filled with a placeholder. */
export function buildSessionShareDetails({
  size,
  board,
  windSpeed,
  windLabel,
}: {
  size?: string | null;
  board?: string | null;
  windSpeed?: string | null;
  windLabel?: string | null;
}): SessionShareDetail[] {
  const details: SessionShareDetail[] = [
    { label: "Waves", value: formatShareWaveSize(size) },
    { label: "Board", value: board?.trim() ?? "" },
    { label: "Wind", value: [windSpeed?.trim(), windLabel?.trim()].filter(Boolean).join(" ") },
  ];
  return details.filter((detail) => detail.value.length > 0);
}
