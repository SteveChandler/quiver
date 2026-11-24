import {
  SAND_BEACH_SIZE_CAPS_FT,
  sandBeachSizeCapFt,
} from '@/lib/data/sand-beach-size-caps';
import { closeoutSizeEffect } from '@/lib/domains/scoring/closeout-size';
import { ScoringEngine } from '@/lib/domains/scoring';
import { canonicalCandidateVerdict } from '@/lib/recommendations/canonical-decision/engine';
import { createInput, createMockScorer } from '../__fixtures__';

const MISSION_BEACH = 'c02b4ede-69d9-440e-b8de-22ea4bde10ef';
const AVALANCHE = '63af8c07-1aed-44bd-b03b-9b20abdff56c';
const BOLSA_CHICA = 'dd21a212-1f15-5b34-8749-8d54c44f3b25';
const THE_WEDGE = 'c2c7cc01-4920-4fd9-941c-68df6b46ced0';
const BLACKS_BEACH = '01330afc-00d3-461b-88f3-b173774766f4';
const UNKNOWN_BEACH = '00000000-0000-0000-0000-000000000000';

describe('sand beach size caps', () => {
  it('holds the researched caps: 116 capped beaches, exempt beaches left out', () => {
    const caps = Object.values(SAND_BEACH_SIZE_CAPS_FT);
    const counts = caps.reduce<Record<number, number>>((acc, cap) => {
      acc[cap] = (acc[cap] ?? 0) + 1;
      return acc;
    }, {});
    expect(caps).toHaveLength(113);
    // No cap is below the 6 ft floor: a wrong low cap would hide normal days.
    expect(Math.min(...caps)).toBe(6);
    expect(counts[8]).toBe(40);
    expect(sandBeachSizeCapFt(BLACKS_BEACH)).toBeNull();
  });

  it('returns the cap for a listed beach and null otherwise', () => {
    expect(sandBeachSizeCapFt(MISSION_BEACH)).toBe(7);
    expect(sandBeachSizeCapFt(AVALANCHE)).toBe(8);
    expect(sandBeachSizeCapFt(BOLSA_CHICA)).toBe(6);
    expect(sandBeachSizeCapFt(THE_WEDGE)).toBeNull();
    expect(sandBeachSizeCapFt(UNKNOWN_BEACH)).toBeNull();
    expect(sandBeachSizeCapFt(undefined)).toBeNull();
    expect(sandBeachSizeCapFt('toString')).toBeNull();
  });
});

describe('closeoutSizeEffect', () => {
  it('fires only above the cap', () => {
    expect(closeoutSizeEffect(AVALANCHE, 8.1)).toEqual({
      code: 'closeout_size',
      severity: 'severe',
      verdictCeiling: 39,
      message: 'Likely closing out at this size',
    });
    expect(closeoutSizeEffect(AVALANCHE, 8)).toBeNull();
    expect(closeoutSizeEffect(BOLSA_CHICA, 6.1)).not.toBeNull();
    expect(closeoutSizeEffect(THE_WEDGE, 12)).toBeNull();
  });

  it('never fires for exempt, unknown or missing input', () => {
    expect(closeoutSizeEffect(BLACKS_BEACH, 12)).toBeNull();
    expect(closeoutSizeEffect(UNKNOWN_BEACH, 12)).toBeNull();
    expect(closeoutSizeEffect(undefined, 12)).toBeNull();
    expect(closeoutSizeEffect(MISSION_BEACH, null)).toBeNull();
    expect(closeoutSizeEffect(MISSION_BEACH, Number.NaN)).toBeNull();
  });
});

describe('ScoringEngine closeout size rule', () => {
  function score(beachId: string, waveHeight: number) {
    const engine = new ScoringEngine()
      .register(createMockScorer('a', 80, 0.5))
      .register(createMockScorer('b', 80, 0.5));
    return engine.score(createInput({ waveHeight }, { id: beachId }));
  }

  it('leads the reasons with the closeout line and its height above the cap only', () => {
    const over = score(MISSION_BEACH, 8.6);
    expect(over.reasons[0]).toBe('Likely closing out at 8–9 ft.');
    expect(over.reasonCodes?.[0]).toBe('caution_size_over');
    expect(score(MISSION_BEACH, 6.5).reasons.join(' ')).not.toMatch(/closing out/);
    expect(score(BLACKS_BEACH, 9.8).reasons.join(' ')).not.toMatch(/closing out/);
  });

  function verdict(effects: ReturnType<typeof score>['effects']) {
    return canonicalCandidateVerdict(
      {
        candidateId: 'c',
        beachId: MISSION_BEACH,
        beachName: 'Mission Beach',
        beachSkillLevel: 'intermediate',
        windowStart: '2026-11-26T15:00:00.000Z',
        windowEnd: '2026-11-26T18:00:00.000Z',
        timezone: 'America/Los_Angeles',
        forecastId: 'f',
        forecastAt: '2026-11-26T15:00:00.000Z',
        waveHeight: '8-9 ft',
        utilityScore: 80,
        recommendationLabel: 'Worth it',
        effects,
      } as unknown as Parameters<typeof canonicalCandidateVerdict>[0],
      'advanced',
    );
  }

  it('caps a capped sand beach above its cap and turns the verdict to "no"', () => {
    const result = score(AVALANCHE, 8.1);
    expect(result.effects).toContainEqual(
      expect.objectContaining({ code: 'closeout_size', verdictCeiling: 39 }),
    );
    expect(result.total).toBeLessThanOrEqual(39);
    expect(result.matchQuality).toBe('skip');
    expect(result.warnings).toContain('Likely closing out at this size');
    expect(verdict(result.effects)).toBe('no');
  });

  it('leaves the beach alone at exactly the cap', () => {
    const result = score(AVALANCHE, 8);
    expect((result.effects ?? []).map((effect) => effect.code)).not.toContain('closeout_size');
    expect(result.total).toBe(80);
    expect(verdict(result.effects)).toBe('go');
  });

  it('leaves exempt and unknown beaches alone at 12 ft', () => {
    for (const id of [BLACKS_BEACH, UNKNOWN_BEACH]) {
      const result = score(id, 12);
      expect((result.effects ?? []).map((effect) => effect.code)).not.toContain('closeout_size');
      expect(result.total).toBe(80);
    }
  });
});
