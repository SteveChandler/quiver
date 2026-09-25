import { isInSessionTime, overlapsSessionTime, parseSessionTime } from '@/lib/scoring/session-time-preference';

const at = (hour: number): Date => new Date(`2026-05-08T${String(hour).padStart(2, '0')}:30:00.000Z`);

describe('session time preference', () => {
  it('lets morning include dawn patrol but keeps dawn patrol to first light', () => {
    expect(isInSessionTime(at(5), 'UTC', 'morning')).toBe(true);
    expect(isInSessionTime(at(9), 'UTC', 'morning')).toBe(true);
    expect(isInSessionTime(at(10), 'UTC', 'morning')).toBe(false);
    expect(isInSessionTime(at(5), 'UTC', 'dawn_patrol')).toBe(true);
    expect(isInSessionTime(at(8), 'UTC', 'dawn_patrol')).toBe(false);
    expect(isInSessionTime(at(15), 'UTC', 'any')).toBe(true);
    expect(isInSessionTime(at(15), 'UTC', null)).toBe(true);
  });

  it('accepts only known preference values', () => {
    expect(parseSessionTime('morning')).toBe('morning');
    expect(parseSessionTime('brunch')).toBeNull();
    expect(parseSessionTime(null)).toBeNull();
  });

  it('matches a window that overlaps the preferred hours', () => {
    const window = (from: number, to: number): [Date, Date] => [at(from), at(to)];
    expect(overlapsSessionTime(...window(14, 19), 'UTC', 'evening')).toBe(true);
    expect(overlapsSessionTime(...window(10, 14), 'UTC', 'morning')).toBe(false);
    expect(overlapsSessionTime(...window(6, 10), 'UTC', 'dawn_patrol')).toBe(true);
    expect(overlapsSessionTime(...window(10, 14), 'UTC', 'evening')).toBe(false);
  });
});
