import type {
  ConditionBadge,
  SimilarityRecommendation,
  SurfDiscoveryBoardPick,
} from '@/types/personalization';
import type { RecommendationV2SourceState } from '@/lib/services/discovery/recommendations-v2';

export interface RecommendationEvidenceInput {
  sourceState: RecommendationV2SourceState;
  similarity?: SimilarityRecommendation;
  personalExplanation?: string | null;
  reasons?: string[];
  summary?: string | null;
  conditionBadges?: ConditionBadge[];
  conditionPositiveSessionCount?: number;
  boardPick?: SurfDiscoveryBoardPick | null;
  boardLinkedPositiveCount?: number;
}

export interface RecommendationEvidence {
  reasonType: string;
  proofSummary: string;
  evidenceFacts: Array<Record<string, unknown>>;
}

function positiveCount(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

function baseFacts(sourceState: RecommendationV2SourceState): Array<Record<string, unknown>> {
  return [{ type: 'source_state', value: sourceState }];
}

export function buildRecommendationEvidence(
  input: RecommendationEvidenceInput,
): RecommendationEvidence {
  if (input.sourceState === 'starter_fit') {
    return {
      reasonType: 'starter_preferences',
      proofSummary: "Starter fit based on your preferences and today's conditions.",
      evidenceFacts: [
        ...baseFacts(input.sourceState),
        {
          type: 'starter_profile',
          session_count: input.similarity?.state === 'onboarding'
            ? input.similarity.sessionCount
            : 0,
          sessions_needed: input.similarity?.state === 'onboarding'
            ? input.similarity.sessionsNeeded
            : null,
        },
      ],
    };
  }

  if (input.sourceState === 'avoidance_learning') {
    return {
      reasonType: 'avoidance_learning',
      proofSummary: 'Learning from what you avoid. Rate this one after you surf.',
      evidenceFacts: baseFacts(input.sourceState),
    };
  }

  if (input.sourceState === 'low_confidence') {
    return {
      reasonType: 'low_confidence',
      proofSummary: 'Tentative match while Quiver learns your reliable patterns.',
      evidenceFacts: baseFacts(input.sourceState),
    };
  }

  if (input.sourceState === 'degraded') {
    return {
      reasonType: 'degraded',
      proofSummary: 'Tentative call because fresh forecast data is degraded.',
      evidenceFacts: baseFacts(input.sourceState),
    };
  }

  if (input.similarity?.state === 'ready' && input.similarity.sessionCount > 0) {
    return {
      reasonType: 'session_history',
      proofSummary:
        input.personalExplanation ??
        input.similarity.reason ??
        'Similar to your better-rated sessions.',
      evidenceFacts: [
        ...baseFacts(input.sourceState),
        {
          type: 'past_session',
          positive_session_count: input.similarity.sessionCount,
          score_band: Math.round(input.similarity.score),
        },
      ],
    };
  }

  const conditionPositiveSessionCount = positiveCount(input.conditionPositiveSessionCount);
  const primaryBadge = input.conditionBadges?.[0]?.label;
  if (conditionPositiveSessionCount >= 3 && primaryBadge) {
    return {
      reasonType: 'condition_pattern',
      proofSummary: `${primaryBadge} has shown up in your better sessions.`,
      evidenceFacts: [
        ...baseFacts(input.sourceState),
        {
          type: 'condition_pattern',
          positive_session_count: conditionPositiveSessionCount,
          labels: input.conditionBadges?.slice(0, 2).map((badge) => badge.label) ?? [],
        },
      ],
    };
  }

  const boardLinkedPositiveCount = positiveCount(input.boardLinkedPositiveCount);
  if (boardLinkedPositiveCount >= 2 && input.boardPick?.reason) {
    return {
      reasonType: 'board_fit',
      proofSummary: `Board fit: ${input.boardPick.reason}`,
      evidenceFacts: [
        ...baseFacts(input.sourceState),
        {
          type: 'board_fit',
          board_name: input.boardPick.boardName ?? null,
          board_type: input.boardPick.boardType ?? null,
          board_linked_positive_count: boardLinkedPositiveCount,
        },
      ],
    };
  }

  return {
    reasonType: 'current_conditions',
    proofSummary:
      input.personalExplanation ??
      input.reasons?.[0] ??
      input.summary ??
      'This window lines up with the current surf setup.',
    evidenceFacts: baseFacts(input.sourceState),
  };
}
