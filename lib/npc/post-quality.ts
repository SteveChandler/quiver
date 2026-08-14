import type { Database } from "@/types/database";

export type NPCPostTag = Database["public"]["Enums"]["intel_post_tag"];

export interface NPCPostCopy {
  title: string;
  description: string;
  tag: NPCPostTag;
}

export interface RecentPostCopy {
  title: string | null;
  description: string | null;
}

export interface SystemCardDedupeRecord extends RecentPostCopy {
  beachId: string;
  contentClass: string;
  semanticClaim: string | null;
  createdAt: string;
}

const SUPPORTED_INTEL_TAGS = new Set<NPCPostTag>(["conditions"]);

const TAG_LABELS: Record<NPCPostTag, string> = {
  conditions: "Conditions",
  parking: "Parking",
  crowd: "Crowd",
  access: "Access",
  hazard: "Hazard",
  other: "Session note",
};

const REGION_FLAVOR: Record<string, string> = {
  "outer-banks": "Atlantic wind and shifting sandbars made the local read matter",
  hawaii: "trade winds and island swell shaped the local read",
  "la-santa-monica": "the west-facing LA beach break set the tone",
  "santa-barbara": "the Channel coast kept the read measured",
  "southern-maine": "cold-water timing made the local read matter",
  "south-jersey": "the Jersey shore jetties gave the session its shape",
};

export function buildPostCopy(args: {
  beachName: string;
  content: string;
  contentType: "intel" | "session_note" | "review";
  tag?: string | null;
}): NPCPostCopy {
  const description = cleanDescription(args.content, args.beachName);
  const tag = resolveTag(args.contentType, args.tag);
  const label = TAG_LABELS[tag];
  const title = distinctTitle(`${label} · ${args.beachName}`, description, args.beachName);

  return {
    title: title.slice(0, args.contentType === "review" ? 255 : 100),
    description: description.slice(0, args.contentType === "review" ? 2000 : 1000),
    tag,
  };
}

export function buildFallbackPostCopy(args: {
  beachName: string;
  personalityType: string;
  homeRegion: string;
  contentType: "intel" | "session_note" | "review";
}): NPCPostCopy {
  const flavor = REGION_FLAVOR[args.homeRegion];
  const regionalDetail = flavor ? ` ${capitalize(flavor)}.` : "";
  const descriptions: Record<string, string> = {
    local: `Logged a check-in at ${args.beachName} before the day got moving.${regionalDetail}`,
    rookie: `Spent time learning at ${args.beachName}; keeping the session simple and staying patient.${regionalDetail}`,
    traveler: `Stopped at ${args.beachName} while passing through and added the break to the trip notes.${regionalDetail}`,
    photographer: `Made a session stop at ${args.beachName} and watched the light change across the lineup.${regionalDetail}`,
    tactical: `Recorded a scouting pass at ${args.beachName}; the useful detail is logged for the next window.${regionalDetail}`,
    competitor: `Put in a focused training block at ${args.beachName} and logged the work.${regionalDetail}`,
  };
  const description = descriptions[args.personalityType] ??
    `Added a session note for ${args.beachName}.${regionalDetail}`;

  return buildPostCopy({
    beachName: args.beachName,
    content: description,
    contentType: args.contentType,
    tag: args.contentType === "session_note" ? "other" : "conditions",
  });
}

export function isTitlePrefixOfDescription(
  title: string,
  description: string,
): boolean {
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description);
  return (
    normalizedTitle.length > 0 &&
    normalizedDescription.startsWith(normalizedTitle)
  );
}

export function isNearDuplicate(
  candidate: RecentPostCopy,
  recent: RecentPostCopy,
  threshold = 0.82,
): boolean {
  const candidateText = normalizeText(`${candidate.title ?? ""} ${candidate.description ?? ""}`);
  const recentText = normalizeText(`${recent.title ?? ""} ${recent.description ?? ""}`);
  if (!candidateText || !recentText) return false;
  if (candidateText === recentText) return true;

  const candidateTokens = new Set(candidateText.split(" "));
  const recentTokens = new Set(recentText.split(" "));
  const intersection = [...candidateTokens].filter((token) => recentTokens.has(token)).length;
  const union = new Set([...candidateTokens, ...recentTokens]).size;
  return union > 0 && intersection / union >= threshold;
}

export function isSystemCardBlocked(
  candidate: SystemCardDedupeRecord,
  recent: readonly SystemCardDedupeRecord[],
  asOf: Date,
): boolean {
  const candidateDescription = normalizeText(candidate.description ?? "");
  const candidateBeachId = candidate.beachId.toLowerCase();
  const candidateCreatedAt = asOf.getTime();

  return recent.some((existing) => {
    const existingTime = new Date(existing.createdAt).getTime();
    if (!Number.isFinite(existingTime) || existingTime > candidateCreatedAt) return false;

    const ageDays = (candidateCreatedAt - existingTime) / 86400000;
    if (ageDays < 0) return false;

    const existingDescription = normalizeText(existing.description ?? "");
    if (
      candidateDescription &&
      existingDescription &&
      candidateDescription === existingDescription
    ) {
      return true;
    }

    if (
      ageDays <= 14 &&
      existing.beachId.toLowerCase() === candidateBeachId &&
      existing.contentClass === candidate.contentClass &&
      isNearDuplicate(candidate, existing)
    ) {
      return true;
    }

    return (
      ageDays <= 7 &&
      Boolean(candidate.semanticClaim) &&
      candidate.semanticClaim === existing.semanticClaim
    );
  });
}

function resolveTag(
  contentType: "intel" | "session_note" | "review",
  templateTag?: string | null,
): NPCPostTag {
  if (contentType === "session_note") return "other";
  if (contentType === "review") return "other";
  return templateTag && SUPPORTED_INTEL_TAGS.has(templateTag as NPCPostTag)
    ? (templateTag as NPCPostTag)
    : "conditions";
}

function cleanDescription(content: string, beachName: string): string {
  const description = content.replace(/\s+/g, " ").trim();
  return description || `No additional detail was recorded for ${beachName}.`;
}

function distinctTitle(baseTitle: string, description: string, beachName: string): string {
  const candidates = [
    baseTitle,
    `${beachName} · local log`,
    `Local log · ${beachName}`,
    `Update ${stableSuffix(description)} · ${beachName}`,
  ];
  return candidates.find((candidate) => !isTitlePrefixOfDescription(candidate, description)) ??
    `Log ${stableSuffix(description)}`;
}

function stableSuffix(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
