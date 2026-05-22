export interface BeachPhotoTarget {
  slug: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  query?: string;
  notes?: string;
}

export interface OpenverseImageResult {
  id?: string | null;
  url?: string | null;
  thumbnail?: string | null;
  title?: string | null;
  creator?: string | null;
  creator_url?: string | null;
  license?: string | null;
  license_version?: string | null;
  license_url?: string | null;
  provider?: string | null;
  source?: string | null;
  foreign_landing_url?: string | null;
  mature?: boolean | null;
}

export interface PhotoCandidate {
  targetSlug: string;
  targetName: string;
  source: "openverse";
  sourceId: string;
  imageUrl: string;
  thumbUrl: string | null;
  sourceUrl: string;
  title: string | null;
  creatorName: string | null;
  creatorUrl: string | null;
  licenseCode: string;
  licenseUrl: string | null;
  provider: string | null;
  attributionHtml: string;
  score: number;
}

export interface CandidateReportInput {
  generatedAt: string;
  sourceLabel: string;
  targetPath: string;
  targets: BeachPhotoTarget[];
  candidates: PhotoCandidate[];
}

const STOP_WORDS = new Set([
  "and",
  "beach",
  "state",
  "the",
  "surf",
  "surfer",
  "surfing",
]);

const DEFAULT_OPENVERSE_API_URL = "https://api.openverse.org/v1/images/";
const LOW_VALUE_SEO_TITLE_TERMS = [
  "airlines",
  "bath house",
  "birds",
  "boeing",
  "bonfire meetup",
  "bowling pavilion",
  "facade",
  "freeway",
  "fwy",
  "generating station",
  "goldenwest st",
  "nuclear",
  "oily rocks",
  "overhang rock",
  "patriot point",
  "souvenir",
  "walking dogs",
];

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLicense(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/creative commons/g, "cc")
    .replace(/attribution/g, "by")
    .replace(/sharealike/g, "sa")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function hasDisallowedLicenseTerm(normalizedLicense: string): boolean {
  return /(^|-)n[co]($|-)/.test(normalizedLicense) || /(^|-)nd($|-)/.test(normalizedLicense);
}

export function isSeoUsableCreativeCommonsLicense(
  license: string | null | undefined,
): boolean {
  if (!license) return false;

  const normalizedLicense = normalizeLicense(license);
  if (!normalizedLicense || hasDisallowedLicenseTerm(normalizedLicense)) {
    return false;
  }

  return [
    "cc0",
    "pdm",
    "public-domain",
    "by",
    "by-sa",
    "cc-by",
    "cc-by-sa",
  ].some(
    (allowedLicense) =>
      normalizedLicense === allowedLicense ||
      normalizedLicense.startsWith(`${allowedLicense}-`),
  );
}

export function buildTargetQuery(target: BeachPhotoTarget): string {
  if (target.query) return normalizeWhitespace(target.query);

  return normalizeWhitespace(
    [target.name, "beach", target.city, target.state, target.country]
      .filter((part): part is string => Boolean(part))
      .join(" "),
  );
}

export function buildOpenverseSearchUrl(
  target: BeachPhotoTarget,
  options: { apiUrl?: string; limit?: number; source?: string | null } = {},
): string {
  const url = new URL(options.apiUrl ?? DEFAULT_OPENVERSE_API_URL);
  url.searchParams.set("q", buildTargetQuery(target));
  url.searchParams.set("license_type", "commercial");
  url.searchParams.set("format", "json");
  url.searchParams.set("page_size", String(options.limit ?? 4));
  if (options.source) url.searchParams.set("source", options.source);
  return url.toString();
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function licenseCodeFor(result: OpenverseImageResult): string {
  const license = (result.license ?? "").toUpperCase();
  return result.license_version
    ? `${license} ${result.license_version}`
    : license;
}

function scoreOpenverseResult(
  target: BeachPhotoTarget,
  result: OpenverseImageResult,
): number {
  const targetTerms = new Set(
    tokenize(
      `${target.name} ${target.slug} ${target.city ?? ""} ${target.query ?? ""}`,
    ),
  );
  const haystack = tokenize(
    [
      result.title,
      result.url,
      result.foreign_landing_url,
      result.creator,
      result.provider,
      result.source,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" "),
  );
  const haystackSet = new Set(haystack);
  let score = 0;

  for (const term of targetTerms) {
    if (haystackSet.has(term)) score += 2;
  }

  const title = result.title?.toLowerCase() ?? "";
  if (target.name && title.includes(target.name.toLowerCase())) score += 5;
  if (target.city && title.includes(target.city.toLowerCase())) score += 2;
  if ((result.provider ?? result.source ?? "").toLowerCase().includes("wikimedia")) {
    score += 1;
  }

  return score;
}

export function candidateFromOpenverseResult(
  target: BeachPhotoTarget,
  result: OpenverseImageResult,
): PhotoCandidate | null {
  if (!result.id || !result.url || result.mature === true) return null;
  if (!isSeoUsableCreativeCommonsLicense(result.license)) return null;

  const licenseCode = licenseCodeFor(result);
  const sourceUrl = result.foreign_landing_url ?? result.url;
  const creatorName = result.creator ?? null;
  const creatorUrl = result.creator_url ?? null;
  const licenseUrl = result.license_url ?? null;
  const title = result.title ?? null;
  if (hasLowValueSeoTitle(title)) return null;

  return {
    targetSlug: target.slug,
    targetName: target.name,
    source: "openverse",
    sourceId: result.id,
    imageUrl: result.url,
    thumbUrl: result.thumbnail?.replace(/\?format=json$/i, "") ?? null,
    sourceUrl,
    title,
    creatorName,
    creatorUrl,
    licenseCode,
    licenseUrl,
    provider: result.provider ?? result.source ?? null,
    attributionHtml: buildAttributionHtml({
      title,
      creatorName,
      creatorUrl,
      licenseCode,
      licenseUrl,
      source: "Openverse",
    }),
    score: scoreOpenverseResult(target, result),
  };
}

function hasLowValueSeoTitle(title: string | null): boolean {
  if (!title) return false;
  const normalizedTitle = title.toLowerCase();
  return LOW_VALUE_SEO_TITLE_TERMS.some((term) =>
    normalizedTitle.includes(term),
  );
}

export function parseBeachPhotoTargets(input: unknown): BeachPhotoTarget[] {
  if (!Array.isArray(input)) {
    throw new Error("Beach photo target manifest must be an array.");
  }

  return input.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Beach photo target at index ${index} must be an object.`);
    }

    const target = entry as Record<string, unknown>;
    if (typeof target.slug !== "string" || !target.slug.trim()) {
      throw new Error(`Beach photo target at index ${index} is missing slug.`);
    }
    if (typeof target.name !== "string" || !target.name.trim()) {
      throw new Error(`Beach photo target ${target.slug} is missing name.`);
    }

    return {
      slug: target.slug.trim(),
      name: target.name.trim(),
      city: optionalString(target.city),
      state: optionalString(target.state),
      country: optionalString(target.country),
      query: optionalString(target.query),
      notes: optionalString(target.notes),
    };
  });
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildAttributionHtml({
  title,
  creatorName,
  creatorUrl,
  licenseCode,
  licenseUrl,
  source,
}: {
  title: string | null;
  creatorName: string | null;
  creatorUrl: string | null;
  licenseCode: string;
  licenseUrl: string | null;
  source: string;
}): string {
  const label = title ? `"${title}"` : "Image";
  const creator = creatorName
    ? creatorUrl
      ? `<a href="${creatorUrl}" rel="noopener nofollow">${creatorName}</a>`
      : creatorName
    : "Unknown";
  const license = licenseUrl
    ? `<a href="${licenseUrl}" rel="noopener nofollow">${licenseCode}</a>`
    : licenseCode;

  return `${label} by ${creator} · ${license} via ${source}`;
}

function escapeMarkdownCell(value: string | null): string {
  return (value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function markdownLink(label: string, href: string | null): string {
  if (!href) return escapeMarkdownCell(label);
  return `[${escapeMarkdownCell(label)}](${href})`;
}

export function formatCandidateReport(input: CandidateReportInput): string {
  const candidatesByTarget = new Map<string, PhotoCandidate[]>();
  for (const candidate of input.candidates) {
    const existing = candidatesByTarget.get(candidate.targetSlug) ?? [];
    existing.push(candidate);
    candidatesByTarget.set(candidate.targetSlug, existing);
  }

  const lines: string[] = [
    "# Beach Photo Candidate Report",
    "",
    `Generated: ${input.generatedAt}`,
    `Source: ${input.sourceLabel}`,
    `Target manifest: \`${input.targetPath}\``,
    "",
    "These are review candidates only. Do not approve or seed them until the beach match, license, creator, and source URL have been manually checked.",
    "",
  ];

  for (const target of input.targets) {
    const candidates = (candidatesByTarget.get(target.slug) ?? []).sort(
      (a, b) => b.score - a.score,
    );

    lines.push(`## ${target.name}`);
    lines.push("");
    lines.push(`Slug: \`${target.slug}\``);
    lines.push(`Query: \`${buildTargetQuery(target)}\``);
    if (target.notes) lines.push(`Notes: ${target.notes}`);
    lines.push("");

    if (candidates.length === 0) {
      lines.push("No license-safe candidates returned.");
      lines.push("");
      continue;
    }

    lines.push(
      "| Score | Candidate | Creator | License | Provider | Source | Image |",
    );
    lines.push("| ---: | --- | --- | --- | --- | --- | --- |");

    for (const candidate of candidates) {
      lines.push(
        `| ${[
          String(candidate.score),
          escapeMarkdownCell(candidate.title ?? candidate.sourceId),
          candidate.creatorUrl
            ? markdownLink(
                candidate.creatorName ?? "Unknown",
                candidate.creatorUrl,
              )
            : escapeMarkdownCell(candidate.creatorName ?? "Unknown"),
          candidate.licenseUrl
            ? markdownLink(candidate.licenseCode, candidate.licenseUrl)
            : escapeMarkdownCell(candidate.licenseCode),
          escapeMarkdownCell(candidate.provider),
          markdownLink("source", candidate.sourceUrl),
          markdownLink("image", candidate.imageUrl),
        ].join(" | ")} |`,
      );
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
