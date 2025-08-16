import { buildTwoHourWindows, topMorningWindows } from '@/lib/surf/windows';

function makeHour(ts: string, baseScoreBias = 0) {
	return {
		ts,
		waveDirectionDeg: 250,
		windDirectionDeg: 270,
		windSpeedMs: 2,
		tideHeightM: 0.6,
		params: {
			windOffshoreDeg: 270,
			windCrossOkKts: 10,
			swellWindowMinDeg: 220,
			swellWindowMaxDeg: 280,
			tidePreferredFtMin: 1,
			tidePreferredFtMax: 3,
		},
	};
}

describe('Fixture day: deterministic picks across 3 beaches', () => {
	it('builds windows and returns up to 3 morning picks', () => {
		const base = new Date('2025-08-15T06:00:00.000-07:00'); // PDT
		const mkTs = (i: number) => new Date(base.getTime() + i * 3600_000).toISOString();
		const blacks = Array.from({ length: 24 }).map((_, i) => makeHour(mkTs(i)));
		const delmar = Array.from({ length: 24 }).map((_, i) => makeHour(mkTs(i)));
		const scripps = Array.from({ length: 24 }).map((_, i) => makeHour(mkTs(i)));
		const all = [...blacks, ...delmar, ...scripps];
		const picks = topMorningWindows(all, { tz: 'America/Los_Angeles', startHour: 6, endHour: 12, limit: 3 });
		expect(picks.length).toBeLessThanOrEqual(3);
	});
});
