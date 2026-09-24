export interface SessionShareDetail {
  label: string;
  value: string;
}

// Native builds send the logged wave height as a bare number ("3" or "3-4").
const BARE_WAVE_HEIGHT = /^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\+?$/;

export function formatShareWaveSize(size: string | null | undefined): string {
  const trimmed = size?.trim() ?? "";
  return BARE_WAVE_HEIGHT.test(trimmed) ? `${trimmed} ft` : trimmed;
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
