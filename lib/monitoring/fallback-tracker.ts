import * as Sentry from '@sentry/nextjs';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

export type FallbackSeverity = 'low' | 'medium' | 'high' | 'dangerous';

/**
 * Default severity for known domain:field combinations.
 * Call sites can still override, but this provides consistency
 * and documents the rationale for each severity level.
 */
const SEVERITY_CONFIG: Record<string, Record<string, FallbackSeverity>> = {
  'morning-intel': {
    wave_height: 'dangerous',     // Scoring built on fabricated wave data
  },
  'surf-windows': {
    tide_height: 'dangerous',     // Window scoring ignores tide influence
  },
  scoring: {
    wind_offshore_deg: 'high',    // Wind quality calculation affected
  },
  'tide-analyzer': {
    tide_height: 'high',          // Tide timing recommendations affected
  },
  forecast: {
    confidence_score: 'high',     // User-visible reliability indicator fabricated
  },
  discovery: {
    confidence_score: 'high',     // Discovery ranking uses fabricated confidence
    subscore_baseConditions: 'dangerous',
    subscore_windQuality: 'dangerous',
    subscore_tideFit: 'dangerous',
    stale_data_scored: 'high',
  },
  'noaa-coops': {
    tide_data: 'dangerous',       // Entire tide dataset is synthetic
  },
  'noaa-wavewatch': {
    wave_forecast: 'dangerous',   // Entire wave forecast is synthetic
  },
  'beach-query': {
    cache_and_db: 'high',
  },
  sessions: {
    join_enrichment: 'high',
  },
  'beach-detail': {
    forecast_data: 'high',
  },
  search: {
    autocomplete: 'high',
  },
  homepage: {
    top_beaches: 'high',
  },
};

function getDefaultSeverity(domain: string, field: string): FallbackSeverity {
  return SEVERITY_CONFIG[domain]?.[field] ?? 'medium';
}

export interface FallbackEvent {
  /** Which system triggered the fallback (scoring, forecast, session, etc.) */
  domain: string;
  /** What specifically fell back (wave_height, confidence, tide, etc.) */
  field: string;
  /** What default value was used */
  fallbackValue: string | number | null;
  /**
   * Why the real value was missing.
   * Examples: 'missing_data', 'api_failure', 'cache_miss', 'invalid_value'
   */
  reason?: string;
  /**
   * How bad is this for data quality.
   * If omitted, derived from the domain:field severity config.
   */
  severity?: FallbackSeverity;
  /** Optional context (beach ID, forecast date, etc.) */
  context?: Record<string, string | number | boolean | null | undefined>;
}

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (typeof window !== 'undefined') return null;
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _supabaseAdmin = createSupabaseClient(url, key);
  return _supabaseAdmin;
}

export function trackFallback(event: FallbackEvent): void {
  try {
    const severity = event.severity ?? getDefaultSeverity(event.domain, event.field);
    const tag = `[FALLBACK:${event.domain}:${event.field}]`;

    // Always log structured for Vercel log drain
    console.warn(tag, {
      fallbackValue: event.fallbackValue,
      severity,
      reason: event.reason,
      ...event.context,
      timestamp: new Date().toISOString(),
    });

    // Send to Sentry as a breadcrumb + message for high/dangerous
    if (severity === 'high' || severity === 'dangerous') {
      const sentryLevel = severity === 'dangerous' ? 'error' as const : 'warning' as const;
      Sentry.withScope((scope) => {
        scope.setTag('fallback_domain', event.domain);
        scope.setTag('fallback_field', event.field);
        scope.setTag('fallback_severity', severity);
        scope.setLevel(sentryLevel);
        if (event.context) {
          scope.setContext('fallback', event.context);
        }
        Sentry.captureMessage(
          `Fallback triggered: ${event.domain}.${event.field} → ${event.fallbackValue}`,
          sentryLevel
        );
      });
    } else {
      // Low/medium: add as breadcrumb only (no alert, but visible in error traces)
      Sentry.addBreadcrumb({
        category: 'fallback',
        message: `${event.domain}.${event.field} → ${event.fallbackValue}`,
        level: 'warning',
        data: event.context,
      });
    }

    // Server-side: persist to database (fire-and-forget)
    const supabase = getSupabaseAdmin();
    if (supabase) {
      void supabase
        .from('fallback_events')
        .insert({
          domain: event.domain,
          field: event.field,
          fallback_value: String(event.fallbackValue ?? ''),
          severity,
          reason: event.reason ?? null,
          context: event.context ?? null,
        });
    }
  } catch {
    // Monitoring must never break the fallback it's observing
  }
}
