import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { withApprovedPhotos } from '@/lib/supabase/query-builders';
import { getFreshForecastFromCache, getStalenessDetails } from '@/lib/utils/forecast-service-utils';
import { getCurrentForecast } from '@/lib/utils/current-forecast-utils';
import { validateURL } from '@/lib/security/ip-validation';
import type { Database } from '@/types/supabase';

export const runtime = "nodejs";

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function measurement(value: string | null | undefined, units: string): string | null {
  if (!value || value.length > 24) return null;
  const match = value.trim().match(new RegExp(`^(-?\\d+(?:\\.\\d+)?)(?:\\s*[-–]\\s*(\\d+(?:\\.\\d+)?))?\\s*(${units})$`, 'i'));
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low || (low < 0 && units !== 'ft')) return null;
  return `${match[1]}${match[2] ? `–${match[2]}` : ''} ${match[3]}`;
}

async function loadPhoto(url: string, supabaseUrl: string): Promise<string | null> {
  try {
    const validation = await validateURL(url, [
      new URL(supabaseUrl).hostname, 'cdn.quiversurf.app',
      'upload.wikimedia.org', 'thumb.wikimedia.org', 'live.staticflickr.com',
      'api.openverse.org', 'i0.wp.com', 'i1.wp.com', 'i2.wp.com', 'files.wordpress.com',
    ]);
    if (!validation.isValid) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/') || !response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 10 * 1024 * 1024) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    // Decode before rendering so an unavailable or corrupt photo cannot break the image stream.
    const image = await sharp(Buffer.concat(chunks), { limitInputPixels: 40000000 })
      .rotate().resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${image.toString('base64')}`;
  } catch {
    return null;
  }
}

function renderFallback() {
  const response = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#ffffff',
            display: 'flex',
          }}
        >
          Quiver
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
          }}
        >
          Surf Forecasts & Conditions
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 22,
            color: '#F78E42',
            display: 'flex',
          }}
        >
          quiversurf.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
  response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  return response;
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/.test(slug)) return renderFallback();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return renderFallback();

  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
    const { data: beach } = await supabase.from('beaches')
      .select('id, name, city, state, timezone').eq('slug', slug).limit(1).single();
    if (!beach) return renderFallback();

    const [photoResult, forecastResult] = await Promise.allSettled([
      withApprovedPhotos(supabase.from('beach_photos')
        .select('image_url, creator_name, license_code').eq('beach_id', beach.id))
        .order('fetched_at', { ascending: false }).limit(1).maybeSingle(),
      getFreshForecastFromCache(beach.id, 6),
    ]);
    const photo = photoResult.status === 'fulfilled' && !photoResult.value.error
      ? photoResult.value.data : null;
    const background = photo?.image_url ? await loadPhoto(photo.image_url, supabaseUrl) : null;
    const cache = forecastResult.status === 'fulfilled' ? forecastResult.value : null;
    const now = Date.now();
    const forecast = getCurrentForecast(!cache || cache.metadata.stale ? [] : cache.forecasts.filter(row => {
      const age = getStalenessDetails(row.updated_at, row.data_source);
      return Number.isFinite(age.hoursSinceUpdate) && age.hoursSinceUpdate >= 0 && !age.isStale &&
        row.data_source?.toUpperCase() !== 'FALLBACK' &&
        Math.abs(new Date(row.forecast_at).getTime() - now) <= 3 * 60 * 60 * 1000;
    }));
    const waveHeight = measurement(forecast?.wave_height, 'ft');
    const waves = waveHeight?.startsWith('-') ? null : waveHeight;
    const windSpeed = forecast?.wind_source ? measurement(forecast.wind_speed, 'mph|kts|knots|km/h') : null;
    const windDirection = /^(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)$/i.test(forecast?.wind_direction ?? '')
      ? forecast?.wind_direction?.toUpperCase() : null;
    const wind = windSpeed ? [windSpeed, windDirection].filter(Boolean).join(' · ') : null;
    const tideStatus = /^(rising|falling|high|low|slack)$/i.test(forecast?.tide_status ?? '')
      ? forecast?.tide_status : null;
    const tide = [measurement(forecast?.tide_height, 'ft'), tideStatus].filter(Boolean).join(' · ');
    const name = truncate(beach.name?.trim() || 'Beach', 90);
    const location = truncate([beach.city, beach.state].filter(Boolean).join(', '), 70);
    const hasConditions = Boolean(waves || wind || tide);
    // A dated snapshot remains honest when a third-party cache retains the card.
    const snapshot = forecast && hasConditions ? new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: beach.timezone || 'UTC', timeZoneName: 'short',
    }).format(new Date(forecast.forecast_at)) : null;

    const font = await readFile(path.join(process.cwd(), 'public/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf')).catch(() => null);
    const response = new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff',
        fontFamily: 'system-ui, sans-serif' }}>
        {/* Satori requires a native image element with decoded image data. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {background && <img alt="" src={background} width={1200} height={630}
          style={{ position: 'absolute', top: 0, left: 0 }} />}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'linear-gradient(90deg, rgba(10,18,32,0.88), rgba(10,18,32,0.48))' }} />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '42px 54px', width: '100%', position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, color: '#F78E42', letterSpacing: 2 }}>
            Surf Report & Forecast
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: 154, flexShrink: 0,
            fontSize: name.length > 65 ? 32 : name.length > 45 ? 40 : name.length > 28 ? 50 : 72,
            fontFamily: 'SpaceGrotesk, system-ui, sans-serif', fontWeight: 700, lineHeight: 1.06, overflow: 'hidden', wordBreak: 'break-word' }}>{name}</div>
          <div style={{ display: 'flex', fontSize: 27, height: 42, color: '#F5EEDC' }}>{location}</div>
          <div style={{ display: 'flex', fontSize: 20, marginTop: 12, marginBottom: 14, color: '#F5EEDC' }}>
            {snapshot ? `Forecast snapshot · ${snapshot}` : 'Check Quiver for the latest conditions'}
          </div>
          <div style={{ display: 'flex', background: '#F5EEDC', color: '#171C2A', padding: '22px 26px', height: 126 }}>
            {[
              ['WAVES', waves || 'Unavailable'],
              ['WIND', wind || 'Unavailable'],
              ['TIDE', tide || 'Unavailable'],
            ].map(([label, value], index) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', width: index === 0 ? '32%' : '34%',
                paddingLeft: index ? 24 : 0, borderLeft: index ? '1px solid #B9B6AB' : '0px solid transparent' }}>
                <div style={{ display: 'flex', fontSize: 18, letterSpacing: 2 }}>{label}</div>
                <div style={{ display: 'flex', fontSize: value.length > 16 ? 25 : 32, fontWeight: 700, marginTop: 9 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
            <div style={{ display: 'flex', fontSize: 40, fontFamily: 'SpaceGrotesk, system-ui, sans-serif', fontWeight: 700, color: '#F78E42' }}>Quiver</div>
            <div style={{ display: 'flex', fontSize: 23 }}>quiversurf.app</div>
          </div>
          {background && photo && <div style={{ display: 'flex', fontSize: 14, marginTop: 7, color: '#F5EEDC' }}>
            {truncate(['Photo', photo.creator_name, photo.license_code].filter(Boolean).join(' · '), 120)}
          </div>}
        </div>
      </div>,
      { width: 1200, height: 630, ...(font ? { fonts: [{ name: 'SpaceGrotesk', data: font, weight: 700 as const, style: 'normal' as const }] } : {}) }
    );
    response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    return response;
  } catch {
    return renderFallback();
  }
}
