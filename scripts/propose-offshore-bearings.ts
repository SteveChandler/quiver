#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  circularMean,
  confidenceForSources,
  nearestCoastlineSegments,
  roundBearing,
  segmentBearing,
  signedAngularDelta,
  type CoastlineSegment,
  type Point,
} from './offshore-bearing-geometry';

type Beach = {
  slug: string; name: string; lat: number; lon: number; currentOffshore: number; currentTol: number | null;
  aspect: number | null; windowCenter: number | null; calibrated: boolean;
};
type BearingRow = {
  slug: string; name: string; lat: number; lon: number; current_offshore: number; current_tol: number | null;
  aspect_deg: number | null; geometry_seaward: number | null; coastline_distance_m: number | null;
  window_center: number | null; proposed_offshore: number | null; delta: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'REVIEW'; change: 'CHANGE' | ''; notes: string;
};

const QUERY = `SELECT slug, name, lat, lon, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, swell_window_center_deg, (shoaling_factors IS NOT NULL AND slug NOT IN ('avalanche', 'imperial-beach-pier')) AS calibrated FROM public.beaches WHERE wind_offshore_deg IS NOT NULL ORDER BY calibrated DESC, slug`;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'Quiver offshore-bearing review (https://quiversurf.app; data-quality research)';
const ENV_FILE = '/Users/stevenchandler/Desktop/dev/quiver/.env.production.local';
let lastOverpassRequest = 0;

function printHelp(): void {
  console.log('Usage: yarn tsx scripts/propose-offshore-bearings.ts --out <dir>');
  console.log('Reads beaches through direct POSTGRES_URL_NON_POOLING with read-only psql, caches Overpass coastline responses, and writes bearings.csv and bearings.json.');
}

function parseArgs(): string | null {
  const outIndex = process.argv.indexOf('--out');
  if (process.argv.includes('--help')) { printHelp(); return null; }
  if (outIndex < 0 || !process.argv[outIndex + 1]) throw new Error('--out <dir> is required. Use --help for usage.');
  return process.argv[outIndex + 1];
}

function valueOrNull(value: string): number | null {
  const parsed = Number(value);
  return value === '\\N' || !Number.isFinite(parsed) ? null : parsed;
}

function readProductionUrl(): string {
  const contents = readFileSync(ENV_FILE, 'utf8');
  const match = contents.match(/^POSTGRES_URL_NON_POOLING=(.*)$/m);
  if (!match) throw new Error(`Missing POSTGRES_URL_NON_POOLING in ${ENV_FILE}`);
  return match[1].replace(/^"|"$/g, '');
}

function loadBeaches(): Beach[] {
  const output = execFileSync('psql', [readProductionUrl(), '-X', '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', QUERY], {
    env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' }, encoding: 'utf8',
  });
  return output.trim().split('\n').filter(Boolean).map((line) => {
    const [slug, name, lat, lon, currentOffshore, currentTol, aspect, windowCenter, calibrated] = line.split('\t');
    return { slug, name, lat: Number(lat), lon: Number(lon), currentOffshore: Number(currentOffshore), currentTol: valueOrNull(currentTol), aspect: valueOrNull(aspect), windowCenter: valueOrNull(windowCenter), calibrated: calibrated === 't' };
  });
}

async function fetchCoastline(beach: Beach, outDir: string): Promise<{ nearest: { segments: CoastlineSegment[]; distanceM: number } | null; unavailable: boolean }> {
  const cachePath = join(outDir, 'coastline-cache', `${beach.slug}.json`);
  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf8')) as { segments: CoastlineSegment[] };
    const nearest = nearestCoastlineSegments({ lat: beach.lat, lon: beach.lon }, cached.segments);
    return { nearest: nearest && nearest.distanceM <= 1000 ? nearest : null, unavailable: false };
  } catch { /* cache miss */ }
  const waitMs = Math.max(0, 1000 - (Date.now() - lastOverpassRequest));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastOverpassRequest = Date.now();
  const query = `[out:json][timeout:20];way["natural"="coastline"](around:1500,${beach.lat},${beach.lon});out geom;`;
  try {
    const response = await fetch(OVERPASS_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(1_500) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { elements?: Array<{ id: number; geometry?: Point[] }> };
    const segments = (payload.elements ?? []).flatMap((element) => (element.geometry ?? []).slice(1).map((end, index) => ({ wayId: element.id, start: element.geometry?.[index] as Point, end })));
    await mkdir(join(outDir, 'coastline-cache'), { recursive: true });
    await writeFile(cachePath, JSON.stringify({ query, fetchedAt: new Date().toISOString(), segments }));
    const nearest = nearestCoastlineSegments({ lat: beach.lat, lon: beach.lon }, segments);
    return { nearest: nearest && nearest.distanceM <= 1000 ? nearest : null, unavailable: false };
  } catch (error) {
    console.warn(`Overpass unavailable for ${beach.slug}: ${error instanceof Error ? error.message : String(error)}`);
    return { nearest: null, unavailable: true };
  }
}

function rowFromBeach(beach: Beach, geometry: { segments: CoastlineSegment[]; distanceM: number } | null, overpassFailed: boolean): BearingRow {
  const geometrySeaward = geometry ? circularMean(geometry.segments.map((segment) => roundBearing(segmentBearing(segment.start, segment.end) + 90, 1))) : null;
  const confidence = confidenceForSources(beach.aspect, geometrySeaward, beach.windowCenter);
  const seaward = beach.aspect ?? geometrySeaward;
  const proposed = seaward !== null && confidence !== 'REVIEW' ? roundBearing(seaward + 180) : null;
  const delta = proposed === null ? null : signedAngularDelta(proposed, beach.currentOffshore);
  const notes = [
    beach.aspect === null ? 'no aspect_deg' : 'aspect_deg source',
    geometry ? 'OSM nearest coastline' : 'geometry unavailable',
    overpassFailed ? 'Overpass unavailable' : '',
    confidence === 'REVIEW' ? 'insufficient/agreement review' : '',
  ].filter(Boolean).join('; ');
  return { slug: beach.slug, name: beach.name, lat: beach.lat, lon: beach.lon, current_offshore: beach.currentOffshore, current_tol: beach.currentTol, aspect_deg: beach.aspect, geometry_seaward: geometrySeaward, coastline_distance_m: geometry?.distanceM ?? null, window_center: beach.windowCenter, proposed_offshore: proposed, delta, confidence, change: proposed !== null && Math.abs(delta ?? 0) >= 20 ? 'CHANGE' : '', notes };
}

function csvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main(): Promise<void> {
  const outDir = parseArgs();
  if (!outDir) return;
  await mkdir(outDir, { recursive: true });
  const beaches = loadBeaches();
  const rows: BearingRow[] = [];
  for (const beach of beaches) {
    if (!beach.calibrated) {
      const row = rowFromBeach(beach, null, false);
      row.proposed_offshore = null;
      row.delta = null;
      row.confidence = 'REVIEW';
      row.change = '';
      row.notes = 'not calibrated; reported only';
      rows.push(row);
      continue;
    }
    const coastline = await fetchCoastline(beach, outDir);
    rows.push(rowFromBeach(beach, coastline.nearest, coastline.unavailable));
  }
  const calibrated = rows.filter((row) => beaches.find((beach) => beach.slug === row.slug)?.calibrated);
  const other = rows.filter((row) => !beaches.find((beach) => beach.slug === row.slug)?.calibrated);
  const headers = ['slug', 'name', 'lat', 'lon', 'current_offshore', 'current_tol', 'aspect_deg', 'geometry_seaward', 'coastline_distance_m', 'window_center', 'proposed_offshore', 'delta', 'confidence', 'change', 'notes'];
  const csv = [
    `# calibrated (${calibrated.length})`, headers.join(','), ...calibrated.map((row) => headers.map((header) => csvValue(row[header as keyof BearingRow])).join(',')),
    '', `# other non-null wind_offshore_deg (${other.length})`, headers.join(','), ...other.map((row) => headers.map((header) => csvValue(row[header as keyof BearingRow])).join(',')),
  ].join('\n') + '\n';
  await writeFile(join(outDir, 'bearings.csv'), csv);
  await writeFile(join(outDir, 'bearings.json'), JSON.stringify({ generatedAt: new Date().toISOString(), calibrated, other }, null, 2) + '\n');
  const counts = rows.reduce((result, row) => { result[row.confidence] += 1; return result; }, { HIGH: 0, MEDIUM: 0, REVIEW: 0 });
  console.log(JSON.stringify({ calibrated: calibrated.length, other: other.length, counts, proposedChanges: rows.filter((row) => row.change === 'CHANGE').length, outDir }, null, 2));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
