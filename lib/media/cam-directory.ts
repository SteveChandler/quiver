export interface CamDirectoryBeach {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  camera_url: string;
  thumbnail_url: string | null;
  lat?: number | null;
  lon?: number | null;
  cameraTitleHint?: string | null;
}

const CAMERA_SIGNAL_STOP_WORDS = new Set([
  "cam",
  "camera",
  "com",
  "cdn",
  "hls",
  "http",
  "https",
  "img",
  "jpg",
  "jpeg",
  "latest",
  "live",
  "player",
  "playlist",
  "small",
  "snapshot",
  "stream",
  "surf",
  "thumbnail",
  "video",
  "watch",
  "webcam",
  "www",
]);

const DIRECTIONAL_MODIFIERS = new Set([
  "north",
  "northside",
  "south",
  "southside",
  "east",
  "west",
  "inside",
  "outside",
]);

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";

  try {
    return decodeURIComponent(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  } catch {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value)
    .split(" ")
    .filter(
      (token) => token.length > 2 && !CAMERA_SIGNAL_STOP_WORDS.has(token),
    );
}

function getCameraSignalText(beach: CamDirectoryBeach): string {
  return [beach.camera_url, beach.thumbnail_url, beach.cameraTitleHint]
    .filter(Boolean)
    .join(" ");
}

function getCameraDirectoryKey(cameraUrl: string): string {
  try {
    const url = new URL(cameraUrl);
    url.hash = "";
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return cameraUrl.trim().toLowerCase();
  }
}

function getCentroid(beaches: CamDirectoryBeach[]): {
  lat: number;
  lon: number;
} | null {
  const coordinates = beaches.filter(
    (beach) => typeof beach.lat === "number" && typeof beach.lon === "number",
  );

  if (coordinates.length === 0) return null;

  const totals = coordinates.reduce(
    (acc, beach) => ({
      lat: acc.lat + beach.lat!,
      lon: acc.lon + beach.lon!,
    }),
    { lat: 0, lon: 0 },
  );

  return {
    lat: totals.lat / coordinates.length,
    lon: totals.lon / coordinates.length,
  };
}

function getDistanceToCentroid(
  beach: CamDirectoryBeach,
  centroid: { lat: number; lon: number } | null,
): number {
  if (
    !centroid ||
    typeof beach.lat !== "number" ||
    typeof beach.lon !== "number"
  ) {
    return 0;
  }

  const latDelta = beach.lat - centroid.lat;
  const lonDelta = beach.lon - centroid.lon;
  return Math.sqrt(latDelta * latDelta + lonDelta * lonDelta);
}

function scoreCameraBeach(
  beach: CamDirectoryBeach,
  duplicateGroup: CamDirectoryBeach[],
): number {
  const signalText = normalizeText(getCameraSignalText(beach));
  const signalTokens = new Set(tokenize(signalText));
  const namePhrase = normalizeText(beach.name);
  const slugPhrase = normalizeText(beach.slug);
  const nameTokens = new Set(tokenize(`${beach.name} ${beach.slug}`));
  const cityTokens = new Set(tokenize(beach.city));
  const centroid = getCentroid(duplicateGroup);

  let score = 0;

  if (namePhrase && signalText.includes(namePhrase)) {
    score += 100;
  }

  if (slugPhrase && signalText.includes(slugPhrase)) {
    score += 80;
  }

  for (const token of nameTokens) {
    if (signalTokens.has(token)) score += 8;
  }

  for (const token of cityTokens) {
    if (signalTokens.has(token)) score += 2;
  }

  for (const modifier of DIRECTIONAL_MODIFIERS) {
    if (nameTokens.has(modifier) && !signalTokens.has(modifier)) {
      score -= 12;
    }
  }

  score -= getDistanceToCentroid(beach, centroid) * 200;
  score -= beach.name.length * 0.001;

  return score;
}

function selectBestCameraBeach<T extends CamDirectoryBeach>(
  duplicateGroup: T[],
): T {
  return [...duplicateGroup].sort((a, b) => {
    const scoreDelta =
      scoreCameraBeach(b, duplicateGroup) - scoreCameraBeach(a, duplicateGroup);
    if (scoreDelta !== 0) return scoreDelta;

    const nameDelta = a.name.localeCompare(b.name);
    if (nameDelta !== 0) return nameDelta;

    return a.id.localeCompare(b.id);
  })[0];
}

export function dedupeCameraBeachesForDirectory<T extends CamDirectoryBeach>(
  beaches: T[],
): T[] {
  const groups = new Map<string, T[]>();

  for (const beach of beaches) {
    const key = getCameraDirectoryKey(beach.camera_url);
    const existing = groups.get(key) ?? [];
    existing.push(beach);
    groups.set(key, existing);
  }

  return Array.from(groups.values(), (group) =>
    group.length === 1 ? group[0] : selectBestCameraBeach(group),
  );
}
