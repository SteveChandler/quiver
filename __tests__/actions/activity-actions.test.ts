import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib/supabase/server', () => {
  const client = {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  } as any;
  return {
    createSupabaseServerClient: jest.fn(() => Promise.resolve(client)),
    __client: client,
  };
});

const { getUserActivityFeed, getUserActivities, getGlobalActivityFeed } = require('@/actions/activity-actions');
const supabaseModule = require('@/lib/supabase/server');
const supa = supabaseModule.__client as any;

describe('actions/activity-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  });

  it('returns user activity feed via RPC', async () => {
    const items = [{ id: 'a1', user_id: 'u1', activity_type: 'like', entity_type: 'session', entity_id: 's1', metadata: {}, created_at: '2024-01-01' }];
    supa.rpc.mockResolvedValue({ data: items, error: null });

    const res = await getUserActivityFeed('u1', 10, 0);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0].id).toBe('a1');
  });

  it('lists user activities with profiles join mapping', async () => {
    supa.from.mockImplementation((table: string) => {
      if (table === 'user_activities') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          order: jest.fn(() => chain),
          range: jest.fn(() => chain),
          in: jest.fn(() => chain),
          then: (onResolve: any) => Promise.resolve(onResolve({ data: [
            { id: 'a2', user_id: 'u1', activity_type: 'post', entity_type: 'intel_post', entity_id: 'ip1', metadata: {}, created_at: '2024-01-01', profiles: { full_name: 'Test', avatar_url: null } }
          ], error: null })),
        };
        return chain;
      }
      return {} as any;
    });

    const res = await getUserActivities('u1', ['post'], 5, 0);
    if (!res.success) {
       
      console.log('getUserActivities debug', res);
    }
    expect(res.success).toBe(true);
    expect(res.data?.[0].user_name).toBe('Test');
  });

  it('lists global activity feed', async () => {
    supa.from.mockImplementation((table: string) => {
      if (table === 'user_activities') {
        const chain: any = {
          select: jest.fn(() => chain),
          order: jest.fn(() => chain),
          range: jest.fn(() => Promise.resolve({ data: [], error: null })),
        };
        return chain;
      }
      return {} as any;
    });

    const res = await getGlobalActivityFeed(5, 0);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });
});
