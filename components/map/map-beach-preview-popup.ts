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
  waterQualityHold?: boolean;
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

function formatStaticDescriptor(value: string | null | undefined): string | null {
  const normalized = value?.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function appendLiveRow(
  parent: HTMLElement,
  label: string,
  value: string
): void {
  const row = document.createElement("div");
  row.className = "quiver-beach-preview-popup__meta";

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
  waterQualityHold,
  partition,
}: BeachPreviewPopupContentOptions): HTMLElement {
  const root = document.createElement("div");
  root.className = "quiver-beach-preview-popup";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", `${location.name} surf preview`);
  root.setAttribute("data-testid", "beach-preview-popup-content");
  root.style.width = "min(236px, calc(100vw - 48px))";

  const header = document.createElement("div");
  header.className = "quiver-beach-preview-popup__header";
  header.style.padding = "12px 34px 10px 14px";
  root.appendChild(header);

  appendText(
    header,
    "h3",
    "quiver-beach-preview-popup__title",
    location.name
  );

  const body = document.createElement("div");
  body.className = "quiver-beach-preview-popup__item";
  body.style.borderBottom = "0";
  root.appendChild(body);

  const call = getConditionMarkerCall({
    conditionSummary,
    conditionScore,
    waterQualityHold,
  });
  // No quality read -> hide the verdict entirely. Showing "No read" next to real
  // swell/wind reads as broken; absence is cleaner than a negative badge.
  if (call.label !== "No read") {
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
  }

  const cleanWaveLabel = waveLabel?.trim();
  if (cleanWaveLabel) {
    const periodSuffix = isFiniteNumber(partition?.s1PeriodS)
      ? ` · ${Math.round(partition.s1PeriodS)}s`
      : "";
    appendLiveRow(body, "SURF", `${cleanWaveLabel}${periodSuffix}`);
  }

  const swellDirection = partition
    ? partition.s1Dir ?? partition.swellDirOm
    : null;
  if (isFiniteNumber(swellDirection)) {
    // Show swell height alongside direction so a beach with real swell never reads
    // as "no data" next to a "No read" quality verdict (verdict != swell presence).
    const swellHeightFt = partition?.s1HeightFt;
    const swellHeightPrefix =
      isFiniteNumber(swellHeightFt) && swellHeightFt > 0
        ? `${Math.round(swellHeightFt * 10) / 10}ft · `
        : "";
    appendLiveRow(
      body,
      "SWELL",
      `${swellHeightPrefix}from ${degreesToCompass(swellDirection)}`
    );
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

  const breakType = formatStaticDescriptor(location.break_type);
  if (breakType) {
    appendLiveRow(body, "WAVE", breakType);
  }

  const skillLevel = formatStaticDescriptor(location.skill_level);
  if (skillLevel) {
    appendLiveRow(body, "LEVEL", skillLevel);
  }

  const city = location.city?.trim();
  if (city) {
    const state = location.state?.trim();
    appendLiveRow(body, "SPOT", state ? `${city}, ${state}` : city);
  }

  const href = getBeachHrefSafe(location);
  if (href) {
    const link = document.createElement("a");
    link.className = "quiver-beach-preview-popup__beach-name";
    link.href = href;
    link.textContent = "Full forecast →";
    link.style.marginTop = "9px";
    body.appendChild(link);
  }

  return root;
}
