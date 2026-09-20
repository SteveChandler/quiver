/** @jest-environment node */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import { expectConsoleErrors } from '@/__tests__/setup/test-utils';
import { runTrialFeedbackReconciliation } from '@/lib/trial-feedback/reconciliation';
import { GET as webGet, POST as webPost } from '@/app/api/trial-feedback/web/route';
import { runWebRecoveryQueue } from '@/lib/trial-feedback/web-recovery';
import { GET, POST } from '@/app/api/trial-feedback/route';
import { POST as webhook } from '@/app/api/webhooks/revenuecat/route';
import type { RCEvent } from '@/app/api/webhooks/revenuecat/entitlement-update';
import { POST as redeem } from '@/app/api/trial-feedback/redemption/route';

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));
jest.mock('@/lib/alerts/auto-enable-similarity', () => ({ ensureSimilarityRuleForUser: jest.fn(async () => ({ created: false, reason: 'outside_feedback_contract' })) }));
jest.mock('@supabase/realtime-js', () => ({ RealtimeClient: jest.fn(() => ({ setAuth: jest.fn(), disconnect: jest.fn() })) }));
jest.mock('@/lib/email/lifecycle', () => ({ lifecycleRpc: (name: string, args: Record<string, unknown>) => mockDatabaseRpc(name, args) }));

const user = 'dddd0000-0000-4000-8000-000000000001';
const requestId = 'bbbb0000-0000-4000-8000-000000000001';
const otherId = 'bbbb0000-0000-4000-8000-000000000002';
const originalFetch = global.fetch;
const environmentKeys = ['TRIAL_FEEDBACK_WEB_ENABLED', 'TRIAL_FEEDBACK_ENABLED', 'TRIAL_FEEDBACK_REDEMPTION_ENABLED', 'TRIAL_FEEDBACK_WORKER_ENABLED', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'REVENUECAT_WEBHOOK_SECRET', 'REVENUECAT_SECRET_API_KEY', 'REVENUECAT_V2_SECRET_API_KEY', 'REVENUECAT_PROJECT_ID'];
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
let authToken: string;
let ip = 0;
let failCompletion = false;
function sql(query: string): string {
  const socket = process.env.LIFECYCLE_TEST_SOCKET;
  const binary = process.env.LIFECYCLE_TEST_PSQL;
  if (!socket || !/\/quiver-email-lifecycle\.[A-Za-z0-9]+$/.test(socket) || !existsSync(`${socket}/data/PG_VERSION`) || !binary) {
    throw new Error('Run bash scripts/test-email-lifecycle.sh --feedback-contract; disposable socket required');
  }
  return execFileSync(binary, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-p', '55438', '-U', 'postgres', '-d', 'postgres', '-c', query], { encoding: 'utf8' }).trim();
}
function literal(value: unknown): string {
  if (value === null) return 'NULL';
  return `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
}
async function mockDatabaseRpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!/^[a-z_]+$/.test(name) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key))) throw new Error('Invalid RPC');
  const parameters = Object.entries(args).map(([key, value]) => `${key} => ${literal(value)}`).join(',');
  const result = sql(`SET ROLE service_role; SELECT to_jsonb(public.${name}(${parameters}));`);
  return result ? JSON.parse(result) : null;
}
// Replace only PostgREST transport with bounded SQL against the disposable cluster.
// The real Supabase client, webhook parser and persistence calls remain in the path.
function databaseHttp(url: URL, init?: RequestInit): Response {
  if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-service') throw new Error('Expected service-role transport');
  const table = url.pathname.slice('/rest/v1/'.length);
  if (!['revenuecat_provider_events', 'user_entitlements', 'cron_runs'].includes(table)) throw new Error(`Unexpected table: ${table}`);
  const key = table === 'cron_runs' ? 'id' : table === 'user_entitlements' ? 'user_id' : 'provider_event_id';
  const filter = url.searchParams.get(key);
  const where = filter?.startsWith('eq.') ? `${key}=${literal(filter.slice(3))}` : '';
  const method = init?.method ?? 'GET';
  const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  if (method === 'GET' && where) {
    const projection = url.searchParams.get('select');
    const expected = table === 'user_entitlements' ? 'is_pro,is_trialing,expires_at,product_id' : 'processed_at';
    if (projection !== expected) throw new Error('Unexpected database projection');
    const rows = sql(`SET ROLE service_role; SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT ${projection} FROM ${table} WHERE ${where}) t`);
    return json(JSON.parse(rows));
  }
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  const columns = Object.keys(body);
  if (!columns.length || columns.some(column => !/^[a-z_]+$/.test(column))) throw new Error('Invalid write columns');
  if (table === 'cron_runs') {
    if (method === 'POST' && columns.sort().join(',') === 'job,route,status') {
      const run = sql(`SET ROLE service_role; INSERT INTO cron_runs(route,job,status) VALUES (${literal(body.route)},${literal(body.job)},${literal(body.status)}) RETURNING jsonb_build_object('id',id)`);
      return json(JSON.parse(run));
    }
    if (method === 'PATCH' && where && columns.sort().join(',') === 'finished_at,status,summary') {
      sql(`SET ROLE service_role; UPDATE cron_runs SET status=${literal(body.status)},finished_at=${literal(body.finished_at)},summary=${literal(body.summary)}::jsonb WHERE ${where}`);
      return new Response(null, { status: 204 });
    }
    throw new Error('Unexpected run operation');
  }
  if (method === 'PATCH' && where && table === 'revenuecat_provider_events' && columns.join() === 'processed_at') {
    if (failCompletion) return json({ message: 'Synthetic completion outage', code: 'fixture' }, 503);
    sql(`SET ROLE service_role; UPDATE ${table} SET processed_at=${literal(body.processed_at)} WHERE ${where}`);
    return new Response(null, { status: 204 });
  }
  if (method !== 'POST') throw new Error(`Unexpected database operation: ${method}`);
  if (table === 'user_entitlements' && (url.searchParams.get('on_conflict') !== 'user_id' || !new Headers(init?.headers).get('prefer')?.includes('resolution=merge-duplicates'))) throw new Error('Expected entitlement upsert');
  const names = columns.join(',');
  const conflict = table === 'user_entitlements'
    ? `DO UPDATE SET ${columns.filter(column => column !== key).map(column => `${column}=EXCLUDED.${column}`).join(',')}`
    : 'DO NOTHING';
  const inserted = sql(`SET ROLE service_role; INSERT INTO ${table} (${names}) SELECT ${names} FROM jsonb_populate_record(NULL::${table},${literal(body)}::jsonb) ON CONFLICT (${key}) ${conflict} RETURNING ${key}`);
  if (!inserted && table === 'revenuecat_provider_events') return json({ code: '23505', message: 'Duplicate fixture event' }, 409);
  return new Response(null, { status: 201 });
}
function providerRequest(event: RCEvent, authorized = true): Request {
  return new Request('http://localhost/api/webhooks/revenuecat', {
    method: 'POST', headers: { authorization: authorized ? 'Bearer fixture-webhook' : 'wrong', 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_version: '1.0', event }),
  });
}
function token(): string {
  return [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(JSON.stringify({ sub: user, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.');
}
function request(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/trial-feedback', {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json', 'x-real-ip': `198.51.100.${++ip}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeAll(() => {
  authToken = token();
  Object.assign(process.env, { TRIAL_FEEDBACK_ENABLED: 'true', TRIAL_FEEDBACK_REDEMPTION_ENABLED: 'true', TRIAL_FEEDBACK_WORKER_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', REVENUECAT_WEBHOOK_SECRET: 'fixture-webhook',
    REVENUECAT_SECRET_API_KEY: 'fixture', REVENUECAT_V2_SECRET_API_KEY: 'fixture', REVENUECAT_PROJECT_ID: 'projfixture' });
  sql(`DELETE FROM trial_feedback_submissions WHERE user_id='${user}'; UPDATE email_contact_state SET paused_at=NULL WHERE user_id='${user}';
    UPDATE user_entitlements SET trial_ends_at=date_trunc('milliseconds',trial_ends_at) WHERE user_id='${user}';
    UPDATE revenuecat_provider_events SET expiration_at=date_trunc('milliseconds',expiration_at) WHERE app_user_id='${user}';`);
  const expiry = sql(`SELECT trial_ends_at::text FROM user_entitlements WHERE user_id='${user}'`);
  const expires = new Date(expiry).toISOString();
  const cancelled = new Date(Date.now() - 86400000).toISOString();
  // Auth/provider HTTP responses are fixtures. Handlers, eligibility refresh, validation and SQL state transitions are real.
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:54321/rest/v1/')) return databaseHttp(new URL(url), init);
    let body: unknown;
    if (url.startsWith('http://127.0.0.1:54321/auth/v1/user')) {
      if (new Headers(init?.headers).get('authorization') !== `Bearer ${authToken}`) return new Response('{}', { status: 401 });
      body = { id: user, email: 'feedback@example.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' };
    } else if (url === `https://api.revenuecat.com/v2/projects/projfixture/customers/${user}`) body = { id: user, project_id: 'projfixture' };
    else if (url === `https://api.revenuecat.com/v2/projects/projfixture/customers/${user}/aliases?limit=100`) body = { items: [{ id: user }], next_page: null };
    else if (url === `https://api.revenuecat.com/v1/subscribers/${user}`) body = { subscriber: { original_app_user_id: user,
      entitlements: { 'Quiver Pro': { product_identifier: 'pro', expires_date: expires } },
      subscriptions: { pro: { store: 'app_store', period_type: 'trial', is_sandbox: false, expires_date: expires, unsubscribe_detected_at: cancelled, billing_issues_detected_at: null } } } };
    else throw new Error(`Unexpected network request: ${new URL(url).origin}`);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});
afterAll(() => {
  global.fetch = originalFetch;
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

it('connects authenticated feedback, immutable submission, reservation, one handoff and exact receipt fulfillment in PostgreSQL', async () => {
  const initial = await GET(request());
  expect(initial.status).toBe(200);
  expect(await initial.json()).toMatchObject({ status: 'available', offer: null });
  expect(sql(`SELECT count(*) FROM trial_feedback_submissions WHERE user_id='${user}'`)).toBe('0');

  const saved = await POST(request({ request_id: requestId, reason: 'time', note: 'Need more time in the water' }));
  expect(saved.status).toBe(200);
  const feedback = await saved.json();
  expect(feedback).toMatchObject({ status: 'submitted', offer: { store: 'APP_STORE', months: 1 } });
  expect(sql(`SELECT note FROM trial_feedback_submissions WHERE user_id='${user}'`)).toBe('Need more time in the water');
  expect(sql(`SELECT paused_at IS NOT NULL FROM email_contact_state WHERE user_id='${user}'`)).toBe('t');
  const replay = await POST(request({ request_id: otherId, reason: 'price', note: 'Must not overwrite' }));
  expect(replay.status).toBe(200);
  expect((await replay.json()).submission_id).toBe(feedback.submission_id);
  expect(sql(`SELECT note FROM trial_feedback_submissions WHERE user_id='${user}'`)).toBe('Need more time in the water');

  expect((await redeem(request({ action: 'reserve', request_id: requestId, terms_version: 'v1', accept: false }))).status).toBe(400);
  const reserved = await redeem(request({ action: 'reserve', request_id: requestId, terms_version: 'v1', accept: true }));
  expect(reserved.status).toBe(200);
  const reservation = await reserved.json();
  expect(reservation).toMatchObject({ redemption_state: 'reserved', reservation_id: requestId });
  expect((await redeem(request({ action: 'handoff', reservation_id: otherId }))).status).toBe(409);
  expect((await redeem(request({ action: 'handoff', reservation_id: requestId }))).status).toBe(200);
  expect((await redeem(request({ action: 'handoff', reservation_id: requestId }))).status).toBe(409);
  expect((await (await redeem(request({ action: 'reconcile' }))).json()).status).toBe('submitted');

  const receipt: RCEvent = {
    id: 'contract-redemption', type: 'RENEWAL', app_user_id: user, original_app_user_id: user,
    environment: 'PRODUCTION', store: 'APP_STORE', product_id: 'pro', period_type: 'TRIAL',
    entitlement_ids: ['Quiver Pro'], offer_code: reservation.offer.offer_identifier, price: 0,
    purchased_at_ms: Date.parse(reservation.offer.trial_ends_at),
    expiration_at_ms: Date.parse(reservation.offer.free_ends_at), event_timestamp_ms: Date.now(),
  };
  expect((await webhook(providerRequest(receipt, false))).status).toBe(401);
  expect(sql("SELECT count(*) FROM revenuecat_provider_events WHERE provider_event_id='contract-redemption'")).toBe('0');
  const rejectedReceipts: RCEvent[] = [
    { ...receipt, id: 'contract-sandbox', environment: 'SANDBOX' },
    { ...receipt, id: 'contract-missing-environment', environment: undefined },
    { ...receipt, id: 'contract-wrong-expiry', expiration_at_ms: receipt.expiration_at_ms! - 1000 },
    { ...receipt, id: 'contract-paid', price: 4.99 },
  ];
  for (const [index, rejectedReceipt] of rejectedReceipts.entries()) {
    // Distinct provider chronology: the eventual accepted receipt supersedes these fixtures.
    rejectedReceipt.event_timestamp_ms = receipt.event_timestamp_ms! - 100 + index;
    expect((await webhook(providerRequest(rejectedReceipt))).status).toBe(200);
    expect(sql(`SELECT processed_at IS NOT NULL FROM revenuecat_provider_events WHERE provider_event_id=${literal(rejectedReceipt.id)}`)).toBe('t');
    expect((await (await redeem(request({ action: 'reconcile' }))).json()).status).toBe('submitted');
  }
  expect(sql("SELECT environment_verified FROM revenuecat_provider_events WHERE provider_event_id='contract-missing-environment'")).toBe('f');
  failCompletion = true;
  expect((await webhook(providerRequest(receipt))).status).toBe(500);
  expectConsoleErrors([/\[rc-webhook\] Provider event completion write failed:/]);
  expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'Synthetic completion outage' }), expect.objectContaining({ tags: { feature: 'rc-webhook', step: 'provider-event-completion' } }));
  expect(sql("SELECT processed_at IS NULL FROM revenuecat_provider_events WHERE provider_event_id='contract-redemption'")).toBe('t');
  expect((await (await redeem(request({ action: 'reconcile' }))).json()).status).toBe('submitted');
  failCompletion = false;
  expect((await webhook(providerRequest(receipt))).status).toBe(200);
  const duplicate = await webhook(providerRequest(receipt));
  expect(duplicate.status).toBe(200);
  expect(await duplicate.json()).toMatchObject({ duplicate: true });
  expect(sql("SELECT count(*) FROM revenuecat_provider_events WHERE provider_event_id='contract-redemption' AND processed_at IS NOT NULL")).toBe('1');
  const entitlement = JSON.parse(sql(`SELECT to_jsonb(t) FROM (SELECT is_pro,is_trialing,will_renew,expires_at FROM user_entitlements WHERE user_id='${user}') t`));
  expect(entitlement).toMatchObject({ is_pro: true, is_trialing: true, will_renew: true });
  expect(Date.parse(entitlement.expires_at)).toBe(Date.parse(reservation.offer.free_ends_at));
  process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED = 'false';
  expect(await runTrialFeedbackReconciliation()).toMatchObject({ checked: 0, attention: 0 });
  expect(sql(`SELECT state FROM trial_feedback_submissions WHERE user_id='${user}'`)).toBe('reserved');
  // Advance only this synthetic fixture's queue eligibility, avoiding a ten-minute wall-clock wait.
  sql(`UPDATE trial_feedback_submissions SET last_reconciled_at=now()-interval '11 minutes' WHERE user_id='${user}'`);
  const run = await runTrialFeedbackReconciliation();
  expect(run).toMatchObject({ checked: 1, attention: 0 });
  const runRow = JSON.parse(sql("SELECT to_jsonb(t) FROM cron_runs t WHERE job='trial-feedback-reconciliation' ORDER BY started_at DESC LIMIT 1"));
  expect(runRow).toMatchObject({ status: 'ok', summary: { checked: 1, attention: 0 } });
  expect(runRow.finished_at).not.toBeNull();
  expect(sql(`SELECT state FROM trial_feedback_submissions WHERE user_id='${user}'`)).toBe('verified');
  const verified = await redeem(request({ action: 'reconcile' }));
  expect(verified.status).toBe(200);
  expect(await verified.json()).toMatchObject({ status: 'verified', redemption_state: 'verified', verified_until: reservation.offer.free_ends_at, offer: null });
  expect(sql(`SELECT count(*) FROM trial_feedback_submissions WHERE user_id='${user}' AND provider_event_id='contract-redemption' AND state='verified'`)).toBe('1');
  expect((await (await redeem(request({ action: 'reconcile' }))).json()).status).toBe('verified');
  expect((await redeem(request({ action: 'handoff', reservation_id: requestId }))).status).toBe(503);
});

it('extends an existing web trial once, recovers a lost provider response, and independently verifies portal renewal', async () => {
  const requestId = 'bbbb0000-0000-4000-8000-000000000004';
  const webUser = 'dddd0000-0000-4000-8000-000000000004';
  Object.assign(process.env, { TRIAL_FEEDBACK_ENABLED: 'true', TRIAL_FEEDBACK_REDEMPTION_ENABLED: 'true', TRIAL_FEEDBACK_WORKER_ENABLED: 'true', TRIAL_FEEDBACK_WEB_ENABLED: 'true' });
  sql(`DELETE FROM trial_feedback_submissions WHERE user_id='${webUser}';
    DELETE FROM revenuecat_provider_events WHERE app_user_id='${webUser}' AND provider_event_id NOT IN ('feedback-trial-4','feedback-trial-4-cancel');
    UPDATE revenuecat_provider_events SET purchased_at=date_trunc('milliseconds',purchased_at),expiration_at=date_trunc('milliseconds',expiration_at) WHERE app_user_id='${webUser}';
    UPDATE user_entitlements SET is_pro=true,is_trialing=true,will_renew=false,product_id='pro',trial_ends_at=(SELECT expiration_at FROM revenuecat_provider_events WHERE provider_event_id='feedback-trial-4') WHERE user_id='${webUser}';`);
  const period = JSON.parse(sql("SELECT jsonb_build_object('start',purchased_at,'end',expiration_at) FROM revenuecat_provider_events WHERE provider_event_id='feedback-trial-4'"));
  const snapshot = { object: 'subscription', id: 'subfixture', customer_id: webUser, original_customer_id: webUser, product_id: 'prodfixture',
    starts_at: Date.parse(period.start), current_period_starts_at: Date.parse(period.start), current_period_ends_at: Date.parse(period.end),
    environment: 'production', store: 'rc_billing', ownership: 'purchased', store_subscription_identifier: 'web-fixture', status: 'trialing', gives_access: true,
    pending_payment: false, auto_renewal_status: 'will_not_renew', total_revenue_in_usd: { currency: 'USD', gross: 0 }, pending_changes: null };
  const extensionRequests: Array<{ method: string | undefined; state: string; body: Record<string, number> }> = [];
  let extensionCalls = 0; let portalCalls = 0; let loseExtensionResponse = true; let unsafePortal = false;
  const webToken = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: webUser, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'fixture'].join('.');
  const req = (body?: unknown): NextRequest => new NextRequest('http://localhost/api/trial-feedback/web', { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${webToken}`, 'Content-Type': 'application/json', 'x-real-ip': `203.0.113.${++ip}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input); let result: unknown;
    const base = 'https://api.revenuecat.com/v2/projects/projfixture';
    if (url === 'http://127.0.0.1:54321/auth/v1/user') result = { id: webUser, email: 'web-feedback@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
    else if (url === `${base}/customers/${webUser}`) result = { id: webUser, project_id: 'projfixture' };
    else if (url === `${base}/customers/${webUser}/aliases?limit=100`) result = { items: [{ id: webUser }], next_page: null };
    else if (url === `https://api.revenuecat.com/v1/subscribers/${webUser}`) result = { subscriber: { original_app_user_id: webUser,
      entitlements: { 'Quiver Pro': { product_identifier: 'pro', expires_date: new Date(snapshot.current_period_ends_at).toISOString() } },
      subscriptions: { pro: { store: 'rc_billing', period_type: 'trial', is_sandbox: false, expires_date: new Date(snapshot.current_period_ends_at).toISOString(), unsubscribe_detected_at: new Date(Date.now()-86400000).toISOString(), billing_issues_detected_at: null } } } };
    else if (url === `${base}/customers/${webUser}/subscriptions?environment=production&limit=100`) result = { items: [snapshot], next_page: null };
    else if (url === `${base}/products/prodfixture`) result = { id: 'prodfixture', store_identifier: 'pro', type: 'subscription', state: 'active', subscription: { trial_duration: 'P2W' } };
    else if (url === `${base}/subscriptions/subfixture`) result = snapshot;
    else if (url === `${base}/subscriptions/subfixture/actions/extend`) {
      const body = JSON.parse(String(init?.body));
      extensionRequests.push({ method: init?.method, state: sql(`SELECT state FROM trial_feedback_web_recoveries WHERE user_id='${webUser}'`), body });
      extensionCalls++; snapshot.current_period_ends_at = body.extend_until_ms;
      if (loseExtensionResponse) throw new Error('Synthetic lost response after successful provider extension');
      result = snapshot;
    } else if (url === `${base}/subscriptions/subfixture/authenticated_management_url`) {
      portalCalls++; result = { object: 'authenticated_management_url', management_url: unsafePortal ? 'https://attacker.example/subfixture?token=fixture' : 'https://billing.revenuecat.com/appfixture/subfixture?token=fixture' };
    } else throw new Error('Unexpected fixture network request');
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  expect((await webPost(new NextRequest('http://localhost/api/trial-feedback/web', { method: 'POST', body: '{}' }))).status).toBe(401);
  expect((await webPost(req({ action: 'accept', request_id: requestId, terms_version: 'v1', accept: false }))).status).toBe(400);
  expect((await webPost(req({ action: 'accept', request_id: requestId, terms_version: 'v1', accept: true, user_id: user }))).status).toBe(400);
  expect((await (await webGet(req())).json()).status).toBe('unavailable');
  expect((await POST(req({ request_id: otherId, reason: 'time', note: 'Web fixture feedback' }))).status).toBe(200);
  expect((await (await webGet(req())).json()).status).toBe('unavailable');
  expect(sql("SELECT web_enabled FROM trial_feedback_controls")).toBe('f');
  sql('UPDATE trial_feedback_controls SET web_enabled=true');
  const available = await webGet(req()); expect(available.status).toBe(200);
  expect(await available.json()).toMatchObject({ user_id: webUser, status: 'available', terms_version: 'v1' });
  expect(sql("SELECT has_table_privilege('authenticated','trial_feedback_web_recoveries','SELECT')")).toBe('f');
  expect(sql("SELECT has_function_privilege('authenticated','reserve_trial_feedback_web(uuid,uuid,text,jsonb)','EXECUTE')")).toBe('f');
  const accepted = await Promise.all([requestId, otherId].map(id => webPost(req({ action: 'accept', request_id: id, terms_version: 'v1', accept: true }))));
  expect(accepted.map(response => response.status)).toEqual([200, 200]);
  expect((await (await webGet(req())).json()).status).toBe('review_required');
  expect(extensionCalls).toBe(1);
  expect(extensionRequests).toEqual([{ method: 'POST', state: 'pending', body: { extend_until_ms: Date.parse(sql(`SELECT expected_ends_at::text FROM trial_feedback_web_recoveries WHERE user_id='${webUser}'`)) } }]);
  expect(sql(`SELECT extension_verified_at IS NULL FROM trial_feedback_web_recoveries WHERE user_id='${webUser}'`)).toBe('t');
  expect(sql('SELECT trial_feedback_web_attention_count()')).toBe('1');
  expect(snapshot.current_period_starts_at).toBe(Date.parse(period.start));
  loseExtensionResponse = false;
  // Existing accepted work reconciles with new acceptance paused, without a second provider mutation.
  process.env.TRIAL_FEEDBACK_WEB_ENABLED = 'false'; process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED = 'false';
  expect((await webPost(req({ action: 'accept', request_id: otherId, terms_version: 'v1', accept: true }))).status).toBe(503);
  snapshot.current_period_ends_at += 1000;
  sql(`UPDATE trial_feedback_web_recoveries SET next_check_at=now() WHERE user_id='${webUser}'`);
  expect(await runWebRecoveryQueue()).toEqual({ checked: 1, attention: 1 });
  expect(sql(`SELECT extension_verified_at IS NULL FROM trial_feedback_web_recoveries WHERE user_id='${webUser}'`)).toBe('t');
  snapshot.current_period_ends_at -= 1000;
  sql(`UPDATE trial_feedback_web_recoveries SET next_check_at=now() WHERE user_id='${webUser}'`);
  expect(await runWebRecoveryQueue()).toEqual({ checked: 1, attention: 0 });
  expect(extensionCalls).toBe(1);
  expect((await (await webGet(req())).json()).status).toBe('extended');
  expect(sql(`SELECT mirror_verified_at IS NOT NULL FROM trial_feedback_web_recoveries WHERE user_id='${webUser}'`)).toBe('t');
  expect(Date.parse(sql(`SELECT trial_ends_at::text FROM user_entitlements WHERE user_id='${webUser}'`))).toBe(snapshot.current_period_ends_at);
  expect(sql(`SELECT will_renew FROM user_entitlements WHERE user_id='${webUser}'`)).toBe('f');
  sql(`UPDATE trial_feedback_web_recoveries SET next_check_at=now()-interval '31 minutes' WHERE user_id='${webUser}'`);
  expect(sql(`SELECT attention FROM trial_feedback_outcomes WHERE user_id='${webUser}'`)).toBe('web_reconciliation_overdue');
  expect(sql('SELECT trial_feedback_web_attention_count()')).toBe('1');
  unsafePortal = true;
  expect((await webPost(req({ action: 'portal' }))).status).toBe(409);
  unsafePortal = false;
  const portal = await webPost(req({ action: 'portal' })); expect(portal.status).toBe(200);
  expect(portal.headers.get('Cache-Control')).toContain('no-store');
  expect(await portal.json()).toEqual({ user_id: webUser, url: 'https://billing.revenuecat.com/appfixture/subfixture?token=fixture' });
  expect(portalCalls).toBe(2);
  expect(sql(`SELECT to_jsonb(r)::text LIKE '%token=%' FROM trial_feedback_web_recoveries r WHERE user_id='${webUser}'`)).toBe('f');
  expect((await (await webGet(req())).json()).status).toBe('extended');
  snapshot.auto_renewal_status = 'will_renew';
  expect((await (await webPost(req({ action: 'reconcile' }))).json()).status).toBe('renewing');
  expect(sql(`SELECT renewal_verified_at IS NOT NULL FROM trial_feedback_web_recoveries WHERE user_id='${webUser}'`)).toBe('t');
  expect(sql(`SELECT will_renew FROM user_entitlements WHERE user_id='${webUser}'`)).toBe('t');
  snapshot.auto_renewal_status = 'will_not_renew';
  expect((await (await webPost(req({ action: 'reconcile' }))).json()).status).toBe('extended');
  expect(extensionCalls).toBe(1);
  const dashboard = JSON.parse(sql("SET ROLE service_role; SELECT email_automation_dashboard()"));
  expect(dashboard.trial_feedback.find((item: { user_id: string }) => item.user_id === webUser)).toMatchObject({ web_state: 'extended', attention: null });
  sql(`UPDATE user_entitlements SET product_id='rc_promo_Quiver Pro_lifetime',is_trialing=false,trial_ends_at=NULL,expires_at=NULL WHERE user_id='${webUser}'`);
  expect((await (await webPost(req({ action: 'reconcile' }))).json()).status).toBe('review_required');
  expect(sql(`SELECT product_id FROM user_entitlements WHERE user_id='${webUser}'`)).toBe('rc_promo_Quiver Pro_lifetime');
  expect(sql(`SELECT attention FROM trial_feedback_web_recoveries WHERE user_id='${webUser}'`)).toBe('entitlement_mirror_conflict');
  expect(extensionCalls).toBe(1);
});
