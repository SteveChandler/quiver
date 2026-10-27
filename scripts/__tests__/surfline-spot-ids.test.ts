import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SURFLINE_SPOT_IDS } from '../surfline-spot-ids';

// Spot identities come from the shoaling pipeline and the Windansea mapview check.
const verifiedSpots = [
  { slug: 'tourmaline-beach', id: '5842041f4e65fad6a77088c4' },
  { slug: 'blacks', id: '5842041f4e65fad6a770883b' },
  { slug: 'lower-trestles', id: '5842041f4e65fad6a770888a' },
  { slug: 'swamis', id: '5842041f4e65fad6a77088b4' },
  { slug: 'hb-pier-southside', id: '5842041f4e65fad6a77088ed' },
  { slug: 'the-wedge', id: '5842041f4e65fad6a770882b' },
  { slug: 'windansea', id: '5842041f4e65fad6a770883c' },
  { slug: 'hb-pier-northside', id: '5842041f4e65fad6a7708827' },
] as const;

describe('Surfline parity spot IDs', () => {
  it.each(verifiedSpots)('$slug resolves to its own Surfline spot', ({ slug, id }) => {
    expect(SURFLINE_SPOT_IDS[slug]).toBe(id);
  });

  it('never assigns the Pacific Beach spot to Blacks', () => {
    expect(SURFLINE_SPOT_IDS.blacks).not.toBe('5842041f4e65fad6a7708841');
  });

  it('maps every advisory regression fixture to a Surfline spot', () => {
    const fixturePath = resolve(process.cwd(), 'scripts/__fixtures__/shoaling-regression-fixtures.json');
    const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as { gates: { E: string[] } };
    expect(fixtures.gates.E).toHaveLength(6);
    for (const slug of fixtures.gates.E) {
      expect(SURFLINE_SPOT_IDS).toHaveProperty(slug);
    }
  });
});
