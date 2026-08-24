import type { Beach } from "@/types/database";
import { loadBeachesAndWaveHeights } from "@/components/map/map-beach-loader";
import {
  createWaveHeightBadge,
  getConditionMarkerCall,
  getConditionMarkerGradient,
  getWaterTempBadgeColor,
} from "@/components/map/map-marker-builder";

const beach = (id: string): Beach =>
  ({
    id,
    name: `Beach ${id}`,
    lat: 32.75,
    lon: -117.25,
    region: "San Diego",
  }) as Beach;

function getBadge(marker: HTMLElement): HTMLElement {
  const badge = marker.querySelector("[data-marker-badge='true']");
  if (!(badge instanceof HTMLElement)) {
    throw new Error("Marker badge was not rendered");
  }
  return badge;
}

function getMarkerVisual(marker: HTMLElement): HTMLElement {
  const visual = marker.querySelector("[data-marker-visual='true']");
  if (!(visual instanceof HTMLElement)) {
    throw new Error("Marker visual was not rendered");
  }
  return visual;
}

describe("map condition summaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          forecasts: {
            "beach-good": 3.2,
          },
          waterTemps: {
            "beach-good": "66",
          },
          conditionScores: {
            "beach-good": 74,
          },
          conditionSummaries: {
            "beach-good": "GOOD",
            "beach-unknown": "UNKNOWN",
          },
        },
      }),
    }) as Response) as unknown as typeof fetch;
  });

  it("parses bulk condition score and summary maps in the beach loader", async () => {
    const result = await loadBeachesAndWaveHeights(
      32.75,
      -117.25,
      [beach("beach-good"), beach("beach-unknown")],
      { fetchNearbyBeaches: jest.fn() }
    );

    expect(result.waveHeightMap.get("beach-good")).toBe(3.2);
    expect(result.waterTempMap.get("beach-good")).toBe("66");
    expect(result.conditionScoreMap.get("beach-good")).toBe(74);
    expect(result.conditionSummaryMap.get("beach-good")).toBe("GOOD");
    expect(result.conditionSummaryMap.get("beach-unknown")).toBe("UNKNOWN");
  });

  it("retains the nearby water-quality hold flag for marker construction", async () => {
    const heldBeach = {
      ...beach("held-beach"),
      waterQualityHold: true,
    };
    const result = await loadBeachesAndWaveHeights(
      32.75,
      -117.25,
      undefined,
      {
        fetchNearbyBeaches: jest.fn(async () => ({ data: [heldBeach] })),
      },
    );

    expect(result.locations).toEqual([heldBeach]);
  });

  it("renders wave-height markers with condition semantics and gradients", () => {
    const marker = createWaveHeightBadge(beach("beach-fair"), 2.0, {
      favoriteBeachIds: new Set(),
      selectedBeachId: null,
      hoveredBeachId: null,
      onHoverChange: jest.fn(),
      onSelectChange: jest.fn(),
      router: { push: jest.fn() },
      autoNavigate: false,
      displayMode: "wave-height",
      conditionSummary: "FAIR",
    });
    const badge = getBadge(marker);
    const visual = getMarkerVisual(marker);
    const markerGradient = getConditionMarkerGradient("FAIR");

    expect(badge).toBeInstanceOf(HTMLButtonElement);
    expect(badge).toHaveAttribute("type", "button");
    expect(badge).toHaveAttribute(
      "aria-label",
      "View Beach beach-fair conditions"
    );
    expect(marker).toHaveAttribute("data-condition-summary", "FAIR");
    expect(badge.textContent).toBe("");
    expect(badge).toHaveAttribute("data-marker-gradient", markerGradient);
    expect(markerGradient).toContain("linear-gradient");
    expect(badge).toHaveStyle({ width: "44px", height: "44px" });
    expect(visual).toHaveStyle({
      width: "15px",
      height: "15px",
      borderRadius: "50%",
    });
  });

  it("keeps water-temp marker colors in water-temp mode", () => {
    const marker = createWaveHeightBadge(beach("beach-good"), 3.1, {
      favoriteBeachIds: new Set(),
      selectedBeachId: null,
      hoveredBeachId: null,
      onHoverChange: jest.fn(),
      onSelectChange: jest.fn(),
      router: { push: jest.fn() },
      autoNavigate: false,
      displayMode: "water-temp",
      waterTemp: "76",
      conditionSummary: "GOOD",
    });
    const badge = getBadge(marker);
    const visual = getMarkerVisual(marker);
    const markerGradient = getWaterTempBadgeColor("76");

    expect(marker).toHaveAttribute("data-condition-summary", "GOOD");
    expect(badge.textContent).toBe("");
    expect(badge).toHaveAttribute("data-marker-gradient", markerGradient);
    expect(markerGradient).toContain("linear-gradient");
    expect(badge).toHaveStyle({ width: "44px", height: "44px" });
    expect(visual).toHaveStyle({
      width: "15px",
      height: "15px",
      borderRadius: "50%",
    });
  });

  it("renders held beaches red with a non-positive accessible advisory label", () => {
    const marker = createWaveHeightBadge(beach("held-beach"), 4.0, {
      favoriteBeachIds: new Set(),
      selectedBeachId: null,
      hoveredBeachId: null,
      onHoverChange: jest.fn(),
      onSelectChange: jest.fn(),
      router: { push: jest.fn() },
      autoNavigate: false,
      conditionSummary: "EPIC",
      waterQualityHold: true,
    });
    const badge = getBadge(marker);
    const markerGradient = getConditionMarkerGradient("EPIC", true);
    const call = getConditionMarkerCall({
      conditionSummary: "EPIC",
      waterQualityHold: true,
    });

    expect(markerGradient).toBe(
      "linear-gradient(to right, #991B1B, #B91C1C)",
    );
    expect(badge).toHaveAttribute("data-marker-gradient", markerGradient);
    expect(badge).toHaveAttribute(
      "aria-label",
      "Beach held-beach water quality advisory",
    );
    expect(call).toMatchObject({
      label: "Water quality advisory",
      gradient: markerGradient,
    });
  });
});
