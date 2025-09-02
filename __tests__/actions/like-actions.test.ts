import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Isolated Supabase + cache + XP mocks
jest.mock('@/lib/supabase/server', () => {
  const client = {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  } as any;
  return {
    createSupabaseServerClient: jest.fn(() => Promise.resolve(client)),
    __client: client,
  };
});

jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));
jest.mock('@/lib/gamification-actions', () => ({ creditAuthorWithXP: jest.fn(() => Promise.resolve({ success: true })) }));

const { toggleSessionLike, getSessionLikeStatus } = require('@/actions/like-actions');
const supabaseModule = require('@/lib/supabase/server');
const supa = supabaseModule.__client as any;

function makeSelectEqEqMaybeSingle(result: any) {
  const chain: any = { maybeSingle: jest.fn(() => Promise.resolve(result)) };
  chain.eq = jest.fn(() => chain);
  return { select: jest.fn(() => chain) } as any;
}

function makeSelectEqEqSingle(result: any) {
  const chain: any = { single: jest.fn(() => Promise.resolve(result)) };
  chain.eq = jest.fn(() => chain);
  return { select: jest.fn(() => chain) } as any;
}

describe('actions/like-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  });

  it('likes a session when not already liked', async () => {
    // Check existing like: none
    supa.from.mockImplementationOnce(() => makeSelectEqEqMaybeSingle({ data: null, error: null }));
    // Insert like
    supa.from.mockImplementationOnce(() => ({ insert: jest.fn(() => Promise.resolve({ error: null })) }));
    // Fetch session author
    supa.from.mockImplementationOnce(() => makeSelectEqEqSingle({ data: { user_id: 'author-1' }, error: null }));

    const res = await toggleSessionLike('session-1');
    expect(res.success).toBe(true);
    expect(res.liked).toBe(true);
  });

  it('unlikes a session when already liked', async () => {
    // Existing like
    supa.from.mockImplementationOnce(() => makeSelectEqEqMaybeSingle({ data: { id: 'like-1' }, error: null }));
    // Delete like
    supa.from.mockImplementationOnce(() => ({ delete: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })) }));

    const res = await toggleSessionLike('session-2');
    expect(res.success).toBe(true);
    expect(res.liked).toBe(false);
  });

  it('reports like status and total count', async () => {
    // user like present
    supa.from.mockImplementationOnce(() => makeSelectEqEqMaybeSingle({ data: { id: 'like-9' }, error: null }));
    // likes count
    supa.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ count: 3, error: null })),
      })),
    }));

    const res = await getSessionLikeStatus('session-3');
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.log('getSessionLikeStatus debug', res);
    }
    expect(res.success).toBe(true);
    expect(res.liked).toBe(true);
    expect(res.likesCount).toBe(3);
  });

  it('requires auth', async () => {
    supa.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await toggleSessionLike('session-4');
    expect(res.success).toBe(false);
    expect(String(res.error || '')).toMatch(/Authentication/);
  });
});
