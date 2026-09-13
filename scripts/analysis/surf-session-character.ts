import type { Database } from '../../types/database.generated';

export const DIMENSIONS = [
  'surface', 'shape', 'barrels', 'barrel_makeability', 'frequency', 'sets_lulls',
  'arrival_consistency', 'size_consistency', 'shape_consistency',
  'consistency_unspecified', 'power', 'evolution', 'size', 'direction',
] as const;
export type Dimension = typeof DIMENSIONS[number];
export type Origin = 'user' | 'uncertain' | 'forecast_prefilled' | 'forecast_quote';
export interface Observation {
  dimension: Dimension;
  label: string;
  status: 'positive' | 'negative' | 'ambiguous';
  origin: Origin;
  field: string;
  span: string;
  offset: number | null;
  scope: 'one' | 'some' | 'most' | 'session' | 'unknown';
  time: string | null;
  range?: { min: number; max: number | null; unit: 'minutes'; target: string };
}
type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type AuditSession = Pick<SessionRow,
  'id' | 'user_id' | 'beach_id' | 'custom_spot_id' | 'arrival_time' | 'duration_minutes'
  | 'wave_characteristics' | 'notes' | 'description'>;

const TAGS: Record<string, [Dimension, string]> = {
  clean: ['surface', 'clean'], glassy: ['surface', 'glassy'], choppy: ['surface', 'choppy'],
  blown_out: ['surface', 'blown_out'], closeouts: ['shape', 'closeouts'],
  barreling: ['barrels', 'observed'], reform: ['shape', 'reform'],
  walled: ['shape', 'walled'], peaky: ['shape', 'peaky'],
  fat: ['power', 'fat'], mushy: ['power', 'mushy'], steep: ['power', 'steep'],
  powerful: ['power', 'powerful'], lefts: ['direction', 'left'], rights: ['direction', 'right'],
};
const RULES: Array<[Dimension, string, RegExp]> = [
  ['surface', 'glassy', /\bglassy\b/gi], ['surface', 'clean', /\bclean\b/gi],
  ['surface', 'textured', /\b(?:textured|bumpy)\b/gi],
  ['surface', 'choppy', /\b(?:choppy|chop)\b/gi],
  ['surface', 'blown_out', /\bblown[ -]out\b/gi],
  ['shape', 'closeouts', /\b(?:closeouts?|clos(?:ing|ed) out)\b/gi],
  ['shape', 'peeling', /\b(?:peelers?|peeling|open (?:faces?|shoulders?))\b/gi],
  ['shape', 'running', /\b(?:runners?|running wave)\b/gi],
  ['shape', 'sectioning', /\bsectioning\b/gi], ['shape', 'reform', /\breforms?\b/gi],
  ['shape', 'walled', /\b(?:walled|walls?)\b/gi], ['shape', 'peaky', /\bpeaky\b/gi],
  ['barrels', 'observed', /\b(?:barrels?|barreling|barrelling)\b/gi],
  ['barrels', 'hollow', /\b(?:hollow|pitching)\b/gi],
  ['barrel_makeability', 'makeable', /\b(?:makeable barrels?|made (?:a|the|one) barrel)\b/gi],
  ['frequency', 'frequent', /\b(?:nonstop|constant sets|frequent (?:waves|sets))\b/gi],
  ['frequency', 'occasional', /\boccasional (?:waves|sets)\b/gi],
  ['frequency', 'set_driven', /\bset[- ]driven\b/gi],
  ['sets_lulls', 'long_wait', /\b(?:long (?:waits?|lulls?)|waves (?:just )?stopped coming)\b/gi],
  ['sets_lulls', 'background_present', /\b(?:smaller (?:ones|waves) in between|background waves)\b/gi],
  ['arrival_consistency', 'regular', /\b(?:regular (?:gaps|intervals|arrivals)|evenly spaced)\b/gi],
  ['arrival_consistency', 'irregular', /\b(?:irregular (?:gaps|intervals|arrivals)|unevenly spaced)\b/gi],
  ['size_consistency', 'variable', /\b(?:variable sizes?|sizes? varied)\b/gi],
  ['size_consistency', 'steady', /\b(?:consistent size|same size)\b/gi],
  ['shape_consistency', 'repeatable', /\b(?:consistent shape|repeatable shape)\b/gi],
  ['consistency_unspecified', 'consistent', /\bconsistent\b(?!\s+(?:size|shape))/gi],
  ['power', 'mushy', /\b(?:mushy|soft)\b/gi], ['power', 'fat', /\bfat\b/gi],
  ['power', 'steep', /\bsteep\b/gi], ['power', 'powerful', /\b(?:powerful|heavy)\b/gi],
  ['power', 'punchy', /\bpunchy\b/gi], ['power', 'slow', /\bslow\b/gi],
  ['power', 'difficult_takeoff', /\b(?:difficult|hard) takeoffs?\b/gi],
  ['evolution', 'improving', /\b(?:improving|got better)\b/gi],
  ['evolution', 'deteriorating', /\b(?:deteriorating|got worse)\b/gi],
  ['size', 'reported', /\b(?:waist[- ]high|\d+(?:\s*[-\u2013]\s*\d+)?\s*(?:feet|ft))\b/gi],
];

/** Offline coding aid. Unrecognized language stays unknown and needs human review. */
export function extractObservations(
  session: Pick<AuditSession, 'wave_characteristics' | 'notes' | 'description'>,
  tagOrigin: Origin = 'uncertain',
): Observation[] {
  const result: Observation[] = [];
  for (const tag of new Set(session.wave_characteristics ?? [])) {
    const rule = TAGS[tag];
    if (!rule) continue;
    const [dimension, label] = rule;
    result.push({ dimension, label, status: ['walled', 'peaky'].includes(label) ? 'ambiguous' : 'positive',
      origin: tagOrigin === 'uncertain' && dimension !== 'surface' ? 'user' : tagOrigin,
      field: 'wave_characteristics', span: tag, offset: null, scope: 'unknown', time: null });
  }
  for (const field of ['notes', 'description'] as const) {
    const text = session[field];
    if (!text) continue;
    for (const [dimension, label, pattern] of RULES) {
      for (const match of text.matchAll(pattern)) {
        const offset = match.index!;
        const before = text.slice(0, offset).split(/[.!?;,]|\bbut\b|\bthen\b/i).pop() ?? '';
        const after = text.slice(offset).split(/[.!?;,]|\bbut\b|\bthen\b/i)[0];
        const clause = before + after;
        const negative = /\b(?:not|no|never|wasn['\u2019]t|weren['\u2019]t)\s+(?:(?:really|too|crazy|many|any)\s+)?$/i.test(before);
        const quote = /\b(?:forecast|home page|app|quiver)\b.{0,40}\b(?:said|says|predicted|showed)\b/i.test(before);
        const personal = /\b(?:caught|rode|paddled for)\b/i.test(before);
        const scope = /\bmost\b/i.test(before) ? 'most'
          : /\b(?:couple|few|some)\b/i.test(before) ? 'some'
          : personal ? 'one' : /\b(?:all morning|all day|whole session|nonstop)\b/i.test(clause) ? 'session' : 'unknown';
        const ambiguous = ['walled', 'peaky', 'consistency_unspecified'].includes(label) || dimension === 'consistency_unspecified';
        result.push({ dimension, label, status: negative ? 'negative' : ambiguous ? 'ambiguous' : 'positive',
          origin: quote ? 'forecast_quote' : 'user', field,
          span: negative ? `${before.match(/\b(?:not|no|never|wasn['\u2019]t|weren['\u2019]t)\b[^.!?;,]*$/i)?.[0] ?? ''}${match[0]}`.trim() : match[0],
          offset, scope, time: clause.match(/\b(?:early|later|after\s+\d+(?::\d+)?(?:\s*(?:am|pm))?|all morning|as the tide rose)\b/i)?.[0] ?? null });
      }
    }
    const waits = /\b(\d+)\s*(?:[-\u2013]|to)\s*(\d+)\s*(?:minutes?|mins?)\b/gi;
    for (const match of text.matchAll(waits)) {
      const context = text.slice(Math.max(0, match.index! - 45), match.index! + match[0].length + 65);
      if (/caught|lineup was packed|forecast|app said/i.test(context)) continue;
      const target = /(?:decent|worthwhile|good) sets/i.test(context) ? 'worthwhile_sets'
        : /good waves/i.test(context) ? 'worthwhile_waves'
        : /between sets/i.test(context) ? 'sets' : /waves.*increments/i.test(context) ? 'waves' : 'unspecified';
      result.push({ dimension: 'sets_lulls', label: 'reported_wait_range', status: target === 'unspecified' ? 'ambiguous' : 'positive',
        origin: 'user', field, span: match[0], offset: match.index!, scope: 'unknown', time: null,
        range: { min: Number(match[1]), max: Number(match[2]), unit: 'minutes', target } });
    }
    for (const match of text.matchAll(/\b(\d+)\s*(?:minutes?|mins?)\s*\+/gi)) {
      if (!/set|lull|wait/i.test(text)) continue;
      result.push({ dimension: 'sets_lulls', label: 'reported_wait_lower_bound', status: 'positive', origin: 'user', field,
        span: match[0], offset: match.index!, scope: 'unknown', time: null,
        range: { min: Number(match[1]), max: null, unit: 'minutes', target: /set/i.test(text) ? 'sets' : 'unspecified' } });
    }
    if (/\b(?:early|went from|turned to)\b/i.test(text) && /\b(?:then|later|after|to)\b/i.test(text)) {
      result.push({ dimension: 'evolution', label: 'changing', status: 'positive', origin: 'user', field,
        span: text.match(/\b(?:early|went from|turned to)\b/i)![0], offset: null, scope: 'session',
        time: text.match(/\b(?:after\s+\d+(?::\d+)?(?:\s*(?:am|pm))?|later|early)\b/i)?.[0] ?? null });
    }
  }
  return result;
}

export function observedSurface(observations: Observation[]): 'clean' | 'rough' | 'mixed' | 'unknown' {
  const usable = observations.filter(o => o.dimension === 'surface' && o.origin === 'user' && o.status === 'positive' && o.scope !== 'one');
  const clean = usable.some(o => ['clean', 'glassy'].includes(o.label));
  const rough = usable.some(o => ['choppy', 'blown_out', 'textured'].includes(o.label));
  if ((clean && rough) || usable.some(o => o.time && !/all morning/i.test(o.time))) return 'mixed';
  return clean ? 'clean' : rough ? 'rough' : 'unknown';
}

export function compareWarning(prediction: boolean | null, observed: boolean | null): string {
  if (observed === null) return 'unknown_observation';
  if (prediction === null) return 'capability_gap';
  return prediction ? (observed ? 'agreement_warning' : 'false_warning')
    : observed ? 'missed_warning' : 'agreement_no_warning';
}

export interface ForecastEvidence {
  id: string;
  session_id: string;
  beach_id: string;
  user_id: string;
  forecast_snapshot: Record<string, unknown>;
  created_at?: string | null;
}
export interface EvidenceResult {
  category: 'B' | 'C' | 'D';
  reason: string;
  snapshot: ForecastEvidence | null;
  offsetMinutes: number | null;
  coversWholeSession: boolean;
}
export function uniqueRows<T extends { id: string }>(rows: T[]): T[] {
  const found = new Map<string, T>();
  for (const row of rows) {
    const previous = found.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error(`Conflicting duplicate row in audit input`);
    found.set(row.id, row);
  }
  return [...found.values()];
}
const timestamp = (value: unknown): number => typeof value === 'string' ? Date.parse(value) : NaN;

/** B certifies the saved input revision only, not historic code/config or displayed output. */
export function matchForecast(session: AuditSession, rows: ForecastEvidence[], toleranceMinutes = 90): EvidenceResult {
  const base: EvidenceResult = { category: 'D', reason: 'no_snapshot', snapshot: null, offsetMinutes: null, coversWholeSession: false };
  const candidates = uniqueRows(rows.filter(r => r.session_id === session.id));
  if (!candidates.length) return base;
  if (candidates.length !== 1) return { ...base, category: 'C', reason: 'ambiguous_snapshots' };
  const row = candidates[0];
  const start = timestamp(session.arrival_time);
  const forecast = row.forecast_snapshot;
  const validAt = timestamp(forecast.forecast_at);
  const offsetMinutes = (validAt - start) / 60_000;
  const result = { ...base, category: 'C' as const, snapshot: row, offsetMinutes: Number.isFinite(offsetMinutes) ? offsetMinutes : null };
  if (session.custom_spot_id || row.beach_id !== session.beach_id || forecast.beach_id !== session.beach_id || row.user_id !== session.user_id) {
    return { ...result, snapshot: null, reason: 'beach_peak_or_owner_mismatch' };
  }
  if (!Number.isFinite(start) || !Number.isFinite(validAt) || !(session.duration_minutes > 0)) return { ...result, reason: 'session_interval_unknown' };
  if (Math.abs(offsetMinutes) > toleranceMinutes) return { ...result, snapshot: null, reason: 'outside_start_tolerance' };
  const created = timestamp(forecast.created_at);
  const updated = timestamp(forecast.updated_at);
  if (!Number.isFinite(created) || !Number.isFinite(updated) || updated < created) return { ...result, reason: 'revision_vintage_unknown' };
  const raw = forecast.raw_forecast as { fetch_timestamps?: Record<string, unknown> } | null;
  const fetches = Object.values(raw?.fetch_timestamps ?? {}).map(timestamp).filter(Number.isFinite);
  if (Math.max(created, updated, ...fetches, timestamp(forecast.om_fetched_at) || 0) > start) return { ...result, reason: 'post_session_revision' };
  return { ...result, category: 'B', reason: 'pre_session_input_revision_current_config_only' };
}
