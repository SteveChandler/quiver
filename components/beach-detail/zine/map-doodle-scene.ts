export type ZineMapCue = "pier" | "jetty" | "reef" | "point" | "inlet" | "sandbars";

export interface ZineMapSceneInput {
  beachName?: string;
  locationName?: string;
  lat?: number | null;
  lon?: number | null;
  aspectDeg?: number | null;
  breakType?: string | null;
  features?: string[] | null;
}

export interface ZineMapScene {
  oceanSide: "left" | "right";
  oceanPath: string;
  landPath: string;
  coastPath: string;
  gridLines: string[];
  marker: { x: number; y: number };
  label: { x: number; y: number };
  cue: ZineMapCue;
  cueTransform: string;
  patternId: string;
}

interface CoastPoint {
  x: number;
  y: number;
}

const SVG_WIDTH = 400;
const SVG_HEIGHT = 240;
const DEFAULT_MARKER = { x: 130, y: 165 };

export function buildZineMapScene(input: ZineMapSceneInput): ZineMapScene {
  const aspectDeg = normalizeDegrees(input.aspectDeg);
  const oceanSide = aspectDeg != null && aspectDeg > 45 && aspectDeg < 135 ? "right" : "left";
  const seed = stableSeed([
    input.beachName,
    input.locationName,
    input.breakType,
    ...(input.features ?? []),
    input.lat?.toFixed(4),
    input.lon?.toFixed(4),
  ]);
  const coastPoints = buildCoastPoints({ aspectDeg, oceanSide, seed });
  const coastPath = buildCoastPath(coastPoints);
  const oceanPath =
    oceanSide === "left"
      ? `${coastPath} L0,${SVG_HEIGHT} L0,0 Z`
      : `${coastPath} L${SVG_WIDTH},${SVG_HEIGHT} L${SVG_WIDTH},0 Z`;
  const landPath =
    oceanSide === "left"
      ? `${coastPath} L${SVG_WIDTH},${SVG_HEIGHT} L${SVG_WIDTH},0 Z`
      : `${coastPath} L0,${SVG_HEIGHT} L0,0 Z`;
  const marker = computeMarkerPosition(input.lat, input.lon, oceanSide);
  const label = oceanSide === "left" ? { x: 292, y: 135 } : { x: 108, y: 135 };

  return {
    oceanSide,
    oceanPath,
    landPath,
    coastPath,
    gridLines: buildGridLines(coastPoints, oceanSide, seed),
    marker,
    label,
    cue: inferMapCue(input),
    cueTransform: buildCueTransform(marker, oceanSide, seed),
    patternId: `zine-dots-map-${seed.toString(36)}`,
  };
}

function normalizeDegrees(value?: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return ((value % 360) + 360) % 360;
}

function buildCoastPoints({
  aspectDeg,
  oceanSide,
  seed,
}: {
  aspectDeg: number | null;
  oceanSide: "left" | "right";
  seed: number;
}): CoastPoint[] {
  const rad = ((aspectDeg ?? 270) * Math.PI) / 180;
  const tilt = Math.round(Math.sin(rad) * 30);
  const bay = Math.round(Math.cos(rad) * 10);
  const sideSign = oceanSide === "left" ? 1 : -1;
  const baseX = oceanSide === "left" ? 168 : 232;
  const phase = (seed % 17) - 8;
  const ys = [-8, 40, 80, 120, 160, 200, 248];

  return ys.map((y, index) => {
    const normalizedY = (y - 120) / 120;
    const wiggle = Math.sin(index * 1.7 + seed * 0.13) * 7;
    const x = baseX + sideSign * (tilt * normalizedY + bay + wiggle + phase * 0.5);
    return { x: Math.round(clamp(x, 118, 282)), y };
  });
}

function buildCoastPath(points: CoastPoint[]): string {
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const controlOffset = Math.round((current.y - previous.y) * 0.45);
    path += ` C${previous.x - 10},${previous.y + controlOffset} ${current.x + 10},${current.y - controlOffset} ${current.x},${current.y}`;
  }
  return path;
}

function buildGridLines(
  coastPoints: CoastPoint[],
  oceanSide: "left" | "right",
  seed: number,
): string[] {
  const lines: string[] = [];
  const lean = ((seed % 9) - 4) * 0.8;

  [38, 78, 118, 158, 198].forEach((y, index) => {
    const coastX = interpolateCoastX(coastPoints, y);
    const startX = oceanSide === "left" ? coastX + 18 : 0;
    const endX = oceanSide === "left" ? SVG_WIDTH : coastX - 18;
    lines.push(`M${Math.round(startX)},${y + index * 2} L${Math.round(endX)},${y - 12 + index * 2}`);
  });

  const verticals = oceanSide === "left" ? [220, 280, 340] : [60, 120, 180];
  verticals.forEach((x, index) => {
    lines.push(`M${x + lean * index},0 L${x + 20 + lean * index},${SVG_HEIGHT}`);
  });

  return lines;
}

function interpolateCoastX(points: CoastPoint[], y: number): number {
  const upperIndex = points.findIndex((point) => point.y >= y);
  if (upperIndex <= 0) return points[0].x;
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  const ratio = (y - lower.y) / (upper.y - lower.y);
  return lower.x + (upper.x - lower.x) * ratio;
}

function computeMarkerPosition(
  lat?: number | null,
  lon?: number | null,
  oceanSide: "left" | "right" = "left",
): { x: number; y: number } {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return oceanSide === "left" ? DEFAULT_MARKER : { x: 270, y: DEFAULT_MARKER.y };
  }

  const fracLat = Math.abs(lat) - Math.floor(Math.abs(lat));
  const fracLon = Math.abs(lon) - Math.floor(Math.abs(lon));
  const x = oceanSide === "left" ? 40 + fracLon * 110 : 250 + fracLon * 110;
  const y = 210 - fracLat * 90;
  return { x: Math.round(x), y: Math.round(y) };
}

function inferMapCue(input: ZineMapSceneInput): ZineMapCue {
  const searchable = [
    input.beachName,
    input.breakType,
    ...(input.features ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(pier|wharf)\b/.test(searchable)) return "pier";
  if (/\b(jetty|groin|breakwater)\b/.test(searchable)) return "jetty";
  if (/\b(reef|rock|rocks|kelp)\b/.test(searchable)) return "reef";
  if (/\b(point|headland|cove)\b/.test(searchable)) return "point";
  if (/\b(inlet|river|mouth|channel|harbor|harbour)\b/.test(searchable)) return "inlet";
  return "sandbars";
}

function buildCueTransform(
  marker: { x: number; y: number },
  oceanSide: "left" | "right",
  seed: number,
): string {
  const offsetX = oceanSide === "left" ? -18 : 18;
  const rotation = oceanSide === "left" ? -7 + (seed % 5) : 7 - (seed % 5);
  return `translate(${marker.x + offsetX},${marker.y + 34}) rotate(${rotation})`;
}

function stableSeed(parts: Array<string | null | undefined>): number {
  const source = parts.filter(Boolean).join("|") || "quiver-zine-map";
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 9973;
  }
  return hash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
