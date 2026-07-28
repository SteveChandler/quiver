import type { FullConfig } from "@playwright/test";

const mockExecFile = jest.fn(
  (
    _file: string,
    _args: string[],
    _options: object,
    callback: (error: NodeJS.ErrnoException) => void
  ) => {
    const error = new Error("spawn psql ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    callback(error);
  }
);
const mockCleanupEphemeralSmokeUsers = jest
  .fn()
  .mockResolvedValue({ error: null });
const mockLoginAs = jest.fn().mockResolvedValue(undefined);
const mockSeedPoolUsers = jest.fn().mockResolvedValue(undefined);
const mockStorageState = jest.fn().mockResolvedValue(undefined);
const mockContextClose = jest.fn().mockResolvedValue(undefined);
const mockBrowserClose = jest.fn().mockResolvedValue(undefined);

jest.mock("child_process", () => ({
  execFile: (
    file: string,
    args: string[],
    options: object,
    callback: (error: NodeJS.ErrnoException) => void
  ) => mockExecFile(file, args, options, callback),
}));

jest.mock("@playwright/test", () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      close: (...args: unknown[]) => mockBrowserClose(...args),
      newContext: jest.fn().mockResolvedValue({
        close: (...args: unknown[]) => mockContextClose(...args),
        newPage: jest.fn().mockResolvedValue({}),
        storageState: (...args: unknown[]) => mockStorageState(...args),
      }),
    }),
  },
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({}),
}));

jest.mock("@/e2e/utils/test-data-cleanup", () => ({
  cleanupEphemeralSmokeUsers: (...args: unknown[]) =>
    mockCleanupEphemeralSmokeUsers(...args),
}));

jest.mock("@/e2e/utils/auth-helpers", () => ({
  getAuthTokens: jest.fn(),
  logAuthState: jest.fn(),
  loginAs: (...args: unknown[]) => mockLoginAs(...args),
}));

jest.mock("@/e2e/utils/prod-readonly-auth", () => ({
  clearProdReadonlyAuthStatus: jest.fn(),
  isProdReadonlyMode: jest.fn().mockReturnValue(false),
  writeProdReadonlyAuthStatus: jest.fn(),
}));

jest.mock("@/e2e/scripts/lib/playwright-env", () => ({
  isLocalSupabaseUrl: jest.fn().mockReturnValue(true),
  loadPlaywrightEnv: jest.fn(),
  requireEnv: jest.fn().mockReturnValue("e2e-pool-password"),
  requireLocalSupabaseEnv: jest.fn().mockReturnValue({
    anonKey: "local-anon-key",
    serviceRoleKey: "local-service-role-key",
    url: "http://127.0.0.1:54321",
  }),
  resolvePsqlExecutable: jest.fn().mockReturnValue("psql"),
}));

jest.mock("@/e2e/scripts/seed-pool-users", () => ({
  seedPoolUsers: (...args: unknown[]) => mockSeedPoolUsers(...args),
}));

jest.mock("@/e2e/scripts/lib/worker-pool", () => ({
  POOL_SIZE: 2,
  poolEmail: (index: number) => `worker-${index}@example.test`,
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  rmSync: jest.fn(),
}));

import globalSetup from "@/e2e/global-setup";

describe("local Playwright global setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("continues creating authenticated worker state when forecast rebasing is unavailable", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const config = {
      projects: [
        {
          grep: undefined,
          grepInvert: undefined,
          name: "auth",
          testMatch: [/.*\.spec\.ts/],
          use: { baseURL: "http://localhost:3000" },
        },
      ],
    } as unknown as FullConfig;

    try {
      await expect(globalSetup(config)).resolves.toBeUndefined();

      expect(mockSeedPoolUsers).toHaveBeenCalledTimes(1);
      expect(mockLoginAs).toHaveBeenCalledTimes(3);
      expect(mockStorageState).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Forecast snapshot rebase unavailable; authenticated tests will continue"
        )
      );
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });
});
