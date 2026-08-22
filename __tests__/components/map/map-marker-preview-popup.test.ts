import type { Beach } from "@/types/database";
import {
  createWaveHeightBadge,
  type MarkerBuilderDeps,
} from "@/components/map/map-marker-builder";
import { createBeachPreviewPopupContent } from "@/components/map/map-beach-preview-popup";
import type { SwellPartition } from "@/app/api/forecasts/bulk/swell-partition";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

const beachLngLat: [number, number] = [-117.2811, 32.8328];

const beach = {
  id: "beach-1",
  name: "Windansea",
  slug: "windansea",
  city: "San Diego",
  state: "CA",
  country: "USA",
  region: "San Diego",
  lat: 32.8328,
  lon: -117.2811,
} as Beach;

function setCanHover(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

function getBadge(marker: HTMLElement): HTMLElement {
  const badge = marker.querySelector("[data-marker-badge='true']");
  if (!(badge instanceof HTMLElement)) {
    throw new Error("Marker badge was not rendered");
  }
  return badge;
}

function baseDeps(overrides: Partial<MarkerBuilderDeps> = {}): MarkerBuilderDeps {
  return {
    favoriteBeachIds: new Set(),
    selectedBeachId: null,
    hoveredBeachId: null,
    onHoverChange: jest.fn(),
    onSelectChange: jest.fn(),
    router: { push: jest.fn() },
    autoNavigate: true,
    displayMode: "wave-height",
    waveHeightLabel: "3-4 ft",
    conditionSummary: "GOOD",
    conditionScore: 82,
    previewLngLat: beachLngLat,
    ...overrides,
  };
}

describe("map marker preview popup", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    setCanHover(false);
  });

  it("renders objective surf height and beach URL without a score-inferred verdict", () => {
    const content = createBeachPreviewPopupContent({
      location: beach,
      waveLabel: "3-4 ft",
      conditionScore: 82,
    });

    expect(content).toHaveTextContent("Windansea");
    expect(content).toHaveTextContent("3-4 ft");
    expect(content).not.toHaveTextContent("Worth it");
    expect(
      content.querySelector(".quiver-beach-preview-popup__verdict")
    ).toBeNull();

    const link = content.querySelector("a");
    expect(link).toHaveTextContent("Full forecast →");
    expect(link?.getAttribute("href")).toBe("/ca/san-diego/windansea");
  });

  it("hides the verdict entirely when there is no quality read", () => {
    const content = createBeachPreviewPopupContent({
      location: beach,
      waveLabel: "",
      conditionSummary: "UNKNOWN",
    });

    expect(
      content.querySelector(".quiver-beach-preview-popup__verdict")
    ).toBeNull();
    expect(content).not.toHaveTextContent("No read");
  });

  it("renders live surf, swell, wind, and spot details when partition data exists", () => {
    const partition: SwellPartition = {
      s1Dir: 280,
      swellDirOm: 293,
      s1PeriodS: 14,
      s1HeightFt: 3.5,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: 247,
      windMph: 8,
    };
    const content = createBeachPreviewPopupContent({
      location: beach,
      waveLabel: "3-4 ft",
      conditionScore: 82,
      partition,
    });

    expect(content).toHaveTextContent("SURF · 3-4 ft · 14s");
    expect(content).toHaveTextContent("SWELL · 3.5ft · from W");
    expect(content).toHaveTextContent("WIND · WSW 8 mph");
    expect(content).toHaveTextContent("SPOT · San Diego, CA");
  });

  it("renders static break type and skill rows between wind and spot", () => {
    const partition: SwellPartition = {
      s1Dir: null,
      swellDirOm: 293,
      s1PeriodS: 14,
      s1HeightFt: 3.5,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: 247,
      windMph: 8,
    };
    const content = createBeachPreviewPopupContent({
      location: {
        ...beach,
        break_type: "point",
        skill_level: "intermediate",
      } as Beach,
      waveLabel: "3-4 ft",
      conditionScore: 82,
      partition,
    });

    expect(content).toHaveTextContent("WAVE · Point");
    expect(content).toHaveTextContent("LEVEL · Intermediate");
    expect(
      Array.from(content.querySelectorAll(".quiver-beach-preview-popup__meta")).map(
        (row) => row.textContent
      )
    ).toEqual([
      "SURF · 3-4 ft · 14s",
      "SWELL · 3.5ft · from WNW",
      "WIND · WSW 8 mph",
      "WAVE · Point",
      "LEVEL · Intermediate",
      "SPOT · San Diego, CA",
    ]);
  });

  it("omits static break type and skill rows when missing", () => {
    const content = createBeachPreviewPopupContent({
      location: {
        ...beach,
        break_type: null,
        skill_level: null,
      } as Beach,
      waveLabel: "3-4 ft",
      conditionScore: 82,
    });

    expect(content).not.toHaveTextContent("WAVE");
    expect(content).not.toHaveTextContent("LEVEL");
    expect(content).toHaveTextContent("SPOT · San Diego, CA");
  });

  it("omits missing live details without null, NaN, or empty unit text", () => {
    const partition: SwellPartition = {
      s1Dir: 293,
      swellDirOm: null,
      s1PeriodS: null,
      s1HeightFt: 3.5,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: null,
      windMph: null,
    };
    const content = createBeachPreviewPopupContent({
      location: { ...beach, city: null, state: null } as Beach,
      waveLabel: "3-4 ft",
      conditionScore: 82,
      partition,
    });

    expect(content).toHaveTextContent("SURF · 3-4 ft");
    expect(content).toHaveTextContent("SWELL · 3.5ft · from WNW");
    expect(content).not.toHaveTextContent("WIND");
    expect(content).not.toHaveTextContent("SPOT");
    expect(content).not.toHaveTextContent("NaN");
    expect(content).not.toHaveTextContent("null");
    expect(content.textContent).not.toMatch(/·\s*s/);
  });

  it("keeps desktop marker click navigation unchanged", () => {
    setCanHover(true);
    jest.useFakeTimers();
    const router = { push: jest.fn() };
    const onLocationClick = jest.fn();
    const onPreviewOpen = jest.fn();
    const marker = createWaveHeightBadge(
      beach,
      3.5,
      baseDeps({
        router,
        onLocationClick,
        onPreviewOpen,
      })
    );

    getBadge(marker).click();

    expect(onLocationClick).toHaveBeenCalledWith(beach);
    expect(onPreviewOpen).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);

    expect(router.push).toHaveBeenCalledWith("/ca/san-diego/windansea");
  });

  it("opens preview instead of auto-navigating on touch marker click", () => {
    setCanHover(false);
    const router = { push: jest.fn() };
    const onLocationClick = jest.fn();
    const onSelectChange = jest.fn();
    const onPreviewHold = jest.fn();
    const onPreviewOpen = jest.fn();
    const marker = createWaveHeightBadge(
      beach,
      3.5,
      baseDeps({
        router,
        onLocationClick,
        onSelectChange,
        onPreviewHold,
        onPreviewOpen,
      })
    );

    getBadge(marker).click();

    expect(onSelectChange).toHaveBeenCalledWith("beach-1");
    expect(onLocationClick).toHaveBeenCalledWith(beach);
    expect(onPreviewHold).toHaveBeenCalled();
    expect(onPreviewOpen).toHaveBeenCalledWith(
      beach,
      beachLngLat,
      {
        waveLabel: "3-4 ft",
        conditionSummary: "GOOD",
        conditionScore: 82,
      }
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens preview on desktop hover and requests delayed close on leave", () => {
    setCanHover(true);
    const onHoverChange = jest.fn();
    const onPreviewHold = jest.fn();
    const onPreviewOpen = jest.fn();
    const onPreviewClose = jest.fn();
    const marker = createWaveHeightBadge(
      beach,
      3.5,
      baseDeps({
        onHoverChange,
        onPreviewHold,
        onPreviewOpen,
        onPreviewClose,
      })
    );
    const badge = getBadge(marker);

    badge.dispatchEvent(new MouseEvent("mouseenter"));

    expect(onHoverChange).toHaveBeenCalledWith("beach-1");
    expect(onPreviewHold).toHaveBeenCalled();
    expect(onPreviewOpen).toHaveBeenCalledWith(
      beach,
      beachLngLat,
      {
        waveLabel: "3-4 ft",
        conditionSummary: "GOOD",
        conditionScore: 82,
      }
    );

    badge.dispatchEvent(new MouseEvent("mouseleave"));

    expect(onHoverChange).toHaveBeenLastCalledWith(null);
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
  });
});
