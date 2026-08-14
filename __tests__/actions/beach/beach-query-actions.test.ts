/**
 * Tests for beach-query-actions.ts
 *
 * Covers:
 * - getBeachesByIntentAndCity: hyphenated city names, space-separated cities, intent filters
 * - getBeachesByState: returns all beaches without skill filtering
 * - applyIntentFilters: skill-based vs non-skill intents
 */

import { createPublicReadClient } from '@/lib/supabase/server';
import {
  getBeachesByIntentAndCity,
  getBeachesByIntentAndState,
  getBeachesByState,
} from '@/actions/beach/beach-query-actions';
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) => beaches);

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/recommendations/major-event-hold/water-quality-visibility', () => ({
  filterBeachesByWaterQualityVisibility: jest.fn(async (beaches: Array<{ id: string }>) => beaches),
}));
jest.mock('@/lib/recommendations/selection', () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));
const mockCreate = createPublicReadClient as jest.Mock;

/**
 * Creates a mock Supabase client that tracks query builder method calls
 * and returns the specified data from the final awaited query.
 *
 * The supabase client itself is NOT thenable (so `createPublicReadClient()`
 * returns synchronously), but the query result (returned by terminal methods like .order())
 * is a thenable that resolves to { data, error }.
 */
function makeMockSupabase(data: any[] = [], error: any = null) {
  const orCalls: string[] = [];
  const eqCalls: [string, any][] = [];
  const orderCalls: string[] = [];
  let limitVal: number | undefined;

  // A thenable result object (returned by terminal .order()/.limit() calls)
  const thenableResult = {
    then: (resolve: any) => resolve ? resolve({ data, error }) : Promise.resolve({ data, error }),
  };

  const inCalls: [string, any[]][] = [];

  // The query builder chains all methods; .order() and .limit() return the thenable result
  const queryBuilder: any = {};
  queryBuilder.select = jest.fn(() => queryBuilder);
  queryBuilder.or = jest.fn((condition: string) => { orCalls.push(condition); return queryBuilder; });
  queryBuilder.eq = jest.fn((col: string, val: any) => { eqCalls.push([col, val]); return queryBuilder; });
  queryBuilder.in = jest.fn((col: string, vals: any[]) => { inCalls.push([col, vals]); return queryBuilder; });
  queryBuilder.order = jest.fn((col: string) => { orderCalls.push(col); return queryBuilder; });
  queryBuilder.limit = jest.fn((val: number) => { limitVal = val; return queryBuilder; });
  queryBuilder.is = jest.fn(() => queryBuilder);
  queryBuilder.not = jest.fn(() => queryBuilder);
  // Make the query builder itself thenable as a fallback
  queryBuilder.then = (resolve: any) => resolve ? resolve({ data, error }) : Promise.resolve({ data, error });

  // The supabase client: only has .from() method, no .then
  const supabase: any = {
    from: jest.fn(() => queryBuilder),
  };

  // Track calls on a results object for test assertions
  const tracker = {
    _orCalls: orCalls,
    _eqCalls: eqCalls,
    _inCalls: inCalls,
    _orderCalls: orderCalls,
    get _limitVal() { return limitVal; },
    queryBuilder,
    supabase,
  };

  mockCreate.mockReturnValue(supabase);
  return tracker;
}

describe('beach-query-actions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('removes held beaches from intent and regional beach lists', async () => {
    mockRankBeaches.mockImplementation(async (beaches: Array<{ id: string }>) =>
      beaches.filter(({ id }) => id !== 'held-beach'),
    );

    makeMockSupabase([
      { id: 'held-beach', name: 'Held Beach', city: 'San Diego', state: 'CA' },
      { id: 'safe-beach', name: 'Safe Beach', city: 'San Diego', state: 'CA' },
    ]);
    const cityResult = await getBeachesByIntentAndCity('tide', 'san-diego', 'ca');
    expect(cityResult.data?.map((beach) => beach.id)).toEqual(['safe-beach']);

    makeMockSupabase([
      { id: 'held-beach', name: 'Held Beach', city: 'San Diego', state: 'CA' },
      { id: 'safe-beach', name: 'Safe Beach', city: 'San Diego', state: 'CA' },
    ]);
    const stateResult = await getBeachesByIntentAndState('tide', 'ca');
    expect(stateResult.data?.map((beach) => beach.id)).toEqual(['safe-beach']);
    expect(mockRankBeaches).toHaveBeenCalled();
  });

  describe('getBeachesByIntentAndCity', () => {
    it('should match hyphenated city names (e.g., Carmel-by-the-Sea)', async () => {
      const mockBeaches = [
        { id: '1', name: 'Carmel Beach', city: 'Carmel-by-the-Sea', state: 'CA', skill_level: null },
      ];
      const qb = makeMockSupabase(mockBeaches);

      const result = await getBeachesByIntentAndCity('tide', 'carmel-by-the-sea', 'ca');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Carmel Beach');

      // Verify .or() was called with both the hyphenated and space-replaced patterns
      const cityOrCall = qb._orCalls.find((c: string) => c.includes('city.ilike'));
      expect(cityOrCall).toBeDefined();
      expect(cityOrCall).toContain('carmel-by-the-sea');
      expect(cityOrCall).toContain('carmel by the sea');
    });

    it('should match space-separated cities (e.g., San Diego)', async () => {
      const mockBeaches = [
        { id: '1', name: 'Blacks Beach', city: 'San Diego', state: 'CA', skill_level: 'advanced' },
      ];
      const qb = makeMockSupabase(mockBeaches);

      const result = await getBeachesByIntentAndCity('tide', 'san-diego', 'ca');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      const cityOrCall = qb._orCalls.find((c: string) => c.includes('city.ilike'));
      expect(cityOrCall).toContain('san-diego');
      expect(cityOrCall).toContain('san diego');
    });

    it('should apply skill filters for beginner intent', async () => {
      const mockBeaches = [
        { id: '1', name: 'Easy Beach', city: 'San Diego', state: 'CA', skill_level: 'beginner' },
      ];
      const qb = makeMockSupabase(mockBeaches);

      const result = await getBeachesByIntentAndCity('beginner', 'san-diego', 'ca');
      expect(result.success).toBe(true);

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeDefined();
      expect(skillOrCall).toContain('beginner');
      expect(skillOrCall).toContain('longboard');
    });

    it('should apply skill filters for longboard intent', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('longboard', 'san-diego', 'ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeDefined();
      expect(skillOrCall).toContain('longboard');
      expect(skillOrCall).toContain('beginner');
    });

    it('should apply skill filters for advanced intent', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('advanced', 'san-diego', 'ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeDefined();
      expect(skillOrCall).toContain('advanced');
      expect(skillOrCall).toContain('expert');
    });

    it('should NOT apply skill filters for non-skill intents (tide)', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('tide', 'san-diego', 'ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeUndefined();
    });

    it('should NOT apply skill filters for water-temp intent', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('water-temp', 'san-diego', 'ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeUndefined();
    });

    it('should NOT apply skill filters for least-crowded intent', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('least-crowded', 'san-diego', 'ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeUndefined();
    });

    it('should NOT apply skill filters for dawn-patrol intent', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('dawn-patrol', 'san-diego', 'ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeUndefined();
    });

    it('should NOT apply skill filters for sunset intent', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('sunset', 'san-diego', 'ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeUndefined();
    });

    it('should apply crowd_level filter for least-crowded intent', async () => {
      const mockBeaches = [
        { id: '2', name: 'Empty Beach', city: 'San Diego', state: 'CA', crowd_level: 'light' },
        { id: '3', name: 'Chill Beach', city: 'San Diego', state: 'CA', crowd_level: 'moderate' },
      ];
      const qb = makeMockSupabase(mockBeaches);

      const result = await getBeachesByIntentAndCity('least-crowded', 'san-diego', 'ca');
      expect(result.success).toBe(true);

      // Should call .or() with case-insensitive crowd_level filter
      const crowdOrCall = qb._orCalls.find((c: string) => c.includes('crowd_level'));
      expect(crowdOrCall).toBeDefined();
      expect(crowdOrCall).toBe('crowd_level.ilike.light,crowd_level.ilike.moderate');
    });

    it('should convert state slug to uppercase for query', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('tide', 'san-diego', 'ca');

      const stateEq = qb._eqCalls.find(([col]: [string, any]) => col === 'state');
      expect(stateEq).toBeDefined();
      expect(stateEq![1]).toBe('CA');
    });

    it('should handle database errors gracefully', async () => {
      makeMockSupabase([], { message: 'Connection failed' });

      const result = await getBeachesByIntentAndCity('tide', 'san-diego', 'ca');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return empty array when no beaches match', async () => {
      makeMockSupabase([]);

      const result = await getBeachesByIntentAndCity('beginner', 'some-city', 'ca');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should escape LIKE special characters in city slug', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('tide', 'test%city', 'ca');

      const cityOrCall = qb._orCalls.find((c: string) => c.includes('city.ilike'));
      expect(cityOrCall).toBeDefined();
      // The % should be escaped in the ILIKE pattern
      expect(cityOrCall).toContain('test\\%city');
    });

    it('should chain multiple .or() calls for beginner intent (AND semantics)', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('beginner', 'san-diego', 'ca');

      // Should have 3 .or() calls:
      // 1. is_private filter
      // 2. city matching
      // 3. skill_level filter (for beginner)
      expect(qb._orCalls).toHaveLength(3);
      expect(qb._orCalls[0]).toContain('is_private');
      expect(qb._orCalls[1]).toContain('city.ilike');
      expect(qb._orCalls[2]).toContain('skill_level');
    });

    it('should chain 2 .or() calls for non-skill intents (no skill filter)', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByIntentAndCity('tide', 'san-diego', 'ca');

      // 2 .or() calls: is_private + city matching (no skill filter)
      expect(qb._orCalls).toHaveLength(2);
      expect(qb._orCalls[0]).toContain('is_private');
      expect(qb._orCalls[1]).toContain('city.ilike');
    });
  });

  describe('getBeachesByState', () => {
    it('should return all beaches in a state without skill filtering', async () => {
      const mockBeaches = [
        { id: '1', name: 'Beach A', city: 'City A', state: 'CA', skill_level: 'beginner' },
        { id: '2', name: 'Beach B', city: 'City B', state: 'CA', skill_level: 'advanced' },
        { id: '3', name: 'Beach C', city: 'City A', state: 'CA', skill_level: null },
      ];
      makeMockSupabase(mockBeaches);

      const result = await getBeachesByState('ca');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });

    it('should NOT apply skill_level filters', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByState('ca');

      const skillOrCall = qb._orCalls.find((c: string) => c.includes('skill_level'));
      expect(skillOrCall).toBeUndefined();
    });

    it('should convert state slug to uppercase', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByState('ca');

      const stateEq = qb._eqCalls.find(([col]: [string, any]) => col === 'state');
      expect(stateEq).toBeDefined();
      expect(stateEq![1]).toBe('CA');
    });

    it('should order by city then name', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByState('hi');

      expect(qb._orderCalls).toContain('city');
      expect(qb._orderCalls).toContain('name');
    });

    it('should not apply a limit (CA has 157+ beaches)', async () => {
      const qb = makeMockSupabase([]);

      await getBeachesByState('ca');

      expect(qb._limitVal).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      makeMockSupabase([], { message: 'Query failed' });

      const result = await getBeachesByState('ca');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
