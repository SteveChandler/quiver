/** @jest-environment node */
import { renderLifecycleEmail } from '@/lib/mailer/lifecycle-email';
import type { LifecycleDecision } from '@/lib/email/lifecycle';
// Keep real React template rendering; avoid React Email's Jest-incompatible dynamic formatter import.
jest.mock('@react-email/render', () => ({ render: async (element: unknown) => jest.requireActual('react-dom/server').renderToStaticMarkup(element) }));
const base: LifecycleDecision = {user_id:'11111111-1111-4111-8111-111111111111',campaign_id:'startup-lifecycle-v1',status:'due',reason:'fixture',job:'activation',source:{audience:"free",email:'surfer@example.com',name:null,home_beach_id:null,sessions:0,last_completion:null,trial_end:null}};
const render = (decision: LifecycleDecision) => renderLifecycleEmail(decision,'22222222-2222-4222-8222-222222222222','https://example.com','founder@example.com','https://example.com/unsubscribe');
it('does not leak or duplicate a reward paragraph between recipients',async () => {
 const offered = {...base,source:{...base.source!,offer_id:'33333333-3333-4333-8333-333333333333',offer_months:1 as const}};
 const first=await render(offered), second=await render(offered), regular=await render(base);
 expect(first.text.match(/next month of Pro/g)).toHaveLength(1);
 expect(second.text).toBe(first.text);
 expect(regular.text).not.toContain('next month of Pro');
 expect(regular.html).not.toContain('next month of Pro');
});
it.each([1,3] as const)('renders the approved %s-month offer without an automatic-renewal claim',async months => {
 const email=await render({...base,job:'offer_ready',source:{...base.source!,sessions:months===1?5:0,offer_id:'33333333-3333-4333-8333-333333333333',offer_months:months}});
 expect(email.text).toContain(months===1?'your next month of Pro is on me':'three months of Quiver Pro');
 expect(email.text).toContain('nothing renews');
 expect(email.text).toContain('/offers/claim?message_instance_id=');
 expect(email.text).not.toContain('Log a session');
});
it('refuses a one-month ready notice without five completed sessions',async () => {
 await expect(render({...base,job:'offer_ready',source:{...base.source!,offer_id:'33333333-3333-4333-8333-333333333333',offer_months:1}})).rejects.toThrow('Missing earned offer evidence');
});

it.each(['entitled', 'trial', undefined] as const)('never renders promo copy for audience %s, even with a saved offer', async audience => {
 const source = {...base.source!, audience, offer_id:'33333333-3333-4333-8333-333333333333', offer_months:1 as const};
 for (const job of ['activation', 'progress'] as const) {
  const email = await render({...base, job, source});
  expect(email.text).not.toContain('month');
  expect(email.html).not.toContain('on me');
 }
 await expect(render({...base, job:'offer_ready', source:{...source,sessions:5}})).rejects.toThrow('verified free audience');
});
it('supports the personal loop without promising trial access or exact forecast accuracy', async () => {
 const email = await render({...base,job:'trial_support',source:{...base.source!,audience:'trial'}});
 expect(email.subject).toBe('A few things to set up first');
 expect(email.text).toContain('Add the spot you actually surf');
 expect(email.text).toContain('Set an alert');
 expect(email.text).toContain('rate them, so Quiver knows what a good day looks like for you');
 expect(email.text).not.toContain('on me');
});
it('keeps the routine question, stickers, postal address and unsubscribe footer', async () => {
 const email = await render({...base,job:'routine'});
 expect(email.text).toContain('If there’s something you keep wishing it did, tell me. I’m picking what to build next.');
 expect(email.html).not.toContain('You opted in');
 expect(email.html).toContain('2261 Market Street STE 10852, San Francisco, CA 94114');
 expect(email.text).toContain('2261 Market Street STE 10852, San Francisco, CA 94114');
 expect(email.html).not.toContain('email updates enabled');
 expect(email.html).toContain('href="https://example.com/unsubscribe"');
 expect(email.text).toContain('Unsubscribe: https://example.com/unsubscribe');
 expect(email.html).toContain('/images/quiver-stickers/single-fin.png');
 expect(email.html).toContain('/images/quiver-stickers/line-strip.png');
});

it.each(['activation', 'progress'] as const)('gives paid users personal-loop support for %s', async job => {
 const email = await render({...base, job, source:{...base.source!,audience:'entitled'}});
 expect(email.text).toContain('what a good day looks like for you');
 expect(email.text).not.toContain('on me');
});

it('asks for trial feedback with the approved sticker and no incentive in the email',async () => {
 const email=await render({...base,job:'trial_feedback',source:{...base.source!,audience:'trial'}});
 expect(email.subject).toBe('Why’d you cancel?');
 expect(email.text).toContain('I’d like to know what didn’t work for you');
 expect(email.html).toContain('/images/quiver-stickers/single-fin.png');
 expect(email.text).toContain('/trial-feedback?message_instance_id=22222222-2222-4222-8222-222222222222');
 expect(email.text).not.toMatch(/on me|extra month|gift|renew/);
});
// The v2 hash is recorded in migration 20261007030000. Any copy change needs a new approved campaign.
it('matches the approved startup-lifecycle-v2 content hash when feedback is enabled', () => {
 const before=process.env.TRIAL_FEEDBACK_ENABLED;
 try {
  process.env.TRIAL_FEEDBACK_ENABLED='true';
  jest.isolateModules(() => expect(require('@/lib/mailer/lifecycle-email').LIFECYCLE_CONTENT_HASH).toBe('172803d87d8ee9a7be33bd03bd9cbfe71a069de81f74cc320894dd32cd1aedb1'));
  delete process.env.TRIAL_FEEDBACK_ENABLED;
  // v1 copy is retired: running with the flag off no longer matches the approved v1 hash.
  jest.isolateModules(() => expect(require('@/lib/mailer/lifecycle-email').LIFECYCLE_CONTENT_HASH).not.toBe('7fa9c944e8d8d1c86680c750f99d1db593a1f6a540ff0244f94eb4515de0e39d'));
 } finally { if(before===undefined) delete process.env.TRIAL_FEEDBACK_ENABLED;else process.env.TRIAL_FEEDBACK_ENABLED=before; }
});

it.each(['welcome','activation','progress','friction','trial_support','routine','offer_ready'] as const)('%s copy has no dash characters',async job => {
 const email=await render({...base,job,source:{...base.source!,sessions:5,offer_id:'33333333-3333-4333-8333-333333333333',offer_months:1}});
 expect(`${email.subject}\n${email.text.replace(/https?:\/\/\S+/g,'')}`).not.toMatch(/[\u2010-\u2015\u2212]| - /);
});
