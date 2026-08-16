import type { Beach } from "@/types/database";
import type { ClusterPoint } from "@/hooks/use-beach-clustering";
import type { MapDisplayMode } from "@/components/map/map-marker-builder";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { formatWaterTemp } from "@/lib/formatters/surf-data";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";

const DEFAULT_VISIBLE_BEACHES = 5;
const DESCRIPTION_MAX_LENGTH = 96;

interface ClusterPopupContentOptions {
  cluster: ClusterPoint;
  beaches: Beach[];
  waveHeightMap: Map<string, number | undefined>;
  displayForecastMap?: Map<string, ForecastDisplay | undefined>;
  waterTempMap?: Map<string, string | undefined>;
  displayMode?: MapDisplayMode;
  maxVisibleBeaches?: number;
}

function humanize(value: string | null | undefined): string | null {
  const normalized = value?.replace(/[_-]+/g, " ").trim();
  if (!normalized) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function truncate(value: string): string {
  if (value.length <= DESCRIPTION_MAX_LENGTH) return value;
  return `${value.slice(0, DESCRIPTION_MAX_LENGTH - 1).trim()}...`;
}

function firstString(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function getGeneratedDescription(beach: Beach): string | null {
  const breakType = humanize(beach.break_type)?.toLowerCase();
  const crowdLevel = humanize(beach.crowd_level)?.toLowerCase();
  const skillLevel = humanize(beach.skill_level)?.toLowerCase();
  const place = firstString([beach.city, beach.region]);

  if (breakType && crowdLevel) {
    return `${breakType} setup with ${crowdLevel} crowds.`;
  }

  if (breakType && place) {
    return `${breakType} setup around ${place}.`;
  }

  if (crowdLevel && place) {
    return `${crowdLevel} crowd level around ${place}.`;
  }

  if (skillLevel && place) {
    return `${skillLevel} option around ${place}.`;
  }

  return null;
}

function getBeachDescription(beach: Beach): string | null {
  const description = firstString([
    beach.wave_tips,
    beach.best_conditions_prose,
    beach.crowd_tips,
    getGeneratedDescription(beach),
  ]);

  return description ? truncate(description) : null;
}

function getSharedSkillLabel(beaches: Beach[]): string | null {
  if (!beaches.length) return null;
  const firstSkill = beaches[0]?.skill_level;
  if (!firstSkill) return null;
  const hasOneSkill = beaches.every((beach) => beach.skill_level === firstSkill);
  return hasOneSkill ? humanize(firstSkill) : null;
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

function formatBeachMeta(
  beach: Beach,
  waveHeightMap: Map<string, number | undefined>,
  displayForecastMap: Map<string, ForecastDisplay | undefined> | undefined,
  waterTempMap: Map<string, string | undefined> | undefined,
  displayMode: MapDisplayMode
): string {
  const labels: string[] = [];
  const waveHeight = waveHeightMap.get(beach.id);
  const condition =
    displayMode === "water-temp"
      ? formatWaterTemp(waterTempMap?.get(beach.id), "—")
      : displayForecastMap?.get(beach.id)?.label ??
        (waveHeightMap.has(beach.id)
        ? waveHeight == null
          ? null
          : formatWaveHeightRange(waveHeight)
        : null);

  if (condition && condition !== "—") labels.push(condition);

  const skill = humanize(beach.skill_level);
  if (skill) labels.push(skill);

  const place = firstString([beach.city, beach.region]);
  if (place) labels.push(place);

  return labels.join(" • ");
}

export function getClusterPopupBeaches(
  cluster: ClusterPoint,
  beaches: Beach[]
): Beach[] {
  const beachIds = new Set(cluster.beachIds ?? []);
  if (!beachIds.size) return [];
  return beaches.filter((beach) => beachIds.has(beach.id));
}

export function createClusterPopupContent({
  cluster,
  beaches,
  waveHeightMap,
  displayForecastMap,
  waterTempMap,
  displayMode = "wave-height",
  maxVisibleBeaches = DEFAULT_VISIBLE_BEACHES,
}: ClusterPopupContentOptions): HTMLElement {
  const root = document.createElement("div");
  root.className = "quiver-cluster-popup";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Grouped surf spots");
  root.setAttribute("data-testid", "cluster-popup-content");

  const sharedSkill = getSharedSkillLabel(beaches);
  const header = document.createElement("div");
  header.className = "quiver-cluster-popup__header";
  root.appendChild(header);

  const count = cluster.pointCount ?? beaches.length;
  const skillPrefix = sharedSkill ? `${sharedSkill.toLowerCase()} ` : "";
  appendText(
    header,
    "h3",
    "quiver-cluster-popup__title",
    `${count} ${skillPrefix}${count === 1 ? "spot" : "spots"} nearby`
  );

  const visibleBeaches = beaches.slice(0, maxVisibleBeaches);
  const list = document.createElement("ul");
  list.className = "quiver-cluster-popup__list";
  root.appendChild(list);

  visibleBeaches.forEach((beach) => {
    const item = document.createElement("li");
    item.className = "quiver-cluster-popup__item";
    list.appendChild(item);

    const href = getBeachHrefSafe(beach);
    const title = href ? document.createElement("a") : document.createElement("span");
    title.className = "quiver-cluster-popup__beach-name";
    title.textContent = beach.name;
    if (href && title instanceof HTMLAnchorElement) {
      title.href = href;
    }
    item.appendChild(title);

    const meta = formatBeachMeta(
      beach,
      waveHeightMap,
      displayForecastMap,
      waterTempMap,
      displayMode
    );
    if (meta) {
      appendText(item, "div", "quiver-cluster-popup__meta", meta);
    }

    const description = getBeachDescription(beach);
    if (description) {
      appendText(item, "p", "quiver-cluster-popup__description", description);
    }
  });

  const remainingCount = beaches.length - visibleBeaches.length;
  if (remainingCount > 0) {
    appendText(
      root,
      "div",
      "quiver-cluster-popup__remaining",
      `${remainingCount} more ${remainingCount === 1 ? "spot" : "spots"} in this group`
    );
  }

  return root;
}
