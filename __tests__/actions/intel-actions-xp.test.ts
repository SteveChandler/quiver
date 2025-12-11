import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// Mock Supabase service-role client
const mockSupabase = {
  auth: {
    getUser: jest.fn<any>(),
  },
  from: jest.fn<any>().mockReturnThis(),
  insert: jest.fn<any>().mockReturnThis(),
  select: jest.fn<any>().mockReturnThis(),
  single: jest.fn<any>(),
  eq: jest.fn<any>().mockReturnThis(),
  gte: jest.fn<any>().mockReturnThis(),
  order: jest.fn<any>().mockReturnThis(),
  limit: jest.fn<any>(),
  update: jest.fn<any>().mockReturnThis(),
  rpc: jest.fn<any>(),
};

let createIntelPost: typeof import('@/actions/intel-actions')['createIntelPost'];

beforeAll(async () => {
  ({ createIntelPost } = await import('@/actions/intel-actions'));
});

// Local DI trackXP mock
const trackXP = jest.fn(async () => ({ success: true }));

// Avoid realtime client constructor errors
jest.mock('@supabase/realtime-js', () => ({
  RealtimeClient: function() { return {}; }
}));

// Mock next/cache used by action for revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Intel Actions XP Wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.limit.mockResolvedValue({ data: [], error: null });
  });

  test('createIntelPost awards post_beach_intel XP on success', async () => {
    // Auth user
    // Insert intel post
    mockSupabase.insert.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'intel-123', user_id: 'user-1', beach_id: 'beach-123' }, error: null });

    // Profile fetch
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'user-1', full_name: 'Test', avatar_url: null }, error: null });

    const res = await createIntelPost({
      lat: 32.7,
      lon: -117.2,
      tag: 'conditions' as any,
      title: 'Great morning',
      description: 'Light offshore winds.',
      beach_id: 'beach-123',
    }, {
      trackXP,
      authWrapper: async (fn: any) => fn({ id: 'user-1' }, mockSupabase),
    });
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error('createIntelPost failed:', res);
    }
    expect(res.success).toBe(true);
    expect(trackXP).toHaveBeenCalledWith('post_beach_intel', 'intel-123', 'intel_post');
  });
});
