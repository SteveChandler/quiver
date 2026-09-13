#!/usr/bin/env tsx
import { createHmac, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import type { Database } from '../../types/database.generated';
import type { Beach } from '../../types/database';
import type { EnhancedForecastEntity } from '../../types/forecast';
import { beachToSpotProfile, forecastToSnapshot, createDiscoveryScoringEngine } from '../../lib/domains/scoring/discovery-adapter';
import { getConditionCharacter } from '../../lib/domains/scoring/condition-character';
import { detectSetupRisk } from '../../lib/domains/scoring/scorers/setup-risk-scorer';
import { calculateRideableWaves } from '../../lib/domains/wave-frequency';
import { forecastToConditionsData } from '../../lib/mappers/conditions-mappers';
import { DIMENSIONS, extractObservations, observedSurface, compareWarning, matchForecast, uniqueRows, type ForecastEvidence } from './surf-session-character';

type Session = Database['public']['Tables']['sessions']['Row'];
type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'deleted_at' | 'is_mock' | 'analytics_is_real_user' | 'is_system_account'>;
type Context = Database['public']['Tables']['forecast_feedback_contexts']['Row'];
interface Input {
  extractedAt: string;
  all: Session[];
  profiles: Profile[];
  snapshots: ForecastEvidence[];
  beaches: Beach[];
  contexts: Context[];
  impressions: Array<{ id: string }>;
  recommendationContexts: Array<{ id: string }>;
  queries?: Array<{ table: string; count: number; pages: number }>;
}
const START = '2026-06-01T07:00:00.000Z';
const END = '2026-09-09T07:00:00.000Z';
const count = (values: string[]): Record<string, number> => values.reduce<Record<string, number>>((a, v) => { a[v] = (a[v] ?? 0) + 1; return a; }, {});

function eligibility(session: Session, profile: Profile | undefined, extraction: string): string {
  if (session.status !== 'completed') return 'not_completed';
  if (session.deleted_at || profile?.deleted_at) return 'deleted';
  if (profile?.is_mock || profile?.is_system_account || profile?.analytics_is_real_user === false) return 'mock_system_or_nonreal';
  if (/mock|test|maestro|smoke|seed|system|npc|synthetic/i.test(session.source ?? '')) return 'test_source';
  if (!profile || profile.is_mock !== false || profile.analytics_is_real_user !== true) return 'ambiguous_profile';
  if (Date.parse(session.arrival_time) > Date.parse(extraction)) return 'future_arrival';
  return 'included';
}

async function extract(envFile: string): Promise<Input> {
  config({ path: envFile });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service-role key');
  if (new URL(url).hostname !== 'vawdnbbgawichorsjiwe.supabase.co') throw new Error('Unexpected database host; this audit targets the authorized Quiver production project');
  const queries: NonNullable<Input['queries']> = [];
  async function read<T extends { id: string }>(table: string, params: Record<string, string>): Promise<T[]> {
    const rows: T[] = [];
    let expected: number | null = null;
    for (let page = 0; page < 100; page++) {
      const target = new URL(`${url}/rest/v1/${table}`);
      Object.entries({ ...params, order: 'id.asc', limit: '500', offset: String(page * 500) }).forEach(([k, v]) => target.searchParams.set(k, v));
      const response = await fetch(target, { method: 'GET', headers: { apikey: key!, Authorization: `Bearer ${key}`, Prefer: 'count=exact' }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`${table}: HTTP ${response.status}: ${await response.text()}`);
      const total = Number(response.headers.get('content-range')?.split('/')[1]);
      if (!Number.isFinite(total)) throw new Error(`${table}: missing exact count`);
      if (expected !== null && total !== expected) throw new Error(`${table}: cardinality changed during pagination; rerun`);
      expected = total;
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error(`${table}: expected array`);
      rows.push(...data as T[]);
      if (data.length < 500) {
        if (rows.length !== total || uniqueRows(rows).length !== total) throw new Error(`${table}: truncated or duplicate page`);
        queries.push({ table, count: rows.length, pages: page + 1 });
        return rows;
      }
    }
    throw new Error(`${table}: pagination safety limit reached`);
  }
  async function related<T extends { id: string }>(table: string, column: string, ids: string[], select = '*'): Promise<T[]> {
    const rows: T[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      rows.push(...await read<T>(table, { select, [column]: `in.(${ids.slice(i, i + 150).join(',')})` }));
    }
    return uniqueRows(rows);
  }
  const extractedAt = new Date().toISOString();
  const all = await read<Session>('sessions', { select: '*', status: 'eq.completed',
    or: `(and(arrival_time.gte.${START},arrival_time.lt.${END}),and(arrival_time.is.null,created_at.gte.${START},created_at.lt.${END}))` });
  const profiles = await related<Profile>('profiles', 'id', [...new Set(all.map(s => s.user_id))], 'id,deleted_at,is_mock,analytics_is_real_user,is_system_account');
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const sessions = all.filter(s => eligibility(s, profileMap.get(s.user_id), extractedAt) === 'included');
  const sessionIds = sessions.map(s => s.id);
  const users = [...new Set(sessions.map(s => s.user_id))];
  const snapshots = await related<ForecastEvidence>('session_forecast_snapshots', 'session_id', sessionIds);
  const beaches = await related<Beach>('beaches', 'id', [...new Set(sessions.map(s => s.beach_id).filter(Boolean))]);
  const contexts = await related<Context>('forecast_feedback_contexts', 'user_id', users);
  const impressions = await related<{ id: string }>('recommendation_impressions', 'user_id', users);
  const recommendationContexts = await related<{ id: string }>('recommendation_session_contexts', 'session_id', sessionIds);
  return { extractedAt, all, profiles, snapshots, beaches, contexts, impressions, recommendationContexts, queries };
}

function buildReport(input: Input, salt: string): { summary: Record<string, unknown>; cases: unknown[] } {
  const pseudonym = (value: string): string => createHmac('sha256', salt).update(value).digest('hex').slice(0, 16);
  const profiles = new Map(input.profiles.map(p => [p.id, p]));
  const all = uniqueRows(input.all);
  const sessions = all.filter(s => eligibility(s, profiles.get(s.user_id), input.extractedAt) === 'included');
  const beaches = new Map(input.beaches.map(b => [b.id, b]));
  const engine = createDiscoveryScoringEngine();
  const cases = sessions.map(s => {
    const observations = extractObservations(s);
    const evidence = matchForecast(s, input.snapshots);
    const beach = beaches.get(s.beach_id);
    const date = Number.isFinite(Date.parse(s.arrival_time))
      ? new Intl.DateTimeFormat('en-CA', { timeZone: beach?.timezone || 'America/Los_Angeles' }).format(new Date(s.arrival_time)) : 'unknown';
    const forecast = evidence.snapshot?.forecast_snapshot as unknown as EnhancedForecastEntity | undefined;
    let replay = null;
    if (forecast && beach) {
      const snapshot = forecastToSnapshot(forecast);
      const profile = beachToSpotProfile(beach);
      const scorerInput = { snapshot, profile, window: null, preferences: null };
      const composite = engine.score(scorerInput);
      const baselineScore = composite.total;
      const candidate = getConditionCharacter(snapshot, profile, composite);
      const baselineLabel = composite.skipReason
        ? composite.skipReason.toLowerCase().includes('onshore') ? 'Onshore wind - conditions blown out' : 'Blown out - too much wind'
        : candidate.label;
      const setupRisk = detectSetupRisk(scorerInput);
      const heuristic = calculateRideableWaves(forecast, beach);
      const display = forecastToConditionsData(forecast, beach);
      const predictedSurface = /chop|wind-affected|blown out/i.test(candidate.label) ? 'rough' : /clean|glassy|dialed/i.test(candidate.label) ? 'clean' : 'unknown';
      const surface = observedSurface(observations);
      const shape = observations.filter(o => o.dimension === 'shape' && o.origin === 'user' && o.label === 'closeouts');
      const closeoutObserved = shape.some(o => o.status === 'positive') && shape.some(o => o.status === 'negative') ? null
        : shape.some(o => o.status === 'positive') ? true : shape.some(o => o.status === 'negative') ? false : null;
      replay = { inputVintage: evidence.category, configurationVintage: 'current_only', historicalAccuracyEligible: false,
        score: composite.total, scoreChanged: baselineScore !== composite.total, baselineLabel, candidateLabel: candidate.label, category: candidate.category,
        warnings: composite.warnings, windQuality: composite.subscores.get('windQuality') ?? null,
        predictedSurface, observedSurface: surface,
        surfaceComparison: surface === 'mixed' ? 'mixed_observation' : compareWarning(predictedSurface === 'unknown' ? null : predictedSurface === 'rough', surface === 'unknown' ? null : surface === 'rough'),
        closeoutWarning: setupRisk ? true : null,
        closeoutComparison: compareWarning(setupRisk ? true : null, closeoutObserved),
        frequencyBaseline: { wavesPerHour: heuristic.rideableWavesPerHour, beatIntervalSeconds: heuristic.dominantBeatIntervalS, validity: 'uncalibrated_heuristic' },
        frequencyCandidate: { wavesPerHour: display.rideableWavesPerHour ?? null, setWaitSeconds: display.dominantBeatIntervalS ?? null },
      };
    }
    // Saved feedback context is output evidence only if it predates the session
    // and covers its actual interval. Later feedback never becomes a prediction.
    const outputs = input.contexts.filter(c => c.user_id === s.user_id && c.beach_id === s.beach_id &&
      Date.parse(c.created_at) <= Date.parse(s.arrival_time) && Date.parse(c.updated_at) <= Date.parse(s.arrival_time) &&
      Date.parse(c.window_start ?? '') <= Date.parse(s.arrival_time) &&
      Date.parse(c.window_end ?? '') >= Date.parse(s.arrival_time) + s.duration_minutes * 60_000);
    return { caseId: pseudonym(s.id), user: pseudonym(s.user_id), beachDay: pseudonym(`${s.beach_id}:${date}`),
      beach: beach?.name ?? 'unknown', date, arrival: s.arrival_time, durationMinutes: s.duration_minutes,
      loggedAt: s.created_at, source: s.source, notesPresent: !!(s.notes || s.description),
      tagsPresent: !!s.wave_characteristics?.length, observations, evidence: { ...evidence, snapshot: undefined },
      savedPreSessionOutputs: outputs.length, savedOutputFields: [...new Set(outputs.flatMap(o => Object.keys(o.displayed_context as object ?? {})))],
      forecastAccuracyAnswer: s.forecast_accuracy, replay };
  });
  const matrix = DIMENSIONS.map(dimension => {
    const reported = cases.filter(c => c.observations.some(o => o.dimension === dimension));
    const usable = cases.filter(c => c.observations.some(o => o.dimension === dimension && o.origin === 'user' && o.status !== 'ambiguous'));
    return { dimension, reported: reported.length, usable: usable.length, unknown: cases.length - usable.length,
      users: new Set(usable.map(c => c.user)).size, beachDays: new Set(usable.map(c => c.beachDay)).size,
      trustedHistoricalPredictionMatches: 0,
      preSessionInputMatches: usable.filter(c => c.evidence.category === 'B').length,
      mixedOrAmbiguous: reported.filter(c => c.observations.some(o => o.dimension === dimension && o.status === 'ambiguous') || (dimension === 'surface' && observedSurface(c.observations) === 'mixed')).length,
      retrospectiveComparison: dimension === 'surface' ? count(cases.flatMap(c => c.replay ? [c.replay.surfaceComparison] : []))
        : dimension === 'shape' ? count(cases.flatMap(c => c.replay ? [c.replay.closeoutComparison] : [])) : null,
    };
  });
  return { summary: {
    extractedAt: input.extractedAt, window: { startInclusive: START, endExclusive: END, timezone: 'America/Los_Angeles', september8Partial: true },
    cohort: { queried: all.length, included: cases.length, filters: count(all.map(s => eligibility(s, profiles.get(s.user_id), input.extractedAt))),
      users: new Set(cases.map(c => c.user)).size, beaches: new Set(sessions.map(s => s.beach_id)).size,
      beachDays: new Set(cases.map(c => c.beachDay)).size, notes: cases.filter(c => c.notesPresent).length,
      tags: cases.filter(c => c.tagsPresent).length, forecastAccuracyAnswers: count(cases.map(c => c.forecastAccuracyAnswer ?? 'missing')),
      recommendationIds: sessions.filter(s => s.recommendation_id).length },
    queries: input.queries ?? 'legacy extraction without per-query receipts',
    provenance: { inputClasses: count(cases.map(c => c.evidence.category)), reasons: count(cases.map(c => c.evidence.reason)),
      savedPreSessionOutputs: cases.reduce((n, c) => n + c.savedPreSessionOutputs, 0),
      feedbackContexts: input.contexts.length, recommendationImpressions: input.impressions.length,
      recommendationContexts: input.recommendationContexts.length, historicalOutcomesValidated: 0,
      limitation: 'B identifies a pre-session forecast revision only. Historical beach configuration, deployed code at surf time, and whole-session predictions are not recovered. All replays use current beach configuration and are diagnostic.' },
    tags: count(sessions.flatMap(s => s.wave_characteristics ?? [])), matrix,
    replay: { denominator: cases.filter(c => c.replay).length,
      surface: count(cases.flatMap(c => c.replay ? [c.replay.surfaceComparison] : [])),
      closeout: count(cases.flatMap(c => c.replay ? [c.replay.closeoutComparison] : [])),
      setupWarnings: cases.filter(c => c.replay?.closeoutWarning).length,
      correctedNonWindLabels: cases.filter(c => c.replay?.category === 'skip' && !/blown out/i.test(c.replay.candidateLabel)).length,
      frequencyNumbersWithheld: cases.filter(c => c.replay).length,
      trainedRules: 0, heldOutPredictivePerformance: null, scoresChanged: cases.filter(c => c.replay?.scoreChanged).length },
    unsupported: ['makeable barrel probability', 'wave opportunities/hour', 'set schedules', 'numeric wait predictions', 'arrival variability', 'wave-to-wave size variability', 'shape repeatability'],
  }, cases };
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { env: { type: 'string' }, input: { type: 'string' }, output: { type: 'string' } } });
  if (!!values.env === !!values.input || !values.output) throw new Error('Use exactly one of --env FILE or --input FILE, plus --output DIR outside the repository');
  const output = resolve(values.output);
  const repository = resolve(__dirname, '../..');
  const rel = relative(repository, output);
  if (!rel.startsWith('..')) throw new Error('Evidence must remain outside the repository');
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const saltPath = resolve(output, '.pseudonym-key');
  if (!existsSync(saltPath)) writeFileSync(saltPath, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
  const input = values.env ? await extract(values.env) : JSON.parse(readFileSync(values.input!, 'utf8')) as Input;
  for (const key of ['all', 'profiles', 'snapshots', 'beaches', 'contexts', 'impressions', 'recommendationContexts'] as const) {
    if (!Array.isArray(input[key])) throw new Error(`Audit input missing array: ${key}`);
  }
  const report = buildReport(input, readFileSync(saltPath, 'utf8'));
  for (const [file, value] of [['summary.json', report.summary], ['cases.private.json', report.cases], ['input.private.json', input]] as const) {
    const path = resolve(output, file);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  }
  process.stdout.write(JSON.stringify(report.summary, null, 2) + '\n');
}
if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Audit failed'); process.exitCode = 1; });
