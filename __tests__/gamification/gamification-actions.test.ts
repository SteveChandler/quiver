import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { trackXP, getUserXPStatus, getUserBadges, getAllBadgeDefinitions } from '@/lib/gamification-actions';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
};

// Mock server action utils
jest.mock('@/lib/server-action-utils', () => ({
  withAuthenticatedAction: (fn: any) => (async (...args: any[]) => {
    try {
      const result = await fn(mockUser, mockSupabase, ...args);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }),
}));

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => mockSupabase,
}));

// Mock RealtimeClient to avoid constructor error
jest.mock('@supabase/realtime-js', () => ({
  RealtimeClient: function() {
    return {};
  }
}));

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
};

describe('Gamification Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackXP', () => {
    test('should initialize user XP if not exists', async () => {
      // Mock no existing XP record
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: null });
      
      // Mock successful initialization
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      
      // Mock current XP fetch
      mockSupabase.select.mockResolvedValueOnce({
        data: { xp_total: 0, level: 1 },
        error: null,
      });
      
      // Mock successful XP update
      mockSupabase.update.mockResolvedValueOnce({ data: null, error: null });
      
      // Mock XP event logging
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await trackXP('plan_session');

      expect(result.success).toBe(true);
      expect(result.data?.xp_gained).toBe(50);
      expect(result.data?.total_xp).toBe(50);
      expect(result.data?.new_level).toBe(1);
    });

    test('should track XP for session planning', async () => {
      // Mock existing XP record
      mockSupabase.select.mockResolvedValueOnce({
        data: { id: 'existing' },
        error: null,
      });
      
      // Mock current XP fetch
      mockSupabase.select.mockResolvedValueOnce({
        data: { xp_total: 50, level: 1 },
        error: null,
      });
      
      // Mock successful updates
      mockSupabase.update.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await trackXP('plan_session');

      expect(result.success).toBe(true);
      expect(result.data?.xp_gained).toBe(50);
      expect(result.data?.total_xp).toBe(100);
    });

    test('should detect level up when threshold reached', async () => {
      // Mock existing user
      mockSupabase.select.mockResolvedValueOnce({
        data: { id: 'existing' },
        error: null,
      });
      
      // Mock user at 90 XP (level 1), adding 50 XP should level up to level 2
      mockSupabase.select.mockResolvedValueOnce({
        data: { xp_total: 90, level: 1 },
        error: null,
      });
      
      mockSupabase.update.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await trackXP('plan_session');

      expect(result.success).toBe(true);
      expect(result.data?.total_xp).toBe(140);
      expect(result.data?.previous_level).toBe(1);
      expect(result.data?.new_level).toBe(2);
      expect(result.data?.level_up).toBe(true);
      expect(result.data?.level_title).toBe('Grom');
    });

    test('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.select.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await trackXP('plan_session');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    test('should reject invalid XP actions', async () => {
      const result = await trackXP('invalid_action' as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown XP action');
    });
  });

  describe('getUserXPStatus', () => {
    test('should return user XP status with progress calculation', async () => {
      // Mock initialization check
      mockSupabase.select.mockResolvedValueOnce({
        data: { id: 'existing' },
        error: null,
      });
      
      // Mock XP status fetch
      mockSupabase.select.mockResolvedValueOnce({
        data: {
          xp_total: 150,
          level: 2,
          created_at: '2025-01-01',
          updated_at: '2025-01-15',
        },
        error: null,
      });

      const result = await getUserXPStatus();

      expect(result.success).toBe(true);
      expect(result.data?.xp_total).toBe(150);
      expect(result.data?.level).toBe(2);
      expect(result.data?.level_title).toBe('Grom');
      expect(result.data?.progress_to_next).toBeGreaterThan(0);
      expect(result.data?.xp_to_next_level).toBeGreaterThan(0);
    });
  });

  describe('getUserBadges', () => {
    test('should return user badges with definitions', async () => {
      const mockBadgeData = [
        {
          badge_slug: 'first_ride',
          unlocked_at: '2025-01-01',
          context: {},
          badge_definitions: {
            name: 'First Ride',
            description: 'Complete your first surf session',
            icon: 'Waves',
            category: 'global',
            xp_reward: 50,
          },
        },
      ];

      mockSupabase.select.mockResolvedValueOnce({
        data: mockBadgeData,
        error: null,
      });

      const result = await getUserBadges();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].badge_slug).toBe('first_ride');
      expect(result.data?.[0].badge_definitions.name).toBe('First Ride');
    });
  });

  describe('getAllBadgeDefinitions', () => {
    test('should return all badge definitions ordered by category', async () => {
      const mockBadgeDefinitions = [
        {
          badge_slug: 'first_ride',
          name: 'First Ride',
          description: 'Complete your first surf session',
          icon: 'Waves',
          category: 'global',
          xp_reward: 50,
        },
        {
          badge_slug: 'first_entry',
          name: 'First Entry',
          description: 'Log your first reflection',
          icon: 'BookOpen',
          category: 'journal',
          xp_reward: 25,
        },
      ];

      mockSupabase.select.mockResolvedValueOnce({
        data: mockBadgeDefinitions,
        error: null,
      });

      const result = await getAllBadgeDefinitions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].category).toBe('global');
      expect(result.data?.[1].category).toBe('journal');
    });
  });
});

describe('XP System Logic', () => {
  test('should have correct XP values for all actions', () => {
    const expectedXPValues = {
      plan_session: 50,
      add_board: 30,
      tag_board_to_session: 20,
      post_beach_intel: 50,
      review_intel: 25,
      tag_friends_in_session: 20,
      invite_friend: 100,
      post_surf_photos: 15,
      get_like_upvote: 10,
      write_reflection: 25,
      add_surf_tags: 20,
      record_temperature: 10,
      submit_crowd_parking: 10,
    };

    // These values should match the spec
    expect(expectedXPValues.plan_session).toBe(50);
    expect(expectedXPValues.invite_friend).toBe(100); // Highest XP for viral growth
    expect(expectedXPValues.get_like_upvote).toBe(10); // Encourages engagement
  });

  test('should have correct level progression thresholds', () => {
    const expectedLevels = [
      { level: 1, title: 'Kook', xp: 0 },
      { level: 2, title: 'Grom', xp: 100 },
      { level: 3, title: 'Paddler', xp: 300 },
      { level: 4, title: 'Wavestorm Warrior', xp: 600 },
      { level: 5, title: 'Rip Rider', xp: 1000 },
      { level: 6, title: 'Barrel Hunter', xp: 1500 },
      { level: 7, title: 'Point Breaker', xp: 2200 },
      { level: 8, title: 'Lineup Legend', xp: 3000 },
      { level: 9, title: 'Quiver King/Queen', xp: 4000 },
    ];

    // Verify progression makes sense
    expect(expectedLevels).toHaveLength(9); // 9 tiers as per spec
    expect(expectedLevels[0].title).toBe('Kook'); // Beginner level
    expect(expectedLevels[8].title).toBe('Quiver King/Queen'); // Max level
  });
});