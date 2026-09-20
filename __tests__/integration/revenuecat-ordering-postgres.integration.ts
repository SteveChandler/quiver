/** @jest-environment node */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { POST } from '@/app/api/webhooks/revenuecat/route';
import { expectConsoleErrors } from '@/__tests__/setup/test-utils';
import { resetAccountSql } from '@/scripts/qa/account-presets';
import { buildEntitlementUpdate, type RCEvent } from '@/app/api/webhooks/revenuecat/entitlement-update';

jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceRoleClient: async () => mockClient }));
jest.mock('@/lib/alerts/auto-enable-similarity', () => ({ ensureSimilarityRuleForUser: async () => ({ created: false, reason: 'fixture' }) }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

const directory = mkdtempSync(join(tmpdir(), 'quiver-rc-order-'));
const bin = process.env.RC_TEST_PG_BIN ?? execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
const args = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55439', '-U', 'postgres', '-d', 'postgres'];
const userId = '20000000-0000-4000-8000-000000000001';
const ledger = new Map<string, { processed_at: string | null }>();
const failures: unknown[] = [];
const originalSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
function sql(query: string): string {
  return execFileSync(join(bin, 'psql'), [...args, '-c', query], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function literal(value: unknown): string {
  if (value === null) return 'NULL';
  return `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
}
function upsert(row: Record<string, unknown>): string {
  const keys = Object.keys(row);
  return `INSERT INTO user_entitlements(${keys.join(',')}) VALUES(${keys.map(key => literal(row[key])).join(',')}) ON CONFLICT(user_id) DO UPDATE SET ${keys.filter(key => key !== 'user_id').map(key => `${key}=excluded.${key}`).join(',')}`;
}
const mockClient = { from: (table: string) => {
  if (table === 'user_entitlements') return {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: JSON.parse(sql(`SELECT row_to_json(e) FROM user_entitlements e WHERE user_id='${userId}'`) || 'null'), error: null }) }) }),
    upsert: async (row: Record<string, unknown>) => {
      try { sql(upsert(row)); return { error: null }; }
      catch { return { error: { message: 'RevenueCat event_timestamp_ms required' } }; }
    },
  };
  if (table === 'revenuecat_provider_events') return {
    insert: async (row: { provider_event_id: string }) => {
      if (ledger.has(row.provider_event_id)) return { error: { code: '23505' } };
      ledger.set(row.provider_event_id, { processed_at: null }); return { error: null };
    },
    select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: async () => ({ data: ledger.get(id), error: null }) }) }),
    update: (row: { processed_at: string }) => ({ eq: async (_key: string, id: string) => { ledger.set(id, row); return { error: null }; } }),
  };
  if (table === 'user_entitlements_failed_webhooks') return { insert: async (row: unknown) => { failures.push(row); return { error: null }; } };
  throw new Error(`Unexpected table ${table}`);
} };
function event(id: string, type: string, timestamp: number): Record<string, unknown> {
  return { id, type, app_user_id: userId, product_id: 'pro', event_timestamp_ms: timestamp, expiration_at_ms: Date.now() + 86400000, period_type: 'NORMAL' };
}
async function webhook(value: Record<string, unknown>): Promise<Response> {
  return POST(new Request('https://quiver.test/api/webhooks/revenuecat', { method: 'POST', headers: { authorization: 'Bearer fixture', 'content-type': 'application/json' }, body: JSON.stringify({ event: value }) }));
}

beforeAll(() => {
  execFileSync(join(bin, 'initdb'), ['-D', join(directory, 'data'), '-A', 'trust', '-U', 'postgres'], { stdio: 'ignore' });
  execFileSync(join(bin, 'pg_ctl'), ['-D', join(directory, 'data'), '-l', join(directory, 'server.log'), '-o', `-k ${directory} -h '' -p 55439`, 'start'], { stdio: 'ignore' });
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN NEW.updated_at=now(); RETURN NEW; END';`);
  sql(readFileSync('supabase/migrations/20260420185916_create_user_entitlements.sql', 'utf8'));
  sql(readFileSync('supabase/migrations/20260915181000_order_revenuecat_entitlement_events.sql', 'utf8'));
  sql(`INSERT INTO auth.users VALUES('${userId}')`);
  process.env.REVENUECAT_WEBHOOK_SECRET = 'fixture';
});
beforeEach(() => { sql('TRUNCATE user_entitlements'); ledger.clear(); failures.length = 0; });
afterAll(() => {
  execFileSync(join(bin, 'pg_ctl'), ['-D', join(directory, 'data'), '-m', 'fast', 'stop'], { stdio: 'ignore' });
  if (originalSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_SECRET;
  else process.env.REVENUECAT_WEBHOOK_SECRET = originalSecret;
});

it.each(['UNCANCELLATION', 'RENEWAL', 'EXPIRATION'])('ignores delayed cancellation after %s and marks it processed; duplicates remain harmless', async (type) => {
  expect((await webhook(event('initial', 'INITIAL_PURCHASE', 1000))).status).toBe(200);
  expect((await webhook(event('newer', type, 3000))).status).toBe(200);
  const before = sql('SELECT row_to_json(e) FROM user_entitlements e');
  expect((await webhook(event('late', 'CANCELLATION', 2000))).status).toBe(200);
  expect(sql('SELECT row_to_json(e) FROM user_entitlements e')).toBe(before);
  expect(ledger.get('late')?.processed_at).toEqual(expect.any(String));
  expect(await (await webhook(event('late', 'CANCELLATION', 2000))).json()).toMatchObject({ duplicate: true });
  expect(sql('SELECT row_to_json(e) FROM user_entitlements e')).toBe(before);
});

it('resolves tied timestamps by stable ID, and sends missing timestamps to the existing DLQ', async () => {
  await webhook(event('z', 'RENEWAL', 3000));
  await webhook(event('a', 'CANCELLATION', 3000));
  expect(sql('SELECT will_renew FROM user_entitlements')).toBe('t');
  sql('TRUNCATE user_entitlements'); ledger.clear();
  await webhook(event('a', 'CANCELLATION', 3000));
  await webhook(event('z', 'RENEWAL', 3000));
  expect(sql('SELECT will_renew FROM user_entitlements')).toBe('t');
  const missing = event('missing', 'CANCELLATION', 4000); delete missing.event_timestamp_ms;
  expect(await (await webhook(missing)).json()).toMatchObject({ queued_for_reconciliation: true });
  expectConsoleErrors([/Upsert failed/]);
  expect(failures).toHaveLength(1);
  expect(ledger.get('missing')?.processed_at).toBeNull();
  expect(sql('SELECT will_renew FROM user_entitlements')).toBe('t');
});

it('retains the watermark across a gift mirror, protects active gifts and lifetime access, and allows genuine gift expiry', async () => {
  await webhook(event('newer', 'RENEWAL', 3000));
  sql(`UPDATE user_entitlements SET product_id='rc_promo_month',expires_at=now()+interval '1 month',will_renew=false,rc_raw='{"type":"PROMOTIONAL_GRANT","store":"PROMOTIONAL"}'`);
  expect(sql("SELECT rc_field_events->'is_pro'->>0 FROM user_entitlements")).toBe('3000');
  await webhook(event('late', 'EXPIRATION', 2000));
  await webhook(event('old-store', 'EXPIRATION', 4000));
  expect(sql('SELECT is_pro FROM user_entitlements')).toBe('t');
  sql(upsert({ user_id: userId, ...buildEntitlementUpdate(event('shorter', 'RENEWAL', 4500) as RCEvent), rc_raw: event('shorter', 'RENEWAL', 4500) }));
  expect(sql('SELECT product_id FROM user_entitlements')).toBe('rc_promo_month');
  await webhook({ ...event('gift-end', 'EXPIRATION', 5000), product_id: 'rc_promo_month' });
  expect(sql('SELECT is_pro FROM user_entitlements')).toBe('f');
  sql(`UPDATE user_entitlements SET is_pro=true,product_id='rc_promo_lifetime',expires_at=NULL,rc_raw='{"type":"PROMOTIONAL_GRANT"}'`);
  sql(upsert({ user_id: userId, is_pro: false, previous_product_id: 'pro', rc_raw: event('racing-expiry', 'EXPIRATION', 6000) }));
  expect(sql('SELECT is_pro FROM user_entitlements')).toBe('t');
  sql(`UPDATE user_entitlements SET product_id='app.quiversurf.surf.pro.lifetime',rc_raw='{"type":"PROMOTIONAL_GRANT"}'`);
  sql(upsert({ user_id: userId, is_pro: false, previous_product_id: 'app.quiversurf.surf.pro.lifetime', rc_raw: { ...event('refund', 'CANCELLATION', 7000), product_id: 'app.quiversurf.surf.pro.lifetime' } }));
  expect(sql('SELECT is_pro FROM user_entitlements')).toBe('f');
});

it('preserves the existing QA preset insert and upsert metadata path', () => {
  for (const scenario of ['trial', 'expired'] as const) {
    const statement = resetAccountSql(scenario, userId, userId).split('INSERT INTO user_entitlements')[1].split('COMMIT;')[0];
    sql(`INSERT INTO user_entitlements${statement}`);
    expect(sql("SELECT rc_raw->>'qa_registry',is_pro FROM user_entitlements")).toBe(`quiver-local-qa-v1|${scenario === 'trial' ? 't' : 'f'}`);
    expect(sql("SELECT rc_field_events='{}'::jsonb FROM user_entitlements")).toBe('t');
  }
});

it('serializes a competing update and upsert against the committed newer event', async () => {
  await webhook(event('initial', 'INITIAL_PURCHASE', 1000));
  const writer = spawn(join(bin, 'psql'), args, { stdio: ['pipe', 'pipe', 'pipe'] });
  const ready = once(writer.stdout, 'data');
  writer.stdin.write(`BEGIN; UPDATE user_entitlements SET will_renew=true,rc_raw=${literal(event('newer', 'UNCANCELLATION', 3000))}::jsonb WHERE user_id='${userId}'; SELECT 'locked';\n`);
  await ready;
  const older = spawn(join(bin, 'psql'), [...args, '-c', upsert({ user_id: userId, will_renew: false, rc_raw: event('older', 'CANCELLATION', 2000) })]);
  const done = once(older, 'exit');
  const deadline = Date.now() + 5000;
  while (sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%older%'") !== '1') {
    if (Date.now() > deadline) throw new Error('Older writer did not wait for row lock');
  }
  const writerDone = once(writer, 'exit');
  writer.stdin.end('COMMIT;\n');
  expect((await done)[0]).toBe(0);
  expect((await writerDone)[0]).toBe(0);
  expect(sql("SELECT will_renew,rc_field_events->'will_renew'->>1 FROM user_entitlements")).toBe('t|newer');
});

it('matches every SQL field set to the real webhook producer including lifetime refunds', () => {
  const cases = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'PRODUCT_CHANGE', 'TRANSFER'];
  for (const type of cases) {
    for (const product of ['pro', 'rc_promo_month', 'app.quiversurf.surf.pro.lifetime']) {
      const input = { ...event('field-check', type, 1000), product_id: product } as RCEvent;
      const fields = JSON.parse(sql(`SELECT to_jsonb(revenuecat_entitlement_fields(${literal(input)}::jsonb))`));
      expect(fields.sort()).toEqual(Object.keys(buildEntitlementUpdate(input) ?? {}).sort());
    }
  }
});

it('applies older purchase access while preserving newer cancellation and billing fields, without later resurrection', async () => {
  await webhook(event('cancel', 'CANCELLATION', 4000));
  await webhook(event('billing', 'BILLING_ISSUE', 5000));
  const renewal = { ...event('renew', 'RENEWAL', 3000), expiration_at_ms: Date.now() + 172800000 };
  await webhook(renewal);
  expect(sql('SELECT is_pro,will_renew,billing_issue FROM user_entitlements')).toBe('t|f|t');
  expect(sql("SELECT rc_raw->>'id' FROM user_entitlements")).toBe('billing');
  await webhook(event('purchase', 'INITIAL_PURCHASE', 2000));
  expect(Date.parse(sql('SELECT expires_at FROM user_entitlements'))).toBe(renewal.expiration_at_ms);
  await webhook(event('expiry', 'EXPIRATION', 6000));
  await webhook(event('late-renewal', 'RENEWAL', 5500));
  expect(sql('SELECT is_pro,will_renew FROM user_entitlements')).toBe('f|f');
});
