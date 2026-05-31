/**
 * Unit tests for the ephemeral-smoke-user sweep.
 *
 * Lives under __tests__/e2e-utils/ rather than e2e/ because jest.config.js
 * excludes <rootDir>/e2e/ from test discovery.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  cleanupEphemeralSmokeUsers,
  cleanupOrphanSmokeProfiles,
  filterAuthBackedUserIds,
  isEphemeralSmokeTestUser,
} from '../../e2e/utils/test-data-cleanup';

type ListUsersArgs = { page: number; perPage: number };
type ListUsersResult = {
  data: { users: User[] } | null;
  error: { message: string } | null;
};

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    id: overrides.id,
    email: overrides.email,
    app_metadata: overrides.app_metadata ?? {},
    user_metadata: overrides.user_metadata ?? {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
  } as User;
}

function makeMockSupabase(opts: {
  pages: User[][];
  deleteFailIds?: Set<string>;
  profileDeleteFailIds?: Set<string>;
  /**
   * RPC behavior. Default: returns 0 (no orphans to sweep).
   * Pass `'missing'` to simulate the pre-migration "function does not exist"
   * error. Pass a number to simulate that many orphans swept.
   */
  rpcResponse?: number | 'missing' | { message: string };
}): {
  client: SupabaseClient;
  calls: {
    listUsers: number;
    deleted: string[];
    profileDeletes: string[];
    rpcCalls: string[];
  };
} {
  const calls = {
    listUsers: 0,
    deleted: [] as string[],
    profileDeletes: [] as string[],
    rpcCalls: [] as string[],
  };
  const client = {
    auth: {
      admin: {
        listUsers: async (args: ListUsersArgs): Promise<ListUsersResult> => {
          calls.listUsers += 1;
          const idx = args.page - 1;
          const users = opts.pages[idx] ?? [];
          return { data: { users }, error: null };
        },
        deleteUser: async (userId: string) => {
          if (opts.deleteFailIds?.has(userId)) {
            return { data: null, error: { message: 'forced failure' } };
          }
          calls.deleted.push(userId);
          return { data: null, error: null };
        },
      },
    },
    rpc: async (fn: string) => {
      calls.rpcCalls.push(fn);
      const r = opts.rpcResponse ?? 0;
      if (r === 'missing') {
        return {
          data: null,
          error: { message: 'function cleanup_orphan_smoke_profiles() does not exist', code: '42883' },
        };
      }
      if (typeof r === 'number') {
        return { data: r, error: null };
      }
      return { data: null, error: r };
    },
    from: (_table: string) => ({
      delete: () => ({
        eq: async (_column: string, value: string) => {
          if (opts.profileDeleteFailIds?.has(value)) {
            return { data: null, error: { message: 'profile delete failed' } };
          }
          calls.profileDeletes.push(value);
          return { data: null, error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('isEphemeralSmokeTestUser', () => {
  it('returns true for users tagged with app_metadata.is_ephemeral_smoke_test', () => {
    const user = makeUser({
      id: 'a',
      email: 'real-looking@example.com',
      app_metadata: { is_ephemeral_smoke_test: true },
    });
    expect(isEphemeralSmokeTestUser(user)).toBe(true);
  });

  it('returns true for legacy untagged smoke+@quiversurf.test emails', () => {
    const user = makeUser({
      id: 'b',
      email: 'smoke+abc-123@quiversurf.test',
      app_metadata: {},
    });
    expect(isEphemeralSmokeTestUser(user)).toBe(true);
  });

  it('returns false for real users without the marker', () => {
    const user = makeUser({
      id: 'c',
      email: 'realuser@gmail.com',
      app_metadata: {},
    });
    expect(isEphemeralSmokeTestUser(user)).toBe(false);
  });

  it('returns false for marker explicitly set to false', () => {
    const user = makeUser({
      id: 'd',
      email: 'realuser@gmail.com',
      app_metadata: { is_ephemeral_smoke_test: false },
    });
    expect(isEphemeralSmokeTestUser(user)).toBe(false);
  });

  it('returns false for users with no email and no marker', () => {
    const user = makeUser({
      id: 'e',
      email: undefined,
      app_metadata: {},
    });
    expect(isEphemeralSmokeTestUser(user)).toBe(false);
  });
});

describe('filterAuthBackedUserIds', () => {
  it('drops profile ids that no longer have auth.users rows', async () => {
    const { client, calls } = makeMockSupabase({
      pages: [[makeUser({ id: 'auth-backed-user', email: 'mock@example.invalid' })]],
    });

    const result = await filterAuthBackedUserIds(
      client,
      ['auth-backed-user', 'orphan-profile'],
      false
    );

    expect(result).toEqual(['auth-backed-user']);
    expect(calls.listUsers).toBe(1);
  });
});

describe('cleanupEphemeralSmokeUsers', () => {
  it('paginates through listUsers until a partial page returns and deletes all matched users', async () => {
    // Build a 3-page response:
    //   page 1: 1000 users — half tagged, half real users
    //   page 2: 400 users — all marker-tagged
    //   page 3: 0 users — loop exits (returned length 0 < perPage 1000)
    // Wait — the loop condition is `users.length < perPage`. Page 2 returns 400
    // (<1000) so the loop exits after page 2. We don't need a page-3 call.
    const page1: User[] = [];
    for (let i = 0; i < 500; i++) {
      page1.push(
        makeUser({
          id: `tag-1-${i}`,
          email: `smoke+tag1-${i}@quiversurf.test`,
          app_metadata: { is_ephemeral_smoke_test: true },
        })
      );
    }
    for (let i = 0; i < 500; i++) {
      page1.push(makeUser({ id: `real-1-${i}`, email: `real-${i}@example.com` }));
    }

    const page2: User[] = [];
    for (let i = 0; i < 400; i++) {
      page2.push(
        makeUser({
          id: `tag-2-${i}`,
          email: `arbitrary-${i}@example.com`,
          app_metadata: { is_ephemeral_smoke_test: true },
        })
      );
    }

    const { client, calls } = makeMockSupabase({ pages: [page1, page2] });

    const result = await cleanupEphemeralSmokeUsers(client, false, false);

    expect(calls.listUsers).toBe(2);
    expect(result.count).toBe(900);
    expect(calls.deleted).toHaveLength(900);
    // Each successful auth-user delete triggers an orphan-profile cleanup.
    expect(calls.profileDeletes).toHaveLength(900);
    // The orphan-profile RPC runs once as a pre-pass.
    expect(calls.rpcCalls).toEqual(['cleanup_orphan_smoke_profiles']);
    expect(result.error).toBeUndefined();
  });

  it('returns count without deleting on dryRun=true', async () => {
    const page1: User[] = [
      makeUser({
        id: 'x',
        email: 'smoke+legacy@quiversurf.test',
      }),
      makeUser({
        id: 'y',
        email: 'tagged@example.com',
        app_metadata: { is_ephemeral_smoke_test: true },
      }),
      makeUser({ id: 'z', email: 'real@example.com' }),
    ];
    const { client, calls } = makeMockSupabase({ pages: [page1] });

    const result = await cleanupEphemeralSmokeUsers(client, true, false);

    expect(result.count).toBe(2);
    expect(calls.deleted).toHaveLength(0);
    expect(calls.listUsers).toBe(1);
  });

  it('returns 0 when no ephemeral users match', async () => {
    const page1: User[] = [
      makeUser({ id: 'r1', email: 'a@example.com' }),
      makeUser({ id: 'r2', email: 'b@example.com' }),
    ];
    const { client, calls } = makeMockSupabase({ pages: [page1] });

    const result = await cleanupEphemeralSmokeUsers(client, false, false);

    expect(result.count).toBe(0);
    expect(calls.deleted).toHaveLength(0);
  });

  it('reports per-user delete failures without aborting the sweep', async () => {
    const page1: User[] = [
      makeUser({
        id: 'good',
        email: 'smoke+good@quiversurf.test',
      }),
      makeUser({
        id: 'bad',
        email: 'smoke+bad@quiversurf.test',
      }),
    ];
    const { client, calls } = makeMockSupabase({
      pages: [page1],
      deleteFailIds: new Set(['bad']),
    });

    const result = await cleanupEphemeralSmokeUsers(client, false, false);

    expect(result.count).toBe(1);
    expect(calls.deleted).toEqual(['good']);
    // The 'bad' user never reached the profile-delete step (auth delete failed).
    expect(calls.profileDeletes).toEqual(['good']);
    expect(result.error).toContain('forced failure');
  });

  it('skips the orphan RPC pre-pass on dryRun', async () => {
    const { client, calls } = makeMockSupabase({ pages: [[]] });
    await cleanupEphemeralSmokeUsers(client, true, false);
    expect(calls.rpcCalls).toEqual([]);
  });

  it('flags profile-cleanup failures separately from auth-delete failures', async () => {
    const page1: User[] = [
      makeUser({
        id: 'auth-ok-profile-bad',
        email: 'smoke+orphan@quiversurf.test',
      }),
    ];
    const { client, calls } = makeMockSupabase({
      pages: [page1],
      profileDeleteFailIds: new Set(['auth-ok-profile-bad']),
    });

    const result = await cleanupEphemeralSmokeUsers(client, false, false);

    // Auth delete succeeded → counted; profile delete failed → reported in error.
    expect(result.count).toBe(1);
    expect(calls.deleted).toEqual(['auth-ok-profile-bad']);
    expect(result.error).toContain('profile orphan');
  });
});

describe('cleanupOrphanSmokeProfiles', () => {
  it('returns the RPC count when the function is deployed', async () => {
    const { client, calls } = makeMockSupabase({ pages: [], rpcResponse: 5 });
    const result = await cleanupOrphanSmokeProfiles(client, false);
    expect(result.count).toBe(5);
    expect(result.error).toBeUndefined();
    expect(calls.rpcCalls).toEqual(['cleanup_orphan_smoke_profiles']);
  });

  it('treats "function does not exist" as 0 deletions, not an error', async () => {
    const { client } = makeMockSupabase({ pages: [], rpcResponse: 'missing' });
    const result = await cleanupOrphanSmokeProfiles(client, false);
    expect(result.count).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it('surfaces non-missing-function errors', async () => {
    const { client } = makeMockSupabase({
      pages: [],
      rpcResponse: { message: 'permission denied' },
    });
    const result = await cleanupOrphanSmokeProfiles(client, false);
    expect(result.count).toBe(0);
    expect(result.error).toBe('permission denied');
  });
});
