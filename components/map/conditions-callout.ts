import type { CalloutComponent } from "@/components/map/conditions-callout-data";

export interface ConditionsCalloutOptions {
  beachName: string;
  tempLabel: string | null;
  components: CalloutComponent[];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SIZE = 480;
const CX = 240;
const CY = 240;
const RING_R = 150;
const BANNER_LEN = 190; // local x of the arrowhead tip
const BODY_END = 165; // local x where the taper begins
const GAP = 16; // px the arrowhead sits out from the beach center

export function travelScreenAngleDeg(bearingDeg: number): number {
  return ((bearingDeg + 90) % 360 + 360) % 360;
}

export function textNeedsFlip(screenAngleDeg: number): boolean {
  return screenAngleDeg > 90 && screenAngleDeg < 270;
}

function svgEl(name: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function buildBanner(c: CalloutComponent, indexGap: number): SVGElement {
  const gamma = travelScreenAngleDeg(c.bearingDeg);
  const flip = textNeedsFlip(gamma);
  const pillW = 30 + c.name.length * 9;

  const group = svgEl("g", {
    transform: `translate(${CX},${CY}) rotate(${gamma}) translate(${-(BANNER_LEN + GAP + indexGap)},-17)`,
  });
  group.setAttribute("data-callout-banner", c.kind);
  group.setAttribute("data-callout-label", c.label);
  group.setAttribute("data-callout-flipped", String(flip));

  group.appendChild(
    svgEl("path", {
      d: `M17,0 H${BODY_END} L${BANNER_LEN},17 L${BODY_END},34 H17 A17,17 0 0 1 17,0 Z`,
      fill: c.color, stroke: c.color, "stroke-width": "2", "stroke-linejoin": "round",
    })
  );
  group.appendChild(
    svgEl("path", { d: `M17,0 H${pillW} V34 H17 A17,17 0 0 1 17,0 Z`, fill: "#2E2A26" })
  );

  const textGroup = svgEl("g", flip ? { transform: `rotate(180 ${BANNER_LEN / 2} 17)` } : {});
  const name = svgEl("text", {
    x: String(pillW / 2 + 8), y: "23", "text-anchor": "middle",
    "font-family": "system-ui, sans-serif", "font-size": "14", "font-weight": "800", fill: "#fff",
  });
  name.textContent = c.name;
  const value = svgEl("text", {
    x: String((pillW + BANNER_LEN) / 2), y: "23", "text-anchor": "middle",
    "font-family": "system-ui, sans-serif", "font-size": "15", "font-weight": "800", fill: "#1a1208",
  });
  value.textContent = c.label;
  textGroup.appendChild(name);
  textGroup.appendChild(value);
  group.appendChild(textGroup);

  return group;
}

export function createConditionsCalloutElement(
  opts: ConditionsCalloutOptions
): { element: HTMLElement } {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-conditions-callout", "true");
  wrapper.style.cssText = `width:${SIZE}px;height:${SIZE}px;pointer-events:auto;cursor:pointer;`;

  const svg = svgEl("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, width: String(SIZE), height: String(SIZE) });
  svg.appendChild(svgEl("circle", { cx: String(CX), cy: String(CY), r: String(RING_R), fill: "none", stroke: "rgba(255,255,255,0.7)", "stroke-width": "2" }));

  opts.components.forEach((c, i) => svg.appendChild(buildBanner(c, i * 8)));

  svg.appendChild(svgEl("circle", { cx: String(CX), cy: String(CY), r: "6", fill: "#fff" }));
  const name = svgEl("text", { x: String(CX), y: String(CY - 8), "text-anchor": "middle", "font-family": "system-ui, sans-serif", "font-size": "24", "font-weight": "800", fill: "#fff" });
  name.setAttribute("data-callout-name", "true");
  name.textContent = opts.beachName;
  svg.appendChild(name);
  if (opts.tempLabel) {
    const temp = svgEl("text", { x: String(CX), y: String(CY + 18), "text-anchor": "middle", "font-family": "system-ui, sans-serif", "font-size": "20", "font-weight": "700", fill: "#fff" });
    temp.setAttribute("data-callout-temp", "true");
    temp.textContent = opts.tempLabel;
    svg.appendChild(temp);
  }

  wrapper.appendChild(svg);
  return { element: wrapper };
}
