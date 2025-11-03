import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { topWindowsInRange } from '@/lib/surf/windows';
import { windowBlurbDetailed } from '@/lib/surf/windows';
import { getBeachesNear, getMarineForecastRange, getTideForecastRange, getSunTimes } from '@/lib/surf/data';
import { sunForLatLon, isDark } from '@/lib/surf/sun';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { apiCache } from '@/lib/utils/request-cache';
import { createAPIServerClient } from '@/lib/supabase/api-server-client';
import { getMorningWindow } from '@/lib/time';
import { handleApiError, createValidationError } from '@/lib/api-utils';

const schema = z.object({
  lat: z.number(),
  lon: z.number(),
  radius_km: z.number().default(25),
  tz: z.string().optional(),
  horizon_hours: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      return createValidationError('Invalid JSON in request body');
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      return createValidationError('Invalid request parameters', result.error.issues);
    }

    const { lat, lon, radius_km = 25, tz = 'America/Los_Angeles', horizon_hours = 5 } = result.data;

    const nowLocal = toZonedTime(new Date(), tz);
    const todayLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
    const { sunriseLocal, sunsetLocal } = sunForLatLon(todayLocal, lat, lon, tz);

    let mode: 'tomorrow_morning' | 'next_windows';
    let startLocal: Date;
    let endLocal: Date;

    if (isDark(nowLocal, sunriseLocal, sunsetLocal)) {
      const tomorrow = new Date(todayLocal); tomorrow.setDate(tomorrow.getDate() + 1);
      const { sunriseLocal: tSunrise } = sunForLatLon(tomorrow, lat, lon, tz);
      startLocal = tSunrise;
      const elevenLocal = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 0, 0);
      endLocal = new Date(Math.min(tSunrise.getTime() + 5*3600_000, elevenLocal.getTime()));
      mode = 'tomorrow_morning';
    } else {
      startLocal = new Date(Math.max(nowLocal.getTime(), sunriseLocal.getTime()));
      endLocal = new Date(Math.min(sunsetLocal.getTime(), startLocal.getTime() + horizon_hours*3600_000));
      if (endLocal.getTime() - startLocal.getTime() < 60*60*1000) {
        const tomorrow = new Date(todayLocal); tomorrow.setDate(tomorrow.getDate() + 1);
        const { sunriseLocal: tSunrise } = sunForLatLon(tomorrow, lat, lon, tz);
        startLocal = tSunrise;
        const elevenLocal = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 0, 0);
        endLocal = new Date(Math.min(tSunrise.getTime() + 5*3600_000, elevenLocal.getTime()));
        mode = 'tomorrow_morning';
      } else {
        mode = 'next_windows';
      }
    }

    // Thin cache key: geohash(lat,lon, precision=4) | local date | radius | horizon | tz
    const gh4 = geohashEncode(lat, lon, 4);
    const keyDate = `${startLocal.getFullYear()}-${String(startLocal.getMonth() + 1).padStart(2, '0')}-${String(startLocal.getDate()).padStart(2, '0')}`;
    const cacheKey = `morning:${gh4}|${keyDate}|r${radius_km}|h${horizon_hours}|${tz}`;
    const cached = apiCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const startUtc = fromZonedTime(startLocal, tz);
    const endUtc   = fromZonedTime(endLocal, tz);

    const beaches = await getBeachesNear(lat, lon, radius_km);
    // Batching: cap candidates to top ~8 by distance before scoring to reduce load
    const candidates = (() => {
      let arr = Array.isArray(beaches) ? beaches : [];
      if (arr.length <= 8) return arr;
      const first = arr[0] as any;
      const hasDistance = first && Object.prototype.hasOwnProperty.call(first, 'distance_km');
      if (hasDistance) {
        return [...arr]
          .sort((a: any, b: any) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
          .slice(0, 8);
      }
      return arr.slice(0, 8);
    })();
    const supabase = createAPIServerClient();
    const winsAll: any[] = [];

    for (const b of candidates) {
      const localDateStr = `${startLocal.getFullYear()}-${String(startLocal.getMonth() + 1).padStart(2, '0')}-${String(startLocal.getDate()).padStart(2, '0')}`;
      // Prefer MV exact-hour rows if available; else fall back to range readers
      const { data: mvRows } = await (supabase as any)
        .from('mv_beach_hourly_scores')
        .select('ts_utc, hs_m, tp_s, swell_dir_deg, wind_spd_kts, wind_dir_deg, tide_ft')
        .eq('beach_id', b.id)
        .gte('ts_utc', startUtc.toISOString())
        .lt('ts_utc', endUtc.toISOString())
        .order('ts_utc', { ascending: true });

      let marine: any[] = [];
      let tide: any[] = [];
      if (mvRows && mvRows.length > 0) {
        marine = mvRows.map((r: any) => ({
          ts: new Date(r.ts_utc),
          hs_m: Number(r.hs_m ?? 0),
          tp_s: r.tp_s == null ? null : Number(r.tp_s),
          swell_dir_deg: r.swell_dir_deg == null ? null : Number(r.swell_dir_deg),
          wind_spd_kts: r.wind_spd_kts == null ? null : Number(r.wind_spd_kts),
          wind_dir_deg: r.wind_dir_deg == null ? null : Number(r.wind_dir_deg),
        }));
        tide = mvRows.map((r: any) => ({ ts: new Date(r.ts_utc), tide_ft: Number(r.tide_ft ?? 0) }));
      } else {
        const [m, t] = await Promise.all([
          getMarineForecastRange(b.id, startUtc, endUtc),
          getTideForecastRange(b.id, startUtc, endUtc),
          // Warm the sun_times cache for this beach/day in parallel (result not used directly here)
          getSunTimes(b.id, localDateStr, b.lat, b.lon).catch(() => ({ sunrise_utc: null, sunset_utc: null })),
        ]).then(([m, t]) => [m, t]);
        marine = m || [];
        tide = t || [];
      }
      if (!marine?.length || !tide?.length) continue;
      const wins = topWindowsInRange(b, marine, tide, startUtc, endUtc, 120);
      for (const w of wins) winsAll.push(w);
    }

    winsAll.sort((a,b) => (b.meanScore ?? 0) - (a.meanScore ?? 0));
    if (winsAll.length === 0) {
      const title = mode === 'tomorrow_morning' ? "Tomorrow morning's picks" : "Next best windows near you";
      const payload = {
        mode,
        title,
        range_local: { start: startLocal.toISOString(), end: endLocal.toISOString(), tz },
        picks: [],
        note: "Not enough forecast data",
      };
      apiCache.set(cacheKey, payload, 12 * 60 * 1000); // 12 minutes
      return NextResponse.json(payload);
    }
    const cards = winsAll.slice(0, 3).map((w) => windowBlurbDetailed(w));

    const title = mode === 'tomorrow_morning' ? "Tomorrow morning's picks" : "Next best windows near you";
    const payload = {
      mode,
      title,
      range_local: { start: startLocal.toISOString(), end: endLocal.toISOString(), tz },
      picks: cards
    };
    apiCache.set(cacheKey, payload, 12 * 60 * 1000); // 12 minutes
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}

const requestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radius_km: z.number().positive().optional(),
  date_local: z.string().optional(),
  tz: z.string().optional().default('America/Los_Angeles'),
  horizon_hours: z.number().positive().optional().default(5)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate input
    const rawInput = {
      lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
      lon: searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : undefined,
      radius_km: searchParams.get('radius_km') ? parseFloat(searchParams.get('radius_km')!) : undefined,
      date_local: searchParams.get('date_local') || undefined,
      tz: searchParams.get('tz') || undefined,
      horizon_hours: searchParams.get('horizon_hours') ? parseFloat(searchParams.get('horizon_hours')!) : undefined
    };

    const result = requestSchema.safeParse(rawInput);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    const { lat, lon, radius_km, date_local, tz, horizon_hours } = result.data;
    
    // Use current date if date_local not provided
    const date = date_local || new Date().toISOString().split('T')[0];

    const [startUtc, endUtc] = getMorningWindow(date, tz, lat, lon, horizon_hours);

    return NextResponse.json({
      date,
      timezone: tz,
      coordinates: { lat, lon },
      radius_km,
      horizon_hours,
      morningWindow: {
        startUtc: startUtc.toISOString(),
        endUtc: endUtc.toISOString()
      }
    });
  } catch (error) {
    console.error('Error calculating morning window:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Minimal GeoHash encoder (base32), precision = number of characters
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function geohashEncode(latitude: number, longitude: number, precision: number = 4): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude >= lonMid) { idx = (idx << 1) + 1; lonMin = lonMid; }
      else { idx = (idx << 1) + 0; lonMax = lonMid; }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude >= latMid) { idx = (idx << 1) + 1; latMin = latMid; }
      else { idx = (idx << 1) + 0; latMax = latMid; }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}