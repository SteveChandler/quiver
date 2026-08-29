import {
  processCustomSpotAnalysisBatch,
  type ClaimedCustomSpotAnalysisJob,
  type CustomSpotAnalysisStore,
  type CustomSpotForAnalysis,
  type CustomSpotModeledUpdate,
} from '@/lib/services/custom-spot-analysis/processor';

const modeledSwell = Array(72).fill(0.2);
for (let index = 40; index <= 58; index += 1) modeledSwell[index] = 0.8;

const terrain = {
  analyzeTerrain: async () => ({
    swellAccessFactors: modeledSwell,
    windExposureFactors: Array(72).fill(0.5),
    debug: {},
  }),
  now: () => new Date('2026-08-28T12:00:00.000Z'),
};

function createStore(overrides: {
  jobs?: ClaimedCustomSpotAnalysisJob[];
  spot?: CustomSpotForAnalysis | null;
  writeResult?: boolean;
} = {}): CustomSpotAnalysisStore & { updates: CustomSpotModeledUpdate[]; events: string[] } {
  const updates: CustomSpotModeledUpdate[] = [];
  const events: string[] = [];
  const spot = overrides.spot === undefined ? {
    id: 'spot-1',
    lat: 32.5,
    lon: -117.1,
    breakType: 'reef',
    updatedAt: '2026-08-28T11:00:00.000Z',
    fingerprintProvenanceState: 'unset' as const,
    fingerprintProvenance: { fields: {} },
    fingerprintModelVersion: null,
    fingerprintCoordinateHash: null,
    terrainStatus: 'queued',
    fingerprintConfidence: 'unset',
  } : overrides.spot;
  return {
    updates,
    events,
    claimJobs: async () => overrides.jobs ?? [{
      jobId: 1, customSpotId: 'spot-1', requestedModelVersion: 'custom_spot_terrain_v1',
      attempts: 1, claimedAt: '2026-08-28T12:00:00.000Z',
    }],
    getSpot: async () => spot,
    writeModeledResult: async (_job, _current, update) => {
      updates.push(update);
      return overrides.writeResult ?? true;
    },
    markAnalysisFailed: async () => { events.push('analysis-failed'); return true; },
    markJobComplete: async () => { events.push('complete'); },
    markJobRetry: async () => { events.push('retry'); },
    markJobFailed: async () => { events.push('failed'); },
  };
}

describe('custom spot analysis processor', () => {
  it('writes modeled geometry and completes the job', async () => {
    const store = createStore();
    const summary = await processCustomSpotAnalysisBatch(store, 5, terrain);

    expect(summary).toMatchObject({ claimed: 1, completed: 1, failed: 0 });
    expect(store.events).toEqual([]);
    expect(store.updates[0]).toMatchObject({
      terrainStatus: 'ok',
      fingerprintProvenanceState: 'modeled',
      fingerprintConfidence: 'modeled',
    });
  });

  it('never overwrites reviewed or user-corrected fields', async () => {
    const store = createStore({
      spot: {
        id: 'spot-1', lat: 32.5, lon: -117.1, breakType: 'reef',
        updatedAt: '2026-08-28T11:00:00.000Z',
        fingerprintProvenanceState: 'user_corrected',
        fingerprintProvenance: {
          fields: {
            facing_direction_deg: 'user_corrected',
            swell_window_min_deg: 'independently_reviewed',
          },
        },
        fingerprintModelVersion: null,
        fingerprintCoordinateHash: null,
        terrainStatus: 'queued',
        fingerprintConfidence: 'user_set',
      },
    });

    await processCustomSpotAnalysisBatch(store, 5, terrain);

    expect(store.updates[0].facingDirectionDeg).toBeUndefined();
    expect(store.updates[0].swellWindowMinDeg).toBeUndefined();
    expect(store.updates[0].offshoreDirectionDeg).toBe(65);
    expect(store.updates[0].fingerprintProvenanceState).toBe('user_corrected');
    expect(store.updates[0].fingerprintConfidence).toBe('user_set');
  });

  it('protects legacy user-set geometry that predates field provenance', async () => {
    const store = createStore({
      spot: {
        id: 'spot-1', lat: 32.5, lon: -117.1, breakType: 'reef',
        updatedAt: '2026-08-28T11:00:00.000Z',
        fingerprintProvenanceState: 'unset',
        fingerprintProvenance: { fields: {} },
        fingerprintModelVersion: null,
        fingerprintCoordinateHash: null,
        terrainStatus: 'queued',
        fingerprintConfidence: 'user_set',
      },
    });

    await processCustomSpotAnalysisBatch(store, 5, terrain);

    expect(store.updates[0].facingDirectionDeg).toBeUndefined();
    expect(store.updates[0].swellWindowMinDeg).toBeUndefined();
    expect(store.updates[0].swellAccessFactors).toHaveLength(72);
    expect(store.updates[0].fingerprintProvenanceState).toBe('user_corrected');
  });

  it('retries an optimistic-write conflict without completing', async () => {
    const store = createStore({ writeResult: false });
    const summary = await processCustomSpotAnalysisBatch(store, 5, terrain);

    expect(summary.retried).toBe(1);
    expect(store.events).toEqual(['retry']);
  });

  it('uses cached results idempotently', async () => {
    const base = createStore();
    await processCustomSpotAnalysisBatch(base, 5, terrain);
    const update = base.updates[0];
    const store = createStore({
      spot: {
        id: 'spot-1', lat: 32.5, lon: -117.1, breakType: 'reef',
        updatedAt: '2026-08-28T11:00:00.000Z', fingerprintProvenanceState: 'modeled',
        fingerprintProvenance: update.fingerprintProvenance,
        fingerprintModelVersion: update.fingerprintModelVersion,
        fingerprintCoordinateHash: update.fingerprintCoordinateHash,
        terrainStatus: 'ok', fingerprintConfidence: 'modeled',
      },
    });

    const summary = await processCustomSpotAnalysisBatch(store, 5, terrain);

    expect(summary.cached).toBe(1);
    expect(store.updates).toHaveLength(0);
    expect(store.events).toEqual(['complete']);
  });

  it('fails obsolete model-version jobs instead of retrying forever', async () => {
    const store = createStore({
      jobs: [{
        jobId: 1,
        customSpotId: 'spot-1',
        requestedModelVersion: 'custom_spot_terrain_v0',
        attempts: 1,
        claimedAt: '2026-08-28T12:00:00.000Z',
      }],
    });

    const summary = await processCustomSpotAnalysisBatch(store, 5, terrain);

    expect(summary.failed).toBe(1);
    expect(store.events).toEqual(['failed']);
  });

  it('fails closed to the nearest-beach fallback after bounded retries', async () => {
    const store = createStore({
      jobs: [{
        jobId: 1,
        customSpotId: 'spot-1',
        requestedModelVersion: 'custom_spot_terrain_v1',
        attempts: 3,
        claimedAt: '2026-08-28T12:00:00.000Z',
      }],
    });
    const summary = await processCustomSpotAnalysisBatch(store, 5, {
      analyzeTerrain: async () => { throw new Error('terrain_data_unavailable'); },
      now: terrain.now,
    });

    expect(summary.failed).toBe(1);
    expect(store.updates).toHaveLength(0);
    expect(store.events).toEqual(['analysis-failed']);
  });
});
