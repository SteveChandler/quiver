/**
 * Tests that the global Playwright teardown sweeps ephemeral smoke users
 * regardless of TEST_ENV, while keeping the broader session/intel-post
 * cleanup gated to the dev environment.
 */

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(),
  statSync: jest.fn(),
}));

const cleanupAllTestData = jest.fn();
const cleanupEphemeralSmokeUsers = jest.fn();
const createServiceClient = jest.fn();

jest.mock('../../e2e/utils/test-data-cleanup', () => ({
  cleanupAllTestData: (...args: unknown[]) => cleanupAllTestData(...args),
  cleanupEphemeralSmokeUsers: (...args: unknown[]) => cleanupEphemeralSmokeUsers(...args),
  createServiceClient: (...args: unknown[]) => createServiceClient(...args),
}));

import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';
import globalTeardown from '../../e2e/global-teardown';

// The teardown logs these auth-state-file warnings for guest-only runs (the
// test setup mocks fs.existsSync → false). Allow them in every test.
const STATE_FILE_MISSING_WARNINGS = [
  /Auth state file not found/,
  /This is expected if only guest tests ran/,
];

describe('global-teardown cleanup gating', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    cleanupAllTestData.mockReset();
    cleanupEphemeralSmokeUsers.mockReset();
    createServiceClient.mockReset();

    cleanupEphemeralSmokeUsers.mockResolvedValue({
      table: 'ephemeral_users',
      count: 0,
    });
    cleanupAllTestData.mockResolvedValue({
      sessions: { table: 'sessions', count: 0 },
      intelPosts: { table: 'intel_posts', count: 0 },
      ephemeralUsers: { table: 'ephemeral_users', count: 0 },
      totalCleaned: 0,
      durationMs: 0,
      testUserIds: [],
      dryRun: false,
    });
    createServiceClient.mockReturnValue({});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('runs the ephemeral sweep even when TEST_ENV is local', async () => {
    process.env.TEST_ENV = 'local';
    delete process.env.BASE_URL;

    await globalTeardown({} as never);

    expect(cleanupEphemeralSmokeUsers).toHaveBeenCalledTimes(1);
    expect(cleanupAllTestData).not.toHaveBeenCalled();
    expectConsoleWarnings(STATE_FILE_MISSING_WARNINGS);
  });

  it('runs both sweeps in dev environment with skipEphemeralSmokeUsers=true on the broader cleanup', async () => {
    process.env.TEST_ENV = 'dev';

    await globalTeardown({} as never);

    expect(cleanupEphemeralSmokeUsers).toHaveBeenCalledTimes(1);
    expect(cleanupAllTestData).toHaveBeenCalledTimes(1);
    expect(cleanupAllTestData).toHaveBeenCalledWith(
      expect.objectContaining({ skipEphemeralSmokeUsers: true })
    );
    expectConsoleWarnings(STATE_FILE_MISSING_WARNINGS);
  });

  it('detects dev via BASE_URL containing dev.quiversurf.app', async () => {
    delete process.env.TEST_ENV;
    process.env.BASE_URL = 'https://dev.quiversurf.app';

    await globalTeardown({} as never);

    expect(cleanupAllTestData).toHaveBeenCalledTimes(1);
    expectConsoleWarnings(STATE_FILE_MISSING_WARNINGS);
  });

  it('continues to broader cleanup when ephemeral sweep cannot construct a service client', async () => {
    process.env.TEST_ENV = 'dev';
    createServiceClient.mockImplementation(() => {
      throw new Error('Supabase configuration missing.');
    });

    await globalTeardown({} as never);

    // Service-client construction failed → ephemeral sweep was skipped...
    expect(cleanupEphemeralSmokeUsers).not.toHaveBeenCalled();
    // ...but the dev-gated cleanup still ran.
    expect(cleanupAllTestData).toHaveBeenCalledTimes(1);
    expectConsoleWarnings([
      ...STATE_FILE_MISSING_WARNINGS,
      /Skipping ephemeral sweep/,
    ]);
  });

  it('does not throw when ephemeral sweep itself rejects', async () => {
    process.env.TEST_ENV = 'local';
    cleanupEphemeralSmokeUsers.mockRejectedValue(new Error('listUsers blew up'));

    await expect(globalTeardown({} as never)).resolves.toBeUndefined();
    expectConsoleWarnings([
      ...STATE_FILE_MISSING_WARNINGS,
      /Skipping ephemeral sweep/,
    ]);
  });
});
