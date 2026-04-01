import { circularAngleDiff } from "@/lib/services/magic-hour/direction-utils";

export interface WindQualityLabel {
  label: "offshore" | "cross-offshore" | "cross-shore" | "onshore";
  color: "green" | "yellow" | "red";
  verdict: string;
}

export function classifyWindQuality(
  windDir: number,
  offshoreDeg: number,
  toleranceDeg: number
): WindQualityLabel {
  const diff = circularAngleDiff(windDir, offshoreDeg);

  if (diff <= toleranceDeg) {
    return {
      label: "offshore",
      color: "green",
      verdict: `Offshore winds — blowing from land to sea, keeping the wave face clean`,
    };
  }
  if (diff <= toleranceDeg * 1.5) {
    return {
      label: "cross-offshore",
      color: "yellow",
      verdict: `Cross-offshore — mostly offshore with a slight angle`,
    };
  }
  if (diff <= 90) {
    return {
      label: "cross-shore",
      color: "yellow",
      verdict: `Cross-shore — wind is coming from the side, expect some chop`,
    };
  }
  return {
    label: "onshore",
    color: "red",
    verdict: `Onshore — blowing from sea to land, creating choppy conditions`,
  };
}
