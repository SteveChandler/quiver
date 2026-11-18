/** @jest-environment node */
import type { LifecycleDecision } from '@/lib/email/lifecycle';
import type { ActivationCall } from '@/lib/email/activation-call';
import type { WeekScoutWindowResponse } from '@/lib/services/discovery/week-scout';
jest.mock('@react-email/render', () => ({ render: async (element: unknown) => jest.requireActual('react-dom/server').renderToStaticMarkup(element) }));

// v4 row in 20261117130000_startup_lifecycle_v4_campaign.sql; computed with TRIAL_FEEDBACK_ENABLED=true and LIFECYCLE_V4_ENABLED=true.
const V4_HASH = 'b078fb0b9942d6b876503bf9f7ddc4ff8bb0ba418e42994d2484323d99d5ba14';
const V3_HASH = 'c4420192008baef0a920860820092f5e13e00788833963112bc2634c929fbde2';
const USER = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-11-19T17:00:00Z'; // Thursday 9 AM in Los Angeles

type Module = typeof import('@/lib/mailer/lifecycle-email');
function load(env: { feedback?: boolean; v4?: boolean }): Module {
 const saved = { f: process.env.TRIAL_FEEDBACK_ENABLED, v: process.env.LIFECYCLE_V4_ENABLED };
 try {
  if (env.feedback) process.env.TRIAL_FEEDBACK_ENABLED = 'true'; else delete process.env.TRIAL_FEEDBACK_ENABLED;
  if (env.v4) process.env.LIFECYCLE_V4_ENABLED = 'true'; else delete process.env.LIFECYCLE_V4_ENABLED;
  let mod: Module | undefined;
  jest.isolateModules(() => { mod = require('@/lib/mailer/lifecycle-email'); });
  return mod!;
 } finally {
  if (saved.f === undefined) delete process.env.TRIAL_FEEDBACK_ENABLED; else process.env.TRIAL_FEEDBACK_ENABLED = saved.f;
  if (saved.v === undefined) delete process.env.LIFECYCLE_V4_ENABLED; else process.env.LIFECYCLE_V4_ENABLED = saved.v;
 }
}

const beach = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Capitola', slug: 'capitola', timezone: 'America/Los_Angeles', windOffshoreDeg: 45, aspectDeg: null };
function windowFixture(overrides: Partial<WeekScoutWindowResponse['forecast']> = {}, start = '2026-11-21T15:00:00Z', end = '2026-11-21T18:00:00Z'): WeekScoutWindowResponse {
 return { id: 'w', displayWindowStart: start, displayWindowEnd: end, personalLabel: 'GOOD',
  forecast: { waveHeight: '3.4', period: '12.2', swellDirection: 'SSW', windSpeed: '4', windDirection: 'NE', tideHeightFt: null, tidePhase: null, freshnessAt: NOW, ...overrides } } as WeekScoutWindowResponse;
}
const good: ActivationCall = { kind: 'window', beach, label: 'GOOD', window: windowFixture(), now: NOW };
const decision: LifecycleDecision = { user_id: USER, campaign_id: 'startup-lifecycle-v4', status: 'due', reason: 'fixture', job: 'activation',
 source: { audience: 'trial', email: 'surfer@example.com', name: null, home_beach_id: beach.id, sessions: 0, last_completion: null, trial_end: null } };
const renderWith = (mod: Module, call?: ActivationCall, d: LifecycleDecision = decision) =>
 mod.renderLifecycleEmail(d, '22222222-2222-4222-8222-222222222222', 'https://example.com', 'founder@example.com', 'https://example.com/unsubscribe', call);

it('keeps the v3 hash and the v3 activation email byte for byte while LIFECYCLE_V4_ENABLED is unset', async () => {
 const v3 = load({ feedback: true });
 expect(v3.LIFECYCLE_CONTENT_HASH).toBe(V3_HASH);
 const withCall = await renderWith(v3, good);
 const without = await renderWith(v3);
 expect(withCall).toEqual(without);
 expect(without.subject).toBe('How was your last surf?');
});

it('needs trial feedback on as well, so the flag alone cannot break the approved hash', () => {
 expect(load({ v4: true }).LIFECYCLE_CONTENT_HASH).toBe(load({}).LIFECYCLE_CONTENT_HASH);
});

it('matches the approved startup-lifecycle-v4 hash, which hashes templates and not the rotated text', async () => {
 const v4 = load({ feedback: true, v4: true });
 expect(v4.LIFECYCLE_CONTENT_HASH).toBe(V4_HASH);
 const subjects = new Set<string>();
 for (const user of [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `${i}${USER.slice(1)}`)) {
  subjects.add((await renderWith(v4, good, { ...decision, user_id: user })).subject);
 }
 expect(subjects.size).toBeGreaterThan(1);
 expect(load({ feedback: true, v4: true }).LIFECYCLE_CONTENT_HASH).toBe(V4_HASH);
});

it('leads a GOOD activation email with the window, numbers and a link to that beach', async () => {
 const email = await renderWith(load({ feedback: true, v4: true }), good);
 expect([
  'Capitola is looking good on Saturday', 'Saturday’s shaping up at Capitola', 'Capitola’s lining up for Saturday morning', 'Good one coming at Capitola Saturday',
 ]).toContain(email.subject);
 expect(email.html).toContain(`>${email.subject}</h1>`);
 expect(email.text).toContain('GOOD · Worth planning, 7–10 AM.');
 expect(email.text).toContain('~3–4 ft at 12s from the SSW, light wind.');
 expect(email.text).toContain('Check it before you drive. Quiver updates the call as the swell comes in.');
 expect(email.text).toMatch(/See the window: https:\/\/example\.com\/app\/spot\/capitola\?utm_source=email&utm_medium=email&utm_campaign=startup-lifecycle-v4&email_type=activation&message_instance_id=22222222/);
 expect(email.html).toContain('Your next window');
 expect(email.text).not.toMatch(/undefined|null|NaN|\{\w+\}/);
});

it('rotates the headline by user and day, the same on a second render', async () => {
 const v4 = load({ feedback: true, v4: true });
 expect((await renderWith(v4, good)).subject).toBe((await renderWith(v4, good)).subject);
 const nextDay = await renderWith(v4, { ...good, now: '2026-11-20T17:00:00Z' });
 expect(nextDay.subject).toMatch(/Capitola|Saturday/);
});

it('says Worth a surf for a window that is open now, and names an offshore wind', async () => {
 const call: ActivationCall = { ...good, window: windowFixture({ windSpeed: '7.6', windDirection: 'NE' }, '2026-11-19T16:00:00Z', '2026-11-19T19:00:00Z') };
 const email = await renderWith(load({ feedback: true, v4: true }), call);
 expect(email.text).toContain('GOOD · Worth a surf, 8–11 AM.');
 expect(email.text).toContain('~3–4 ft at 12s from the SSW, 8 mph offshore.');
 expect(email.subject).toMatch(/[Tt]oday|this morning/);
 expect(email.subject).not.toMatch(/on today|today morning/);
});

it('words a FAIR call and leaves out a missing period, direction and wind', async () => {
 const call: ActivationCall = { ...good, label: 'FAIR', window: windowFixture({ period: null, swellDirection: null, windSpeed: null }, '2026-11-20T21:00:00Z', '2026-11-20T23:00:00Z') };
 const email = await renderWith(load({ feedback: true, v4: true }), call);
 expect(['Capitola could be fun tomorrow', 'Decent shot at Capitola tomorrow']).toContain(email.subject);
 expect(email.text).toContain('FAIR · Worth a look, 1–3 PM.');
 expect(email.text).toContain('~3–4 ft.');
});

it('uses the fallback copy without a number when no fresh call is good enough', async () => {
 const email = await renderWith(load({ feedback: true, v4: true }), { kind: 'fallback', beach, reason: 'stale_call', now: NOW });
 expect(email.subject).toBe('Planning a surf?');
 expect(email.text).toContain('Check Capitola before you drive. Quiver tells you if it’s worth going.');
 expect(email.text).toMatch(/Check Capitola: https:\/\/example\.com\/app\/spot\/capitola\?/);
 expect(email.text).not.toMatch(/\d ft|GOOD|FAIR/);
});

it('uses the fallback form with home-beach onboarding when there is no beach', async () => {
 const email = await renderWith(load({ feedback: true, v4: true }), { kind: 'no_beach', now: NOW }, { ...decision, source: { ...decision.source!, home_beach_id: null } });
 expect(email.subject).toBe('Planning a surf?');
 expect(email.html).toContain('>Planning a surf?</h1>');
 expect(email.text).toContain('Pick your home beach and Quiver tells you if it’s worth going.');
 expect(email.text).toMatch(/Choose your home beach: https:\/\/example\.com\/app\?.*email_type=activation.*onboarding=required/);
 expect(email.text).not.toContain('Why I built Quiver');
 expect(email.html).toContain('Your next window');
});

it('keeps the earned-offer note and does not let the paid-user line replace the forecast', async () => {
 const v4 = load({ feedback: true, v4: true });
 const free = await renderWith(v4, good, { ...decision, source: { ...decision.source!, audience: 'free', offer_id: '33333333-3333-4333-8333-333333333333', offer_months: 1 } });
 expect(free.text).toContain('Five logged sessions gets you a month of Pro on me.');
 const paid = await renderWith(v4, good, { ...decision, source: { ...decision.source!, audience: 'entitled', offer_id: '33333333-3333-4333-8333-333333333333', offer_months: 1 } });
 expect(paid.text).toContain('~3–4 ft at 12s from the SSW');
 expect(paid.text).not.toMatch(/on me|ratings teach/);
});

it('keeps other jobs on their approved copy under v4', async () => {
 const email = await renderWith(load({ feedback: true, v4: true }), good, { ...decision, job: 'routine' });
 expect(email.subject).toBe('What’s missing?');
});

it('uses dashes only inside number ranges', async () => {
 const v4 = load({ feedback: true, v4: true });
 for (const call of [good, { kind: 'fallback', beach, reason: 'no_call', now: NOW } as ActivationCall]) {
  const email = await renderWith(v4, call);
  for (const body of [email.subject, email.text]) expect(body.replace(/https?:\/\/\S+/g, '').replace(/\d–\d/g, '')).not.toMatch(/[‐-―−]| - /);
 }
});
