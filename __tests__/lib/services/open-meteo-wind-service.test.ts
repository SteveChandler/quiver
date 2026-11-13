import {
  parseOpenMeteoWindResponse,
  buildOpenMeteoWindUrl,
  fetchHourlyWind,
  fetchHourlyWindOrThrow,
  isOpenMeteoUpstreamError,
} from '@/lib/services/open-meteo-wind-service';
import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';

describe('buildOpenMeteoWindUrl', () => {
  it('builds correct URL for a single location', () => {
    const url = buildOpenMeteoWindUrl(32.7157, -117.1611);
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=32.7157');
    expect(url).toContain('longitude=-117.1611');
    expect(url).toContain('wind_speed_10m');
    expect(url).toContain('wind_direction_10m');
    expect(url).toContain('wind_gusts_10m');
    expect(url).toContain('hourly=');
  });
});

describe('parseOpenMeteoWindResponse', () => {
  it('parses hourly wind data into WindPoint array', () => {
    const response = {
      hourly: {
        time: ['2026-03-13T05:00', '2026-03-13T06:00', '2026-03-13T07:00'],
        wind_speed_10m: [3.2, 5.1, 7.8],
        wind_direction_10m: [225, 270, 280],
        wind_gusts_10m: [8.0, 12.0, 15.0],
      },
    };

    const points = parseOpenMeteoWindResponse(response);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({
      ts: '2026-03-13T05:00:00.000Z',
      wind_speed_mph: 3,   // 3.2 rounded to 3
      wind_direction_deg: 225,
      wind_gust_mph: 8,    // 8.0 rounded to 8
    });
  });

  it('handles null wind values gracefully', () => {
    const response = {
      hourly: {
        time: ['2026-03-13T05:00'],
        wind_speed_10m: [null],
        wind_direction_10m: [null],
        wind_gusts_10m: [null],
      },
    };

    const points = parseOpenMeteoWindResponse(response);
    expect(points).toHaveLength(1);
    expect(points[0].wind_speed_mph).toBeNull();
    expect(points[0].wind_direction_deg).toBeNull();
  });

  it('returns empty array for missing hourly data', () => {
    expect(parseOpenMeteoWindResponse({})).toEqual([]);
    expect(parseOpenMeteoWindResponse({ hourly: {} })).toEqual([]);
  });
});

describe('isOpenMeteoUpstreamError', () => {
  it.each([
    [Object.assign(new Error('aborted due to timeout'), { name: 'TimeoutError' }), true],
    [Object.assign(new Error('aborted'), { name: 'AbortError' }), true],
    [new TypeError('fetch failed'), true],
    [new TypeError('Cannot read properties of undefined'), false],
    [new SyntaxError('Unexpected token < in JSON'), false],
    ['fetch failed', false],
  ])('classifies %p as %p', (err, expected) => {
    expect(isOpenMeteoUpstreamError(err)).toBe(expected);
  });
});

describe('fetchHourlyWindOrThrow / fetchHourlyWind', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when the request gets no HTTP response, and the lenient wrapper returns []', async () => {
    const timeout = Object.assign(new Error('aborted due to timeout'), { name: 'TimeoutError' });
    global.fetch = jest.fn().mockRejectedValue(timeout) as unknown as typeof fetch;

    await expect(fetchHourlyWindOrThrow(32.7, -117.2)).rejects.toBe(timeout);
    await expect(fetchHourlyWind(32.7, -117.2)).resolves.toEqual([]);
    expectConsoleWarnings([/Open-Meteo wind fetch failed/]);
  });

  it('returns [] on a non-2xx response without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;

    await expect(fetchHourlyWindOrThrow(32.7, -117.2)).resolves.toEqual([]);
    expectConsoleWarnings([/returned 503/]);
  });
});
