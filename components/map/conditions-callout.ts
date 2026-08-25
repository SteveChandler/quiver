import type { CalloutComponent } from "@/components/map/conditions-callout-data";
import type { WaterQualityHoldKind } from "@/lib/services/nearby-beach-service";

export interface ConditionsCalloutOptions {
  beachName: string;
  tempLabel: string | null;
  components: CalloutComponent[];
  /** When set, renders a tappable "Full forecast →" link to the beach page. */
  beachHref?: string;
  waterQualityHold?: WaterQualityHoldKind | null;
  /**
   * Uniform render scale (default 1). Below 1 shrinks the whole callout — ring,
   * scrim, arrows, and labels together — so it fits narrow mobile viewports where
   * the full-size arrows would run off-screen and the ring looks oversized.
   */
  scale?: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SIZE = 480;
const CX = 240;
const CY = 240;
const RING_R = 150;
const BANNER_LEN = 190; // local x of the arrowhead tip
const BODY_END = 165; // local x where the taper begins
const GAP = 42; // px the arrowhead sits out from the beach center (breathing room around the label)
const MIN_ARROW_SEP_DEG = 36; // fan clustered same-bearing arrows apart so they don't stack

/** Full callout width in viewBox px (arrow span) — used to scale it to the viewport. */
export const CALLOUT_FULL_WIDTH = 2 * (BANNER_LEN + GAP);

function pillCssText(top: number, interactive = false): string {
  return [
    "position:absolute",
    `top:${top}px`,
    "left:50%",
    `z-index:${interactive ? 2 : 1}`,
    "transform:translateX(-50%)",
    "white-space:nowrap",
    "display:inline-flex",
    "align-items:center",
    `min-height:${interactive ? 36 : 26}px`,
    `padding:${interactive ? "6px 14px" : "4px 10px"}`,
    "border-radius:9999px",
    "background:#2E2A26",
    "font-family:system-ui, sans-serif",
    "font-weight:800",
    "box-shadow:0 2px 6px rgba(0,0,0,0.35)",
    `pointer-events:${interactive ? "auto" : "none"}`,
  ].join(";");
}

/**
 * Screen angles for each banner, fanned apart so swells sharing a bearing don't
 * stack into an unreadable blob. Already-separated arrows keep their exact angle;
 * only clustered ones are nudged (recentred on their mean so the fan stays balanced).
 */
function spreadDisplayAngles(components: CalloutComponent[]): number[] {
  const raw = components.map((c) => travelScreenAngleDeg(c.bearingDeg));
  if (raw.length < 2) return raw;
  const ref = raw[0];
  const unwrap = (a: number): number => {
    let d = (((a - ref) % 360) + 360) % 360;
    if (d > 180) d -= 360;
    return ref + d;
  };
  const order = raw.map((a, i) => ({ a: unwrap(a), i })).sort((x, y) => x.a - y.a);
  for (let k = 1; k < order.length; k += 1) {
    if (order[k].a - order[k - 1].a < MIN_ARROW_SEP_DEG) {
      order[k].a = order[k - 1].a + MIN_ARROW_SEP_DEG;
    }
  }
  const meanBefore = raw.reduce((s, a) => s + unwrap(a), 0) / raw.length;
  const meanAfter = order.reduce((s, o) => s + o.a, 0) / order.length;
  const shift = meanBefore - meanAfter;
  const out = new Array<number>(raw.length);
  for (const o of order) out[o.i] = o.a + shift;
  return out;
}

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

function buildBanner(c: CalloutComponent, gamma: number): SVGElement {
  const flip = textNeedsFlip(gamma);
  const pillW = 30 + c.name.length * 9;

  const group = svgEl("g", {
    transform: `translate(${CX},${CY}) rotate(${gamma}) translate(${-(BANNER_LEN + GAP)},-17)`,
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

  const textGroup = svgEl("g", flip ? { transform: `rotate(180 ${(17 + BANNER_LEN) / 2} 17)` } : {});
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
  // Scale the rendered pixel size only; the SVG geometry keeps the SIZE viewBox so
  // everything (ring, arrows, text) shrinks uniformly. Absolutely-positioned DOM bits
  // (pulse, link) are placed in this scaled px space below.
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const RENDER = Math.round(SIZE * scale);
  const center = RENDER / 2;

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-conditions-callout", "true");
  wrapper.style.cssText = `position:relative;width:${RENDER}px;height:${RENDER}px;pointer-events:auto;cursor:pointer;`;

  const svg = svgEl("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, width: String(RENDER), height: String(RENDER) });

  // Dark twilight scrim behind the callout so arrows + label read over busy map
  // tiles/labels instead of fighting them (Windy's arrows sit on muted water).
  const defs = svgEl("defs", {});
  const grad = svgEl("radialGradient", { id: "calloutScrim" });
  ([
    ["0%", "0.5"],
    ["62%", "0.36"],
    ["100%", "0"],
  ] as const).forEach(([offset, opacity]) =>
    grad.appendChild(
      svgEl("stop", { offset, "stop-color": "#0D1020", "stop-opacity": opacity })
    )
  );
  defs.appendChild(grad);
  svg.appendChild(defs);
  svg.appendChild(svgEl("circle", { cx: String(CX), cy: String(CY), r: String(RING_R), fill: "url(#calloutScrim)" }));
  svg.appendChild(svgEl("circle", { cx: String(CX), cy: String(CY), r: String(RING_R), fill: "none", stroke: "rgba(255,255,255,0.85)", "stroke-width": "2" }));

  // Fan clustered same-bearing banners apart so they don't stack into a blob.
  const displayAngles = spreadDisplayAngles(opts.components);
  opts.components.forEach((c, i) => svg.appendChild(buildBanner(c, displayAngles[i])));

  svg.appendChild(svgEl("circle", { cx: String(CX), cy: String(CY), r: "6", fill: "#fff" }));
  // paint-order:stroke gives the label a dark halo so it reads on any backdrop.
  const haloText = {
    "text-anchor": "middle",
    "font-family": "system-ui, sans-serif",
    fill: "#fff",
    stroke: "#0D1020",
    "paint-order": "stroke",
    "stroke-linejoin": "round",
  } as const;
  const name = svgEl("text", { ...haloText, x: String(CX), y: String(CY - 6), "font-size": "20", "font-weight": "800", "stroke-width": "3.5" });
  name.setAttribute("data-callout-name", "true");
  name.textContent = opts.beachName;
  svg.appendChild(name);
  if (opts.tempLabel) {
    const temp = svgEl("text", { ...haloText, x: String(CX), y: String(CY + 16), "font-size": "16", "font-weight": "700", "stroke-width": "3" });
    temp.setAttribute("data-callout-temp", "true");
    temp.textContent = opts.tempLabel;
    svg.appendChild(temp);
  }

  wrapper.appendChild(svg);

  // Pulsing location ring at the beach point — a "you are here" pulse like Windy's
  // live pin. Honors reduced motion (and degrades to a static dot where the Web
  // Animations API is unavailable, e.g. jsdom).
  const pulse = document.createElement("div");
  pulse.setAttribute("data-callout-pulse", "true");
  pulse.style.cssText = [
    "position:absolute",
    `top:${center}px`,
    `left:${center}px`,
    `width:${16 * scale}px`,
    `height:${16 * scale}px`,
    `margin:${-8 * scale}px 0 0 ${-8 * scale}px`,
    "border-radius:9999px",
    "background:rgba(255,255,255,0.5)",
    "pointer-events:none",
  ].join(";");
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof pulse.animate === "function" && !reducedMotion) {
    pulse.animate(
      [
        { transform: "scale(1)", opacity: 0.6 },
        { transform: "scale(3.2)", opacity: 0 },
      ],
      { duration: 1800, iterations: Infinity, easing: "ease-out" }
    );
  }
  wrapper.appendChild(pulse);

  if (opts.waterQualityHold) {
    const statusCopy =
      opts.waterQualityHold === "closure"
        ? "Closed — county water-quality data"
        : opts.waterQualityHold === "advisory"
          ? "Advisory — county water-quality data"
          : "Water quality hold";
    const statusBadge = document.createElement("div");
    statusBadge.setAttribute("data-callout-water-quality", opts.waterQualityHold);
    statusBadge.setAttribute("role", "status");
    statusBadge.setAttribute("aria-label", statusCopy);
    statusBadge.textContent = statusCopy;
    statusBadge.style.cssText = [
      // The map's 0.55 scale floor leaves a 7px gap above the forecast link;
      // the opaque badge also keeps any radial arrow beneath it from crossing the copy.
      pillCssText((CY + 62) * scale),
      "box-sizing:border-box",
      "border:1px solid #F2A24C",
      "color:#FFF7E8",
      "font-size:12px",
      "line-height:1.2",
    ].join(";");
    wrapper.appendChild(statusBadge);
  }

  if (opts.beachHref) {
    // The arrows already carry name/temp/swell/wind; the only thing the old info
    // card added is the path to the full forecast. Render it as a tappable pill
    // just below the center label. stopPropagation so it navigates instead of
    // dismissing the callout (the wrapper's click handler dismisses).
    const link = document.createElement("a");
    link.setAttribute("data-callout-link", "true");
    link.href = opts.beachHref;
    link.textContent = "Full forecast →";
    link.style.cssText = [
      // Position scales with the callout; the pill's own size stays for tappability.
      pillCssText((CY + 122) * scale, true),
      "color:#fff",
      "font-size:13px",
      "text-decoration:none",
    ].join(";");
    link.addEventListener("click", (event) => event.stopPropagation());
    wrapper.appendChild(link);
  }

  return { element: wrapper };
}
