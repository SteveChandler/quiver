// __tests__/services/get-batch-sun-times.test.ts
import { getBatchSunTimes } from '@/lib/services/surf-discovery-service';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({
            data: [
              { beach_id: 'beach-1', date: '2026-01-13', sunset_utc: '2026-01-13T01:05:00Z' },
              { beach_id: 'beach-2', date: '2026-01-13', sunset_utc: '2026-01-13T01:10:00Z' },
            ],
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('getBatchSunTimes', () => {
  it('returns Map keyed by beachId_date with sunset Date values', async () => {
    const result = await getBatchSunTimes(['beach-1', 'beach-2'], ['2026-01-13']);

    expect(result.size).toBe(2);
    expect(result.get('beach-1_2026-01-13')).toBeInstanceOf(Date);
    expect(result.get('beach-2_2026-01-13')).toBeInstanceOf(Date);
  });

  it('deduplicates inputs', async () => {
    const result = await getBatchSunTimes(
      ['beach-1', 'beach-1', 'beach-2'],
      ['2026-01-13', '2026-01-13']
    );

    expect(result.size).toBe(2);
  });
});
