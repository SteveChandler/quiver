import type { Beach } from "@/types/database";
import type { ConditionSummary } from "@/components/map/map-beach-loader";
import type { SwellPartition } from "@/app/api/forecasts/bulk/swell-partition";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { getConditionMarkerCall } from "@/components/map/map-marker-builder";
import { degreesToCompass } from "@/components/map/swell-map-theme";

interface BeachPreviewPopupContentOptions {
  location: Beach;
  waveLabel?: string | null;
  conditionSummary?: ConditionSummary;
  conditionScore?: number;
  partition?: SwellPartition;
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function appendLiveRow(
  parent: HTMLElement,
  label: string,
  value: string
): void {
  const row = document.createElement("div");
  row.className = "quiver-cluster-popup__meta";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  labelEl.style.cssText = `
    color: #252D6B;
    font-family: var(--font-mono), 'Space Mono', ui-monospace, monospace;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0;
  `;
  row.appendChild(labelEl);

  const separator = document.createElement("span");
  separator.textContent = " · ";
  row.appendChild(separator);

  const valueEl = document.createElement("span");
  valueEl.textContent = value;
  row.appendChild(valueEl);

  parent.appendChild(row);
}

export function createBeachPreviewPopupContent({
  location,
  waveLabel,
  conditionSummary,
  conditionScore,
  partition,
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
    const periodSuffix = isFiniteNumber(partition?.s1PeriodS)
      ? ` · ${Math.round(partition.s1PeriodS)}s`
      : "";
    appendLiveRow(body, "SURF", `${cleanWaveLabel}${periodSuffix}`);
  }

  const swellDirection = partition
    ? partition.swellDirOm ?? partition.s1Dir
    : null;
  if (isFiniteNumber(swellDirection)) {
    appendLiveRow(body, "SWELL", `from ${degreesToCompass(swellDirection)}`);
  }

  if (isFiniteNumber(partition?.windDir)) {
    const speedSuffix = isFiniteNumber(partition?.windMph)
      ? ` ${Math.round(partition.windMph)} mph`
      : "";
    appendLiveRow(
      body,
      "WIND",
      `${degreesToCompass(partition.windDir)}${speedSuffix}`
    );
  }

  const city = location.city?.trim();
  if (city) {
    const state = location.state?.trim();
    appendLiveRow(body, "SPOT", state ? `${city}, ${state}` : city);
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
