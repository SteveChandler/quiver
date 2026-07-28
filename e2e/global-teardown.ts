import { FullConfig } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  cleanupAllTestData,
  cleanupEphemeralSmokeUsers,
  cleanupOrphanSmokeProfiles,
  createServiceClient,
} from './utils/test-data-cleanup';
import { USER_OWNED_TABLES } from './scripts/lib/user-owned-tables';
import { POOL_SIZE, poolEmail } from './scripts/lib/worker-pool';
import {
  isLocalSupabaseUrl,
  loadPlaywrightEnv,
  resolvePsqlExecutable,
} from './scripts/lib/playwright-env';

function getLocalDbUrl(): string {
  return (
    process.env.E2E_LOCAL_DB_URL ||
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  );
}

function isLocalBaseURL(baseURL: string): boolean {
  return baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
}

function clearLocalAuthStates(): void {
  const authDir = path.resolve('e2e/.auth');

  if (!existsSync(authDir)) return;

  for (const entry of readdirSync(authDir)) {
    if (entry === 'state.json' || /^worker-\d+\.json$/.test(entry)) {
      rmSync(path.join(authDir, entry), { force: true });
    }
  }
}

function forceLocalPlaywrightEnvIfNeeded(config: FullConfig): void {
  const projects = Array.isArray(config.projects) ? config.projects : [];
  if (projects.length === 0) return;

  const authProject = projects.find((project) => project.name === 'auth');
  const projectBaseURL =
    typeof authProject?.use.baseURL === 'string' ? authProject.use.baseURL : '';
  const envBaseURL = process.env.BASE_URL || '';
  const baseURL = envBaseURL || projectBaseURL;

  if (!baseURL || isLocalBaseURL(baseURL)) {
    dotenvConfig({ path: '.env.playwright.local', override: true });
  }
}

async function listAllUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    users.push(...(data?.users ?? []));
    if ((data?.users ?? []).length < perPage) break;
  }

  return users;
}

async function getPoolUserIds(supabase: SupabaseClient): Promise<string[]> {
  const poolEmails = new Set(
    Array.from({ length: POOL_SIZE }, (_, index) => poolEmail(index))
  );

  const ids = new Set(
    (await listAllUsers(supabase))
    .filter((user) => user.email && poolEmails.has(user.email))
      .map((user) => user.id)
  );

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .like('email', 'e2e-worker-%@quivertest.local');

  if (error) throw error;

  for (const profile of data ?? []) {
    if (profile.id) ids.add(profile.id);
  }

  return Array.from(ids);
}

async function countRowsForIds(
  supabase: SupabaseClient,
  table: string,
  column: string,
  userIds: string[]
): Promise<number> {
  if (userIds.length === 0) return 0;

  const { count, error } = await supabase
    .from(table)
    .select(column, { count: 'exact', head: true })
    .in(column, userIds);

  if (error) throw error;
  return count ?? 0;
}

async function countWorkerProfiles(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .like('email', 'e2e-worker-%@quivertest.local');

  if (error) throw error;
  return count ?? 0;
}

async function countWorkerAuthUsers(supabase: SupabaseClient): Promise<number> {
  const poolEmails = new Set(
    Array.from({ length: POOL_SIZE }, (_, index) => poolEmail(index))
  );

  return (await listAllUsers(supabase)).filter(
    (user) => user.email && poolEmails.has(user.email)
  ).length;
}

async function cleanupWorkerPoolUsers(): Promise<number> {
  const sql = `
    begin;
    set local app.allow_destructive=on;
    with deleted as (
      delete from auth.users
      where email like 'e2e-worker-%@quivertest.local'
      returning 1
    )
    select count(*) from deleted;
    commit;
  `;

  return new Promise((resolve, reject) => {
    const child = spawn(resolvePsqlExecutable(), [
      getLocalDbUrl(),
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      sql,
    ]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              `[Global Teardown] Worker pool SQL cleanup exited ${code}`
          )
        );
        return;
      }

      const deleted = stdout
        .split('\n')
        .map((line) => Number.parseInt(line, 10))
        .find((value) => Number.isFinite(value));

      if (deleted && deleted > 0) {
        console.log(`[Global Teardown] Deleted ${deleted} worker pool user(s)`);
      }
      resolve(deleted ?? 0);
    });
  });
}

async function assertPoolClean(
  supabase: SupabaseClient,
  poolUserIds: string[]
): Promise<void> {
  const warnings: string[] = [];
  const publicTables = USER_OWNED_TABLES.filter(
    (entry) => entry.schema === 'public'
  );

  for (const entry of publicTables) {
    try {
      const count = await countRowsForIds(
        supabase,
        entry.table,
        entry.column,
        poolUserIds
      );
      if (count > 0) {
        warnings.push(`${entry.table}.${entry.column}: ${count}`);
      }
    } catch (error) {
      warnings.push(`${entry.table}.${entry.column}: ${String(error)}`);
    }
  }

  try {
    const authCount = await countWorkerAuthUsers(supabase);
    if (authCount > 0) warnings.push(`auth.users.email: ${authCount}`);
  } catch (error) {
    warnings.push(`auth.users.email: ${String(error)}`);
  }

  try {
    const profileCount = await countWorkerProfiles(supabase);
    if (profileCount > 0) warnings.push(`profiles.email: ${profileCount}`);
  } catch (error) {
    warnings.push(`profiles.email: ${String(error)}`);
  }

  if (warnings.length === 0) {
    console.log('[Global Teardown] ✓ Pool cleanup assertion passed');
    return;
  }

  throw new Error(
    [
      '[Global Teardown] Pool cleanup assertion failed:',
      ...warnings.map((warning) => `  - ${warning}`),
    ].join('\n')
  );
}

async function globalTeardown(config: FullConfig): Promise<void> {
  loadPlaywrightEnv();
  forceLocalPlaywrightEnvIfNeeded(config);

  console.log('\n[Global Teardown] ============================================');
  console.log('[Global Teardown] Cleaning up test data...');
  console.log('[Global Teardown] ============================================\n');

  if (process.env.SKIP_E2E_CLEANUP === 'true') {
    console.log('[Global Teardown] Skipping test data cleanup (SKIP_E2E_CLEANUP=true)');
    return;
  }

  try {
    const testEnv = process.env.TEST_ENV || 'local';
    const baseURL = process.env.BASE_URL || '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isLocalSupabase = isLocalSupabaseUrl(supabaseUrl);
    const isDevEnvironment = testEnv === 'dev' || baseURL.includes('dev.quiversurf.app');
    const hasPlaywrightProjects =
      Array.isArray(config.projects) && config.projects.length > 0;
    const shouldRunLocalPoolCleanup =
      isLocalSupabase && !isDevEnvironment && hasPlaywrightProjects;
    let serviceClient: SupabaseClient | null = null;
    let poolUserIds: string[] = [];
    let ephemeralCount = 0;

    try {
      serviceClient = createServiceClient();
      poolUserIds = shouldRunLocalPoolCleanup ? await getPoolUserIds(serviceClient) : [];
    } catch (error) {
      console.warn(
        '[Global Teardown] ⚠️  Skipping ephemeral sweep (service client unavailable):',
        error
      );
    }

    if (serviceClient) {
      try {
        const ephemeralResult = await cleanupEphemeralSmokeUsers(
          serviceClient,
          false,
          true
        );
        ephemeralCount = ephemeralResult.count;
        if (ephemeralResult.error) {
          console.warn(
            `[Global Teardown] ⚠️  Ephemeral users cleanup warning: ${ephemeralResult.error}`
          );
        }
      } catch (error) {
        console.warn('[Global Teardown] ⚠️  Skipping ephemeral sweep:', error);
      }
    }

    if (shouldRunLocalPoolCleanup && serviceClient) {
      await cleanupWorkerPoolUsers();
      clearLocalAuthStates();
      const orphanResult = await cleanupOrphanSmokeProfiles(serviceClient, true);
      if (orphanResult.error) {
        throw new Error(
          `[Global Teardown] Worker pool profile cleanup failed: ${orphanResult.error}`
        );
      }
      await assertPoolClean(serviceClient, poolUserIds);
    } else if (isDevEnvironment) {
      const result = await cleanupAllTestData({
        verbose: true,
        skipEphemeralSmokeUsers: true,
      });
      const totalCleaned = result.totalCleaned + ephemeralCount;
      console.log(`[Global Teardown] Cleaned ${totalCleaned} test item(s)`);

      if (result.sessions.error) {
        console.warn(`[Global Teardown] ⚠️  Sessions cleanup warning: ${result.sessions.error}`);
      }
      if (result.intelPosts.error) {
        console.warn(`[Global Teardown] ⚠️  Intel posts cleanup warning: ${result.intelPosts.error}`);
      }
    } else if (ephemeralCount > 0) {
      console.log(
        `[Global Teardown] ✓ Cleaned ${ephemeralCount} ephemeral smoke user(s)`
      );
    }
  } catch (error) {
    console.warn('[Global Teardown] ⚠️  Test data cleanup failed (non-fatal):', error);
    console.warn('[Global Teardown] Tests completed but test data may remain in the database');
    if (isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '')) {
      throw error;
    }
  }

  console.log('\n[Global Teardown] ============================================');
  console.log('[Global Teardown] Teardown complete');
  console.log('[Global Teardown] ============================================\n');
}

export default globalTeardown;
