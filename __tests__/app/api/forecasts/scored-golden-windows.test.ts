import { identifyGoldenWindows } from '@/app/api/forecasts/scored/[beachId]/route';

type Slots = Parameters<typeof identifyGoldenWindows>[0];

const HOUR = 3_600_000;
const BASE = Date.parse('2026-10-27T15:00:00.000Z');

function slots(hoursFromBase: number[], scores: number[]): Slots {
  return hoursFromBase.map((hour, index) => ({
    forecastAt: new Date(BASE + hour * HOUR).toISOString(),
    compositeScore: scores[index],
    rideableWavesPerHour: null,
    waveFrequencyConfidence: null,
  })) as unknown as Slots;
}

const iso = (hour: number): string => new Date(BASE + hour * HOUR).toISOString();

describe('identifyGoldenWindows slot duration', () => {
  it('keeps 3-hour slots on the 3-hourly grid, the last slot included', () => {
    expect(identifyGoldenWindows(slots([0, 3, 6, 9], [70, 65, 40, 80]))).toEqual([
      expect.objectContaining({ startTime: iso(0), endTime: iso(6), durationMinutes: 360 }),
      expect.objectContaining({ startTime: iso(9), endTime: iso(12), durationMinutes: 180 }),
    ]);
  });

  it('caps a slot before a missing row at one grid step', () => {
    expect(identifyGoldenWindows(slots([0, 6], [70, 30]))).toEqual([
      expect.objectContaining({ startTime: iso(0), endTime: iso(3), durationMinutes: 180 }),
    ]);
  });

  it('ends hourly golden windows on the hour after the last good slot, not two hours later', () => {
    expect(identifyGoldenWindows(slots([0, 1, 2, 3, 4], [70, 72, 50, 61, 66]))).toEqual([
      expect.objectContaining({ startTime: iso(0), endTime: iso(2), durationMinutes: 120, peakTime: iso(1) }),
      expect.objectContaining({ startTime: iso(3), endTime: iso(5), durationMinutes: 120 }),
    ]);
  });

  it('bridged hourly slots running into the 3-hourly grid take each slot\'s own gap', () => {
    expect(identifyGoldenWindows(slots([0, 1, 2, 3, 6], [70, 70, 70, 70, 70]))).toEqual([
      expect.objectContaining({ startTime: iso(0), endTime: iso(9), durationMinutes: 540 }),
    ]);
  });
});
