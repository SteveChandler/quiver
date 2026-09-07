import {
  createConditionsCalloutElement,
  travelScreenAngleDeg,
  textNeedsFlip,
} from "@/components/map/conditions-callout";
import type { CalloutComponent } from "@/components/map/conditions-callout-data";
import { getConditionMarkerCall } from "@/components/map/map-marker-builder";

const S1: CalloutComponent = { kind: "s1", name: "SWELL", bearingDeg: 290, label: "2.6ft, 8s", color: "#F2A24C" };
const S2: CalloutComponent = { kind: "s2", name: "S2", bearingDeg: 200, label: "1.6ft, 13s", color: "#7AC74F" };
const WIND: CalloutComponent = { kind: "wind", name: "WIND", bearingDeg: 230, label: "8 mph", color: "#74C7E3" };

describe("travelScreenAngleDeg / textNeedsFlip", () => {
  it("maps bearing to travel screen angle (bearing + 90, normalized)", () => {
    expect(travelScreenAngleDeg(0)).toBe(90);
    expect(travelScreenAngleDeg(300)).toBe(30);
  });
  it("flags left-hemisphere angles for text flipping", () => {
    expect(textNeedsFlip(91)).toBe(true);
    expect(textNeedsFlip(269)).toBe(true);
    expect(textNeedsFlip(10)).toBe(false);
    expect(textNeedsFlip(300)).toBe(false);
    expect(textNeedsFlip(90)).toBe(false);
    expect(textNeedsFlip(270)).toBe(false);
  });
});

describe("createConditionsCalloutElement", () => {
  it("renders one banner per component, tagged by kind and label", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [S1, S2, WIND] });
    const banners = element.querySelectorAll("[data-callout-banner]");
    expect(banners.length).toBe(3);
    expect(Array.from(banners).map((b) => b.getAttribute("data-callout-banner"))).toEqual(["s1", "s2", "wind"]);
    expect(element.querySelector('[data-callout-banner="s1"]')?.getAttribute("data-callout-label")).toBe("2.6ft, 8s");
  });

  it("renders the beach name and temp at the center", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [S1] });
    expect(element.querySelector("[data-callout-name]")?.textContent).toBe("Del Mar");
    expect(element.querySelector("[data-callout-temp]")?.textContent).toBe("68°");
  });

  it("omits the temp node when tempLabel is null", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: null, components: [S1] });
    expect(element.querySelector("[data-callout-temp]")).toBeNull();
    expect(element.querySelector("[data-callout-name]")?.textContent).toBe("Del Mar");
  });

  it("renders zero banners (center label only) when components is empty", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [] });
    expect(element.querySelectorAll("[data-callout-banner]").length).toBe(0);
    expect(element.querySelector("[data-callout-name]")?.textContent).toBe("Del Mar");
  });

  it("marks a left-hemisphere banner as text-flipped", () => {
    // S2 bearing 200 -> screen angle 290 -> right hemisphere -> no flip.
    // Wind bearing 230 -> screen angle 320 -> right hemisphere -> no flip.
    // S1 bearing 290 -> screen angle 380%360=20 -> no flip.
    // Use a south-traveling swell: bearing 10 -> screen 100 -> flip.
    const south: CalloutComponent = { ...S1, bearingDeg: 10 };
    const { element } = createConditionsCalloutElement({ beachName: "X", tempLabel: null, components: [south] });
    expect(element.querySelector('[data-callout-banner="s1"]')?.getAttribute("data-callout-flipped")).toBe("true");
  });

  it("renders a Full forecast link when beachHref is provided, omits it otherwise", () => {
    const withHref = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [S1], beachHref: "/ca/san-diego/del-mar" });
    const link = withHref.element.querySelector("[data-callout-link]");
    expect(link?.getAttribute("href")).toBe("/ca/san-diego/del-mar");
    expect(link?.textContent).toBe("Full forecast →");
    expect(withHref.element).toHaveStyle({ pointerEvents: "none" });
    expect(withHref.element.querySelector("[data-callout-content]")).toHaveStyle({ pointerEvents: "auto" });
    expect(link).toHaveStyle({ top: "calc(50% + 122px * var(--callout-zoom, 1))" });

    const noHref = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [S1] });
    expect(noHref.element.querySelector("[data-callout-link]")).toBeNull();
  });

  it("always renders the pulsing location dot", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [] });
    expect(element.querySelector("[data-callout-pulse]")).not.toBeNull();
  });

  it("labels a closure consistently in the marker call and conditions callout", () => {
    const markerCall = getConditionMarkerCall({
      conditionSummary: "EPIC",
      waterQualityHold: "closure",
    });
    const { element } = createConditionsCalloutElement({
      beachName: "Del Mar",
      tempLabel: "68°",
      components: [S1],
      waterQualityHold: "closure",
    });
    const badge = element.querySelector("[data-callout-water-quality]");

    expect(markerCall.label).toBe("Water quality closure");
    expect(badge).toHaveTextContent("Closed — water-quality alert");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Closed — water-quality alert",
    );
  });

  it.each([
    ["advisory", "Advisory — water-quality alert"],
    ["held", "Water quality hold"],
  ] as const)(
    "renders unmistakable wording for a %s",
    (waterQualityHold, expectedCopy) => {
      const { element } = createConditionsCalloutElement({
        beachName: "Del Mar",
        tempLabel: "68°",
        components: [S1],
        waterQualityHold,
      });
      const badge = element.querySelector("[data-callout-water-quality]");

      expect(badge).toHaveTextContent(expectedCopy);
      expect(badge).toHaveAttribute("aria-label", expectedCopy);
    },
  );

  it.each([1, 0.55])(
    "keeps the water-quality badge above the center label at scale %s",
    (scale) => {
      const { element } = createConditionsCalloutElement({
        beachName: "Del Mar",
        tempLabel: "68°",
        components: [S1],
        waterQualityHold: "advisory",
        scale,
      });
      const badge = element.querySelector<HTMLElement>(
        "[data-callout-water-quality]",
      );
      const name = element.querySelector<SVGTextElement>("[data-callout-name]");
      const ring = element.querySelector<SVGCircleElement>('circle[fill="none"]');

      if (!badge || !name || !ring) {
        throw new Error("Expected water-quality badge, center label, and ring");
      }

      const badgeTop = Number.parseFloat(badge.style.top);
      const badgeHeight = Number.parseFloat(badge.style.minHeight);
      const badgeBottom = badgeTop + badgeHeight;
      const renderedHeight = Number.parseFloat(element.style.height);
      const nameTop =
        (Number(name.getAttribute("y")) -
          Number(name.getAttribute("font-size"))) *
        scale;
      const ringRadius = Number(ring.getAttribute("r")) * scale;
      const expectedBadgeTop =
        renderedHeight / 2 - ringRadius / 2 - badgeHeight / 2;

      expect(badgeTop).toBeGreaterThanOrEqual(0);
      expect(badgeBottom).toBeLessThanOrEqual(renderedHeight);
      expect(badgeBottom).toBeLessThan(nameTop);
      expect(badgeTop).toBeCloseTo(expectedBadgeTop);
    },
  );
});

it("keeps the original SVG arrows on their real bearing instead of fanning directions", () => {
  const { element } = createConditionsCalloutElement({
    beachName: "Osprey Point", tempLabel: "75°", mapBearing: 20,
    components: [{ ...S1, bearingDeg: 180 }, { ...S2, bearingDeg: 180 }],
  });
  expect(element.querySelector("svg")).toHaveAttribute("viewBox", "0 0 480 480");
  for (const banner of element.querySelectorAll("[data-callout-banner]")) {
    expect(banner).toHaveAttribute("data-bearing", "180");
    expect(banner.getAttribute("transform")).toContain("rotate(250)");
  }
});

it.each([false, true])("turns across north by the shortest arc (reduced motion: %s)", (reduced) => {
  const descriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, "animate");
  const animate = jest.fn();
  Object.defineProperty(SVGElement.prototype, "animate", { configurable: true, value: animate });
  const media = jest.spyOn(window, "matchMedia").mockReturnValue({ matches: reduced } as MediaQueryList);
  try {
    const previous = createConditionsCalloutElement({ beachName: "A", tempLabel: null, components: [{ ...S1, bearingDeg: 260 }] }).element;
    const { element } = createConditionsCalloutElement({ beachName: "B", tempLabel: null, components: [{ ...S1, bearingDeg: 280 }], previousElement: previous });
    expect(element.querySelector("[data-callout-banner]")?.getAttribute("transform")).toContain("rotate(10)");
    if (reduced) {
      expect(animate).not.toHaveBeenCalled();
    } else {
      expect(animate).toHaveBeenCalledTimes(1);
      const [frames, options] = animate.mock.calls[0];
      expect(frames[0].transform).toContain("rotate(350deg)");
      expect(frames[1].transform).toContain("rotate(370deg)");
      expect(options.duration).toBe(500);
    }
  } finally {
    media.mockRestore();
    if (descriptor) Object.defineProperty(SVGElement.prototype, "animate", descriptor);
    else delete (SVGElement.prototype as Partial<Element>).animate;
  }
});

 test("warns about historical samples without calling the beach closed", () => {
  (window.matchMedia as jest.Mock).mockReturnValue({ matches: false });
  const { element } = createConditionsCalloutElement({ beachName: "La Jolla Shores", tempLabel: null, components: [], waterQualityHold: null, waterQualityEvidence: { source: "sample", sampleDate: "2026-08-11" } });
  expect(element.querySelector("[data-callout-water-quality]")).toHaveTextContent("Water quality not recently verified");
  expect(element.querySelector("[data-callout-water-quality]")).toHaveAttribute("data-callout-water-quality", "unconfirmed");
  expect(element).not.toHaveTextContent("Advisory");
  expect(element).not.toHaveTextContent("Closed");
  expect(element).toHaveTextContent("Sample: 2026-08-11");
});

 test("flips text within its own colored section when arrows turn left", () => {
  (window.matchMedia as jest.Mock).mockReturnValue({ matches: false });
  const { element } = createConditionsCalloutElement({ beachName: "K-38", tempLabel: null, components: [{ ...S1, bearingDeg: 10 }] });
  const banner = element.querySelector('[data-callout-banner="s1"]')!;
  expect(banner).toHaveAttribute("data-callout-flipped", "true");
  const labels = banner.querySelectorAll("text");
  labels.forEach((label) => expect(label).toHaveAttribute("transform", `rotate(180 ${label.getAttribute("x")} 17)`));
  expect(labels[0].parentElement).not.toHaveAttribute("transform");
});
