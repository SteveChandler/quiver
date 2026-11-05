/**
 * CDIP MOP (Monitoring and Prediction) nowcast: hourly waves every ~100 m along the California coast at
 * the 10 m depth contour, read from THREDDS OPeNDAP as plain ASCII. "Data courtesy of CDIP".
 */

const MOP_BASE_URL = "https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore";
const USER_AGENT = "Quiver (support@quiversurf.app)";
const REQUEST_TIMEOUT_MS = 15_000;
/** The axis gains an hour every hour; a warm instance must not keep serving an old one. */
const TIME_AXIS_TTL_MS = 10 * 60 * 1000;
const MAX_HOUR_OFFSET_S = 60 * 60;
/** Past the last published hour by more than this, a nearer hour may still be published. */
const PUBLISHED_EDGE_S = 30 * 60;
const SWELL_BAND_HZ = { min: 0.04, max: 0.1 } as const;
/** waveFlagPrimary: 1 good, 2 not evaluated; 3 questionable, 4 bad, 9 missing are dropped. */
const USABLE_FLAGS = new Set([1, 2]);

export interface MopHour {
  pointId: string;
  observedAt: string;
  hsM: number;
  tpS: number;
  dpDeg: number;
  dmDeg: number | null;
  swellbandTmS: number | null;
}

/** The hour isn't published yet (MOP's nowcast lands about an hour behind). Retry later; it isn't missing. */
export class MopHourPendingError extends Error {
  constructor(pointId: string, at: Date) {
    super(`CDIP MOP ${pointId} has not published ${at.toISOString()} yet`);
    this.name = "MopHourPendingError";
  }
}

export interface MopPointMeta {
  pointId: string;
  lat: number;
  lon: number;
  shoreNormalDeg: number;
}

type FetchImpl = typeof fetch;
type TimeAxisEntry = { fetchedAt: number; axis: Promise<number[]> };

const timeAxisCaches = new WeakMap<FetchImpl, Map<string, TimeAxisEntry>>();

async function fetchAscii(pointId: string, query: string, fetchImpl: FetchImpl): Promise<Record<string, number[]>> {
  const url = `${MOP_BASE_URL}/${encodeURIComponent(pointId)}_nowcast.nc.ascii?${encodeURI(query)}`;
  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CDIP MOP ${pointId} request failed: HTTP ${response.status}`);
  return parseOpendapAscii(await response.text());
}

/**
 * OPeNDAP ASCII: a DDS header, a dashed rule, then blocks separated by blank lines. An array block is
 * `name[dims]` followed by comma-separated values (grid rows prefixed `[i], `); a grid's array is named
 * `grid.grid` and its map copies `grid.map` are skipped. Scalars are `name, value` lines.
 */
export function parseOpendapAscii(text: string): Record<string, number[]> {
  const rule = text.search(/^-{10,}$/m);
  const body = rule >= 0 ? text.slice(text.indexOf("\n", rule) + 1) : text;
  const values: Record<string, number[]> = {};
  for (const block of body.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const newline = trimmed.indexOf("\n");
    const header = newline >= 0 ? trimmed.slice(0, newline) : trimmed;
    if (!header.includes("[")) {
      for (const line of trimmed.split("\n")) {
        const [name, scalar] = line.split(/,\s*/);
        if (name && scalar !== undefined) values[name.trim()] = [Number.parseFloat(scalar)];
      }
      continue;
    }
    const [grid, member] = header.replace(/\[.*$/, "").trim().split(".");
    if (member !== undefined && member !== grid) continue;
    values[grid] = trimmed
      .slice(newline + 1)
      .replace(/^\[\d+\],\s*/gm, "")
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number.parseFloat);
  }
  return values;
}

function timeAxis(pointId: string, fetchImpl: FetchImpl): Promise<number[]> {
  let cache = timeAxisCaches.get(fetchImpl);
  if (!cache) {
    cache = new Map();
    timeAxisCaches.set(fetchImpl, cache);
  }
  const cached = cache.get(pointId);
  if (cached && Date.now() - cached.fetchedAt < TIME_AXIS_TTL_MS) return cached.axis;
  const axis = fetchAscii(pointId, "waveTime", fetchImpl).then((parsed) => parsed.waveTime ?? []);
  cache.set(pointId, { fetchedAt: Date.now(), axis });
  axis.catch(() => cache?.delete(pointId));
  return axis;
}

function nearestIndex(sortedSeconds: number[], targetSeconds: number): number {
  let low = 0;
  let high = sortedSeconds.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sortedSeconds[mid] < targetSeconds) low = mid + 1;
    else high = mid;
  }
  if (low > 0 && Math.abs(sortedSeconds[low - 1] - targetSeconds) <= Math.abs(sortedSeconds[low] - targetSeconds)) {
    return low - 1;
  }
  return low;
}

function valid(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > -999;
}

function swellBandMeanPeriod(frequencies: number[], bandwidths: number[], energy: number[]): number | null {
  let m0 = 0;
  let m1 = 0;
  frequencies.forEach((frequency, i) => {
    const density = energy[i];
    const bandwidth = bandwidths[i];
    if (frequency < SWELL_BAND_HZ.min || frequency > SWELL_BAND_HZ.max) return;
    if (!valid(density) || !valid(bandwidth) || density < 0) return;
    m0 += density * bandwidth;
    m1 += frequency * density * bandwidth;
  });
  return m0 > 0 && m1 > 0 ? m0 / m1 : null;
}

/**
 * The nowcast hour nearest `at`, or null when MOP has no valid value within ±1 h (fill -999.99, a gap, older than
 * the archive). Throws MopHourPendingError when the hour may not be published yet, and an Error on HTTP or other
 * transient failures, so callers retry instead of recording the hour as missing.
 */
export async function fetchMopHour(pointId: string, at: Date, fetchImpl: FetchImpl = fetch): Promise<MopHour | null> {
  const times = await timeAxis(pointId, fetchImpl);
  if (times.length === 0) return null;
  const targetSeconds = at.getTime() / 1000;
  if (targetSeconds > times[times.length - 1] + PUBLISHED_EDGE_S) throw new MopHourPendingError(pointId, at);
  const index = nearestIndex(times, targetSeconds);
  if (Math.abs(times[index] - targetSeconds) > MAX_HOUR_OFFSET_S) return null;

  const slice = `[${index}:1:${index}]`;
  const hour = await fetchAscii(
    pointId,
    `waveTime${slice},waveHs${slice},waveTp${slice},waveDp${slice},waveDm${slice},waveFlagPrimary${slice},` +
      `waveEnergyDensity${slice}[0:1:19],waveFrequency[0:1:19],waveBandwidth[0:1:19]`,
    fetchImpl,
  );
  const observedSeconds = hour.waveTime?.[0];
  const hsM = hour.waveHs?.[0];
  const tpS = hour.waveTp?.[0];
  const dpDeg = hour.waveDp?.[0];
  const dmDeg = hour.waveDm?.[0];
  const flag = hour.waveFlagPrimary?.[0];
  if (observedSeconds !== times[index]) {
    throw new Error(`CDIP MOP ${pointId} returned ${observedSeconds} for index ${index} (expected ${times[index]})`);
  }
  if (!valid(hsM) || !valid(tpS) || !valid(dpDeg)) return null;
  if (flag === undefined || !USABLE_FLAGS.has(flag)) return null;

  return {
    pointId,
    observedAt: new Date(observedSeconds * 1000).toISOString(),
    hsM,
    tpS,
    dpDeg,
    dmDeg: valid(dmDeg) ? dmDeg : null,
    swellbandTmS: swellBandMeanPeriod(hour.waveFrequency ?? [], hour.waveBandwidth ?? [], hour.waveEnergyDensity ?? []),
  };
}

export async function fetchMopPointMeta(pointId: string, fetchImpl: FetchImpl = fetch): Promise<MopPointMeta> {
  const meta = await fetchAscii(pointId, "metaLatitude,metaLongitude,metaShoreNormal", fetchImpl);
  const lat = meta.metaLatitude?.[0];
  const lon = meta.metaLongitude?.[0];
  const shoreNormalDeg = meta.metaShoreNormal?.[0];
  if (!valid(lat) || !valid(lon) || !valid(shoreNormalDeg)) {
    throw new Error(`CDIP MOP ${pointId} metadata is incomplete`);
  }
  return { pointId, lat, lon, shoreNormalDeg };
}

function neighbourIds(pointId: string): string[] {
  const match = /^([A-Z]+)(\d+)$/.exec(pointId);
  if (!match) return [];
  const [, prefix, digits] = match;
  const number = Number.parseInt(digits, 10);
  return [-2, -1, 1, 2]
    .map((offset) => number + offset)
    .filter((candidate) => candidate >= 1)
    .map((candidate) => `${prefix}${String(candidate).padStart(digits.length, "0")}`);
}

/** Hs at the point divided by the mean Hs of its ±2 alongshore neighbours for the same hour (canyon/reef focusing). */
export async function fetchMopFocusRatio(pointId: string, at: Date, fetchImpl: FetchImpl = fetch): Promise<number | null> {
  const centre = await fetchMopHour(pointId, at, fetchImpl);
  if (!centre) return null;
  const neighbours = await Promise.allSettled(neighbourIds(pointId).map((id) => fetchMopHour(id, at, fetchImpl)));
  const heights = neighbours.flatMap((result) =>
    result.status === "fulfilled" && result.value && result.value.observedAt === centre.observedAt ? [result.value.hsM] : [],
  );
  if (heights.length < 2) return null;
  const mean = heights.reduce((sum, height) => sum + height, 0) / heights.length;
  return mean > 0 ? Math.round((centre.hsM / mean) * 100) / 100 : null;
}
