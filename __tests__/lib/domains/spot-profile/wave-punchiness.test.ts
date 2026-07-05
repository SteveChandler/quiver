import { deriveWavePunchiness } from '@/lib/domains/spot-profile/wave-punchiness';

describe('deriveWavePunchiness', () => {
  it('derives canyon-amplified expert waves near the punchy end', () => {
    expect(
      deriveWavePunchiness({
        persona: 'canyon_amplified',
        skill_level: 'expert',
      })
    ).toBe(1);
  });

  it('derives beginner point breaks near the soft end', () => {
    expect(
      deriveWavePunchiness({
        persona: 'point_break',
        skill_level: 'beginner',
      })
    ).toBeCloseTo(-0.7);
  });

  it('derives expert reefs as punchy', () => {
    expect(
      deriveWavePunchiness({
        break_type: 'reef',
        skill_level: 'expert',
      })
    ).toBeCloseTo(0.7);
  });

  it('derives beginner beach breaks as soft', () => {
    expect(
      deriveWavePunchiness({
        break_type: 'beach',
        skill_level: 'beginner',
      })
    ).toBeCloseTo(-0.3);
  });

  it('supports legacy two-word break type values', () => {
    expect(deriveWavePunchiness({ break_type: 'point break' })).toBeCloseTo(
      -0.3
    );
  });

  it('covers the full hyphenated break_type vocabulary', () => {
    // Actual beaches.break_type values — must not fall through to null.
    expect(deriveWavePunchiness({ break_type: 'river-mouth' })).toBeCloseTo(0.2);
    expect(deriveWavePunchiness({ break_type: 'jetty' })).toBeCloseTo(0.1);
    expect(deriveWavePunchiness({ break_type: 'pier' })).toBeCloseTo(0);
    expect(deriveWavePunchiness({ break_type: 'breakwater' })).toBeCloseTo(-0.1);
    expect(deriveWavePunchiness({ break_type: 'inlet' })).toBeCloseTo(0.1);
  });

  it('returns null when no structural signal exists', () => {
    expect(deriveWavePunchiness({})).toBeNull();
  });

  it('lets persona beat break_type', () => {
    expect(
      deriveWavePunchiness({
        persona: 'canyon_amplified',
        break_type: 'beach',
      })
    ).toBeCloseTo(0.6);
  });

  it('clamps derived values to the unit interval', () => {
    expect(
      deriveWavePunchiness({
        persona: 'canyon_amplified',
        skill_level: 'expert',
      })
    ).toBeLessThanOrEqual(1);
  });
});
