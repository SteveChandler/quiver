interface RecentPostCopy {
  title: string | null;
  description: string | null;
}

export interface SystemCardDedupeRecord extends RecentPostCopy {
  beachId: string;
  contentClass: string;
  semanticClaim: string | null;
  createdAt: string;
}

function isNearDuplicate(
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

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
