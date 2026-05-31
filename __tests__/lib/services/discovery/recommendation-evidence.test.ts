import {
  buildRecommendationEvidence,
  type RecommendationEvidenceInput,
} from '@/lib/services/discovery/recommendation-evidence';

function input(overrides: Partial<RecommendationEvidenceInput> = {}): RecommendationEvidenceInput {
  return {
    sourceState: 'learned',
    reasons: ['Clean wind lines up with your better sessions.'],
    summary: 'Good morning window.',
    ...overrides,
  };
}

describe('buildRecommendationEvidence', () => {
  it('prefers supported past-session proof when available', () => {
    const evidence = buildRecommendationEvidence(input({
      similarity: {
        state: 'ready',
        score: 8.2,
        label: 'GOOD',
        bonusApplied: 12,
        reason: 'Similar to your 4-star HB Pier session in May.',
        sessionCount: 6,
      },
    }));

    expect(evidence.reasonType).toBe('session_history');
    expect(evidence.proofSummary).toBe('Similar to your 4-star HB Pier session in May.');
    expect(evidence.evidenceFacts).toContainEqual(
      expect.objectContaining({ type: 'past_session', positive_session_count: 6 }),
    );
  });

  it('does not emit condition-pattern proof below 3 positive sessions', () => {
    const evidence = buildRecommendationEvidence(input({
      conditionPositiveSessionCount: 2,
      conditionBadges: [{ label: 'Clean wind', contribution: 10 }],
    }));

    expect(evidence.reasonType).not.toBe('condition_pattern');
    expect(evidence.evidenceFacts).not.toContainEqual(
      expect.objectContaining({ type: 'condition_pattern' }),
    );
  });

  it('emits condition-pattern proof with at least 3 positive sessions', () => {
    const evidence = buildRecommendationEvidence(input({
      conditionPositiveSessionCount: 3,
      conditionBadges: [{ label: 'Clean wind', contribution: 10 }],
    }));

    expect(evidence.reasonType).toBe('condition_pattern');
    expect(evidence.proofSummary).toBe('Clean wind has shown up in your better sessions.');
  });

  it('does not emit board proof below 2 board-linked positive sessions', () => {
    const evidence = buildRecommendationEvidence(input({
      boardLinkedPositiveCount: 1,
      boardPick: { boardName: 'Twin Pin', boardType: 'fish', reason: 'Friendly board fit.' },
    }));

    expect(evidence.reasonType).not.toBe('board_fit');
    expect(evidence.evidenceFacts).not.toContainEqual(
      expect.objectContaining({ type: 'board_fit' }),
    );
  });

  it('emits board proof with at least 2 board-linked positive sessions', () => {
    const evidence = buildRecommendationEvidence(input({
      boardLinkedPositiveCount: 2,
      boardPick: { boardName: 'Twin Pin', boardType: 'fish', reason: 'Friendly board fit.' },
    }));

    expect(evidence.reasonType).toBe('board_fit');
    expect(evidence.proofSummary).toBe('Board fit: Friendly board fit.');
  });

  it('returns honest weak-profile copy', () => {
    expect(buildRecommendationEvidence(input({ sourceState: 'avoidance_learning' })).proofSummary)
      .toBe('Learning from what you avoid. Rate this one after you surf.');
    expect(buildRecommendationEvidence(input({ sourceState: 'starter_fit' })).reasonType)
      .toBe('starter_preferences');
    expect(buildRecommendationEvidence(input({ sourceState: 'degraded' })).proofSummary)
      .toMatch(/fresh forecast data is degraded/i);
  });
});
