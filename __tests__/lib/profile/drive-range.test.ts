import {
  DEFAULT_DRIVE_MINUTES,
  driveRadiusMiles,
  MAX_DRIVE_RADIUS_MILES,
  NO_LIMIT_DRIVE_MINUTES,
} from '@/lib/profile/drive-range';

describe('driveRadiusMiles', () => {
  it.each([null, undefined, Number.NaN, Infinity, -Infinity, 0, -5])(
    'defaults a never-set or invalid drive range (%p) to 30 miles',
    (minutes) => {
      expect(driveRadiusMiles(minutes)).toBe(30);
    },
  );

  it('exports the default and explicit No limit preferences', () => {
    expect(DEFAULT_DRIVE_MINUTES).toBe(60);
    expect(NO_LIMIT_DRIVE_MINUTES).toBe(200);
    expect(driveRadiusMiles(NO_LIMIT_DRIVE_MINUTES)).toBe(MAX_DRIVE_RADIUS_MILES);
  });

  it('converts drive minutes at half a mile per minute', () => {
    expect(driveRadiusMiles(15)).toBe(7.5);
    expect(driveRadiusMiles(30)).toBe(15);
    expect(driveRadiusMiles(60)).toBe(30);
    expect(driveRadiusMiles(90)).toBe(45);
  });

  it.each([200, 500])('caps %i drive minutes at 100 miles', (minutes) => {
    expect(driveRadiusMiles(minutes)).toBe(100);
  });
});
