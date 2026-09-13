#!/usr/bin/env tsx
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { beachToSpotProfile, forecastToSnapshot, createDiscoveryScoringEngine } from '../../lib/domains/scoring/discovery-adapter';
import { getConditionCharacter } from '../../lib/domains/scoring/condition-character';
import { detectSetupRisk } from '../../lib/domains/scoring/scorers/setup-risk-scorer';
import { calculateRideableWaves } from '../../lib/domains/wave-frequency';
import type { Beach } from '../../types/database';
import type { Database } from '../../types/database.generated';
import type { EnhancedForecastEntity } from '../../types/forecast';
import type { Observation, ForecastEvidence } from './surf-session-character';

type Session = Database['public']['Tables']['sessions']['Row'];
type ReviewedObservation = Omit<Observation, 'dimension'> & { dimension: string };
interface Case {
  caseId: string; user: string; beach: string; beachDay: string; date: string;
  arrival: string; durationMinutes: number;
  evidence: { category: 'B' | 'C' | 'D'; reason: string; offsetMinutes: number | null };
  observations: ReviewedObservation[];
}
interface Review {
  caseId: string; noteSha256: string; reviewedEntireNote: boolean;
  originalParsedNoteObservations: number; rationale: string;
  added: ReviewedObservation[]; observations: ReviewedObservation[];
}

function main(): void {
  const { values } = parseArgs({ options: { evidence: { type: 'string' }, output: { type: 'string' } } });
  assert(values.evidence && values.output, 'Use --evidence DIR --output DIR');
  const directory = resolve(values.evidence);
  const output = resolve(values.output);
  const repository = resolve(__dirname, '../..');
  const rel = relative(repository, output);
  assert(isAbsolute(rel) || rel === '..' || rel.startsWith('../'), 'Keep private output outside the repository');
  const read = <T>(file: string): T => JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as T;
  const input = read<{ extractedAt: string; all: Session[]; snapshots: ForecastEvidence[]; beaches: Beach[] }>('input.private.json');
  const cases = read<Case[]>('cases.private.json');
  const manual = read<{ notesReviewed: number; entries: Review[] }>('manual-review.private.json');
  const salt = readFileSync(resolve(directory, '.pseudonym-key'), 'utf8');
  const pseudonym = (id: string): string => createHmac('sha256', salt).update(id).digest('hex').slice(0, 16);
  const sessions = new Map(input.all.map(s => [pseudonym(s.id), s]));
  const reviews = new Map(manual.entries.map(r => [r.caseId, r]));
  assert.equal(reviews.size, 49);
  assert.equal(manual.notesReviewed, 49);
  for (const review of reviews.values()) {
    const session = sessions.get(review.caseId);
    assert(session && review.reviewedEntireNote);
    const note = session.notes || session.description || '';
    assert.equal(createHash('sha256').update(note).digest('hex'), review.noteSha256, 'Reviewed source changed');
    for (const observation of review.added) {
      assert(observation.offset !== null && note.slice(observation.offset, observation.offset + observation.span.length) === observation.span, 'Manual source span mismatch');
    }
  }
  assert.equal(cases.filter(c => { const s = sessions.get(c.caseId)!; return !!(s.notes || s.description); }).length, 49);
  const has = (observations: ReviewedObservation[], dimension: string): boolean => observations.some(o => o.dimension === dimension && o.origin === 'user' && o.status !== 'ambiguous');
  const requested = {
    closeouts: cases.filter(c => c.evidence.category === 'B' && c.observations.some(o => o.field === 'wave_characteristics' && o.label === 'closeouts')).map(c => c.caseId),
    barrels: cases.filter(c => c.evidence.category === 'B' && has(c.observations, 'barrels')).map(c => c.caseId),
    lulls: cases.filter(c => c.evidence.category === 'B' && has(c.observations, 'sets_lulls')).map(c => c.caseId),
    originalPower: cases.filter(c => c.evidence.category === 'B' && has(c.observations, 'power')).map(c => c.caseId),
    revisedPower: cases.filter(c => c.evidence.category === 'B' && has(reviews.get(c.caseId)?.observations ?? c.observations, 'power')).map(c => c.caseId),
  };
  assert.deepEqual([requested.closeouts.length, requested.barrels.length, requested.lulls.length, requested.originalPower.length], [14, 6, 3, 30]);
  const engine = createDiscoveryScoringEngine();
  const traces = cases.map(c => {
    const session = sessions.get(c.caseId)!;
    const review = reviews.get(c.caseId);
    const observations = review?.observations ?? c.observations;
    const row = input.snapshots.find(r => r.session_id === session.id);
    const beach = input.beaches.find(b => b.id === session.beach_id);
    const groups = Object.entries(requested).filter(([, ids]) => ids.includes(c.caseId)).map(([name]) => name);
    const base = { ...c, groups, observations, manualRationale: review?.rationale ?? 'Tags only; no note to adjudicate.', historicalPrediction: 'unavailable', configurationVintage: 'current only', coversWholeSession: false };
    if (!row || !beach || c.evidence.reason === 'beach_peak_or_owner_mismatch') return { ...base, diagnostic: null };
    const forecast = row.forecast_snapshot as unknown as EnhancedForecastEntity;
    const snapshot = forecastToSnapshot(forecast);
    const profile = beachToSpotProfile(beach);
    const scorerInput = { snapshot, profile, window: null, preferences: null };
    const composite = engine.score(scorerInput);
    const character = getConditionCharacter(snapshot, profile, composite);
    const gates = {
      beachBreak: String(profile.breakType).toLowerCase().includes('beach'),
      finiteInputs: [snapshot.waveHeight, snapshot.wavePeriod, snapshot.tide.heightFt].every(Number.isFinite),
      heightAtLeast6Ft: snapshot.waveHeight >= 6,
      periodAtLeast10S: snapshot.wavePeriod >= 10,
      falling: snapshot.tide.direction === 'falling',
      sufficientlyLow: snapshot.tide.heightFt <= 0 || profile.tidePreferences.minHeightFt - snapshot.tide.heightFt >= 1,
    };
    const risk = detectSetupRisk(scorerInput);
    assert.equal(!!risk, Object.values(gates).every(Boolean), 'Diagnostic gates diverged from the actual scorer');
    const frequency = calculateRideableWaves(forecast, beach);
    const periodChanged = parseFloat(forecast.wave_period ?? '') !== snapshot.wavePeriod;
    const slotOutsideSession = snapshot.timestamp.getTime() < Date.parse(c.arrival) || snapshot.timestamp.getTime() >= Date.parse(c.arrival) + c.durationMinutes * 60_000;
    const explanation = [
      `Setup warning: ${risk ? risk.warning : `not triggered; failed ${Object.entries(gates).filter(([, pass]) => !pass).map(([gate]) => gate).join(', ')}`}.`,
      ...(periodChanged ? [`Stored period ${forecast.wave_period ?? 'missing'} becomes ${snapshot.wavePeriod}s via the current dominant-partition picker, not a recovered historical model.`] : []),
      ...(slotOutsideSession ? ['Selected hourly slot lies outside the actual session interval despite passing the original start-tolerance match.'] : []),
      ...(c.caseId === 'cf51bb332b1766ff' ? ['Note names a rivermouth peak, while configuration is for the pier; local applicability is unresolved.'] : []),
      ...(groups.includes('closeouts') ? ['Reported closeouts are not explained by this narrow heavy/dropping-low rule; local breaking depth, sandbar geometry and exact breaking section are not supplied.'] : []),
      ...(groups.includes('barrels') ? ['Occurrence tag only; no makeability, ride completion, barrel section depth or opening duration. Neither score nor clean surface predicts makeability.'] : []),
      ...(groups.includes('lulls') ? ['Beat-period heuristic is not observed set-arrival timing; background-wave versus worthwhile-set events are not interchangeable.'] : []),
      ...(groups.includes('revisedPower') ? ['Bulk height/period and fat/mushy/steep/powerful descriptors can coexist; local breaking transformation and takeoff phase are not measured.'] : []),
    ];
    return { ...base, diagnostic: {
      raw: {
        validAt: forecast.forecast_at, createdAt: forecast.created_at, updatedAt: forecast.updated_at,
        height: forecast.wave_height, period: forecast.wave_period, direction: forecast.wave_direction,
        wind: { speed: forecast.wind_speed, direction: forecast.wind_direction, degrees: forecast.wind_direction_deg },
        tide: { height: forecast.tide_height, status: forecast.tide_status },
        partitions: ['swell_1', 'swell_2', 'wind_wave'].map(key => ({ source: key, height: row.forecast_snapshot[`${key}_height`], period: row.forecast_snapshot[`${key}_period`], direction: row.forecast_snapshot[`${key}_direction`] })),
      }, snapshot, profile, validity: { finiteRuleInputs: gates.finiteInputs, rangeHeightUsesLowerBound: /\d\s*-\s*\d/.test(forecast.wave_height ?? ''), missingStoredPeriod: !forecast.wave_period, periodChanged, slotOutsideSession, rawTidePresent: !!forecast.tide_height, rawBreakTypePresent: !!beach.break_type, preferredTideDefaulted: beach.preferred_tide_ft_min == null },
      setupGates: gates, output: { score: composite.total, character, setupRisk: risk, subscores: Object.fromEntries(composite.subscores), reasons: composite.reasons, warnings: composite.warnings, legacyFrequency: frequency }, explanation,
    } };
  });
  // An existing 10s energy gate is examined, not fitted into a new predictor.
  const periodHypothesis = traces.flatMap(t => {
    if (!t.diagnostic || t.evidence.category !== 'B') return [];
    const notes = t.observations.filter(o => o.field !== 'wave_characteristics' && o.origin === 'user' && o.dimension === 'power');
    const strong = notes.some(o => o.label === 'powerful' && o.status === 'positive');
    const weak = notes.some(o => (o.label === 'weak' && o.status === 'positive') || (o.label === 'powerful' && o.status === 'negative'));
    if (strong === weak) return [];
    const prediction = t.diagnostic.snapshot.wavePeriod >= 10;
    const storedPeriod = parseFloat(t.diagnostic.raw.period ?? '');
    const storedPrediction = Number.isFinite(storedPeriod) && storedPeriod > 0 ? storedPeriod >= 10 : null;
    return [{ caseId: t.caseId, user: t.user, date: t.date, period: t.diagnostic.snapshot.wavePeriod,
      strongObserved: strong, energeticProxy: prediction, agrees: prediction === strong,
      storedPeriodCandidate: Number.isFinite(storedPeriod) ? storedPeriod : null,
      storedCandidateAgrees: storedPrediction === null ? null : storedPrediction === strong,
      slotInsideSession: !t.diagnostic.validity.slotOutsideSession,
      split: t.date < '2026-08-01' ? 'earlier' : 'later_retrospective_not_blind' }];
  });
  const closeoutTraces = traces.filter(t => requested.closeouts.includes(t.caseId));
  const failures = Object.keys(closeoutTraces[0].diagnostic!.setupGates).map(gate => ({ gate,
    failed: closeoutTraces.filter(t => Object.entries(t.diagnostic!.setupGates).some(([name, pass]) => name === gate && !pass)).length }));
  const summary = {
    extraction: input.extractedAt, notesReviewed: 49, newlyAdjudicatedSpans: manual.entries.reduce((n, r) => n + r.added.length, 0),
    previouslyUnparsed: manual.entries.filter(r => r.originalParsedNoteObservations === 0).length,
    previouslyUnparsedWithNewEvidence: manual.entries.filter(r => r.originalParsedNoteObservations === 0 && r.added.length).length,
    previouslyUnparsedWithUnambiguousEvidence: manual.entries.filter(r => r.originalParsedNoteObservations === 0 && r.added.some(o => o.status !== 'ambiguous')).length,
    requested, uniqueRequestedCases: new Set(Object.values(requested).flat()).size,
    closeoutGateFailures: failures, closeoutHeightRange: [Math.min(...closeoutTraces.map(t => t.diagnostic!.snapshot.waveHeight)), Math.max(...closeoutTraces.map(t => t.diagnostic!.snapshot.waveHeight))],
    closeoutPeriodReinterpreted: closeoutTraces.filter(t => t.diagnostic!.validity.periodChanged).length,
    periodHypothesis, ruleChanges: 0, calibratedCandidate: null, historicalAccuracyClaims: 0,
    note: 'All notes and source inputs were inspected. The retrospective date split is not an untouched or blind holdout. No predictive candidate was tuned or deployed.',
  };
  mkdirSync(output, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(resolve(output, 'traces.private.json'), JSON.stringify(traces, null, 2) + '\n', { mode: 0o600 });
  const text = ['# Individual current-code diagnostics', '', 'Private evidence. Not historical predictions; current configuration; one hourly slot per case. Groups overlap and must not be summed.', ''];
  for (const trace of traces.filter(t => t.groups.length || t.observations.some(o => o.field !== 'wave_characteristics' && ['frequency', 'shape'].includes(o.dimension)))) {
    text.push(`## ${trace.caseId}: ${trace.beach}, ${trace.date}`, `Groups: ${trace.groups.join(', ') || 'contrary/context observation'}; source class ${trace.evidence.category}; offset ${trace.evidence.offsetMinutes} minutes.`, `Manual review: ${trace.manualRationale}`, '', 'Observations:', ...trace.observations.filter(o => o.origin !== 'forecast_quote').map(o => `- ${o.dimension}/${o.label}: ${o.status}, ${o.origin}, ${o.scope}, time=${o.time ?? 'unspecified'}; ${o.field}@${o.offset ?? 'tag'}: ${JSON.stringify(o.span)}`), '');
    if (!trace.diagnostic) { text.push('No compatible replay inputs. Observation retained without a prediction.', ''); continue; }
    text.push('Inputs, configuration, gates and current output:', '```json', JSON.stringify(trace.diagnostic, null, 2), '```', '');
  }
  writeFileSync(resolve(output, 'case-traces.private.md'), text.join('\n'), { mode: 0o600 });
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main();
