/** @jest-environment node */

const now = new Date('2026-09-28T12:00:00Z');
const wave = (hour = '11', height = '1.2', period = '8'): string =>
  `#YY MM DD hh mm WVHT DPD\n2026 09 28 ${hour} 00 ${height} ${period}\n`;
let service: typeof import('@/lib/services/ndbc-service');

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers({ now });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  service = await import('@/lib/services/ndbc-service');
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

function arrange(responses: Array<string | Error | null>): jest.Mock {
  const fetch = jest.spyOn(global, 'fetch') as jest.Mock;
  fetch.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith('.json')) return { ok: true, json: async () => ({ station:
      responses.map((_, i) => ({ id: String(i), lat: 32 + i * 0.01, lon: -117, data: 'y' })).reverse(),
    }) };
    const index = Number(url.match(/\/(\d+)\.txt$/)?.[1]);
    const response = responses[index];
    if (response instanceof Error) throw response;
    return { ok: response !== null, status: response === null ? 404 : 200, text: async () => response };
  });
  return fetch;
}

it('skips an unavailable nearest station and reuses the selected observation', async () => {
  const fetch = arrange([null, wave(), wave()]);
  expect((await service.getNearestNDBCStation(32, -117))?.id).toBe('1');
  expect(await service.fetchLatestNDBCObservation('1')).toMatchObject({ wave_height_m: 1.2, wave_period_s: 8 });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://www.ndbc.noaa.gov/ndbcmapstations.json',
    'https://www.ndbc.noaa.gov/data/realtime2/0.txt',
    'https://www.ndbc.noaa.gov/data/realtime2/1.txt',
  ]);
});

it.each([null, new Error('unavailable')])('shares candidate probes within a run, including an unavailable nearest station: %s', async (unavailable) => {
  const fetch = arrange([unavailable, wave()]);
  await service.getActiveNDBCStations();
  fetch.mockClear();
  const cache = new Map<string, ReturnType<typeof service.fetchLatestNDBCObservation>>();
  const stations = await Promise.all([
    service.getNearestNDBCStation(32, -117, 80, cache),
    service.getNearestNDBCStation(32.001, -117, 80, cache),
  ]);
  expect(stations.map(station => station?.id)).toEqual(['1', '1']);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://www.ndbc.noaa.gov/data/realtime2/0.txt',
    'https://www.ndbc.noaa.gov/data/realtime2/1.txt',
  ]);
  expect(await service.fetchLatestNDBCObservation('1', 15_000, cache)).toMatchObject({ wave_height_m: 1.2, wave_period_s: 8 });
  expect(fetch).toHaveBeenCalledTimes(2);
  await service.getNearestNDBCStation(32, -117, 80, cache);
  expect(fetch).toHaveBeenCalledTimes(2);
  await service.getNearestNDBCStation(32, -117, 80, new Map());
  expect(fetch).toHaveBeenCalledTimes(unavailable instanceof Error ? 3 : 2);
});

it('keeps each probe timeout when joining a longer shared request', async () => {
  let release!: (value: null) => void;
  const pending = new Promise<null>(resolve => { release = resolve; });
  const cache = new Map([['shared', pending]]);
  const longer = service.fetchLatestNDBCObservation('shared', 5_000, cache);
  let timedOut = false;
  let timeoutName: string | undefined;
  const shorter = service.fetchLatestNDBCObservation('shared', 1_000, cache)
    .catch(error => { timeoutName = error.name; timedOut = true; });
  try {
    await jest.advanceTimersByTimeAsync(999);
    expect(timedOut).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(timedOut).toBe(true);
    expect(timeoutName).toBe('TimeoutError');
    expect(cache.get('shared')).toBe(pending);
  } finally {
    release(null);
    await Promise.all([longer, shorter]);
  }
});

it.each([
  wave('00'), wave('13'), wave('11', 'MM'), wave('11', '-1'),
  wave('11', '1', 'MM'), wave('11', '1', '0'), wave('11', '1', '99'),
])('skips stale, future, or unusable wave data: %s', async bad => {
  arrange([bad, wave()]);
  expect((await service.getNearestNDBCStation(32, -117))?.id).toBe('1');
});

it('continues after transport failure', async () => {
  arrange([new Error('timeout'), wave()]);
  expect((await service.getNearestNDBCStation(32, -117))?.id).toBe('1');
});

it('bounds attempts and does not select a sixth station or one outside the radius', async () => {
  const fetch = arrange([null, null, null, null, null, wave()]);
  expect(await service.getNearestNDBCStation(32, -117)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(6);
  fetch.mockClear();
  expect(await service.getNearestNDBCStation(40, -117, 1)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('stops at the overall lookup deadline', async () => {
  const fetch = arrange([new Error('timeout'), wave()]);
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/0.txt')) jest.setSystemTime(now.getTime() + 15_000);
    return original(...args);
  });
  expect(await service.getNearestNDBCStation(32, -117)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('rejects invalid coordinates before calling the provider', async () => {
  const fetch = arrange([wave()]);
  expect(await service.getNearestNDBCStation(NaN, -117)).toBeNull();
  expect(await service.getNearestNDBCStation(91, -117)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});


it('aborts a stalled body after headers and retries without caching the failure', async () => {
  jest.useRealTimers();
  let signal: AbortSignal | undefined;
  jest.spyOn(global, 'fetch').mockImplementationOnce(async (_url, init) => {
    signal = init?.signal as AbortSignal;
    return { ok: true, text: () => new Promise<string>((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
    }) } as Response;
  }).mockResolvedValueOnce({ ok: true, text: async () => wave() } as Response);
  await expect(service.fetchLatestNDBCObservation('body-timeout', 20)).rejects.toThrow();
  expect(signal?.aborted).toBe(true);
  expect(await service.fetchLatestNDBCObservation('body-timeout')).toMatchObject({ wave_height_m: 1.2 });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
