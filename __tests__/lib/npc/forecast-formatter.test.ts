import { formatWaveRange, formatWindDescription, formatTimeOfDay } from '@/lib/npc/forecast-formatter';

describe('formatWaveRange', () => {
  it('formats wave height into range', () => {
    expect(formatWaveRange(3.5)).toBe('3-4ft');
    expect(formatWaveRange(5.0)).toBe('4-6ft');
  });
});

describe('formatWindDescription', () => {
  it('describes calm conditions', () => {
    expect(formatWindDescription(2, 'NW')).toContain('glassy');
  });
});

describe('formatTimeOfDay', () => {
  it('formats early morning as dawn patrol', () => {
    const date = new Date('2026-01-13T05:30:00');
    expect(formatTimeOfDay(date)).toBe('dawn patrol');
  });
});
