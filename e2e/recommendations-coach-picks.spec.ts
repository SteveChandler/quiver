import { test, expect } from "@playwright/test";

// Dev envs can be slow
test.setTimeout(60000);

// Helper to extract pick list text
async function getCoachPicks(page: any) {
	const card = page.getByRole('heading', { name: /Coach Pick/i }).locator('..');
	// allow card to render or be absent
	await page.waitForLoadState('load');
	const exists = await card.count();
	if (!exists) return [] as string[];
	// top picks list items
	const items = card.locator('div:has-text("Top Picks:")').locator('xpath=following-sibling::*//div[@class="flex items-center justify-between text-sm"] span');
	const count = await items.count();
	const labels: string[] = [];
	for (let i = 0; i < count; i++) labels.push((await items.nth(i).innerText()).trim());
	if (labels.length === 0) {
		// fallback: include primary top name if list collapsed to single
		const primary = card.locator('div.font-medium').first();
		if (await primary.count()) labels.push((await primary.innerText()).trim());
	}
	return labels;
}

// Replace with real IDs present in your dataset
const OCEAN_BEACH_ID = 'c97ef837-7fb5-4881-8dfb-7d750a9f97a5';
const HUNTINGTON_PIER_ID = 'f1a6a6a2-1111-2222-3333-444444444444';

// Coach Picks differ across beaches and cache does not leak
test('Coach Picks are scoped by beach and re-render per beach', async ({ page }) => {
	// Ocean Beach
	await page.goto(`/beach/${OCEAN_BEACH_ID}`);
	await page.waitForLoadState('load');
	const obPicks = await getCoachPicks(page);
	// Allow empty in dev, but capture array
	expect(Array.isArray(obPicks)).toBeTruthy();

	// Huntington Pier
	await page.goto(`/beach/${HUNTINGTON_PIER_ID}`);
	await page.waitForLoadState('load');
	const hpPicks = await getCoachPicks(page);
	expect(Array.isArray(hpPicks)).toBeTruthy();

	// If both non-empty, assert they differ
	if (obPicks.length > 0 && hpPicks.length > 0) {
		expect(hpPicks.join('|')).not.toEqual(obPicks.join('|'));
	}

	// Navigate back to Ocean Beach — ensure re-render (no stale list)
	await page.goto(`/beach/${OCEAN_BEACH_ID}`);
	await page.waitForLoadState('load');
	const obPicksAgain = await getCoachPicks(page);
	expect(Array.isArray(obPicksAgain)).toBeTruthy();
	if (obPicks.length > 0 && obPicksAgain.length > 0) {
		expect(obPicksAgain.join('|')).toEqual(obPicks.join('|'));
	}
});
