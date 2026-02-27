import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  addFavoriteBeach,
  removeFavoriteBeach,
  getFavoriteBeaches,
  enableFavoriteAlerts,
} from '@/actions/beach/beach-favorite-actions';

jest.mock('@/lib/supabase/server');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const mockCreate = createSupabaseServerClient as jest.Mock;

function makeSupabaseFake(options: {
  existingFavoriteId?: string | null;
  ranks?: number[];
  insertShouldFail?: boolean;
  deleteShouldFail?: boolean;
  updateShouldFail?: boolean;
  authUserId?: string;
  favoritesRows?: any[];
}) {
  const insertCalls: any[] = [];
  const upsertCalls: Array<{ payload: any; options: any }> = [];
  const deleteEqCalls: Array<{ col: string; val: any }> = [];
  const updateCalls: Array<{ payload: any; eqCalls: Array<{ col: string; val: any }> }> = [];
  const selectIdChain = {
    eq: jest.fn((col1: string, _val1: any) => ({
      eq: jest.fn((_col2: string, _val2: any) => ({
        maybeSingle: jest.fn(async () => ({
          data: options.existingFavoriteId ? { id: options.existingFavoriteId } : null,
          error: null,
        })),
      })),
    })),
  };
  const selectRankChain = {
    eq: jest.fn((_col: string, _val: any) =>
      Promise.resolve({ data: (options.ranks || []).map((rank) => ({ rank })), error: null })
    ),
  };
  const selectFavoritesChain = {
    eq: jest.fn((_col: string, _val: any) => ({
      order: jest.fn((_by: string, _opts?: any) => ({
        order: jest.fn((_by2: string, _opts2?: any) =>
          Promise.resolve({ data: options.favoritesRows || [], error: null })
        ),
      })),
    })),
  };

  const from = jest.fn((table: string) => {
    if (table !== 'favorite_beaches') throw new Error('Unexpected table: ' + table);
    return {
      select: jest.fn((cols: string) => {
        if (cols.includes('beaches')) return selectFavoritesChain;
        if (cols.includes('rank')) return selectRankChain;
        return selectIdChain; // 'id' check
      }),
      insert: jest.fn((payload: any) => {
        insertCalls.push(payload);
        return Promise.resolve({ error: options.insertShouldFail ? new Error('insert fail') : null });
      }),
      upsert: jest.fn((payload: any, upsertOptions: any) => {
        upsertCalls.push({ payload, options: upsertOptions });
        return Promise.resolve({ error: options.insertShouldFail ? new Error('upsert fail') : null });
      }),
      delete: jest.fn(() => ({
        eq: jest.fn((col: string, val: any) => {
          deleteEqCalls.push({ col, val });
          return {
            eq: jest.fn((col2: string, val2: any) => {
              deleteEqCalls.push({ col: col2, val: val2 });
              return Promise.resolve({ error: options.deleteShouldFail ? new Error('delete fail') : null });
            }),
          };
        }),
      })),
      update: jest.fn((payload: any) => {
        const eqCalls: Array<{ col: string; val: any }> = [];
        updateCalls.push({ payload, eqCalls });
        return {
          eq: jest.fn((col: string, val: any) => {
            eqCalls.push({ col, val });
            return {
              eq: jest.fn((col2: string, val2: any) => {
                eqCalls.push({ col: col2, val: val2 });
                return Promise.resolve({ error: options.updateShouldFail ? new Error('update fail') : null });
              }),
            };
          }),
        };
      }),
    } as any;
  });

  const supabase = {
    from,
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: options.authUserId ? ({ id: options.authUserId } as any) : null }, error: null })
      ),
    },
  } as any;

  return { supabase, insertCalls, upsertCalls, deleteEqCalls, updateCalls, from };
}

describe('beach-favorite-actions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('addFavoriteBeach inserts with next rank when not existing', async () => {
    const { supabase, insertCalls, from } = makeSupabaseFake({ existingFavoriteId: null, ranks: [1, 3], authUserId: 'u1' });
    mockCreate.mockResolvedValue(supabase);

    const res = await addFavoriteBeach('u1', 'b1');
    expect(res.success).toBe(true);
    // nextRank should be max(1,3)+1 = 4
    expect(insertCalls[0]).toEqual({ user_id: 'u1', beach_id: 'b1', rank: 4 });
    expect(from).toHaveBeenCalledWith('favorite_beaches');
  });

  it('addFavoriteBeach no-op if already exists', async () => {
    const { supabase, insertCalls } = makeSupabaseFake({ existingFavoriteId: 'fav-1', ranks: [1], authUserId: 'u1' });
    mockCreate.mockResolvedValue(supabase);

    const res = await addFavoriteBeach('u1', 'b1');
    expect(res.success).toBe(true);
    expect(insertCalls.length).toBe(0);
  });

  it('removeFavoriteBeach deletes by user and beach id', async () => {
    const { supabase, deleteEqCalls } = makeSupabaseFake({ authUserId: 'u1' });
    mockCreate.mockResolvedValue(supabase);

    const res = await removeFavoriteBeach('u1', 'b2');
    expect(res.success).toBe(true);
    // Two filter eq calls: user_id and beach_id
    expect(deleteEqCalls).toEqual([
      { col: 'user_id', val: 'u1' },
      { col: 'beach_id', val: 'b2' },
    ]);
  });

  it('getFavoriteBeaches enforces requester matches target user', async () => {
    const { supabase } = makeSupabaseFake({ authUserId: 'auth-id' });
    mockCreate.mockResolvedValue(supabase);

    const res = await getFavoriteBeaches('other-id');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unauthorized/i);
  });

  it('getFavoriteBeaches returns beaches array ordered', async () => {
    const beach1 = { id: 'b1', name: 'A' };
    const beach2 = { id: 'b2', name: 'B' };
    const { supabase } = makeSupabaseFake({
      authUserId: 'u1',
      favoritesRows: [
        { id: 'fav2', rank: 2, beach_id: 'b2', beaches: beach2 },
        { id: 'fav1', rank: 1, beach_id: 'b1', beaches: beach1 },
      ],
    });
    mockCreate.mockResolvedValue(supabase);

    const res = await getFavoriteBeaches('u1');
    expect(res.success).toBe(true);
    expect(res.data).toEqual([beach2, beach1]);
  });

  describe('enableFavoriteAlerts', () => {
    it('upserts favorite with alerts_enabled when beach is not yet favorited', async () => {
      const { supabase, upsertCalls, updateCalls } = makeSupabaseFake({
        authUserId: 'u1',
        existingFavoriteId: null,
        ranks: [2],
      });
      mockCreate.mockResolvedValue(supabase);

      const res = await enableFavoriteAlerts('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4');

      expect(res.success).toBe(true);
      expect(res.data).toMatchObject({ alerts_enabled: true, was_already_favorited: false });

      // Should have used upsert (atomic, handles race conditions)
      expect(upsertCalls).toHaveLength(1);
      expect(upsertCalls[0].payload).toMatchObject({
        user_id: 'u1',
        beach_id: 'a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4',
        rank: 3,
        alerts_enabled: true,
      });
      expect(upsertCalls[0].options).toEqual({ onConflict: 'user_id,beach_id' });

      // Should NOT have called update separately (upsert handles it)
      expect(updateCalls).toHaveLength(0);
    });

    it('skips upsert and only updates alerts when beach is already favorited', async () => {
      const { supabase, upsertCalls, updateCalls } = makeSupabaseFake({
        authUserId: 'u1',
        existingFavoriteId: 'fav-42',
        ranks: [1],
      });
      mockCreate.mockResolvedValue(supabase);

      const res = await enableFavoriteAlerts('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4');

      expect(res.success).toBe(true);
      expect(res.data).toMatchObject({ alerts_enabled: true, was_already_favorited: true });

      // No upsert should have happened
      expect(upsertCalls).toHaveLength(0);

      // Should update alerts_enabled = true
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].payload).toEqual({ alerts_enabled: true });
    });

    it('is idempotent when alerts are already enabled (returns success)', async () => {
      const { supabase, updateCalls } = makeSupabaseFake({
        authUserId: 'u1',
        existingFavoriteId: 'fav-99',
      });
      mockCreate.mockResolvedValue(supabase);

      const res = await enableFavoriteAlerts('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4');

      expect(res.success).toBe(true);
      expect(res.data).toMatchObject({ alerts_enabled: true });
      expect(updateCalls).toHaveLength(1);
    });

    it('returns success: false with error message when update fails', async () => {
      const { supabase } = makeSupabaseFake({
        authUserId: 'u1',
        existingFavoriteId: 'fav-1',
        updateShouldFail: true,
      });
      mockCreate.mockResolvedValue(supabase);

      const res = await enableFavoriteAlerts('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4');

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(typeof res.error).toBe('string');
    });

    it('returns success: false with error message when upsert fails', async () => {
      const { supabase } = makeSupabaseFake({
        authUserId: 'u1',
        existingFavoriteId: null,
        ranks: [],
        insertShouldFail: true,
      });
      mockCreate.mockResolvedValue(supabase);

      const res = await enableFavoriteAlerts('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4');

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('returns success: false when user is not authenticated', async () => {
      const { supabase } = makeSupabaseFake({ authUserId: undefined });
      mockCreate.mockResolvedValue(supabase);

      const res = await enableFavoriteAlerts('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4');

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not authenticated/i);
    });

    it('rejects invalid (non-UUID) beachId', async () => {
      const { supabase } = makeSupabaseFake({ authUserId: 'u1' });
      mockCreate.mockResolvedValue(supabase);

      const res = await enableFavoriteAlerts('not-a-uuid');

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid beach id/i);
    });
  });
});
