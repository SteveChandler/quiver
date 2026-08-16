import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  createSuccessResponse,
  handleApiError,
  withRateLimit,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import { getVerifiedProfileExperience } from "@/lib/profile/skill-level";
import {
  buildCoachPicksMajorEventHoldCandidates,
  sanitizeCoachPicksForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/legacy";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import {
  buildCanonicalSessionDecision,
  resolveCanonicalSessionDecision,
  type CanonicalSessionDecision,
} from "@/lib/recommendations/canonical-decision";
import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";
import { rankBeaches } from "@/lib/recommendations/selection";

export const dynamic = "force-dynamic";




function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectCoachPicks(
  picks: readonly unknown[],
  sessionDecision: CanonicalSessionDecision,
): unknown[] {
  const selectedBeachId = sessionDecision.selection?.beachId;
  if (sessionDecision.verdict === "no" || !selectedBeachId) return [];

  const selected = picks.find(
    (pick) => isRecord(pick) && pick.beach_id === selectedBeachId,
  );
  if (!isRecord(selected)) return [];
  const {
    score: _score,
    conditions_score: _conditionsScore,
    confidence: _confidence,
    recommendation: _recommendation,
    ...physicalAndIdentity
  } = selected;
  return [{ ...physicalAndIdentity, pick_rank: 1 }];
}

function noCoachDecision(args: {
  anchor: Date;
  profileExperience: unknown;
  recommendationAvailability: RecommendationAvailability;
}): CanonicalSessionDecision {
  const anchorTime = args.anchor.toISOString();
  return buildCanonicalSessionDecision({
    anchorTime,
    scope: {
      kind: "plan_next_session",
      windowStart: anchorTime,
      windowEnd: new Date(
        args.anchor.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
      timezone: "UTC",
    },
    profileExperience: args.profileExperience,
    recommendationAvailability: args.recommendationAvailability,
    candidates: [],
  });
}

async function coachPicksHandler(request: NextRequest) {
  try {
    const requestAsOf = new Date();
    const { searchParams } = new URL(request.url);
    const beachId = searchParams.get("beachId");
    const radiusKm = Number(searchParams.get("radiusKm") || 80);
    const supabase = await createAPIServerClient();
    const { userId, profileExperience } =
      await getVerifiedProfileExperience(supabase);
    if (!beachId) {
      const decisions = await evaluateMajorEventHoldCandidates({
        candidates: [null],
        profileExperience,
        asOf: requestAsOf,
        applyWaterQualityHolds: true,
      });
      const heldResponse = sanitizeCoachPicksForMajorEventHold(
        { picks: [] },
        [null],
        decisions,
      );
      return createSuccessResponse({
        ...heldResponse,
        sessionDecision: noCoachDecision({
          anchor: requestAsOf,
          profileExperience,
          recommendationAvailability: heldResponse.recommendationAvailability,
        }),
      });
    }

    const { data, error } = await supabase.rpc("get_coach_picks", {
      _beach_id: beachId,
      _radius_km: radiusKm,
    });
    if (error) throw error;

    const rawPicks = Array.isArray(data) ? data : [];
    const rankedPicks = await rankBeaches(
      rawPicks.flatMap((pick, index) => (
        isRecord(pick) && typeof pick.beach_id === "string"
          ? [{ id: pick.beach_id, pick, index }]
          : []
      )),
      {
        compare: (left, right) => {
          const leftScore = typeof left.pick.score === "number"
            ? left.pick.score
            : typeof left.pick.conditions_score === "number"
              ? left.pick.conditions_score
              : 0;
          const rightScore = typeof right.pick.score === "number"
            ? right.pick.score
            : typeof right.pick.conditions_score === "number"
              ? right.pick.conditions_score
              : 0;
          return rightScore - leftScore || left.index - right.index;
        },
        asOf: requestAsOf,
      },
    );
    const picks = rankedPicks.map(({ pick }) => pick);
    const candidates = buildCoachPicksMajorEventHoldCandidates(
      picks,
      requestAsOf,
    );
    const decisions = await evaluateMajorEventHoldCandidates({
      candidates,
      profileExperience,
      asOf: requestAsOf,
      applyWaterQualityHolds: true,
    });
    const heldResponse = sanitizeCoachPicksForMajorEventHold(
      { picks },
      candidates,
      decisions,
    );
    const allowedBeachIds = heldResponse.picks.flatMap((pick) => (
      isRecord(pick) && typeof pick.beach_id === "string"
        ? [pick.beach_id]
        : []
    ));
    const anchorTime = requestAsOf.toISOString();
    const sessionDecision = userId && allowedBeachIds.length > 0
      ? await resolveCanonicalSessionDecision({
          userId,
          profileExperience,
          anchorTime,
          scope: {
            kind: "plan_next_session",
            windowStart: anchorTime,
            windowEnd: new Date(
              requestAsOf.getTime() + 24 * 60 * 60 * 1000,
            ).toISOString(),
            timezone: "UTC",
          },
          discoveryOptions: {
            horizonHours: 24,
            includeBeachIds: allowedBeachIds,
          },
        })
      : noCoachDecision({
          anchor: requestAsOf,
          profileExperience,
          recommendationAvailability: heldResponse.recommendationAvailability,
        });

    return createSuccessResponse({
      ...heldResponse,
      picks: projectCoachPicks(heldResponse.picks, sessionDecision),
      sessionDecision,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Keep the legacy surface rate-limited while applying the hold at the boundary.
export const GET = withNoStore(withRateLimit(coachPicksHandler, "coach-picks"));
