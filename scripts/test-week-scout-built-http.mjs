import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.WEEK_SCOUT_HTTP_ARTIFACT_DIR;
assert(output, 'Set WEEK_SCOUT_HTTP_ARTIFACT_DIR to the local evidence directory');
mkdirSync(output, { recursive: true });
const userId = '10000000-0000-4000-8000-000000000001';
const beachId = '00000000-0000-4000-8000-000000000001';
const token = 'local-week-scout-http-only';
const externalCalls = [];
let dataMode = 'empty';
let backend;
const ownedChildren = new Set();
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const digest = (value) => createHash('sha256').update(value).digest('hex');

// Only the external Supabase HTTP boundary is controlled. Auth wrapper, SDK,
// route, collector, default service dependencies and response serialization run
// from the built app. Unknown auth tokens are rejected by this fixture provider.
const gateway = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  const url = new URL(request.url, 'http://127.0.0.1');
  externalCalls.push({ path: url.pathname, method: request.method, body: body ? JSON.parse(body) : null });
  response.setHeader('Content-Type', 'application/json');
  const send = (value, status = 200) => { response.statusCode = status; response.end(JSON.stringify(value)); };
  if (url.pathname === '/auth/v1/user') {
    if (request.headers.authorization !== `Bearer ${token}`) return send({ message: 'Invalid fixture token' }, 401);
    return send({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
  }
  if (url.pathname === '/rest/v1/user_location_snapshots') return send({ lat: 32.75, lon: -117.1, captured_at: new Date().toISOString() });
  if (url.pathname === '/rest/v1/profiles') return send({ id: userId, experience_level: 'intermediate', max_drive_minutes: 120 });
  if (url.pathname === '/rest/v1/rpc/get_weekend_scout_candidates_page') {
    return send(dataMode === 'incomplete' ? [{ id: beachId, distance_meters: 1, total_count: 2 }] : []);
  }
  if (url.pathname.startsWith('/rest/v1/')) return send([]);
  return send({ error: 'Unexpected external request' }, 500);
});

function start(args, env, logName) {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...args], {
    cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = createWriteStream(resolve(output, logName));
  child.stdout.pipe(log); child.stderr.pipe(log);
  child.once('exit', () => { ownedChildren.delete(child); log.end(); });
  ownedChildren.add(child);
  return child;
}

try {
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  const gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;
  const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
  const port = portProbe.address().port; await new Promise((done) => portProbe.close(done));
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR ?? '/tmp',
    NODE_ENV: 'production', VERCEL_ENV: 'preview', NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: '--max-old-space-size=8192',
    NEXT_PUBLIC_SUPABASE_URL: gatewayUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-only',
    SUPABASE_SERVICE_ROLE_KEY: 'local-service-only', NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '',
  };
  const buildArgs = ['build', '--webpack', '--debug-build-paths', 'app/api/surf/week-scout/route.ts'];
  const build = start(buildArgs, env, 'build.log');
  const timeout = setTimeout(() => { try { process.kill(-build.pid, 'SIGTERM'); } catch {} }, 240_000);
  const [code] = await once(build, 'exit'); clearTimeout(timeout);
  assert.equal(code, 0, 'Bounded Next build failed; inspect build.log');
  backend = start(['start', '--hostname', '127.0.0.1', '--port', String(port)], env, 'server.log');
  const url = `http://127.0.0.1:${port}/api/surf/week-scout`;
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const request = { candidateScope: { kind: 'complete-radius' }, localTimezone: 'America/Los_Angeles', startLocalDate: localDate, dayCount: 7 };
  const post = (body, bearer = token) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await post(request, null); if (response.status === 401) { ready = true; break; } } catch {}
    if (backend.exitCode !== null) break;
    await delay(250);
  }
  assert(ready, 'Built server failed readiness/auth check');
  const results = [];
  async function check(name, response, expectedStatus) {
    const body = await response.json();
    assert.equal(response.status, expectedStatus, `${name}: ${JSON.stringify(body)}`);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    results.push({ name, status: response.status, body });
    return body;
  }
  await check('missing bearer', await post(request, null), 401);
  await check('invalid bearer', await post(request, 'invalid-fixture-token'), 401);
  await check('invalid request', await post({ ...request, dayCount: 1 }), 400);
  const beforeComplete = externalCalls.length;
  const complete = await check('complete-radius serialization/mode', await post(request), 200);
  assert.equal(complete.success, true);
  assert.match(complete.data.scorerVersion, /:distance-independent-v1$/);
  assert.equal(complete.data.coverage.scope.candidates.enumerated, 0);
  assert.equal(complete.data.days.length, 7);
  assert.equal(complete.data.sessionDecision.selection, null);
  assert(externalCalls.slice(beforeComplete).some((call) => call.path.endsWith('/get_weekend_scout_candidates_page') && call.body.limit_count === 500));
  const beforeLegacy = externalCalls.length;
  const legacy = await check('legacy mode', await post({ candidateBeachIds: [beachId], localTimezone: request.localTimezone, startLocalDate: localDate, dayCount: 7 }), 200);
  assert.equal(legacy.data.scorerVersion, 'week-scout-v2:day-window-authority-v1');
  assert.equal(legacy.data.coverage, undefined);
  assert(!externalCalls.slice(beforeLegacy).some((call) => call.path.endsWith('/get_weekend_scout_candidates_page')));
  dataMode = 'incomplete';
  const incomplete = await check('incomplete enumeration', await post(request), 503);
  assert.equal(incomplete.success, false); assert.equal(incomplete.data, undefined);
  assert.equal((await fetch(url)).status, 405);
  const routePath = '.next/server/app/api/surf/week-scout/route.js';
  const tracePath = `${routePath}.nft.json`;
  const trace = JSON.parse(readFileSync(resolve(root, tracePath), 'utf8'));
  const tracedDirectories = [];
  const tracedHashes = trace.files.sort().flatMap((file) => {
    const path = resolve(root, dirname(routePath), file);
    if (statSync(path).isDirectory()) { tracedDirectories.push(file); return []; }
    return [[file, digest(readFileSync(path))]];
  });
  const evidence = {
    buildCommand: `node node_modules/next/dist/bin/next ${buildArgs.join(' ')}`,
    buildId: readFileSync(resolve(root, '.next/BUILD_ID'), 'utf8').trim(),
    routeSha256: digest(readFileSync(resolve(root, routePath))),
    tracedFilesSha256: digest(JSON.stringify(tracedHashes)), tracedFileCount: tracedHashes.length,
    tracedDirectories,
    applicationFiles: ['app/api/surf/week-scout/route.ts', 'lib/services/discovery/week-scout.ts'].map((file) => ({ file, sha256: digest(readFileSync(resolve(root, file))) })),
    results, methodCheck: { method: 'GET', status: 405 }, externalCalls,
    boundaries: 'Loopback Supabase HTTP fixture (auth user and data); actual Next production build/start, middleware, auth wrapper, collector, default service and serialization. No full behavioral-suite replay over HTTP.',
  };
  writeFileSync(resolve(output, 'built-http.json'), JSON.stringify(evidence, null, 2));
  console.log(`PASS: 7 narrow built-HTTP checks; build ${evidence.buildId}; route SHA-256 ${evidence.routeSha256}`);
} finally {
  for (const child of ownedChildren) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  gateway.closeAllConnections(); gateway.close();
}
