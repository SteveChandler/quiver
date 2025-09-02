import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { createIntelPost } from '@/actions/intel-actions';

// Mock Supabase service-role client
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
};

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: async () => mockSupabase,
}));

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
  });

  test('createIntelPost awards post_beach_intel XP on success', async () => {
    // Auth user
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

    // Insert intel post
    mockSupabase.insert.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'intel-123', user_id: 'user-1' }, error: null });

    // Profile fetch
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'user-1', full_name: 'Test', avatar_url: null }, error: null });

    const res = await createIntelPost({
      latitude: 32.7,
      longitude: -117.2,
      tag: 'conditions' as any,
      title: 'Great morning',
      description: 'Light offshore winds.'
    }, { trackXP });
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error('createIntelPost failed:', res);
    }
    expect(res.success).toBe(true);
    expect(trackXP).toHaveBeenCalledWith('post_beach_intel', 'intel-123', 'intel_post');
  });
});
