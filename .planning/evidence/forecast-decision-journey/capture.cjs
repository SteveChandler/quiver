const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const root = __dirname;
  const results = [];
  const browser = await chromium.launch();
  for (const [label, port] of [['before',3187], ['after',3186]]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0,500)); });
    await page.route('**/api/events**', route => route.fulfill({status:200,json:{success:true}}));
    for (const width of [360,768,1440]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(`http://localhost:${port}/forecast`, {waitUntil:'domcontentloaded',timeout:120000});
      const card = page.getByTestId('surf-window-card').first();
      await card.waitFor();
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(root,`${label}-list-${width}.png`)});
      results.push({label,width,surface:'list',text:await card.innerText(),height:(await card.boundingBox()).height});
      await page.goto(`http://localhost:${port}/ca/encinitas/grandview`,{waitUntil:'domcontentloaded',timeout:120000});
      await page.getByRole('listbox').waitFor({timeout:60000});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:path.join(root,`${label}-detail-${width}.png`)});
      const answer=page.getByTestId('public-forecast-answer');
      results.push({label,width,surface:'detail',text:await answer.innerText(),bounds:await answer.boundingBox()});
    }
    results.push({label,consoleErrors:errors});
    await page.close();
  }
  fs.writeFileSync(path.join(root,'capture-results.json'),JSON.stringify(results,null,2));
  await browser.close();
})();
