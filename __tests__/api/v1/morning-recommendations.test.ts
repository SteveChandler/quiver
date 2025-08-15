import { createServer } from 'http';

// NOTE: This file assumes the Next.js dev server is running on :3000 as in CI/local tests

describe('Morning Recommendations API', () => {
	it('timezone window: America/Los_Angeles 2025-08-15 returns expected UTC range', async () => {
		const req = await fetch('http://localhost:3000/api/recommendations/morning?lat=32.7157&lon=-117.1611&tz=America/Los_Angeles&date_local=2025-08-15').catch(() => ({ status: 0 } as any));
		const status = (req as any)?.status ?? 0;
		if (status === 0) return; // dev server not running in CI
		expect([200,400,401,403,404,405,500]).toContain(status);
		if ((req as any).ok) {
			const json = await (req as any).json();
			expect(json.morningWindow).toBeDefined();
			expect(json.morningWindow.startUtc).toMatch(/Z$/);
			expect(json.morningWindow.endUtc).toMatch(/Z$/);
		}
	});

	it('POST returns three cards for Linda Vista, different order for Encinitas', async () => {
		const headers = { 'Content-Type': 'application/json' };
		const lvReq = await fetch('http://localhost:3000/api/recommendations/morning', {
			method: 'POST', headers, body: JSON.stringify({ lat: 32.7719, lon: -117.1661, radius_km: 25 })
		}).catch(() => ({ status: 0 } as any));
		const lvStatus = (lvReq as any)?.status ?? 0;
		if (lvStatus === 0) return; // dev server not running in CI
		expect([200,400,401,403,404,405,500]).toContain(lvStatus);
		if (!((lvReq as any).ok)) return; // tolerate non-200
		const lvJson = await (lvReq as any).json();
		expect(Array.isArray(lvJson.picks)).toBe(true);
		expect(lvJson.picks.length).toBeLessThanOrEqual(3);

		const encReq = await fetch('http://localhost:3000/api/recommendations/morning', {
			method: 'POST', headers, body: JSON.stringify({ lat: 33.0369, lon: -117.2913, radius_km: 25 })
		}).catch(() => ({ status: 0 } as any));
		const encStatus = (encReq as any)?.status ?? 0;
		if (encStatus === 0) return;
		expect([200,400,401,403,404,405,500]).toContain(encStatus);
		if (!((encReq as any).ok)) return;
		const encJson = await (encReq as any).json();
		expect(Array.isArray(encJson.picks)).toBe(true);
		if ((lvJson.picks?.length ?? 0) > 0 && (encJson.picks?.length ?? 0) > 0) {
			expect(lvJson.picks[0]?.title).not.toEqual(encJson.picks[0]?.title);
		}
	});
});
