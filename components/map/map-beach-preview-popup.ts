import type { Beach } from "@/types/database";
import type { ConditionSummary } from "@/components/map/map-beach-loader";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { getConditionMarkerCall } from "@/components/map/map-marker-builder";

interface BeachPreviewPopupContentOptions {
  location: Beach;
  waveLabel?: string | null;
  conditionSummary?: ConditionSummary;
  conditionScore?: number;
}

function appendText(
  parent: HTMLElement,
  tagName: keyof HTMLElementTagNameMap,
  className: string,
  text: string
): HTMLElement {
  const child = document.createElement(tagName);
  child.className = className;
  child.textContent = text;
  parent.appendChild(child);
  return child;
}

export function createBeachPreviewPopupContent({
  location,
  waveLabel,
  conditionSummary,
  conditionScore,
}: BeachPreviewPopupContentOptions): HTMLElement {
  const root = document.createElement("div");
  root.className = "quiver-cluster-popup quiver-beach-preview-popup";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", `${location.name} surf preview`);
  root.setAttribute("data-testid", "beach-preview-popup-content");
  root.style.width = "min(236px, calc(100vw - 48px))";

  const header = document.createElement("div");
  header.className = "quiver-cluster-popup__header";
  header.style.padding = "12px 34px 10px 14px";
  root.appendChild(header);

  appendText(
    header,
    "h3",
    "quiver-cluster-popup__title",
    location.name
  );

  const body = document.createElement("div");
  body.className = "quiver-cluster-popup__item";
  body.style.borderBottom = "0";
  root.appendChild(body);

  const call = getConditionMarkerCall({
    conditionSummary,
    conditionScore,
  });
  const verdict = document.createElement("span");
  verdict.className = "quiver-beach-preview-popup__verdict";
  verdict.textContent = call.label;
  verdict.style.cssText = `
    display: inline-flex;
    align-items: center;
    border-radius: 9999px;
    padding: 3px 8px;
    color: white;
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    background: ${call.gradient};
  `;
  body.appendChild(verdict);

  const cleanWaveLabel = waveLabel?.trim();
  if (cleanWaveLabel) {
    appendText(
      body,
      "div",
      "quiver-cluster-popup__meta",
      `Surf ${cleanWaveLabel}`
    );
  }

  const href = getBeachHrefSafe(location);
  if (href) {
    const link = document.createElement("a");
    link.className = "quiver-cluster-popup__beach-name";
    link.href = href;
    link.textContent = "Full forecast →";
    link.style.marginTop = "9px";
    body.appendChild(link);
  }

  return root;
}
