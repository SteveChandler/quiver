import { driveRadiusMiles, MAX_DRIVE_RADIUS_MILES } from '@/lib/profile/drive-range';

describe('driveRadiusMiles', () => {
  it('treats an unset drive range ("No limit") as the 100-mile maximum', () => {
    expect(MAX_DRIVE_RADIUS_MILES).toBe(100);
    expect(driveRadiusMiles(null)).toBe(100);
    expect(driveRadiusMiles(undefined)).toBe(100);
    expect(driveRadiusMiles(Number.NaN)).toBe(100);
  });

  it('converts drive minutes at half a mile per minute', () => {
    expect(driveRadiusMiles(15)).toBe(7.5);
    expect(driveRadiusMiles(60)).toBe(30);
    expect(driveRadiusMiles(90)).toBe(45);
  });

  it('caps at 100 miles and floors at zero', () => {
    expect(driveRadiusMiles(400)).toBe(100);
    expect(driveRadiusMiles(-10)).toBe(0);
  });
});
