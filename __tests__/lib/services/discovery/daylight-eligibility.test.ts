import {
  clampToUsableLight,
  currentHourRowStart,
  isDaylightInterval,
  lightMetadata,
  lightMetadataForInterval,
  nextFirstLight,
  pointInterval,
  scopedLightInterval,
  type BeachSunTimes,
} from '@/lib/services/discovery/daylight-eligibility';

const TIMEZONE = 'America/Los_Angeles';
const SEP23_SUN: BeachSunTimes = {
  sunrises: [new Date('2026-09-23T13:37:00Z')],
  sunsets: [new Date('2026-09-24T01:44:00Z')],
};

function localTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-07:00`);
}

describe('interval daylight eligibility', () => {
  it.each(['05:40', '06:00', '06:15', '06:40'])(
    'accepts a forecast row starting at %s when it overlaps first light',
    (time) => {
      const start = localTime('2026-09-23', time);
      const end = new Date(start.getTime() + 60 * 60_000);
      expect(isDaylightInterval(start, end, TIMEZONE, SEP23_SUN)).toBe(true);
    },
  );

  it('uses sunrise minus 30 minutes for June dawn patrol', () => {
    const juneSun: BeachSunTimes = {
      sunrises: [new Date('2026-06-15T12:42:00Z')],
      sunsets: [new Date('2026-06-16T03:00:00Z')],
    };
    const start = localTime('2026-06-15', '05:15');
    expect(isDaylightInterval(start, new Date(start.getTime() + 60 * 60_000), TIMEZONE, juneSun)).toBe(true);
  });

  it('returns the next first-light time for a genuinely dark 2 AM row', () => {
    const start = localTime('2026-09-23', '02:00');
    expect(isDaylightInterval(start, new Date(start.getTime() + 60 * 60_000), TIMEZONE, SEP23_SUN)).toBe(false);
    expect(nextFirstLight(start, TIMEZONE, SEP23_SUN)).toEqual(new Date('2026-09-23T13:07:00Z'));
  });

  it('keeps the sunset-plus-20-minute edge and rejects the minute after it', () => {
    const beforeLastLight = localTime('2026-09-23', '19:00');
    const afterLastLight = localTime('2026-09-23', '19:05');
    expect(isDaylightInterval(beforeLastLight, new Date(beforeLastLight.getTime() + 30 * 60_000), TIMEZONE, SEP23_SUN)).toBe(true);
    expect(isDaylightInterval(afterLastLight, new Date(afterLastLight.getTime() + 30 * 60_000), TIMEZONE, SEP23_SUN)).toBe(false);
  });

  it('trims a window that straddles first light so it never starts in the dark', () => {
    const lit = clampToUsableLight(
      localTime('2026-09-23', '05:40'),
      localTime('2026-09-23', '07:10'),
      TIMEZONE,
      SEP23_SUN,
    );
    expect(lit).toEqual({
      start: new Date('2026-09-23T13:07:00Z'),
      end: localTime('2026-09-23', '07:10'),
    });
  });

  it('trims a window that runs past last light and leaves a fully lit window unchanged', () => {
    const lateStart = localTime('2026-09-23', '18:00');
    expect(clampToUsableLight(lateStart, localTime('2026-09-23', '20:00'), TIMEZONE, SEP23_SUN)).toEqual({
      start: lateStart,
      end: new Date('2026-09-24T02:04:00Z'),
    });
    const noonStart = localTime('2026-09-23', '12:00');
    const noonEnd = localTime('2026-09-23', '14:00');
    expect(clampToUsableLight(noonStart, noonEnd, TIMEZONE, SEP23_SUN)).toEqual({ start: noonStart, end: noonEnd });
  });

  it('returns null for a window entirely in the dark', () => {
    expect(clampToUsableLight(
      localTime('2026-09-23', '02:00'),
      localTime('2026-09-23', '04:00'),
      TIMEZONE,
      SEP23_SUN,
    )).toBeNull();
  });

  it('uses conservative local 6 AM to 6 PM bounds only when sun times are missing', () => {
    const dawn = localTime('2026-09-23', '05:30');
    const evening = localTime('2026-09-23', '18:00');
    expect(isDaylightInterval(dawn, new Date(dawn.getTime() + 60 * 60_000), TIMEZONE)).toBe(true);
    expect(isDaylightInterval(evening, new Date(evening.getTime() + 30 * 60_000), TIMEZONE)).toBe(false);
  });
});

describe('current-hour row', () => {
  const rows = ['17:00', '20:00', '23:00'].map((time) => localTime('2026-09-23', time));

  it.each([
    ['17:40', '17:00'], ['18:59', '17:00'], ['19:02', '20:00'], ['20:10', '20:00'], ['22:30', '23:00'],
  ])('maps %s to the %s row, like the app\'s hourly interpolation', (now, row) => {
    expect(currentHourRowStart(rows, localTime('2026-09-23', now))).toEqual(localTime('2026-09-23', row));
  });

  it('has no current row before the first row and keeps the last row after it', () => {
    expect(currentHourRowStart(rows, localTime('2026-09-23', '16:30'))).toBeNull();
    expect(currentHourRowStart(rows, localTime('2026-09-24', '01:15'))).toEqual(rows[2]);
  });

  it('treats the scoped row the app maps the current hour to as the current row', () => {
    const now = localTime('2026-09-23', '19:02');
    const next = { start: rows[1], end: rows[2] };
    expect(scopedLightInterval(rows[1].toISOString(), next, now, currentHourRowStart(rows, now))).toEqual(pointInterval(now));
    expect(scopedLightInterval(rows[1].toISOString(), next, now, null)).toEqual(next);
  });
});

describe('scoped light interval', () => {
  const now = localTime('2026-09-23', '20:40');
  const row = (time: string) => {
    const start = localTime('2026-09-24', time);
    return { start, end: new Date(start.getTime() + 3 * 60 * 60_000) };
  };

  it('describes an unscoped request by the request time', () => {
    expect(scopedLightInterval(undefined, null, now)).toEqual(pointInterval(now));
  });

  it('keeps the request time for the row that covers now', () => {
    const current = { start: localTime('2026-09-23', '20:00'), end: localTime('2026-09-23', '23:00') };
    expect(scopedLightInterval(current.start.toISOString(), current, now)).toEqual(pointInterval(now));
  });

  it('describes any other scoped row by its own interval', () => {
    const noon = row('12:00');
    expect(scopedLightInterval(noon.start.toISOString(), noon, now)).toEqual(noon);
  });

  it('falls back to the requested instant, never an earlier one, without a matched row', () => {
    const later = localTime('2026-09-24', '12:00');
    expect(scopedLightInterval(later.toISOString(), null, now)).toEqual(pointInterval(later));
    expect(scopedLightInterval(localTime('2026-09-23', '18:00').toISOString(), null, now)).toEqual(pointInterval(now));
    expect(scopedLightInterval('not-a-date', null, now)).toEqual(pointInterval(now));
  });
});

describe('light metadata for an interval', () => {
  const sun: BeachSunTimes = {
    sunrises: [new Date('2026-09-23T13:37:00Z'), new Date('2026-09-24T13:38:00Z')],
    sunsets: [new Date('2026-09-24T01:44:00Z'), new Date('2026-09-25T01:42:00Z')],
  };

  it('treats a dawn row that overlaps first light as light, like bulk future hours', () => {
    const start = localTime('2026-09-24', '05:00');
    const end = localTime('2026-09-24', '08:00');
    expect(lightMetadataForInterval({ start, end }, TIMEZONE, sun)).toEqual({
      firstLight: '2026-09-24T13:08:00.000Z',
      lastLight: '2026-09-25T02:02:00.000Z',
      isDark: false,
    });
  });

  it('marks a row with no usable light dark and points at the next first light', () => {
    const start = localTime('2026-09-23', '20:00');
    expect(lightMetadataForInterval({ start, end: localTime('2026-09-23', '23:00') }, TIMEZONE, sun)).toEqual({
      firstLight: '2026-09-23T13:07:00.000Z',
      lastLight: '2026-09-24T02:04:00.000Z',
      isDark: true,
      nextWindowStart: '2026-09-24T13:08:00.000Z',
    });
  });

  it('keeps the point form identical to a one-instant interval', () => {
    const at = localTime('2026-09-23', '06:00');
    expect(lightMetadata(at, TIMEZONE, sun)).toEqual(lightMetadataForInterval(pointInterval(at), TIMEZONE, sun));
    expect(lightMetadata(at, TIMEZONE, sun).isDark).toBe(true);
  });
});
