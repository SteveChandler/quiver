import { extractObservations, observedSurface, matchForecast, uniqueRows, compareWarning, type AuditSession, type ForecastEvidence } from '../../scripts/analysis/surf-session-character';

const observe = (notes: string, tags: string[] = []) => extractObservations({ notes, description: null, wave_characteristics: tags }, 'user');
const session: AuditSession = { id: 'session', user_id: 'user', beach_id: 'beach', custom_spot_id: null,
  arrival_time: '2026-07-01T15:00:00Z', duration_minutes: 120, notes: null, description: null, wave_characteristics: null };
const saved: ForecastEvidence = { id: 'snapshot', session_id: 'session', beach_id: 'beach', user_id: 'user', created_at: '2026-07-02T15:00:00Z',
  forecast_snapshot: { beach_id: 'beach', forecast_at: '2026-07-01T15:00:00Z', created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T12:00:00Z' } };

describe('independent surf-session observations', () => {
  it('keeps clean surface, a few barrels, and mostly closed-out sets separate', () => {
    const rows = observe('Glassy, a couple of barrels, but most sets closed out.');
    expect(observedSurface(rows)).toBe('clean');
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimension: 'barrels', label: 'observed', scope: 'some' }),
      expect.objectContaining({ dimension: 'shape', label: 'closeouts', scope: 'most' }),
    ]));
    expect(rows.some(o => o.dimension === 'barrel_makeability')).toBe(false);
    expect(rows.some(o => o.range)).toBe(false);
  });
  it('keeps qualitative opportunity frequency separate from size, shape, and regularity', () => {
    const rows = observe('Waist-high runners all morning, nonstop.');
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimension: 'size', span: 'Waist-high' }),
      expect.objectContaining({ dimension: 'shape', label: 'running' }),
      expect.objectContaining({ dimension: 'frequency', label: 'frequent' }),
    ]));
    expect(rows.some(o => o.dimension === 'arrival_consistency' || o.range)).toBe(false);
  });
  it('preserves worthwhile-set wait ranges and background waves', () => {
    const rows = observe('Waited 15–20 minutes between decent sets. Smaller ones in between.');
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ range: { min: 15, max: 20, unit: 'minutes', target: 'worthwhile_sets' } }),
      expect.objectContaining({ label: 'background_present' }),
    ]));
    expect(rows.some(o => o.label === 'flat')).toBe(false);
  });
  it('never converts personal catches into physical frequency or lulls', () => {
    const rows = observe('Only caught two waves in an hour; the lineup was packed.');
    expect(rows.filter(o => ['frequency', 'sets_lulls', 'arrival_consistency'].includes(o.dimension))).toEqual([]);
  });
  it('keeps power and ambiguous consistency from implying barrels', () => {
    const rows = observe('Steep, powerful, and consistent.');
    expect(rows.filter(o => o.dimension === 'power')).toHaveLength(2);
    expect(rows).toContainEqual(expect.objectContaining({ dimension: 'consistency_unspecified', status: 'ambiguous' }));
    expect(rows.some(o => o.dimension === 'barrels')).toBe(false);
  });
  it('preserves qualitative time changes without extending early conditions to the session', () => {
    const rows = observe('Clean early, then fat and slow after 8.');
    expect(rows).toContainEqual(expect.objectContaining({ dimension: 'surface', time: 'early' }));
    expect(rows).toContainEqual(expect.objectContaining({ dimension: 'power', time: 'after 8' }));
    expect(rows).toContainEqual(expect.objectContaining({ dimension: 'evolution', label: 'changing' }));
    expect(observedSurface(rows)).toBe('mixed');
  });
  it('retains explicit negation and both sides of conflicting reports', () => {
    const rows = observe('Not closing out. Some closeouts later. Not glassy.');
    expect(rows).toContainEqual(expect.objectContaining({ label: 'closeouts', status: 'negative', span: 'Not closing out' }));
    expect(rows).toContainEqual(expect.objectContaining({ label: 'closeouts', status: 'positive' }));
    expect(observedSurface(rows)).toBe('unknown');
    expect(observedSurface(observe('Clean and choppy.'))).toBe('mixed');
  });
  it('treats missing tags, walled, peaky, and hollow reports conservatively', () => {
    expect(observe('')).toEqual([]);
    const rows = observe('Hollow but walled.', ['peaky']);
    expect(rows).toContainEqual(expect.objectContaining({ label: 'walled', status: 'ambiguous' }));
    expect(rows.some(o => o.label === 'closeouts' || o.dimension === 'barrel_makeability')).toBe(false);
  });
  it('excludes forecast-prefilled tags and quoted forecast claims from observed truth', () => {
    expect(observedSurface(extractObservations({ notes: null, description: null, wave_characteristics: ['clean'] }, 'forecast_prefilled'))).toBe('unknown');
    const rows = observe('The forecast had said clean waves. Choppy in the water.');
    expect(rows).toContainEqual(expect.objectContaining({ label: 'clean', origin: 'forecast_quote' }));
    expect(observedSurface(rows)).toBe('rough');
    expect(observedSurface(extractObservations({ notes: null, description: null, wave_characteristics: ['glassy'] }))).toBe('unknown');
  });
  it('allows choppy surface with explicitly peeling waves', () => {
    const rows = observe('Choppy, but some real peelers.');
    expect(observedSurface(rows)).toBe('rough');
    expect(rows).toContainEqual(expect.objectContaining({ dimension: 'shape', label: 'peeling', scope: 'some' }));
  });
  it('preserves lower bounds without inventing a midpoint or exact schedule', () => {
    expect(observe('Long lulls. Set waves came 20 mins +')).toContainEqual(expect.objectContaining({ range: { min: 20, max: null, unit: 'minutes', target: 'sets' } }));
  });
});

describe('historical evidence and comparison discipline', () => {
  it('accepts pre-session input revisions copied later without claiming a displayed prediction', () => {
    expect(matchForecast(session, [saved])).toMatchObject({ category: 'B', reason: 'pre_session_input_revision_current_config_only', coversWholeSession: false });
  });
  it.each(['created_at', 'updated_at'])('rejects post-session %s even for the correct valid time', field => {
    expect(matchForecast(session, [{ ...saved, forecast_snapshot: { ...saved.forecast_snapshot, [field]: '2026-07-02T10:00:00Z' } }]).category).toBe('C');
  });
  it('rejects post-session provider fetches and missing revision timestamps', () => {
    expect(matchForecast(session, [{ ...saved, forecast_snapshot: { ...saved.forecast_snapshot, raw_forecast: { fetch_timestamps: { noaa: '2026-07-02T00:00:00Z' } } } }]).category).toBe('C');
    expect(matchForecast(session, [{ ...saved, forecast_snapshot: { ...saved.forecast_snapshot, updated_at: null } }]).category).toBe('C');
  });
  it('does not match wrong beaches, custom peaks, owners, or remote times', () => {
    expect(matchForecast(session, [{ ...saved, beach_id: 'other' }]).snapshot).toBeNull();
    expect(matchForecast({ ...session, custom_spot_id: 'peak' }, [saved]).snapshot).toBeNull();
    expect(matchForecast(session, [{ ...saved, user_id: 'other' }]).snapshot).toBeNull();
    expect(matchForecast(session, [{ ...saved, forecast_snapshot: { ...saved.forecast_snapshot, forecast_at: '2026-07-01T18:00:00Z' } }]).snapshot).toBeNull();
  });
  it('protects duplicate joins and refuses conflicting or ambiguous revisions', () => {
    expect(uniqueRows([saved, saved])).toHaveLength(1);
    expect(matchForecast(session, [saved, saved]).category).toBe('B');
    expect(() => uniqueRows([saved, { ...saved, user_id: 'other' }])).toThrow('Conflicting duplicate');
    expect(matchForecast(session, [saved, { ...saved, id: 'second' }]).reason).toBe('ambiguous_snapshots');
    expect(matchForecast(session, []).category).toBe('D');
  });
  it('distinguishes unavailable capability from a negative prediction', () => {
    expect(compareWarning(null, true)).toBe('capability_gap');
    expect(compareWarning(false, true)).toBe('missed_warning');
    expect(compareWarning(true, null)).toBe('unknown_observation');
    expect(compareWarning(true, false)).toBe('false_warning');
    expect(compareWarning(true, true)).toBe('agreement_warning');
    expect(compareWarning(false, false)).toBe('agreement_no_warning');
  });
});
