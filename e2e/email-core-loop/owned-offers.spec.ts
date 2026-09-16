import { test, expect } from '@playwright/test';
import fixture from '../../contracts/pro-offers-v1.json';
import { setupErrorDetection, assertNoErrors, type ErrorCapture } from '../utils/error-detection';
let errors: ErrorCapture;
test.beforeEach(async ({page,context}) => {
  errors=setupErrorDetection(page);
  const user={id:fixture.owned.user_id,email:'surfer@example.com',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
  const payload=Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const session={access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  await context.addCookies([{name:'sb-127-auth-token',value:`base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,domain:'localhost',path:'/'}]);
  await page.route('**/auth/v1/user',route => route.fulfill({status:200,json:user}));
  await page.route('**/rest/v1/**',route => route.fulfill({status:200,json:[]}));
  await page.route('**/api/users/*/profile',route => route.fulfill({status:200,json:{success:true,data:{id:user.id,full_name:'Surfer',home_beach_id:null}}}));
  await page.route('**/api/events',route => route.fulfill({status:200,json:{success:true}}));
});
test.afterEach(async ({page}) => { await assertNoErrors(page,errors); });
test('account offer progresses from acceptance to confirmed access at mobile and desktop widths',async ({page}) => {
  let accepted=false;
  await page.route('**/api/offers',route => route.fulfill({status:200,json:{...fixture.owned,offers:[{...fixture.owned.offers[0],completed_sessions:5,earned:true,claim_requested:accepted,state:accepted?'verified':'enrolled',expires_at:accepted?'2027-02-28T12:00:00Z':null,mirror_verified:accepted}]}}));
  await page.route('**/api/offers/claim',async route => {
    expect(route.request().postDataJSON()).toEqual({awardId:fixture.owned.offers[0].award_id,mode:'claim'});accepted=true;
    await route.fulfill({status:200,json:{...fixture.results[1],contract_version:1,mirror_verified:true}});
  });
  for(const width of [390,1280]) {
    accepted=false;await page.setViewportSize({width,height:900});
    const response=await page.goto('/offers/claim');expect(response?.status()).toBe(200);
    await expect(page.getByRole('button',{name:'Accept and save my claim'})).toBeVisible();
    await page.getByRole('button',{name:'Accept and save my claim'}).click();
    await expect(page.getByText(/Confirmed through/)).toBeVisible();
    await expect(page.getByRole('link',{name:'Open Quiver',exact:true})).toHaveAttribute('href','quiver://settings');
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/owned-offer-${width}.png`,fullPage:true});
  }
});
