/** @jest-environment node */
import { renderLifecycleEmail } from '@/lib/mailer/lifecycle-email';
import type { LifecycleDecision } from '@/lib/email/lifecycle';
// Keep real React template rendering; avoid React Email's Jest-incompatible dynamic formatter import.
jest.mock('@react-email/render', () => ({ render: async (element: unknown) => jest.requireActual('react-dom/server').renderToStaticMarkup(element) }));
const base: LifecycleDecision = {user_id:'11111111-1111-4111-8111-111111111111',campaign_id:'startup-lifecycle-v1',status:'due',reason:'fixture',job:'activation',source:{email:'surfer@example.com',name:null,home_beach_id:null,sessions:0,last_completion:null,trial_end:null}};
const render = (decision: LifecycleDecision) => renderLifecycleEmail(decision,'22222222-2222-4222-8222-222222222222','https://example.com','founder@example.com','https://example.com/unsubscribe');
it('does not leak or duplicate a reward paragraph between recipients',async () => {
 const offered = {...base,source:{...base.source!,offer_id:'33333333-3333-4333-8333-333333333333',offer_months:1 as const}};
 const first=await render(offered), second=await render(offered), regular=await render(base);
 expect(first.text.match(/calendar month/g)).toHaveLength(1);
 expect(second.text).toBe(first.text);
 expect(regular.text).not.toContain('calendar month');
 expect(regular.html).not.toContain('calendar month');
});
it.each([1,3] as const)('renders the approved %s-month offer without an automatic-renewal claim',async months => {
 const email=await render({...base,job:'offer_ready',source:{...base.source!,sessions:months===1?5:0,offer_id:'33333333-3333-4333-8333-333333333333',offer_months:months}});
 expect(email.text).toContain(months===1?'One calendar month':'three calendar months');
 expect(email.text).toContain('No payment or automatic renewal.');
 expect(email.text).toContain('/offers/claim?message_instance_id=');
 expect(email.text).not.toContain('Log a session');
});
it('refuses a one-month ready notice without five completed sessions',async () => {
 await expect(render({...base,job:'offer_ready',source:{...base.source!,offer_id:'33333333-3333-4333-8333-333333333333',offer_months:1}})).rejects.toThrow('Missing earned offer evidence');
});
