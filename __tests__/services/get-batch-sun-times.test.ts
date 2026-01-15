// __tests__/services/get-batch-sun-times.test.ts
import { getBatchSunTimes } from '@/lib/services/surf-discovery-service';

// Mock Supabase with proper .in().in().order() chain
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          in: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: [
                { beach_id: 'beach-1', sunset_utc: '2026-01-13T01:05:00Z' },
                { beach_id: 'beach-2', sunset_utc: '2026-01-13T01:10:00Z' },
              ],
              error: null,
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe('getBatchSunTimes', () => {
  it('returns Map keyed by beachId with array of sunset Date values', async () => {
    const result = await getBatchSunTimes(['beach-1', 'beach-2'], ['2026-01-13']);

    // Function returns Map<string, Date[]> keyed by beachId
    expect(result.size).toBe(2);
    expect(result.get('beach-1')).toBeDefined();
    expect(result.get('beach-2')).toBeDefined();
    expect(result.get('beach-1')?.[0]).toBeInstanceOf(Date);
    expect(result.get('beach-2')?.[0]).toBeInstanceOf(Date);
  });

  it('deduplicates inputs', async () => {
    const result = await getBatchSunTimes(
      ['beach-1', 'beach-1', 'beach-2'],
      ['2026-01-13', '2026-01-13']
    );

    // Two unique beaches
    expect(result.size).toBe(2);
  });
});
