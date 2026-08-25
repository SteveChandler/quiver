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
    expect(badge).toHaveTextContent("Closed — county water-quality data");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Closed — county water-quality data",
    );
  });

  it.each([
    ["advisory", "Advisory — county water-quality data"],
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
});
