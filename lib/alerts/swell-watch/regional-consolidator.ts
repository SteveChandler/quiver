import type { MatchedRegionalEvent } from "./event-matcher";
import type { SwellWatchAudienceReason } from "./audience";

export interface RegionalBeachCandidate {
  beachId: string;
  regionalEvent: MatchedRegionalEvent;
}

interface RegionalSwellConsolidation {
  regionalEventId: string;
  regionKey: string;
  beachIds: string[];
  status: MatchedRegionalEvent["status"];
  aliases: string[];
}

export interface SwellWatchRecipientCandidate {
  recipientUserId: string;
  regionalEventId: string;
  beachId: string;
  reason: SwellWatchAudienceReason;
  projectedImpact: number;
  confidence: number;
}

interface SwellWatchRecipientConsolidation {
  recipientUserId: string;
  regionalEventId: string;
  leadBeachId: string;
}

const audienceReasonPriority: Record<SwellWatchAudienceReason, number> = {
  home: 0,
  favorite: 1,
  rule: 2,
};

function credibleScore(value: number, maximum: number = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    return Number.NEGATIVE_INFINITY;
  }
  return value;
}

function compareScoresDescending(left: number, right: number): number {
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

function compareRecipientCandidates(
  left: SwellWatchRecipientCandidate,
  right: SwellWatchRecipientCandidate,
): number {
  const reasonDifference =
    audienceReasonPriority[left.reason] - audienceReasonPriority[right.reason];
  if (reasonDifference !== 0) return reasonDifference;

  const impactDifference = compareScoresDescending(
    credibleScore(left.projectedImpact),
    credibleScore(right.projectedImpact),
  );
  if (impactDifference !== 0) return impactDifference;

  const confidenceDifference = compareScoresDescending(
    credibleScore(left.confidence, 1),
    credibleScore(right.confidence, 1),
  );
  if (confidenceDifference !== 0) return confidenceDifference;

  return left.beachId.localeCompare(right.beachId);
}

export function consolidateSwellWatchRecipients(
  candidates: readonly SwellWatchRecipientCandidate[],
): SwellWatchRecipientConsolidation[] {
  const grouped = new Map<string, SwellWatchRecipientCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.recipientUserId}:${candidate.regionalEventId}`;
    const group = grouped.get(key);
    if (group) {
      group.push(candidate);
      continue;
    }
    grouped.set(key, [candidate]);
  }

  return [...grouped.values()]
    .map((group) => {
      const lead = [...group].sort(compareRecipientCandidates)[0];
      return {
        recipientUserId: lead.recipientUserId,
        regionalEventId: lead.regionalEventId,
        leadBeachId: lead.beachId,
      };
    })
    .sort(
      (left, right) =>
        left.recipientUserId.localeCompare(right.recipientUserId) ||
        left.regionalEventId.localeCompare(right.regionalEventId),
    );
}

export function consolidateRegionalSwellEvents(
  candidates: readonly RegionalBeachCandidate[],
): RegionalSwellConsolidation[] {
  const grouped = new Map<string, RegionalSwellConsolidation>();
  for (const candidate of candidates) {
    const event = candidate.regionalEvent;
    if (event.status !== "stable" || event.regionalEventId === null) continue;
    const key = event.regionalEventId;
    const existing = grouped.get(key);
    if (existing) {
      existing.beachIds.push(candidate.beachId);
      existing.aliases.push(...(event.aliases ?? []));
      continue;
    }
    grouped.set(key, {
      regionalEventId: event.regionalEventId,
      regionKey: event.regionKey,
      beachIds: [candidate.beachId],
      status: event.status,
      aliases: [...(event.aliases ?? [])],
    });
  }
  return [...grouped.values()]
    .map((event) => ({
      ...event,
      beachIds: [...new Set(event.beachIds)].sort(),
      aliases: [...new Set(event.aliases)].sort(),
    }))
    .sort((left, right) =>
      left.regionalEventId.localeCompare(right.regionalEventId),
    );
}
