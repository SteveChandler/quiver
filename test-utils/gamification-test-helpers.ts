/**
 * Gamification Test Helpers
 * 
 * Dedicated test utilities for gamification system testing.
 * Provides proper mocks and helpers to avoid Supabase client initialization issues.
 */

import { jest } from '@jest/globals';

// Mock user for all gamification tests
export const mockGamificationUser = {
  id: 'test-user-123',
  email: 'test@quiver.surf',
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  phone: null,
  email_confirmed_at: '2025-01-01T00:00:00Z',
  last_sign_in_at: '2025-01-01T00:00:00Z',
  role: 'authenticated'
} as const;

// Mock database results that can be configured per test
export interface MockDatabaseState {
  userXP: { xp_total: number; level: number; created_at: string; updated_at: string } | null;
  userBadges: any[];
  badgeDefinitions: any[];
  xpEvents: any[];
  userStats: any;
  insertResults: { success: boolean; error?: string }[];
  updateResults: { success: boolean; error?: string }[];
}

// Default mock state
export const createDefaultMockState = (): MockDatabaseState => ({
  userXP: null,
  userBadges: [],
  badgeDefinitions: [],
  xpEvents: [],
  userStats: {
    session_count: 0,
    board_count: 0,
    intel_posts: 0,
    group_sessions: 0,
    beach_reviews: 0,
    intel_likes: 0,
    invites_sent: 0,
    users_tagged: 0,
    early_sessions: 0,
    reflection_count: 0,
    swell_sessions: 0,
    consecutive_days: 0,
    board_tags: 0,
    temp_records: 0,
    wave_ratings: 0,
    complete_entries: 0,
    detailed_boards: 0,
    board_session_uses: 0,
    twin_fin_sessions: 0
  },
  insertResults: [{ success: true }],
  updateResults: [{ success: true }]
});

// Track operation calls for assertions
export interface MockOperationTracker {
  selects: Array<{ table: string; filters: Record<string, any> }>;
  inserts: Array<{ table: string; data: any }>;
  updates: Array<{ table: string; data: any; filters: Record<string, any> }>;
  rpcs?: Array<{ fn: string; args?: Record<string, any> }>;
}

// Create a comprehensive Supabase client mock
export function createGamificationSupabaseMock(
  state: MockDatabaseState,
  tracker: MockOperationTracker = { selects: [], inserts: [], updates: [], rpcs: [] }
) {
  let selectCallIndex = 0;
  let insertCallIndex = 0;
  let updateCallIndex = 0;

  const mockSupabase = {
    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: { user: mockGamificationUser },
        error: null
      }))
    },
    from: jest.fn((tableName: string) => {
      const queryBuilder = {
        select: jest.fn((columns?: string) => {
          // internal helper to support chained order calls (thenable)
          const makeThenable = (dataProducer: () => any) => {
            return {
              order: jest.fn(((...args: any[]) => Promise.resolve({ data: dataProducer(), error: null })) as any),
              then: (onResolve: any) => Promise.resolve(onResolve({ data: dataProducer(), error: null })),
            } as any;
          };

          // Base select query object
          const selectQuery: any = {
            eq: jest.fn((column: string, value: any) => {
              tracker.selects.push({ table: tableName, filters: { [column]: value } });

              // Track number of order calls per eq-chain
              let eqOrderCount = 0;
              const eqQuery: any = {
                single: jest.fn(() => {
                  if (tableName === 'user_xp' && column === 'user_id') {
                    return Promise.resolve({ data: state.userXP, error: null });
                  }
                  if (tableName === 'user_badges' && column === 'user_id') {
                    return Promise.resolve({ data: state.userBadges, error: null });
                  }
                  return Promise.resolve({ data: null, error: null });
                }),
                maybeSingle: jest.fn(() => {
                  if (tableName === 'user_xp' && column === 'user_id') {
                    return Promise.resolve({
                      data: state.userXP ? { id: 'mock-user-xp-id' } : null,
                      error: null,
                    });
                  }
                  if (tableName === 'user_surf_preferences' && column === 'user_id') {
                    return Promise.resolve({
                      data: { confidence: state.userStats.sweet_spot_confidence ?? 0 },
                      error: null,
                    });
                  }
                  return Promise.resolve({ data: null, error: null });
                }),
                order: jest.fn(() => {
                  eqOrderCount += 1;
                  // For user_badges, a single order call should resolve the data
                  if (tableName === 'user_badges') {
                    return Promise.resolve({ data: state.userBadges, error: null });
                  }
                  // For others, allow up to two chained orders (badge_definitions)
                  if (eqOrderCount === 1) {
                    return eqQuery;
                  }
                  return Promise.resolve({ data: [], error: null });
                }),
                limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
                then: (onResolve: any) => Promise.resolve(onResolve({ data: [], error: null })),
              };
              return eqQuery;
            }),
            in: jest.fn((column: string, values: any[]) => {
              tracker.selects.push({ table: tableName, filters: { [column]: values } });
              return Promise.resolve({ 
                data: state.badgeDefinitions.filter((badge: any) => 
                  values.includes(badge.badge_slug)
                ),
                error: null 
              });
            }),
            // Support double order on badge_definitions
            order: (() => {
              let selectOrderCount = 0;
              return jest.fn(() => {
                selectOrderCount += 1;
                if (selectOrderCount === 1) {
                  // return chain to allow second order call
                  return selectQuery;
                }
                return Promise.resolve({ data: state.badgeDefinitions, error: null });
              });
            })(),
            limit: jest.fn(() => Promise.resolve({ data: state.xpEvents, error: null }))
          };
          
          return selectQuery;
        }),
        insert: jest.fn((data: any) => {
          tracker.inserts.push({ table: tableName, data });
          const result = state.insertResults[insertCallIndex] || { success: true };
          insertCallIndex++;
          
          if (result.success) {
            // Simulate state changes for certain tables
            if (tableName === 'user_xp') {
              state.userXP = state.userXP || {
                xp_total: 0,
                level: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }
            if (tableName === 'user_badges') {
              // Push inserted badges into state for subsequent reads
              if (Array.isArray(data)) {
                state.userBadges = [...state.userBadges, ...data.map((d: any) => ({ ...d, unlocked_at: new Date().toISOString(), context: d.context || {}, badge_definitions: (state.badgeDefinitions || []).find((b: any) => b.badge_slug === d.badge_slug) }))];
              } else {
                state.userBadges = [...state.userBadges, { ...data, unlocked_at: new Date().toISOString(), context: data.context || {}, badge_definitions: (state.badgeDefinitions || []).find((b: any) => b.badge_slug === data.badge_slug) }];
              }
            }
            return Promise.resolve({ data: null, error: null });
          } else {
            return Promise.resolve({ 
              data: null, 
              error: { message: result.error || 'Insert failed' } 
            });
          }
        }),
        update: jest.fn((data: any) => ({
          eq: jest.fn((column: string, value: any) => {
            tracker.updates.push({ table: tableName, data, filters: { [column]: value } });
            const result = state.updateResults[updateCallIndex] || { success: true };
            updateCallIndex++;
            
            if (result.success) {
              if (tableName === 'user_xp') {
                state.userXP = {
                  ...(state.userXP || { xp_total: 0, level: 1, created_at: new Date().toISOString() }),
                  ...data,
                  updated_at: new Date().toISOString(),
                } as any;
              }
              return Promise.resolve({ data: null, error: null });
            } else {
              return Promise.resolve({ 
                data: null, 
                error: { message: result.error || 'Update failed' } 
              });
            }
          })
        }))
      };
      
      return queryBuilder;
    }),
    rpc: jest.fn((fn: string, args?: Record<string, any>) => {
      if (tracker.rpcs) {
        tracker.rpcs.push({ fn, args });
      }

      if (fn === 'ensure_user_xp') {
        state.userXP = state.userXP || {
          xp_total: 0,
          level: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return Promise.resolve({ data: null, error: null });
    }),
  };

  return mockSupabase;
}

// Mock the withAuthenticatedAction wrapper to use our controlled mock
export function mockWithAuthenticatedAction(mockState: MockDatabaseState, tracker?: MockOperationTracker) {
  // Match the real API but keep jest.fn for compatibility with tests using mockImplementation
  const impl = async (fn: any, ...args: any[]) => {
    try {
      const mockSupabase = createGamificationSupabaseMock(mockState, tracker);
      const result = await fn(mockGamificationUser, mockSupabase, ...args);
      return { success: true, data: result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  };
  return jest.fn(impl);
}

// Preset mock states for common test scenarios
export const mockStates = {
  // New user with no XP
  newUser: (): MockDatabaseState => ({
    ...createDefaultMockState(),
    userXP: null // Will trigger initialization
  }),
  
  // User with some XP
  existingUser: (xp: number = 50, level: number = 1): MockDatabaseState => ({
    ...createDefaultMockState(),
    userXP: {
      xp_total: xp,
      level: level,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T12:00:00Z'
    }
  }),
  
  // User near level up
  nearLevelUp: (): MockDatabaseState => ({
    ...createDefaultMockState(),
    userXP: {
      xp_total: 90, // 90 XP, adding 50 should level up to level 2
      level: 1,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T12:00:00Z'
    }
  }),
  
  // User with badges
  withBadges: (): MockDatabaseState => ({
    ...createDefaultMockState(),
    userXP: {
      xp_total: 150,
      level: 2,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T12:00:00Z'
    },
    userBadges: [
      {
        badge_slug: 'first_ride',
        unlocked_at: '2025-01-01T10:00:00Z',
        context: {},
        badge_definitions: {
          name: 'First Ride',
          description: 'Complete your first surf session',
          icon: 'Waves',
          category: 'global',
          xp_reward: 50
        }
      }
    ]
  }),
  
  // Database error scenario
  databaseError: (errorMessage: string = 'Database connection failed'): MockDatabaseState => ({
    ...createDefaultMockState(),
    insertResults: [{ success: false, error: errorMessage }]
  })
};

// Test helper for badge definitions
export const mockBadgeDefinitions = [
  {
    badge_slug: 'first_ride',
    name: 'First Ride',
    description: 'Complete your first surf session',
    icon: 'Waves',
    category: 'global',
    xp_reward: 50
  },
  {
    badge_slug: 'quiver_starter',
    name: 'Quiver Starter',
    description: 'Add your first board to your quiver',
    icon: 'Plus',
    category: 'quiver',
    xp_reward: 30
  },
  {
    badge_slug: 'first_entry',
    name: 'First Entry',
    description: 'Log your first reflection',
    icon: 'BookOpen',
    category: 'journal',
    xp_reward: 25
  }
];

// Helper to create mock stats that would unlock specific badges
export function createStatsForBadges(badgeSlugs: string[]) {
  const stats = createDefaultMockState().userStats;
  
  for (const slug of badgeSlugs) {
    switch (slug) {
      case 'first_ride':
        stats.session_count = 1;
        break;
      case 'quiver_starter':
      case 'quiver_builder':
        stats.board_count = slug === 'quiver_starter' ? 1 : 3;
        break;
      case 'first_entry':
        stats.reflection_count = 1;
        break;
      case 'wave_whisperer':
        stats.intel_posts = 10;
        break;
      case 'session_captain':
        stats.group_sessions = 5;
        break;
      case 'locals_tip':
        stats.intel_likes = 5;
        break;
      case 'the_recruiter':
        stats.invites_sent = 3;
        break;
      case 'sunrise_chaser':
        stats.early_sessions = 1;
        break;
      case 'dawn_patrol_legend':
        stats.early_sessions = 5;
        break;
    }
  }
  
  return stats;
}

// Assertion helpers
export function expectXPTracked(tracker: MockOperationTracker, expectedXP: number) {
  const xpUpdates = tracker.updates.filter(u => u.table === 'user_xp');
  expect(xpUpdates.length).toBeGreaterThan(0);
  
  const lastUpdate = xpUpdates[xpUpdates.length - 1];
  expect(lastUpdate.data.xp_total).toBeGreaterThanOrEqual(expectedXP);
}

export function expectXPEventLogged(tracker: MockOperationTracker, action: string) {
  const xpEvents = tracker.inserts.filter(i => i.table === 'xp_events');
  expect(xpEvents.length).toBeGreaterThan(0);
  
  const lastEvent = xpEvents[xpEvents.length - 1];
  expect(lastEvent.data.action).toBe(action);
}

export function expectBadgeUnlocked(tracker: MockOperationTracker, badgeSlug: string) {
  const badgeInserts = tracker.inserts.filter(i => i.table === 'user_badges');
  const unlockedBadge = badgeInserts.find(i => i.data.badge_slug === badgeSlug);
  expect(unlockedBadge).toBeDefined();
}
