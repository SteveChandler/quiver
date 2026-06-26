import { createCustomSpotMarkerElement } from "@/components/map/custom-spot-marker-builder";
import { getConditionMarkerCall } from "@/components/map/map-marker-builder";
import type { CustomSpot } from "@/hooks/use-custom-spots";

const spot: CustomSpot = {
  id: "spot-1",
  name: "Public Peak",
  lat: 32.75,
  lon: -117.25,
  nearestBeachId: "beach-1",
  visibility: "public",
};

describe("createCustomSpotMarkerElement", () => {
  it("renders the slice-1 orange-ring fallback without forecast data", () => {
    const marker = createCustomSpotMarkerElement(spot);

    expect(marker).toHaveAttribute("data-testid", "custom-spot-marker");
    expect(marker).toHaveAttribute("data-custom-spot-id", "spot-1");
    expect(marker).toHaveAttribute("title", "Public Peak");
    expect(marker).not.toHaveAttribute("data-marker-gradient");
    expect(marker.textContent).toBe("");
    expect(marker.style.width).toBe("14px");
    expect(marker.style.height).toBe("14px");
    expect(marker.style.background).toBe("rgb(255, 255, 255)");
    expect(marker.style.borderWidth).toBe("2.5px");
    expect(marker.style.borderStyle).toBe("solid");
    expect(marker.style.borderColor).toBe("#f78e42");
    expect(marker.style.cursor).toBe("pointer");
  });

  it("renders borrowed forecast verdict color and wave label with the orange ring", () => {
    const marker = createCustomSpotMarkerElement(spot, {
      conditionSummary: "GOOD",
      conditionScore: 82,
      waveLabel: "3-4 ft",
    });
    const markerCall = getConditionMarkerCall({
      conditionSummary: "GOOD",
      conditionScore: 82,
    });

    expect(marker).toHaveAttribute("data-testid", "custom-spot-marker");
    expect(marker).toHaveAttribute("data-custom-spot-id", "spot-1");
    expect(marker).toHaveAttribute("data-condition-summary", "GOOD");
    expect(marker).toHaveAttribute("data-condition-score", "82");
    expect(marker).toHaveAttribute("data-marker-gradient", markerCall.gradient);
    expect(marker).toHaveAttribute("data-wave-label", "3-4 ft");
    expect(marker.textContent).toBe("3-4 ft");
    expect(marker.style.borderWidth).toBe("2.5px");
    expect(marker.style.borderStyle).toBe("solid");
    expect(marker.style.borderColor).toBe("#f78e42");
    expect(marker.style.color).toBe("rgb(255, 255, 255)");
    expect(marker.style.cursor).toBe("pointer");
  });
});
