import { test as base, expect, type Browser, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { checkServerSession, loginAs } from "../utils/auth-helpers";
import { isLocalSupabaseUrl } from "../scripts/lib/playwright-env";
import { POOL_SIZE, poolEmail } from "../scripts/lib/worker-pool";

const PASSWORD = process.env.E2E_POOL_PASSWORD || "e2e-pool-pw-123!";
const EMPTY_STORAGE_STATE = {
  cookies: [],
  origins: [],
};

type StoredAuthState = {
  cookies?: Array<{ name?: string }>;
  origins?: Array<{
    localStorage?: Array<{ name?: string }>;
  }>;
};

function isLocalBaseURL(baseURL: string): boolean {
  return baseURL.includes("localhost") || baseURL.includes("127.0.0.1");
}

function storageStateHasSupabaseAuth(file: string): boolean {
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8")) as StoredAuthState;
    const hasAuthCookie = state.cookies?.some(
      (cookie) =>
        typeof cookie.name === "string" &&
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("auth-token")
    );
    const hasAuthStorage = state.origins?.some((origin) =>
      origin.localStorage?.some(
        (item) =>
          typeof item.name === "string" &&
          item.name.startsWith("sb-") &&
          item.name.includes("auth-token")
      )
    );

    return Boolean(hasAuthCookie || hasAuthStorage);
  } catch {
    return false;
  }
}

async function storageStateHasValidServerSession(
  browser: Browser,
  file: string,
  baseURL: string
): Promise<boolean> {
  if (!storageStateHasSupabaseAuth(file)) return false;

  let page: Page | null = null;

  try {
    page = await browser.newPage({ storageState: file });
    const serverCheck = await checkServerSession(page, { baseUrl: baseURL });
    return serverCheck.hasSession;
  } catch {
    return false;
  } finally {
    await page?.close().catch(() => undefined);
  }
}

export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: async ({ workerStorageState }, applyStorageState) => {
    await applyStorageState(workerStorageState);
  },
  workerStorageState: [
    async ({ browser }, applyWorkerStorageState, workerInfo) => {
      const index = workerInfo.parallelIndex % POOL_SIZE;
      const file = path.resolve("e2e/.auth", `worker-${index}.json`);
      const emptyFile = path.resolve("e2e/.auth", "empty.json");
      const baseURL =
        typeof workerInfo.project.use.baseURL === "string"
          ? workerInfo.project.use.baseURL
          : "http://localhost:3000";
      const useLocalPool =
        isLocalBaseURL(baseURL) &&
        isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

      if (workerInfo.project.name !== "auth") {
        fs.mkdirSync(path.dirname(emptyFile), { recursive: true });
        fs.writeFileSync(emptyFile, JSON.stringify(EMPTY_STORAGE_STATE));
        await applyWorkerStorageState(emptyFile);
        return;
      }

      if (!useLocalPool) {
        const sharedStateFile = path.resolve("e2e/.auth/state.json");
        if (fs.existsSync(sharedStateFile)) {
          await applyWorkerStorageState(sharedStateFile);
          return;
        }

        fs.mkdirSync(path.dirname(sharedStateFile), { recursive: true });
        const page = await browser.newPage({ storageState: undefined });
        await loginAs(
          page,
          process.env.TEST_USER_EMAIL || "testuser@quivertest.local",
          process.env.TEST_USER_PASSWORD || "testpassword123",
          baseURL
        );
        await page.context().storageState({ path: sharedStateFile });
        await page.close();
        await applyWorkerStorageState(sharedStateFile);
        return;
      }

      if (fs.existsSync(file)) {
        const hasValidWorkerState = await storageStateHasValidServerSession(
          browser,
          file,
          baseURL
        );

        if (hasValidWorkerState) {
          await applyWorkerStorageState(file);
          return;
        }

        fs.rmSync(file, { force: true });
      }

      fs.mkdirSync(path.dirname(file), { recursive: true });

      const page = await browser.newPage({ storageState: undefined });
      await loginAs(page, poolEmail(index), PASSWORD, baseURL);
      await page.context().storageState({ path: file });
      await page.close();
      await applyWorkerStorageState(file);
    },
    { scope: "worker" },
  ],
});

export { expect };
