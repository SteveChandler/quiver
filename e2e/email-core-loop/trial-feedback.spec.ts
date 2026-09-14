import { test, expect } from '@playwright/test';
import fixture from '../../contracts/trial-feedback-v1.json';
import { setupErrorDetection, assertNoErrors, type ErrorCapture } from '../utils/error-detection';
let errors: ErrorCapture;
test.beforeEach(async ({page,context}) => {
  errors=setupErrorDetection(page);
  const user={id:fixture.available.user_id,email:'surfer@example.com',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
  const payload=Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const session={access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  await context.addCookies([{name:'sb-127-auth-token',value:`base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,domain:'localhost',path:'/'}]);
  await page.route('**/auth/v1/user',route => route.fulfill({status:200,json:user}));
  await page.route('**/rest/v1/**',route => route.fulfill({status:200,json:[]}));
  await page.route('**/api/users/*/profile',route => route.fulfill({status:200,json:{success:true,data:{id:user.id,full_name:'Surfer',home_beach_id:null}}}));
  await page.route('**/api/events',route => route.fulfill({status:200,json:{success:true}}));
  await page.route('**/api/trial-feedback/web',route => route.fulfill({status:200,json:{user_id:user.id,status:'unavailable',terms_version:null,trial_ends_at:null,free_ends_at:null}}));
});
test.afterEach(async ({page}) => { await assertNoErrors(page,errors); });

test('feedback saves before showing the optional offer at mobile and desktop widths',async ({page}) => {
 let saved=false;let submits=0;
 await page.route('**/api/trial-feedback',async route => {
   if(route.request().method()==='POST') {expect(route.request().postDataJSON()).toMatchObject({reason:'time',note:'I only surfed once'});saved=true;submits++;}
   await route.fulfill({status:200,json:saved?fixture.submitted:fixture.available});
 });
 for(const width of [390,1280]) {
   saved=false;await page.setViewportSize({width,height:950});
   const response=await page.goto('/trial-feedback');expect(response?.status()).toBe(200);
   await expect(page.getByRole('heading',{name:'Tell me how it went.'})).toBeVisible();
   await expect(page.getByText(/next month of Pro is on us/)).toHaveCount(0);
   await page.getByRole('radio',{name:'I didn’t get enough time to try it'}).check();
   await page.getByLabel(/Anything you’d like me to know/).fill('I only surfed once');
   await page.screenshot({path:`test-results/trial-feedback-form-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Send feedback',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Thanks for sharing that.'})).toBeInViewport();
   await expect(page.getByRole('heading',{name:'Thanks for sharing that.'})).toBeFocused();
   await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
   await expect(page.getByRole('link',{name:'Review my extra month'})).toHaveAttribute('href','quiver://settings');
   await expect(page.getByText(/Sending feedback hasn’t restarted/)).toBeVisible();
   expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`test-results/trial-feedback-saved-${width}.png`,fullPage:true});
 }
 expect(submits).toBe(2);
});
test('invalid or unauthenticated mutations return real HTTP errors',async ({request}) => {
 expect((await request.post('/api/trial-feedback',{data:{reason:'time'}})).status()).toBe(401);
 expect((await request.post('/api/trial-feedback/redemption',{data:{action:'reserve'}})).status()).toBe(401);
 expect((await request.get('/api/trial-feedback/redemption')).status()).toBe(405);
});

test('web feedback preserves free-time review and keeps paid renewal a separate customer action', async ({ page }) => {
 let saved = false; let state = 'available'; let extensions = 0; let portals = 0;
 const context = { user_id: fixture.available.user_id, terms_version: 'web-v1', trial_ends_at: '2026-09-27T12:00:00Z', free_ends_at: '2026-10-27T12:00:00Z' };
 await page.route('**/api/trial-feedback', async route => {
   if (route.request().method() === 'POST') saved = true;
   await route.fulfill({ status: 200, json: saved ? { ...fixture.submitted, offer: null } : fixture.available });
 });
 await page.route('**/api/trial-feedback/web', async route => {
   if (route.request().method() === 'POST') {
     const body = route.request().postDataJSON();
     if (body.action === 'accept') {
       expect(body).toMatchObject({ action: 'accept', accept: true, terms_version: 'web-v1' });
       expect(body.user_id).toBeUndefined(); extensions++; state = 'pending';
     } else if (body.action === 'reconcile') state = 'extended';
     else if (body.action === 'portal') {
       expect(state).toBe('extended'); portals++;
       await route.fulfill({ status: 200, json: { user_id: context.user_id, url: 'https://billing.revenuecat.com/appfixture/subfixture?token=fixture' } }); return;
     } else throw new Error('Unexpected action');
   }
   await route.fulfill({ status: 200, json: { ...context, status: state } });
 });
 await page.route('https://billing.revenuecat.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Fixture billing portal</h1>' }));
 for (const width of [390,1280]) {
   saved = false; state = 'available';
   await page.setViewportSize({ width, height: 950 });
   expect((await page.goto('/trial-feedback'))?.status()).toBe(200);
   await expect(page.getByRole('button',{ name:'Add my free month' })).toHaveCount(0);
   await page.getByRole('radio',{name:'I didn’t get enough time to try it'}).check();
   await page.getByRole('button',{name:'Send feedback',exact:true}).click();
   await expect(page.getByRole('button',{name:'Add my free month'})).toBeVisible();
   await expect(page.getByText(/Adding this month won’t restart paid renewal/)).toBeVisible();
   await page.screenshot({path:`test-results/web-recovery-review-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Add my free month'}).click();
   await expect(page.getByText(/Your extra-month request is saved/)).toBeVisible();
   await expect(page.getByRole('button',{name:'Add my free month'})).toHaveCount(0);
   await page.getByRole('button',{name:'Check saved offer status'}).click();
   await expect(page.getByText(/Paid renewal is still off/)).toBeVisible();
   await expect(page.getByRole('button',{name:'Review paid renewal'})).toBeVisible();
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   await page.screenshot({path:`test-results/web-recovery-confirmed-${width}.png`,fullPage:true});
 }
 expect(extensions).toBe(2); expect(portals).toBe(0);
 await page.getByRole('button',{name:'Review paid renewal'}).click();
 await expect(page).toHaveURL('https://billing.revenuecat.com/appfixture/subfixture?token=fixture');
 expect(portals).toBe(1);
});
