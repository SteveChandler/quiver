import { breakTypeFamilies, breakTypesMatch } from '@/lib/scoring/break-family';

it.each([
  ['beach', ['beach']],
  ['Beach ', ['beach']],
  ['beach/reef break', ['beach', 'reef']],
  ['reef/point', ['reef', 'point']],
  ['jetty/beach', ['beach']],
  ['pier', ['beach']],
  ['jetty', ['beach']],
  ['breakwater', ['beach']],
  ['inlet', ['beach']],
  ['river-mouth', ['beach']],
  ['reef', ['reef']],
  ['point', ['point']],
  ['slab', ['slab']],
  ['', null],
  [null, null],
] as const)('resolves %s to families %j', (raw, families) => {
  expect(breakTypeFamilies(raw)).toEqual(families);
});

it.each([
  ['beach', 'beach/reef break', true],
  ['beach', 'reef', false],
  [null, 'reef', true],
  ['jetty', 'beach', true],
  ['point', 'reef/point', true],
] as const)('matches %s against %s: %s', (a, b, match) => {
  expect(breakTypesMatch(a, b)).toBe(match);
});
