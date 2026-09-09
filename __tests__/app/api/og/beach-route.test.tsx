/** @jest-environment node */
import React from 'react';
import { execFileSync } from 'node:child_process';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/og/beach/route';
import { getFreshForecastFromCache } from '@/lib/utils/forecast-service-utils';
import { validateURL } from '@/lib/security/ip-validation';
import sharp from 'sharp';

let mockElement: React.ReactElement<{ style: React.CSSProperties; children?: React.ReactNode }>;
let mockOptions: unknown;
jest.mock('next/og', () => ({
  ImageResponse: jest.fn().mockImplementation((element, options) => {
    mockElement = element;
    mockOptions = options;
    return { headers: new Headers() };
  }),
}));
const mockQuery = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(), single: jest.fn(), maybeSingle: jest.fn(),
};
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => mockQuery }) }));
jest.mock('@/lib/utils/forecast-service-utils', () => ({
  ...jest.requireActual('@/lib/utils/forecast-service-utils'),
  getFreshForecastFromCache: jest.fn(),
}));
jest.mock('@/lib/security/ip-validation', () => ({ validateURL: jest.fn() }));

function text(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return text(node.props.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
function elements(node: React.ReactNode): React.ReactElement<Record<string, any>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const now = new Date('2026-09-09T15:00:00Z');
const row = {
  forecast_at: now.toISOString(), updated_at: now.toISOString(), data_source: 'NOAA_NWS',
  wave_height: '2-3 ft', wind_source: 'NWS', wind_speed: '8 mph', wind_direction: 'NE',
  tide_height: '1.2 ft', tide_status: 'Rising',
};
const request = (slug = 'coast-guard-beach') => new NextRequest(`https://quiversurf.app/api/og/beach?slug=${slug}`);
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  mockQuery.single.mockResolvedValue({ data: { id: 'beach-1', name: 'Coast Guard Beach', city: 'Eastham', state: 'MA', timezone: 'America/New_York' } });
  mockQuery.maybeSingle.mockResolvedValue({ data: null });
  jest.mocked(getFreshForecastFromCache).mockResolvedValue({ forecasts: [row], metadata: { stale: false } } as any);
  jest.mocked(validateURL).mockResolvedValue({ isValid: true });
});
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; process.env = { ...originalEnv }; });

test('shows a dated surf report with all conditions and preserves image size and cache', async () => {
  const response = await GET(request());
  const output = text(mockElement);
  for (const value of ['Coast Guard Beach', 'Eastham, MA', 'Surf Report & Forecast', '2–3 ft', '8 mph · NE', '1.2 ft · Rising', 'Sep 9, 2026', '11:00 AM EDT', 'Quiver']) expect(output).toContain(value);
  expect(mockOptions).toEqual(expect.objectContaining({ width: 1200, height: 630 }));
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
  expect(getFreshForecastFromCache).toHaveBeenCalledWith('beach-1', 6);
  expect(mockQuery.eq).toHaveBeenCalledWith('approved', true);
  expect(mockQuery.is).toHaveBeenCalledWith('deleted_at', null);
});

test.each(['missing', 'stale', 'old row', 'future row', 'invalid timestamp', 'fallback source', 'rejected'])('handles %s forecasts without invented conditions', async (scenario) => {
  let forecastRow = { ...row };
  if (scenario === 'old row') forecastRow.updated_at = '2026-09-07T15:00:00Z';
  if (scenario === 'future row') forecastRow.forecast_at = '2026-09-10T15:00:00Z';
  if (scenario === 'invalid timestamp') forecastRow.updated_at = 'invalid';
  if (scenario === 'fallback source') forecastRow.data_source = 'FALLBACK';
  jest.mocked(getFreshForecastFromCache).mockResolvedValue({ forecasts: scenario === 'missing' ? [] : [forecastRow], metadata: { stale: scenario === 'stale' } } as any);
  if (scenario === 'rejected') jest.mocked(getFreshForecastFromCache).mockRejectedValue(new Error('offline'));
  await GET(request());
  expect(text(mockElement)).toContain('Coast Guard Beach');
  expect(text(mockElement)).toContain('Check Quiver for the latest conditions');
  expect(text(mockElement).match(/Unavailable/g)).toHaveLength(3);
  expect(text(mockElement)).not.toMatch(/undefined|NaN|2–3 ft|Forecast snapshot/);
});

test('missing and malformed values remain unavailable, while zero and negative tide are valid', async () => {
  jest.mocked(getFreshForecastFromCache).mockResolvedValue({ forecasts: [{ ...row, wave_height: 'undefined ft', wind_speed: 'NaN mph', tide_height: null, tide_status: 'unknown' }], metadata: {} } as any);
  await GET(request());
  expect(text(mockElement).match(/Unavailable/g)).toHaveLength(3);
  jest.mocked(getFreshForecastFromCache).mockResolvedValue({ forecasts: [{ ...row, wave_height: '0 ft', wind_speed: '0 mph', tide_height: '-0.5 ft' }], metadata: {} } as any);
  await GET(request());
  expect(text(mockElement)).toContain('0 ft');
  expect(text(mockElement)).toContain('0 mph');
  expect(text(mockElement)).toContain('-0.5 ft');
});

test.each(['A Very Long Beach Name With Multiple Coastal Landmarks And A National Seashore Recreation Area', 'W'.repeat(120)])('fits long names with bounded text and smaller typography: %s', async name => {
  mockQuery.single.mockResolvedValue({ data: { id: 'beach-1', name, city: null, state: null } });
  await GET(request());
  const title = elements(mockElement).find(element => typeof element.props.children === 'string' && element.props.children.startsWith(name.slice(0, 12)))!;
  expect(title.props.children).toHaveLength(90);
  expect(title.props.children).toMatch(/…$/);
  expect(title.props.style).toMatchObject({ fontSize: 32, height: 154, wordBreak: 'break-word' });
  expect(text(mockElement)).toContain('2–3 ft');
  expect(text(mockElement)).not.toMatch(/undefined|NaN|review/);
});

test('decodes an approved photo before embedding it and keeps its credit', async () => {
  const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#abc' } }).png().toBuffer();
  mockQuery.maybeSingle.mockResolvedValue({ data: { image_url: 'https://cdn.quiversurf.app/beach.webp', creator_name: 'Beach Photographer', license_code: 'CC BY 4.0' } });
  global.fetch = jest.fn().mockResolvedValue(new Response(new Uint8Array(bytes), { headers: { 'content-type': 'image/png' } }));
  await GET(request());
  const image = elements(mockElement).find(element => element.type === 'img');
  expect(image?.props.src).toMatch(/^data:image\/jpeg;base64,/);
  expect(text(mockElement)).toContain('Beach Photographer · CC BY 4.0');
  const overlay = elements(mockElement).find(element => element.props.style?.background?.includes('rgba(10,18,32'));
  expect(overlay?.props.style).toMatchObject({ top: 0, left: 0, width: '100%', height: '100%' });
  expect(global.fetch).toHaveBeenCalledWith('https://cdn.quiversurf.app/beach.webp', expect.objectContaining({ redirect: 'error' }));
});

test.each(['query error', 'unsafe URL', 'network error', 'corrupt image'])('keeps the report and safe gradient for a %s photo', async (scenario) => {
  mockQuery.maybeSingle.mockResolvedValue({ data: { image_url: 'https://cdn.quiversurf.app/beach.webp' }, error: scenario === 'query error' ? { message: 'offline' } : null });
  jest.mocked(validateURL).mockResolvedValue({ isValid: scenario !== 'unsafe URL' });
  global.fetch = scenario === 'network error' ? jest.fn().mockRejectedValue(new Error('offline')) : jest.fn().mockResolvedValue(new Response('broken', { headers: { 'content-type': 'image/png' } }));
  await GET(request());
  expect(elements(mockElement).some(element => element.type === 'img')).toBe(false);
  expect(mockElement.props.style.background).toContain('#0f172a');
  expect(text(mockElement)).toContain('Coast Guard Beach');
  expect(text(mockElement)).toContain('2–3 ft');
});

test.each(['', '../secret', 'a'.repeat(201)])('preserves slug validation for %s', async slug => {
  const response = await GET(request(slug));
  expect(mockQuery.single).not.toHaveBeenCalled();
  expect(text(mockElement)).toContain('Surf Forecasts & Conditions');
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400, s-maxage=86400');
});

test('does not show synthetic wind defaults without a source', async () => {
  jest.mocked(getFreshForecastFromCache).mockResolvedValue({ forecasts: [{ ...row, wind_source: null, wind_speed: '10 mph', wind_direction: 'SW' }], metadata: {} } as any);
  await GET(request());
  expect(text(mockElement)).not.toContain('10 mph');
  expect(text(mockElement)).toContain('Unavailable');
  expect(text(mockElement)).toContain('2–3 ft');
});

test.each(['unknown beach', 'missing configuration'])('uses the original safe card for %s', async scenario => {
  if (scenario === 'unknown beach') mockQuery.single.mockResolvedValue({ data: null });
  else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = await GET(request());
  expect(text(mockElement)).toContain('Surf Forecasts & Conditions');
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400, s-maxage=86400');
});

test('renders the actual PNG stream, preserving undefined style properties', async () => {
  await GET(request());
  // Next's renderer uses ESM; run outside Jest's VM without dropping undefined CSS values.
  const bytes = execFileSync(process.execPath, ['-e', `
    const React = require('react');
    const { ImageResponse } = require('next/og');
    const fs = require('node:fs');
    function restore(value) {
      if (value === '__OG_UNDEFINED__') return undefined;
      if (Array.isArray(value)) return value.map(restore);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, restore(child)]));
      }
      return value;
    }
    function element(node) {
      if (Array.isArray(node)) return node.map(element);
      if (!node || typeof node !== 'object') return node;
      return React.createElement(node.type, node.props, element(node.props.children));
    }
    const input = restore(JSON.parse(fs.readFileSync(0, 'utf8')));
    input.options.fonts?.forEach(font => { font.data = Buffer.from(font.data.data); });
    new ImageResponse(element(input.element), input.options).arrayBuffer()
      .then(bytes => process.stdout.write(Buffer.from(bytes)))
      .catch(error => { console.error(error); process.exitCode = 1; });
  `], {
    input: JSON.stringify({ element: mockElement, options: mockOptions }, (_key, value) =>
      value === undefined ? '__OG_UNDEFINED__' : value),
    timeout: 10000,
    maxBuffer: 4 * 1024 * 1024,
  });
  expect(await sharp(bytes).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
});
