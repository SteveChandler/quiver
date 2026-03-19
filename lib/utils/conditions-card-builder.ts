import type { ConditionsData } from "@/types/conditions";

export type ConditionsIconType = "waves" | "swell" | "wind" | "water" | "tide" | "frequency";

export interface ConditionsCard {
  id: string;
  label: string;
  value: string;
  iconType: ConditionsIconType;
  tideRising?: boolean;
  ariaLabel?: string;
}

export interface BuildConditionsCardsOptions {
  showFrequency?: boolean;
}

/**
 * Builds an array of conditions cards from ConditionsData.
 * Pure function — no React dependency, fully testable.
 */
export function buildConditionsCards(
  data: ConditionsData,
  options?: BuildConditionsCardsOptions
): ConditionsCard[] {
  const cards: ConditionsCard[] = [];

  if (data.waveHeight != null && data.waveHeight !== "") {
    cards.push({
      id: "waves",
      label: "Waves",
      value: data.waveHeight,
      iconType: "waves",
    });
  }

  if (data.wavePeriod != null && data.wavePeriod !== "") {
    const swellValue = data.waveDirection
      ? `${data.wavePeriod} ${data.waveDirection}`
      : data.wavePeriod;
    cards.push({
      id: "swell",
      label: "Swell",
      value: swellValue,
      iconType: "swell",
    });
  }

  if (data.windSpeed != null && data.windSpeed !== "") {
    const windValue = data.windDirection
      ? `${data.windSpeed} ${data.windDirection}`
      : data.windSpeed;
    cards.push({
      id: "wind",
      label: "Wind",
      value: windValue,
      iconType: "wind",
    });
  }

  if (data.waterTemp != null && data.waterTemp !== "") {
    cards.push({
      id: "water",
      label: "Water",
      value: data.waterTemp,
      iconType: "water",
    });
  }

  if (data.tideStatus != null && data.tideStatus !== "") {
    const isUnknown = data.tideStatus === "Unknown";

    // Skip tide card entirely when status is unknown and there's no height
    if (!isUnknown || data.tideHeight) {
      const tideValue = isUnknown
        ? data.tideHeight!
        : data.tideHeight
          ? `${data.tideStatus} ${data.tideHeight}`
          : data.tideStatus;

      const isRising =
        !isUnknown &&
        (data.tideStatus.toLowerCase().includes("rising") ||
          data.tideStatus.toLowerCase().includes("incoming") ||
          data.tideStatus.toLowerCase().includes("flood"));

      cards.push({
        id: "tide",
        label: "Tide",
        value: tideValue,
        iconType: "tide",
        tideRising: isRising,
      });
    }
  }

  if (
    options?.showFrequency &&
    data.rideableWavesPerHour != null &&
    data.rideableWavesPerHour > 0
  ) {
    cards.push({
      id: "frequency",
      label: "Waves/hr",
      value: `~${data.rideableWavesPerHour}`,
      iconType: "frequency",
      ariaLabel: `approximately ${data.rideableWavesPerHour} rideable waves per hour`,
    });
  } else if (
    options?.showFrequency &&
    data.rideableWavesPerHour === 0 &&
    data.waveHeight != null
  ) {
    cards.push({
      id: "frequency",
      label: "Waves/hr",
      value: "Flat",
      iconType: "frequency",
      ariaLabel: "flat, no rideable waves",
    });
  }

  return cards;
}
