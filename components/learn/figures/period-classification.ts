export interface PeriodClassification {
  classification: "wind" | "ground";
  label: "WIND SWELL" | "GROUNDSWELL";
  distance: string;
  quality: string;
  why: string;
  /** period clamped to [4,20], normalized to [0,1] for visual interpolation */
  t: number;
}

export function classifyPeriod(period: number): PeriodClassification {
  const p = Math.max(4, Math.min(20, period));
  const t = (p - 4) / 16;
  const classification: "wind" | "ground" = p >= 10 ? "ground" : "wind";

  let distance: string, quality: string, why: string;
  if (p < 7) {
    distance = "~50–100 mi"; quality = "Choppy & weak"; why = "Short-lived, hard to ride";
  } else if (p < 10) {
    distance = "~200–500 mi"; quality = "Mixed, improving"; why = "Some organization";
  } else if (p < 14) {
    distance = "~500–1,500 mi"; quality = "Clean & organized"; why = "Even sets, real push";
  } else {
    distance = "~1,500–3,000 mi"; quality = "Powerful & lined-up"; why = "The good stuff";
  }

  return {
    classification,
    label: classification === "ground" ? "GROUNDSWELL" : "WIND SWELL",
    distance, quality, why, t,
  };
}
