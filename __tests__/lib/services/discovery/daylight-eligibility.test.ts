import {
  isDaylightInterval,
  nextFirstLight,
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

  it('uses conservative local 6 AM to 6 PM bounds only when sun times are missing', () => {
    const dawn = localTime('2026-09-23', '05:30');
    const evening = localTime('2026-09-23', '18:00');
    expect(isDaylightInterval(dawn, new Date(dawn.getTime() + 60 * 60_000), TIMEZONE)).toBe(true);
    expect(isDaylightInterval(evening, new Date(evening.getTime() + 30 * 60_000), TIMEZONE)).toBe(false);
  });
});
