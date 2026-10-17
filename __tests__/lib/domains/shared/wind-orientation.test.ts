import {
  DEFAULT_WIND_OFFSHORE_TOL_DEG,
  resolveOffshoreDeg,
  resolveOffshoreToleranceDeg,
  resolveWindOrientation,
} from '@/lib/domains/shared/wind-orientation';

describe('resolveWindOrientation', () => {
  it('uses the stored offshore bearing and tolerance when present', () => {
    expect(
      resolveWindOrientation({ wind_offshore_deg: 68, wind_offshore_tol_deg: 40, aspect_deg: 270 }),
    ).toEqual({ offshoreDeg: 68, toleranceDeg: 40 });
  });

  it('keeps a stored 0 (north) offshore bearing', () => {
    expect(resolveOffshoreDeg({ wind_offshore_deg: 0, aspect_deg: 180 })).toBe(0);
  });

  it('derives offshore from the facing direction when no offshore is stored', () => {
    // East-facing Atlantic beach: offshore blows from the west.
    expect(resolveOffshoreDeg({ wind_offshore_deg: null, aspect_deg: 90 })).toBe(270);
    // West-facing California beach: offshore blows from the east.
    expect(resolveOffshoreDeg({ wind_offshore_deg: null, aspect_deg: 270 })).toBe(90);
  });

  it('wraps the derived bearing into 0-360', () => {
    expect(resolveOffshoreDeg({ aspect_deg: 350 })).toBe(170);
    expect(resolveOffshoreDeg({ aspect_deg: 180 })).toBe(0);
    expect(resolveOffshoreDeg({ wind_offshore_deg: 370 })).toBe(10);
    expect(resolveOffshoreDeg({ wind_offshore_deg: -20 })).toBe(340);
  });

  it('returns unknown, never east, for a beach with no orientation data', () => {
    expect(resolveOffshoreDeg({ wind_offshore_deg: null, aspect_deg: null })).toBeNull();
    expect(resolveOffshoreDeg({})).toBeNull();
    expect(resolveOffshoreDeg(null)).toBeNull();
    expect(resolveOffshoreDeg({ wind_offshore_deg: Number.NaN, aspect_deg: Number.NaN })).toBeNull();
  });

  it('defaults tolerance to 30 degrees, matching native and the column default', () => {
    expect(DEFAULT_WIND_OFFSHORE_TOL_DEG).toBe(30);
    expect(resolveOffshoreToleranceDeg({ wind_offshore_tol_deg: null })).toBe(30);
    expect(resolveOffshoreToleranceDeg(undefined)).toBe(30);
    expect(resolveOffshoreToleranceDeg({ wind_offshore_tol_deg: 0 })).toBe(0);
  });
});
