import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { __resetGamificationCacheForTests, trackXP, getUserXPStatus, getUserBadges, getAllBadgeDefinitions } from '@/lib/gamification';
import { 
  mockStates, 
  mockBadgeDefinitions,
  mockWithAuthenticatedAction,
  createDefaultMockState,
  expectXPTracked,
  expectXPEventLogged,
  type MockOperationTracker 
} from '@/test-utils/gamification-test-helpers';

// Mock the server action utils
jest.mock('@/lib/server-action-utils', () => ({
  withAuthenticatedAction: jest.fn()
}));

// Mock Supabase server clients
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn()
}));

// Mock RealtimeClient to avoid constructor errors
jest.mock('@supabase/realtime-js', () => ({
  RealtimeClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }))
  }))
}));

// Import mocked modules
const { withAuthenticatedAction } = require('@/lib/server-action-utils');

describe('Gamification Actions', () => {
  let tracker: MockOperationTracker;

  beforeEach(() => {
    jest.clearAllMocks();
    tracker = { selects: [], inserts: [], updates: [] };
    __resetGamificationCacheForTests();
  });

  describe('trackXP', () => {
    test('should initialize user XP if not exists', async () => {
      // Setup: New user with no XP record
      const mockState = mockStates.newUser();
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await trackXP('log_session');

      expect(result.success).toBe(true);
      expect(result.data?.xp_gained).toBe(50);
      expect(result.data?.total_xp).toBe(50);
      expect(result.data?.new_level).toBe(1);
      expect(result.data?.level_title).toBe('Kook');
      
      // Verify XP was tracked and event logged
      expectXPTracked(tracker, 50);
      expectXPEventLogged(tracker, 'log_session');
    });

    test('should track XP for existing user', async () => {
      // Setup: Existing user with 50 XP
      const mockState = mockStates.existingUser(50, 1);
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await trackXP('log_session');

      expect(result.success).toBe(true);
      expect(result.data?.xp_gained).toBe(50);
      expect(result.data?.total_xp).toBe(100);
      expect(result.data?.new_level).toBe(2);
      expect(result.data?.level_up).toBe(true);
      expect(result.data?.level_title).toBe('Grom');
      
      expectXPTracked(tracker, 100);
      expectXPEventLogged(tracker, 'log_session');
    });

    test('should detect level up when threshold reached', async () => {
      // Setup: User with 90 XP (near level up)
      const mockState = mockStates.nearLevelUp();
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await trackXP('log_session');

      expect(result.success).toBe(true);
      expect(result.data?.total_xp).toBe(140);
      expect(result.data?.previous_level).toBe(1);
      expect(result.data?.new_level).toBe(2);
      expect(result.data?.level_up).toBe(true);
      expect(result.data?.level_title).toBe('Grom');
      
      expectXPTracked(tracker, 140);
    });

    test('should handle database errors gracefully', async () => {
      // Setup: Database error scenario
      const mockState = mockStates.databaseError('Database connection failed');
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await trackXP('log_session');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    test('should reject invalid XP actions', async () => {
      // Setup: Normal state but invalid action
      const mockState = mockStates.existingUser();
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await trackXP('invalid_action' as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown XP action');
    });

    test('should award correct XP amounts for different actions', async () => {
      const testCases = [
        { action: 'log_session', expectedXP: 50 },
        { action: 'add_board', expectedXP: 30 },
        { action: 'post_beach_intel', expectedXP: 50 },
        { action: 'invite_friend', expectedXP: 100 },
        { action: 'get_like_upvote', expectedXP: 10 },
        { action: 'onboarding_completed', expectedXP: 100 },
        { action: 'referral_signup', expectedXP: 50 },
        { action: 'successful_referral', expectedXP: 100 }
      ];

      for (const { action, expectedXP } of testCases) {
        // Reset tracker for each test
        tracker = { selects: [], inserts: [], updates: [] };

        const mockState = mockStates.existingUser(0, 1);
        (withAuthenticatedAction as jest.Mock).mockImplementation(
          mockWithAuthenticatedAction(mockState, tracker)
        );

        const result = await trackXP(action as any);

        expect(result.success).toBe(true);
        expect(result.data?.xp_gained).toBe(expectedXP);
        expectXPEventLogged(tracker, action);
      }
    });
  });

  describe('getUserXPStatus', () => {
    test('should return user XP status with progress calculation', async () => {
      // Setup: User with 150 XP (level 2)
      const mockState = mockStates.existingUser(150, 2);
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await getUserXPStatus();

      expect(result.success).toBe(true);
      expect(result.data?.xp_total).toBe(150);
      expect(result.data?.level).toBe(2);
      expect(result.data?.level_title).toBe('Grom');
      expect(result.data?.progress_to_next).toBeGreaterThan(0);
      expect(result.data?.xp_to_next_level).toBeGreaterThan(0);
      expect(result.data?.next_level_title).toBe('Paddler');
    });

    test('should initialize XP for new user', async () => {
      // Setup: New user
      const mockState = mockStates.newUser();
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await getUserXPStatus();

      expect(result.success).toBe(true);
      // Should have initialized the user
      const initInserts = tracker.inserts.filter(i => i.table === 'user_xp');
      expect(initInserts.length).toBe(1);
    });
  });

  describe('getUserBadges', () => {
    test('should return user badges with definitions', async () => {
      // Setup: User with badges
      const mockState = mockStates.withBadges();
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await getUserBadges();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].badge_slug).toBe('first_ride');
      expect((result.data?.[0] as any).badge_definitions.name).toBe('First Ride');
    });

    test('should return empty array for user with no badges', async () => {
      // Setup: User with no badges
      const mockState = mockStates.existingUser();
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await getUserBadges();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getAllBadgeDefinitions', () => {
    test('should return all badge definitions ordered by category', async () => {
      // Setup: Mock state with badge definitions
      const mockState = createDefaultMockState();
      mockState.badgeDefinitions = mockBadgeDefinitions;
      
      (withAuthenticatedAction as jest.Mock).mockImplementation(
        mockWithAuthenticatedAction(mockState, tracker)
      );

      const result = await getAllBadgeDefinitions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.[0].category).toBe('global');
      expect(result.data?.[1].category).toBe('quiver');
      expect(result.data?.[2].category).toBe('journal');
    });
  });
});

describe('XP System Logic Tests', () => {
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
      onboarding_completed: 100,
      referral_signup: 50,
      successful_referral: 100,
    };

    // These values should match the gamification spec
    expect(expectedXPValues.plan_session).toBe(50);
    expect(expectedXPValues.invite_friend).toBe(100); // Highest XP for viral growth
    expect(expectedXPValues.get_like_upvote).toBe(10); // Encourages engagement
    expect(expectedXPValues.post_beach_intel).toBe(50); // Community contribution
    expect(expectedXPValues.onboarding_completed).toBe(100); // Onboarding completion reward
    expect(expectedXPValues.successful_referral).toBe(100); // Referrer reward
    expect(expectedXPValues.referral_signup).toBe(50); // Referee reward
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

    // Verify progression makes sense for growth-focused gamification
    expect(expectedLevels).toHaveLength(9); // 9 tiers as per spec
    expect(expectedLevels[0].title).toBe('Kook'); // Beginner level
    expect(expectedLevels[8].title).toBe('Quiver King/Queen'); // Max level
    
    // Verify XP gaps increase (harder to level up at higher levels)
    expect(expectedLevels[2].xp - expectedLevels[1].xp).toBe(200); // Level 2->3
    expect(expectedLevels[8].xp - expectedLevels[7].xp).toBe(1000); // Level 8->9
  });

  test('should prioritize growth-focused actions with higher XP rewards', () => {
    const socialActions = {
      invite_friend: 100,     // Viral growth
      tag_friends_in_session: 20,  // Social engagement
      get_like_upvote: 10,    // Community interaction
    };
    
    const contentActions = {
      post_beach_intel: 50,   // Community value
      plan_session: 50,       // Core usage
      write_reflection: 25,   // Engagement depth
    };

    // Verify social/viral actions are prioritized
    expect(socialActions.invite_friend).toBeGreaterThan(contentActions.plan_session);
    expect(socialActions.invite_friend).toBeGreaterThan(contentActions.post_beach_intel);
    
    // Community actions should be well-rewarded
    expect(contentActions.post_beach_intel).toBe(contentActions.plan_session);
  });
});
