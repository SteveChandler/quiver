#!/usr/bin/env tsx
/**
 * Map California beaches to their nearest CDIP MOP nowcast point and write reviewable SQL.
 * Nothing is written to the database: the output needs Steven's APPROVE before anyone applies it.
 *
 *   tsx scripts/map-beaches-to-mop.ts --beaches <beaches.json> [--out <file.sql>] [--cache <points.json>]
 *
 * beaches.json is a read-only export: [{ id, name, lat, lon, aspect_deg }].
 *
 * MOP has ~11,600 points ~100 m apart and no combined metadata file, so instead of reading every point
 * this samples every COARSE_STRIDE-th point per county prefix, finds the nearest point near each beach,
 * then reads the points around it that could carry a transect through the beach (matchMopTransect).
 * Point metadata is cached so reruns are free.
 */
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { buildMopMappingSql, matchMopTransect, type MappableBeach } from "@/lib/services/cdip-mop/mop-beach-mapping";
import { fetchMopPointMeta, type MopPointMeta } from "@/lib/services/cdip-mop/mop-client";
import { haversineDistance } from "@/lib/utils/geo-utils";

const CATALOG_URL = "https://thredds.cdip.ucsd.edu/thredds/catalog/cdip/model/MOP_alongshore/catalog.xml";
const USER_AGENT = "Quiver (support@quiversurf.app)";
const COARSE_STRIDE = 20;
/** A beach whose nearest coarse sample is further than this is off the MOP coast (bays, islands). */
const MAX_COARSE_DISTANCE_KM = 5;
const CONCURRENCY = 4;
/** Points within MAX_LANDWARD_M (+ the cross-track allowance) of a beach lie within ~22 indices of its nearest point. */
const TRANSECT_WINDOW = 22;
const TRANSECT_STRIDE = 3;

interface Options {
  beachesPath: string;
  outPath: string;
  cachePath: string;
}

function parseArgs(argv: string[]): Options {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const beachesPath = value("--beaches");
  if (!beachesPath) throw new Error("--beaches <file.json> is required");
  return {
    beachesPath,
    outPath: value("--out") ?? ".planning/2026-10-02-mop-beach-mapping.sql",
    cachePath: value("--cache") ?? ".planning/mop-points.json",
  };
}

async function listPointIds(): Promise<Map<string, string[]>> {
  const response = await fetch(CATALOG_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`MOP catalog failed: HTTP ${response.status}`);
  const xml = await response.text();
  const byPrefix = new Map<string, string[]>();
  for (const match of xml.matchAll(/name="([A-Z]+)(\d+)_nowcast\.nc"/g)) {
    const [, prefix, digits] = match;
    const ids = byPrefix.get(prefix) ?? [];
    ids.push(`${prefix}${digits}`);
    byPrefix.set(prefix, ids);
  }
  for (const ids of byPrefix.values()) {
    ids.sort((a, b) => Number.parseInt(a.replace(/^[A-Z]+/, ""), 10) - Number.parseInt(b.replace(/^[A-Z]+/, ""), 10));
  }
  return byPrefix;
}

class PointCache {
  private readonly points: Record<string, MopPointMeta | null>;
  private readonly queue: Array<() => void> = [];
  private active = 0;
  fetched = 0;

  constructor(private readonly path: string) {
    this.points = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, MopPointMeta | null>) : {};
  }

  async get(pointId: string): Promise<MopPointMeta | null> {
    if (pointId in this.points) return this.points[pointId];
    await this.slot();
    try {
      this.points[pointId] = await fetchMopPointMeta(pointId).catch(() => fetchMopPointMeta(pointId)).catch(() => null);
      this.fetched += 1;
      if (this.fetched % 100 === 0) this.save();
    } finally {
      this.release();
    }
    return this.points[pointId];
  }

  save(): void {
    writeFileSync(this.path, `${JSON.stringify(this.points)}\n`);
  }

  private slot(): Promise<void> {
    if (this.active < CONCURRENCY) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.active -= 1;
  }
}

const distanceKm = (beach: MappableBeach, point: MopPointMeta): number =>
  haversineDistance(beach.lat, beach.lon, point.lat, point.lon);

/** Ternary search over an index window, then walk downhill so a bend in the contour can't strand it. */
async function nearestIndex(beach: MappableBeach, ids: string[], centre: number, cache: PointCache): Promise<{ index: number; km: number }> {
  const at = async (index: number): Promise<number> => {
    const point = await cache.get(ids[index]);
    return point ? distanceKm(beach, point) : Number.POSITIVE_INFINITY;
  };
  let low = Math.max(0, centre - COARSE_STRIDE);
  let high = Math.min(ids.length - 1, centre + COARSE_STRIDE);
  while (high - low > 3) {
    const left = low + Math.floor((high - low) / 3);
    const right = high - Math.floor((high - low) / 3);
    if ((await at(left)) <= (await at(right))) high = right;
    else low = left;
  }
  let best = low;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = low; index <= high; index += 1) {
    const distance = await at(index);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  for (const step of [-1, 1]) {
    let index = best + step;
    while (index >= 0 && index < ids.length) {
      const distance = await at(index);
      if (distance >= bestDistance) break;
      best = index;
      bestDistance = distance;
      index += step;
    }
  }
  return { index: best, km: bestDistance };
}

/** Every point that could carry a transect through the beach: a strided pass, then the neighbours of the best. */
async function transectCandidates(beach: MappableBeach, ids: string[], nearest: number, cache: PointCache): Promise<MopPointMeta[]> {
  const read = async (indices: number[]): Promise<MopPointMeta[]> => {
    const points = await Promise.all(indices.filter((i) => i >= 0 && i < ids.length).map((i) => cache.get(ids[i])));
    return points.filter((point): point is MopPointMeta => point !== null);
  };
  const strided: number[] = [];
  for (let offset = -TRANSECT_WINDOW; offset <= TRANSECT_WINDOW; offset += TRANSECT_STRIDE) strided.push(nearest + offset);
  const candidates = await read(strided);
  const first = matchMopTransect(beach, candidates);
  if (!first) return candidates;
  const bestIndex = ids.indexOf(first.point.pointId);
  return [...candidates, ...(await read([bestIndex - 2, bestIndex - 1, bestIndex + 1, bestIndex + 2]))];
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const beaches = JSON.parse(readFileSync(options.beachesPath, "utf8")) as MappableBeach[];
  const cache = new PointCache(options.cachePath);
  const byPrefix = await listPointIds();
  const total = [...byPrefix.values()].reduce((sum, ids) => sum + ids.length, 0);
  console.log(`MOP catalog: ${total} nowcast points in ${byPrefix.size} prefixes; ${beaches.length} beaches`);

  const coarse: Array<{ prefix: string; index: number; point: MopPointMeta }> = [];
  await Promise.all(
    [...byPrefix].flatMap(([prefix, ids]) => {
      const indices = new Set<number>();
      for (let index = 0; index < ids.length; index += COARSE_STRIDE) indices.add(index);
      indices.add(ids.length - 1);
      return [...indices].map(async (index) => {
        const point = await cache.get(ids[index]);
        if (point) coarse.push({ prefix, index, point });
      });
    }),
  );
  cache.save();
  console.log(`coarse samples: ${coarse.length} (${cache.fetched} fetched)`);

  const rows = [];
  for (const beach of beaches) {
    const nearestSamples = coarse
      .map((sample) => ({ sample, km: distanceKm(beach, sample.point) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 2);
    if (nearestSamples.length === 0 || nearestSamples[0].km > MAX_COARSE_DISTANCE_KM) {
      rows.push({ beach, match: null });
      continue;
    }
    const candidates: MopPointMeta[] = [];
    for (const { sample } of nearestSamples) {
      const ids = byPrefix.get(sample.prefix) ?? [];
      const nearest = await nearestIndex(beach, ids, sample.index, cache);
      candidates.push(...(await transectCandidates(beach, ids, nearest.index, cache)));
    }
    rows.push({ beach, match: matchMopTransect(beach, candidates) });
  }
  cache.save();

  const sql = buildMopMappingSql(rows, new Date().toISOString());
  writeFileSync(options.outPath, sql);
  const sha = createHash("sha256").update(sql).digest("hex");
  console.log(sql.split("\n").filter((line) => line.startsWith("--")).join("\n"));
  for (const row of rows.filter((r) => /La Jolla Shores|Blacks|Scripps/.test(r.beach.name))) {
    console.log(`spot-check ${row.beach.name}: ${row.match ? `${row.match.point.pointId} normal ${row.match.point.shoreNormalDeg}, ${Math.round(row.match.landwardM)} m landward, ${Math.round(row.match.crossTrackM)} m off-transect` : "unmapped"}`);
  }
  console.log(`wrote ${options.outPath} (sha256 ${sha}); ${cache.fetched} point metadata requests this run`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
