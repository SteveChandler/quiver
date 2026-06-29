import { getConditionMarkerCall } from "@/components/map/map-marker-builder";
import type { ConditionSummary } from "@/components/map/map-beach-loader";
import type { CustomSpot } from "@/hooks/use-custom-spots";

const CUSTOM_SPOT_RING_COLOR = "#F78E42";

export interface CustomSpotMarkerData {
  conditionSummary?: ConditionSummary;
  conditionScore?: number;
  waveLabel?: string | null;
}

function hasUsableVerdict(data?: CustomSpotMarkerData): boolean {
  if (!data) return false;
  if (data.conditionSummary) return true;
  return (
    typeof data.conditionScore === "number" &&
    Number.isFinite(data.conditionScore)
  );
}

export function createCustomSpotMarkerElement(
  spot: CustomSpot,
  data?: CustomSpotMarkerData
): HTMLElement {
  const element = document.createElement("div");
  element.setAttribute("data-testid", "custom-spot-marker");
  element.setAttribute("data-custom-spot-id", spot.id);
  element.setAttribute("title", spot.name);

  if (!hasUsableVerdict(data)) {
    element.style.cssText = `
      pointer-events: auto;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #FFFFFF;
      border: 2.5px solid ${CUSTOM_SPOT_RING_COLOR};
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.28);
      cursor: pointer;
    `;
    return element;
  }

  const conditionCall = getConditionMarkerCall({
    conditionSummary: data?.conditionSummary,
    conditionScore: data?.conditionScore,
  });
  const waveLabel = data?.waveLabel?.trim() || null;

  element.setAttribute("data-condition-summary", conditionCall.summary);
  element.setAttribute("data-marker-gradient", conditionCall.gradient);
  if (typeof data?.conditionScore === "number") {
    element.setAttribute("data-condition-score", String(data.conditionScore));
  }
  if (waveLabel) {
    element.setAttribute("data-wave-label", waveLabel);
    element.textContent = waveLabel;
  }

  element.style.cssText = `
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: ${waveLabel ? "30px" : "14px"};
    width: ${waveLabel ? "auto" : "14px"};
    height: ${waveLabel ? "18px" : "14px"};
    padding: ${waveLabel ? "0 6px" : "0"};
    border-radius: 9999px;
    background: ${conditionCall.gradient};
    border: 2.5px solid ${CUSTOM_SPOT_RING_COLOR};
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.32);
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
    cursor: pointer;
  `;

  return element;
}
