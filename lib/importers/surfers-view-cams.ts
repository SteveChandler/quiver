import {
  findLicensedCamOverride,
  type LicensedCamRightsStatus,
} from "@/lib/media/licensed-cam-overrides";

export type SurfersViewMatchStatus =
  | "matched"
  | "needs_review"
  | "candidate_new";

export type SurfersViewFetchStatus = "parsed" | "fetch_failed";
export type SurfersViewSourceRightsStatus =
  | "public_linkout"
  | LicensedCamRightsStatus;

export interface SurfersViewCamPageInput {
  sourcePageUrl: string;
  html: string;
}

export interface SurfersViewCamRecord {
  source_page_url: string;
  title: string;
  spot_name: string;
  region_slug: string;
  provider: string;
  thumbnail_url: string | null;
  audit_stream_url: string | null;
  fetch_status: SurfersViewFetchStatus;
  import_camera_url: string;
  source_rights_status: SurfersViewSourceRightsStatus;
  licensed_override_note: string | null;
  stream_import_allowed: false;
}

export interface QuiverBeachForMatching {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface SurfersViewCamImportRow extends SurfersViewCamRecord {
  match_status: SurfersViewMatchStatus;
  quiver_beach_id: string | null;
  quiver_beach_slug: string | null;
  match_score: number;
  candidate_city: string | null;
  candidate_state: string | null;
  candidate_country: string | null;
}

export interface SurfersViewApplyBatches {
  cameraRows: Array<{
    beach_id: string;
    camera_url: string;
  }>;
  thumbnailRows: Array<{
    beach_id: string;
    thumbnail_url: string;
  }>;
}

interface RegionLocation {
  state: string | null;
  country: string;
}

const SURFERS_VIEW_HOST = "thesurfersview.com";
const LIVE_CAM_PATH_PREFIX = "/live-cams/";
const MATCH_THRESHOLD = 0.72;
const CONFIDENT_MATCH_THRESHOLD = 0.9;

const REGION_LOCATIONS: Record<string, RegionLocation> = {
  alabama: { state: "AL", country: "USA" },
  australia: { state: null, country: "Australia" },
  california: { state: "CA", country: "USA" },
  "costa-rica": { state: null, country: "Costa Rica" },
  delaware: { state: "DE", country: "USA" },
  "el-salvador": { state: null, country: "El Salvador" },
  florida: { state: "FL", country: "USA" },
  hawaii: { state: "HI", country: "USA" },
  maine: { state: "ME", country: "USA" },
  massachusetts: { state: "MA", country: "USA" },
  mexico: { state: null, country: "Mexico" },
  "new-hampshire": { state: "NH", country: "USA" },
  "new-jersey": { state: "NJ", country: "USA" },
  "new-york": { state: "NY", country: "USA" },
  nicaragua: { state: null, country: "Nicaragua" },
  "north-carolina": { state: "NC", country: "USA" },
  "puerto-rico": { state: "PR", country: "USA" },
  "south-carolina": { state: "SC", country: "USA" },
  texas: { state: "TX", country: "USA" },
  "united-kingdom": { state: null, country: "United Kingdom" },
  virginia: { state: "VA", country: "USA" },
};

const TITLE_SUFFIX_RE =
  /\s+(?:webcam|web\s*cam|surf\s+cam|live\s+cam|cam)(?:\s*(?:&|and)\s*(?:surf|beach)\s+report|\s+(?:surf|beach)\s+report)?$/i;

const CSV_COLUMNS: Array<keyof SurfersViewCamImportRow> = [
  "source_page_url",
  "title",
  "region_slug",
  "provider",
  "thumbnail_url",
  "audit_stream_url",
  "fetch_status",
  "source_rights_status",
  "licensed_override_note",
  "match_status",
  "quiver_beach_id",
  "quiver_beach_slug",
  "match_score",
  "import_camera_url",
  "stream_import_allowed",
  "candidate_city",
  "candidate_state",
  "candidate_country",
];

export function extractSurfersViewCamUrlsFromSitemapXml(xml: string): string[] {
  const urls = Array.from(
    xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),
    (match) => decodeHtmlEntities(match[1] ?? "").trim()
  );

  const seen = new Set<string>();
  const liveCamUrls: string[] = [];

  for (const url of urls) {
    if (!isAllowedSurfersViewLiveCamPage(url) || seen.has(url)) {
      continue;
    }
    seen.add(url);
    liveCamUrls.push(url);
  }

  return liveCamUrls;
}

export function parseSurfersViewCamPage({
  sourcePageUrl,
  html,
}: SurfersViewCamPageInput): SurfersViewCamRecord {
  const decodedHtml = decodeHtmlEntities(html);
  const title = extractTitle(decodedHtml);
  const config = extractPlayerConfig(html);
  const thumbnailUrl =
    extractSchemaThumbnailUrl(decodedHtml) ?? config.failimg ?? config.poster ?? null;

  return applyLicensedCameraOverride({
    source_page_url: sourcePageUrl,
    title,
    spot_name: extractSpotName(title),
    region_slug: extractRegionSlug(sourcePageUrl),
    provider: inferProvider(config),
    thumbnail_url: thumbnailUrl,
    audit_stream_url: config.vcdnurl ?? null,
    fetch_status: "parsed",
    import_camera_url: sourcePageUrl,
    source_rights_status: "public_linkout",
    licensed_override_note: null,
    stream_import_allowed: false,
  });
}

export function matchSurfersViewCamToBeach(
  cam: SurfersViewCamRecord,
  beaches: QuiverBeachForMatching[]
): SurfersViewCamImportRow {
  const regionLocation = REGION_LOCATIONS[cam.region_slug] ?? null;
  const filteredBeaches = beaches.filter((beach) =>
    isRegionCompatible(beach, regionLocation)
  );
  const searchBeaches = regionLocation ? filteredBeaches : beaches;
  const candidates = searchBeaches
    .map((beach) => ({
      beach,
      score: scoreBeachMatch(cam.spot_name, beach),
    }))
    .filter((candidate) => candidate.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const candidateLocation = inferCandidateLocation(cam);
  if (candidates.length === 0) {
    return {
      ...cam,
      match_status: "candidate_new",
      quiver_beach_id: null,
      quiver_beach_slug: null,
      match_score: 0,
      ...candidateLocation,
    };
  }

  const [best, second] = candidates;
  const isAmbiguous = !!second && Math.abs(best.score - second.score) < 0.02;

  if (isAmbiguous || best.score < CONFIDENT_MATCH_THRESHOLD) {
    return {
      ...cam,
      match_status: "needs_review",
      quiver_beach_id: best.beach.id,
      quiver_beach_slug: best.beach.slug,
      match_score: roundScore(best.score),
      ...candidateLocation,
    };
  }

  return {
    ...cam,
    match_status: "matched",
    quiver_beach_id: best.beach.id,
    quiver_beach_slug: best.beach.slug,
    match_score: roundScore(best.score),
    ...candidateLocation,
  };
}

export function toSurfersViewCamCsv(rows: SurfersViewCamImportRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")
  );

  return [header, ...body].join("\n") + "\n";
}

export function finalizeSurfersViewImportRows(
  rows: SurfersViewCamImportRow[]
): SurfersViewCamImportRow[] {
  const fetchSafeRows: SurfersViewCamImportRow[] = rows.map(
    (row): SurfersViewCamImportRow => {
      if (row.fetch_status !== "fetch_failed" || row.match_status !== "matched") {
        return row;
      }

      return {
        ...row,
        match_status: row.quiver_beach_id ? "needs_review" : "candidate_new",
      };
    }
  );

  const matchedByBeachId = new Map<string, SurfersViewCamImportRow[]>();
  for (const row of fetchSafeRows) {
    if (row.match_status !== "matched" || !row.quiver_beach_id) continue;
    const currentRows = matchedByBeachId.get(row.quiver_beach_id) ?? [];
    currentRows.push(row);
    matchedByBeachId.set(row.quiver_beach_id, currentRows);
  }

  const duplicateBeachIds = new Set(
    Array.from(matchedByBeachId.entries())
      .filter(([, beachRows]) => beachRows.length > 1)
      .map(([beachId]) => beachId)
  );

  if (duplicateBeachIds.size === 0) {
    return fetchSafeRows;
  }

  return fetchSafeRows.map((row): SurfersViewCamImportRow => {
    if (
      row.match_status !== "matched" ||
      !row.quiver_beach_id ||
      !duplicateBeachIds.has(row.quiver_beach_id)
    ) {
      return row;
    }

    return {
      ...row,
      match_status: "needs_review",
    };
  });
}

export function buildSurfersViewApplyBatches(
  rows: SurfersViewCamImportRow[]
): SurfersViewApplyBatches {
  const matchedRows = rows.filter(
    (row) => row.match_status === "matched" && row.quiver_beach_id
  );
  const duplicateBeachIds = findDuplicateBeachIds(matchedRows);

  if (duplicateBeachIds.length > 0) {
    throw new Error(
      `Refusing to apply duplicate matched beach IDs: ${duplicateBeachIds.join(", ")}`
    );
  }

  return {
    cameraRows: matchedRows.map((row) => ({
      beach_id: row.quiver_beach_id as string,
      camera_url: row.import_camera_url,
    })),
    thumbnailRows: matchedRows
      .filter((row): row is SurfersViewCamImportRow & { thumbnail_url: string } =>
        Boolean(row.thumbnail_url)
      )
      .map((row) => ({
        beach_id: row.quiver_beach_id as string,
        thumbnail_url: row.thumbnail_url,
      })),
  };
}

function findDuplicateBeachIds(rows: SurfersViewCamImportRow[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    if (!row.quiver_beach_id) continue;
    if (seen.has(row.quiver_beach_id)) {
      duplicates.add(row.quiver_beach_id);
      continue;
    }
    seen.add(row.quiver_beach_id);
  }

  return Array.from(duplicates).sort();
}

export function isAllowedSurfersViewLiveCamPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== SURFERS_VIEW_HOST) return false;
    if (!parsed.pathname.startsWith(LIVE_CAM_PATH_PREFIX)) return false;
    const segments = parsed.pathname.replace(/\/+$/g, "").split("/").filter(Boolean);
    if (segments.length < 3) return false;
    if (parsed.pathname.startsWith("/cams/")) return false;
    if (parsed.pathname.startsWith("/cams_http/")) return false;
    return true;
  } catch {
    return false;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/i);
  return normalizeWhitespace(match?.[1] ?? "");
}

function applyLicensedCameraOverride(
  cam: SurfersViewCamRecord
): SurfersViewCamRecord {
  const override = findLicensedCamOverride(cam.source_page_url);
  if (!override) return cam;

  return {
    ...cam,
    provider: override.provider,
    import_camera_url: override.importCameraUrl,
    source_rights_status: override.sourceRightsStatus,
    licensed_override_note: override.note,
  };
}

function extractSpotName(title: string): string {
  const withoutSite = title.replace(/\s+-\s+The Surfers View\s*$/i, "");
  const withoutReport = withoutSite.replace(/\s+(?:&|and)\s*Surf Report$/i, "");
  return normalizeWhitespace(withoutReport.replace(TITLE_SUFFIX_RE, ""));
}

function extractRegionSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const [, liveCams, region] = parsed.pathname.split("/");
    return liveCams === "live-cams" ? region ?? "" : "";
  } catch {
    return "";
  }
}

function extractPlayerConfig(html: string): Partial<{
  failimg: string;
  friendly_location: string;
  poster: string;
  vcdnurl: string;
}> {
  const match = html.match(/data-player-config="([^"]+)"/i);
  if (!match?.[1]) return {};

  try {
    const decoded = decodeHtmlEntities(match[1]);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return {
      failimg: toOptionalString(parsed.failimg),
      friendly_location: toOptionalString(parsed.friendly_location),
      poster: toOptionalString(parsed.poster),
      vcdnurl: toOptionalString(parsed.vcdnurl),
    };
  } catch {
    return {};
  }
}

function extractSchemaThumbnailUrl(html: string): string | null {
  const match = html.match(/"thumbnailUrl"\s*:\s*"([^"]+)"/i);
  return match?.[1] ?? null;
}

function inferProvider(
  config: Partial<{ friendly_location: string; vcdnurl: string }>
): string {
  const friendly = config.friendly_location?.toLowerCase() ?? "";
  const stream = config.vcdnurl?.toLowerCase() ?? "";
  if (
    friendly.includes("coastal camera network") ||
    stream.includes("coastalcameranetwork.com")
  ) {
    return "Coastal Camera Network";
  }
  return "The Surfers View";
}

function isRegionCompatible(
  beach: QuiverBeachForMatching,
  regionLocation: RegionLocation | null
): boolean {
  if (!regionLocation) return true;

  const beachCountry = normalizeCountry(beach.country);
  const targetCountry = normalizeCountry(regionLocation.country);
  if (targetCountry !== "usa" && beachCountry !== targetCountry) {
    return false;
  }
  if (beachCountry && targetCountry && beachCountry !== targetCountry) {
    return false;
  }

  if (regionLocation.state) {
    return normalizeState(beach.state) === regionLocation.state;
  }

  return true;
}

function scoreBeachMatch(
  spotName: string,
  beach: QuiverBeachForMatching
): number {
  const spot = normalizeForMatching(spotName);
  const beachName = normalizeForMatching(beach.name);
  const city = normalizeForMatching(beach.city ?? "");
  const slug = normalizeForMatching((beach.slug ?? "").replace(/-/g, " "));

  if (!spot || !beachName) return 0;
  if (spot === beachName) return 1;
  if (spot === city) return 0.86;
  if (containsTokenPhrase(spot, beachName) || containsTokenPhrase(beachName, spot)) {
    return 0.92;
  }
  if (containsTokenPhrase(slug, spot)) return 0.86;

  const spotTokens = new Set(spot.split(" ").filter(Boolean));
  const beachTokens = new Set(beachName.split(" ").filter(Boolean));
  const shared = Array.from(spotTokens).filter((token) => beachTokens.has(token));
  if (shared.length === 0) return 0;

  return shared.length / Math.max(spotTokens.size, beachTokens.size);
}

function containsTokenPhrase(container: string, phrase: string): boolean {
  if (!container || !phrase) return false;
  const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${escapedPhrase}($| )`).test(container);
}

function inferCandidateLocation(cam: SurfersViewCamRecord): {
  candidate_city: string | null;
  candidate_state: string | null;
  candidate_country: string | null;
} {
  const regionLocation = REGION_LOCATIONS[cam.region_slug] ?? null;
  return {
    candidate_city: null,
    candidate_state: regionLocation?.state ?? null,
    candidate_country: regionLocation?.country ?? null,
  };
}

function normalizeForMatching(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\b(?:beach|cam|webcam|surf|report|live|the|at|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCountry(value: string | null): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "us" || normalized === "usa" || normalized === "united states") {
    return "usa";
  }
  return normalized;
}

function normalizeState(value: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/\\\//g, "/");
}
