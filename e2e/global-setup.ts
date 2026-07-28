import { chromium, FullConfig } from '@playwright/test';
import { execFile } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readdirSync, rmSync } from 'fs';
import { promisify } from 'util';
import {
  cleanupEphemeralSmokeUsers,
} from './utils/test-data-cleanup';
import { loginAs, logAuthState, getAuthTokens } from './utils/auth-helpers';
import {
  clearProdReadonlyAuthStatus,
  isProdReadonlyMode,
  writeProdReadonlyAuthStatus,
} from './utils/prod-readonly-auth';
import {
  isLocalSupabaseUrl,
  loadPlaywrightEnv,
  requireEnv,
  requireLocalSupabaseEnv,
  resolvePsqlExecutable,
} from './scripts/lib/playwright-env';
import { seedPoolUsers } from './scripts/seed-pool-users';
import { POOL_SIZE, poolEmail } from './scripts/lib/worker-pool';

const execFileAsync = promisify(execFile);
const DEFAULT_LOCAL_DB_URL =
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const LOCAL_FORECAST_REBASE_SQL = `
BEGIN;
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE public.enhanced_forecasts IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE e2e_forecast_rebase_delta ON COMMIT DROP AS
SELECT
  CASE
    WHEN max(forecast_at) IS NULL THEN interval '0 seconds'
    ELSE statement_timestamp() - max(forecast_at)
  END AS delta,
  statement_timestamp() AS anchor
FROM public.enhanced_forecasts;
UPDATE public.enhanced_forecasts
SET
  forecast_at = forecast_at + interval '30 days',
  forecast_date = ((forecast_at + interval '30 days') AT TIME ZONE 'UTC')::date,
  forecast_time = ((forecast_at + interval '30 days') AT TIME ZONE 'UTC')::time,
  next_tide_at = CASE
    WHEN next_tide_at IS NULL THEN NULL
    ELSE next_tide_at + interval '30 days'
  END;
UPDATE public.enhanced_forecasts AS ef
SET
  forecast_at = ef.forecast_at - interval '30 days' + d.delta,
  forecast_date = ((ef.forecast_at - interval '30 days' + d.delta) AT TIME ZONE 'UTC')::date,
  forecast_time = ((ef.forecast_at - interval '30 days' + d.delta) AT TIME ZONE 'UTC')::time,
  next_tide_at = CASE
    WHEN ef.next_tide_at IS NULL THEN NULL
    ELSE ef.next_tide_at - interval '30 days' + d.delta
  END,
  created_at = d.anchor,
  updated_at = d.anchor,
  om_fetched_at = CASE
    WHEN ef.om_fetched_at IS NULL THEN NULL
    ELSE d.anchor
  END
FROM e2e_forecast_rebase_delta AS d;
SELECT
  'enhanced_forecasts_rebased=' || count(*) ||
  ';fresh_12h=' || count(*) FILTER (WHERE updated_at >= statement_timestamp() - interval '12 hours') ||
  ';max_forecast_at=' || coalesce(max(forecast_at)::text, 'null') ||
  ';max_updated_at=' || coalesce(max(updated_at)::text, 'null')
FROM public.enhanced_forecasts;
COMMIT;
`;

function getRequestedProjectsFromArgs(): string[] {
  const requestedProjects: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === '--project' && process.argv[index + 1]) {
      requestedProjects.push(process.argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--project=')) {
      requestedProjects.push(arg.slice('--project='.length));
    }
  }

  return requestedProjects;
}

function isLocalBaseURL(baseURL: unknown): boolean {
  return (
    typeof baseURL === 'string' &&
    (baseURL.includes('localhost') || baseURL.includes('127.0.0.1'))
  );
}

function clearWorkerAuthStates(): void {
  mkdirSync('e2e/.auth', { recursive: true });
  for (const file of readdirSync('e2e/.auth')) {
    if (/^worker-\d+\.json$/.test(file)) {
      rmSync(`e2e/.auth/${file}`, { force: true });
    }
  }
}

async function rebaseLocalForecastSnapshot(): Promise<void> {
  const dbUrl = process.env.E2E_LOCAL_DB_URL || DEFAULT_LOCAL_DB_URL;
  const { stdout, stderr } = await execFileAsync(
    resolvePsqlExecutable(),
    [dbUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', LOCAL_FORECAST_REBASE_SQL],
    { maxBuffer: 1024 * 1024 }
  );

  const output = stdout.trim();
  if (output.length > 0) {
    console.log(`[Global Setup] ${output}`);
  }

  const warning = stderr.trim();
  if (warning.length > 0) {
    console.warn(`[Global Setup] Forecast snapshot rebase warning: ${warning}`);
  }
}

async function rebaseLocalForecastSnapshotBestEffort(): Promise<void> {
  try {
    await rebaseLocalForecastSnapshot();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[Global Setup] Forecast snapshot rebase unavailable; authenticated tests will continue: ${message}`
    );
  }
}

function shouldSkipAuthSetup(config: FullConfig): boolean {
  const projectsToRun = config.projects.filter((project) =>
    project.grep ? true : !project.grepInvert
  );
  const requestedProjects = getRequestedProjectsFromArgs();

  const onlyGuestProjects =
    requestedProjects.length > 0
      ? requestedProjects.every((projectName) => projectName === 'guest')
      : projectsToRun.every(
          (project) =>
            project.name === 'guest' ||
            project.testMatch?.toString().includes('guest-') ||
            project.testMatch?.toString().includes('email-core-loop')
        );

  return process.env.SKIP_AUTH_SETUP === 'true' || onlyGuestProjects;
}

async function writeLocalSharedAuthState(baseURL: string): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await loginAs(page, poolEmail(0), requireEnv('E2E_POOL_PASSWORD'), baseURL);
  await context.storageState({ path: 'e2e/.auth/state.json' });
  await context.close();
  await browser.close();
}

async function writeLocalWorkerAuthStates(baseURL: string): Promise<void> {
  const browser = await chromium.launch();

  for (let index = 0; index < POOL_SIZE; index += 1) {
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      await loginAs(page, poolEmail(index), requireEnv('E2E_POOL_PASSWORD'), baseURL);
      await context.storageState({ path: `e2e/.auth/worker-${index}.json` });
    } finally {
      await context.close();
    }
  }

  await browser.close();
}

async function prepareLocalWorkerPool(baseURL: string): Promise<void> {
  const localEnv = requireLocalSupabaseEnv();
  const admin = createClient(localEnv.url, localEnv.serviceRoleKey, {
    auth: { persistSession: false },
  });

  const cleanupResult = await cleanupEphemeralSmokeUsers(admin, false, true);
  if (cleanupResult.error) {
    console.warn(`[Global Setup] Ephemeral cleanup warning: ${cleanupResult.error}`);
  }

  clearWorkerAuthStates();
  await rebaseLocalForecastSnapshotBestEffort();
  await seedPoolUsers();
  await writeLocalSharedAuthState(baseURL);
  await writeLocalWorkerAuthStates(baseURL);
}

async function writeSharedAuthState(
  config: FullConfig,
  prodReadonlyMode: boolean
): Promise<void> {
  const authProject = config.projects.find((project) => project.name === 'auth');
  const projectConfig = authProject || config.projects[0];
  const { baseURL } = projectConfig.use;
  const baseUrlString =
    typeof baseURL === 'string' ? baseURL.replace(/\/$/, '') : '';
  const storageStatePath = 'e2e/.auth/state.json';
  const testEmail = process.env.TEST_USER_EMAIL || 'testuser@quivertest.local';
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';
  const testEnv = process.env.TEST_ENV || 'local';
  const isLocalhost = isLocalBaseURL(baseURL);
  const vercelBypassToken =
    process.env.VERCEL_BYPASS_TOKEN ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.VERCEL_BYPASS;
  const extraHTTPHeaders =
    !isLocalhost && vercelBypassToken
      ? { 'x-vercel-protection-bypass': String(vercelBypassToken) }
      : undefined;

  const browser = await chromium.launch();
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      ...(extraHTTPHeaders ?? {}),
    },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('[Global Setup] ============================================');
  console.log(`[Global Setup] Environment: ${testEnv}`);
  console.log(`[Global Setup] Base URL: ${baseURL}`);
  console.log(`[Global Setup] Authenticating shared test user: ${testEmail}`);
  console.log('[Global Setup] ============================================');

  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`[Global Setup] Authentication attempt ${attempt}/${maxAttempts}`);
      await loginAs(page, testEmail, testPassword, baseUrlString);
      await logAuthState(page, 'Final Auth State');
      await context.storageState({ path: storageStatePath });

      const tokens = await getAuthTokens(page);
      if (tokens.cookies.length === 0 && tokens.storage.length === 0) {
        throw new Error('Saved state contains no authentication data');
      }

      if (prodReadonlyMode) {
        await writeProdReadonlyAuthStatus('ok');
      }
      await context.close();
      await browser.close();
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`[Global Setup] Attempt ${attempt} failed:`, error);
      if (attempt < maxAttempts) {
        // eslint-disable-next-line playwright/no-wait-for-timeout -- retry backoff between login attempts
        await page.waitForTimeout(2000);
      }
    }
  }

  await context.close();
  await browser.close();

  const failureMessage =
    `Failed to authenticate after ${maxAttempts} attempts. ` +
    `Last error: ${lastError?.message || 'Unknown error'}. ` +
    `Please check test credentials and target environment (${testEnv}).`;

  if (prodReadonlyMode) {
    await writeProdReadonlyAuthStatus('blocked', failureMessage);
    console.warn('[Global Setup] Continuing prod-readonly run with guest coverage only');
    return;
  }

  throw new Error(failureMessage);
}

async function globalSetup(config: FullConfig): Promise<void> {
  loadPlaywrightEnv();
  const prodReadonlyMode = isProdReadonlyMode();

  if (prodReadonlyMode) {
    await clearProdReadonlyAuthStatus();
  }

  if (shouldSkipAuthSetup(config)) {
    console.log('[Global Setup] Skipping authentication setup');
    return;
  }

  const authProject = config.projects.find((project) => project.name === 'auth');
  const baseURL = authProject?.use.baseURL ?? config.projects[0]?.use.baseURL;
  const localSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  if (
    !prodReadonlyMode &&
    isLocalBaseURL(baseURL) &&
    isLocalSupabaseUrl(localSupabaseUrl)
  ) {
    await prepareLocalWorkerPool(String(baseURL).replace(/\/$/, ''));
    console.log('[Global Setup] Local worker pool ready');
    return;
  }

  await writeSharedAuthState(config, prodReadonlyMode);
}

export default globalSetup;
