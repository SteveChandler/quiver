import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  removeFavoriteBeach,
  reorderFavoriteBeaches,
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
  orderedRows?: Array<{ beach_id: string | null; custom_spot_id: string | null; rank: number | null }>;
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
      Promise.resolve({ data: options.orderedRows ?? (options.ranks || []).map((rank) => ({ rank })), error: null })
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

  it('reorders curated beaches using only their existing rank slots', async () => {
    const { supabase, updateCalls } = makeSupabaseFake({
      authUserId: 'u1',
      orderedRows: [
        { beach_id: 'b1', custom_spot_id: null, rank: 1 },
        { beach_id: null, custom_spot_id: 's1', rank: 2 },
        { beach_id: 'b2', custom_spot_id: null, rank: 3 },
        { beach_id: null, custom_spot_id: 's2', rank: 4 },
        { beach_id: 'b3', custom_spot_id: null, rank: 5 },
      ],
    });
    mockCreate.mockResolvedValue(supabase);

    const res = await reorderFavoriteBeaches(['b3', 'b1', 'b2']);

    expect(res.success).toBe(true);
    expect(updateCalls).toEqual([
      { payload: { rank: 1 }, eqCalls: [{ col: 'user_id', val: 'u1' }, { col: 'beach_id', val: 'b3' }] },
      { payload: { rank: 3 }, eqCalls: [{ col: 'user_id', val: 'u1' }, { col: 'beach_id', val: 'b1' }] },
      { payload: { rank: 5 }, eqCalls: [{ col: 'user_id', val: 'u1' }, { col: 'beach_id', val: 'b2' }] },
    ]);
  });

  it('rejects omitted curated ids without writing ranks', async () => {
    const { supabase, updateCalls } = makeSupabaseFake({
      authUserId: 'u1',
      orderedRows: [
        { beach_id: 'b1', custom_spot_id: null, rank: 1 },
        { beach_id: null, custom_spot_id: 's1', rank: 2 },
        { beach_id: 'b2', custom_spot_id: null, rank: 3 },
      ],
    });
    mockCreate.mockResolvedValue(supabase);

    const res = await reorderFavoriteBeaches(['b1']);

    expect(res.success).toBe(false);
    expect(updateCalls).toHaveLength(0);
  });

  it('does not write when an existing curated rank collides with a custom spot', async () => {
    const { supabase, updateCalls } = makeSupabaseFake({
      authUserId: 'u1',
      orderedRows: [
        { beach_id: 'b1', custom_spot_id: null, rank: 1 },
        { beach_id: null, custom_spot_id: 's1', rank: 2 },
        { beach_id: 'b2', custom_spot_id: null, rank: 2 },
      ],
    });
    mockCreate.mockResolvedValue(supabase);

    const res = await reorderFavoriteBeaches(['b2', 'b1']);

    expect(res.success).toBe(false);
    expect(updateCalls).toHaveLength(0);
  });

});
