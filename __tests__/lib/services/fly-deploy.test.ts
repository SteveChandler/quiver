/**
 * @jest-environment node
 *
 * Tests for lib/services/fly-deploy.ts
 *
 * Covers updateFlyMachineEnvVars and waitForModelVersion, including
 * terminal-state filtering, env merging/deletion, per-machine error
 * isolation, the stopped-machine /wait skip, and polling timeout logic.
 */

import {
  updateFlyMachineEnvVars,
  waitForModelVersion,
} from '@/lib/services/fly-deploy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fetch Response mock. */
function makeResponse(opts: {
  ok: boolean;
  status?: number;
  body?: unknown;
  text?: string;
}): Response {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    json: jest.fn().mockResolvedValue(opts.body ?? {}),
    text: jest.fn().mockResolvedValue(opts.text ?? ''),
  } as unknown as Response;
}

/** Build a machine object matching the interface used by fly-deploy. */
function makeMachine(
  id: string,
  state: string,
  env: Record<string, string> = {}
) {
  return {
    id,
    state,
    config: { env },
  };
}

// ---------------------------------------------------------------------------
// Setup — each test gets a clean spy and clean env
// ---------------------------------------------------------------------------

let fetchSpy: jest.SpyInstance;
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  // Snapshot env so afterEach can fully restore it
  savedEnv = { ...process.env };

  // Default env for most tests
  process.env.FLY_API_TOKEN = 'test-token';
  delete process.env.FLY_APP_NAME;
  delete process.env.ML_SERVICE_URL;

  fetchSpy = jest.spyOn(global, 'fetch');

  // Suppress noisy console output
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  // Restore env fully (handles any additions made inside tests)
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, savedEnv);

  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// updateFlyMachineEnvVars
// ---------------------------------------------------------------------------

describe('updateFlyMachineEnvVars', () => {
  // Reset the spy's call history before each test in this block so that
  // assertions like toHaveBeenCalledTimes and calls[N] are test-local.
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  describe('happy path — 2 machines updated', () => {
    it('returns success:true and machinesUpdated:2', async () => {
      const machines = [
        makeMachine('m1', 'started', { EXISTING: 'val' }),
        makeMachine('m2', 'started', {}),
      ];

      fetchSpy
        // List machines
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines }))
        // GET machine m1
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[0] }))
        // POST update m1
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        // Wait for m1 started
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        // GET machine m2
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[1] }))
        // POST update m2
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        // Wait for m2 started
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      const result = await updateFlyMachineEnvVars({ MODEL_VERSION: 'v2' });

      expect(result).toEqual({ success: true, machinesUpdated: 2 });
    });

    it('calls the Machines API with the correct Authorization header', async () => {
      const machines = [makeMachine('m1', 'started', {})];

      fetchSpy
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines }))
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[0] }))
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      await updateFlyMachineEnvVars({ KEY: 'val' });

      const listInit = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(
        (listInit.headers as Record<string, string>)['Authorization']
      ).toBe('Bearer test-token');
    });

    it('uses the default app name "quiver-ml" in the list URL', async () => {
      const machines = [makeMachine('m1', 'started', {})];

      fetchSpy
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines }))
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[0] }))
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      await updateFlyMachineEnvVars({ KEY: 'val' });

      const listUrl = fetchSpy.mock.calls[0][0] as string;
      expect(listUrl).toContain('/apps/quiver-ml/machines');
    });
  });

  describe('missing FLY_API_TOKEN', () => {
    it('returns an error result without calling fetch', async () => {
      delete process.env.FLY_API_TOKEN;

      // Clear any prior spy call history so the toHaveBeenCalled assertion
      // reflects only what this test triggered.
      fetchSpy.mockClear();

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result).toEqual({
        success: false,
        error: 'FLY_API_TOKEN not configured',
        machinesUpdated: 0,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('list machines fails with 500', () => {
    it('returns success:false with the status code in the error message', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ ok: false, status: 500 })
      );

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result).toEqual({
        success: false,
        error: 'Failed to list machines: 500',
        machinesUpdated: 0,
      });
    });
  });

  describe('list returns non-array', () => {
    it('returns success:false with "not an array" in the error', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ ok: true, body: { unexpected: 'object' } })
      );

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result.success).toBe(false);
      expect(result.machinesUpdated).toBe(0);
      expect(result.error).toMatch(/not an array/i);
    });
  });

  describe('individual machine GET fails', () => {
    it('collects the error and still updates the other machine', async () => {
      const machines = [
        makeMachine('m1', 'started', {}),
        makeMachine('m2', 'started', {}),
      ];

      fetchSpy
        // List
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines }))
        // GET m1 — fails
        .mockResolvedValueOnce(makeResponse({ ok: false, status: 503 }))
        // GET m2 — succeeds
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[1] }))
        // POST update m2
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        // Wait for m2
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result.success).toBe(true);
      expect(result.machinesUpdated).toBe(1);
    });
  });

  describe('individual machine POST fails', () => {
    it('collects the error and still updates the other machine', async () => {
      const machines = [
        makeMachine('m1', 'started', {}),
        makeMachine('m2', 'started', {}),
      ];

      fetchSpy
        // List
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines }))
        // GET m1
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[0] }))
        // POST m1 — fails
        .mockResolvedValueOnce(
          makeResponse({ ok: false, status: 422, text: 'invalid config' })
        )
        // GET m2
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[1] }))
        // POST m2 — succeeds
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        // Wait for m2
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result.success).toBe(true);
      expect(result.machinesUpdated).toBe(1);
    });
  });

  describe('all machines fail', () => {
    it('returns success:false and machinesUpdated:0', async () => {
      const machines = [makeMachine('m1', 'started', {})];

      fetchSpy
        // List
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines }))
        // GET m1 — fails so the machine is never updated
        .mockResolvedValueOnce(makeResponse({ ok: false, status: 503 }));

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result).toEqual(
        expect.objectContaining({ success: false, machinesUpdated: 0 })
      );
    });
  });

  describe('terminal state filtering', () => {
    it('skips machines in "destroying" or "destroyed" states', async () => {
      const machines = [
        makeMachine('m-destroying', 'destroying', {}),
        makeMachine('m-destroyed', 'destroyed', {}),
        makeMachine('m-started', 'started', {}),
      ];

      fetchSpy
        // List — returns all 3
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines }))
        // GET m-started (only active machine after filtering)
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machines[2] }))
        // POST update m-started
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        // Wait for m-started
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result.success).toBe(true);
      expect(result.machinesUpdated).toBe(1);

      // list + get + post + wait = 4 calls total (no calls for terminal machines)
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // No non-list call should reference the terminal machine IDs
      const nonListUrls = fetchSpy.mock.calls
        .slice(1)
        .map((args) => args[0] as string);
      for (const url of nonListUrls) {
        expect(url).not.toContain('m-destroying');
        expect(url).not.toContain('m-destroyed');
      }
    });
  });

  describe('envRemovals', () => {
    it('deletes the specified keys from the merged env before posting', async () => {
      const machine = makeMachine('m1', 'started', {
        KEEP_ME: 'yes',
        DELETE_ME: 'gone',
        ALSO_DELETE: 'gone-too',
      });

      fetchSpy
        // List
        .mockResolvedValueOnce(makeResponse({ ok: true, body: [machine] }))
        // GET m1
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machine }))
        // POST update m1
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        // Wait
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      await updateFlyMachineEnvVars(
        { NEW_KEY: 'new-val' },
        ['DELETE_ME', 'ALSO_DELETE']
      );

      // Find the POST call by method so the index doesn't matter
      const postCall = fetchSpy.mock.calls.find(
        (args) => (args[1] as RequestInit)?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      const postInit = postCall![1] as RequestInit;
      const body = JSON.parse(postInit.body as string) as {
        config: { env: Record<string, string> };
      };

      expect(body.config.env).toEqual({ KEEP_ME: 'yes', NEW_KEY: 'new-val' });
      expect(body.config.env).not.toHaveProperty('DELETE_ME');
      expect(body.config.env).not.toHaveProperty('ALSO_DELETE');
    });
  });

  describe('stopped machine skips /wait endpoint', () => {
    it('does not call the /wait URL after updating a stopped machine', async () => {
      const machine = makeMachine('m1', 'stopped', {});

      fetchSpy
        // List
        .mockResolvedValueOnce(makeResponse({ ok: true, body: [machine] }))
        // GET m1
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machine }))
        // POST update m1
        .mockResolvedValueOnce(makeResponse({ ok: true }));
      // Deliberately no /wait mock — it must not be called

      const result = await updateFlyMachineEnvVars({ KEY: 'val' });

      expect(result.success).toBe(true);
      expect(result.machinesUpdated).toBe(1);

      const calledUrls = fetchSpy.mock.calls.map((args) => args[0] as string);
      const waitCalls = calledUrls.filter((url) => url.includes('/wait'));
      expect(waitCalls).toHaveLength(0);
    });
  });

  describe('custom FLY_APP_NAME', () => {
    it('uses the FLY_APP_NAME env var instead of the default', async () => {
      process.env.FLY_APP_NAME = 'my-custom-app';

      const machine = makeMachine('m1', 'started', {});

      fetchSpy
        .mockResolvedValueOnce(makeResponse({ ok: true, body: [machine] }))
        .mockResolvedValueOnce(makeResponse({ ok: true, body: machine }))
        .mockResolvedValueOnce(makeResponse({ ok: true }))
        .mockResolvedValueOnce(makeResponse({ ok: true }));

      await updateFlyMachineEnvVars({ KEY: 'val' });

      const listUrl = fetchSpy.mock.calls[0][0] as string;
      expect(listUrl).toContain('/apps/my-custom-app/machines');
      expect(listUrl).not.toContain('quiver-ml');
    });
  });
});

// ---------------------------------------------------------------------------
// waitForModelVersion
// ---------------------------------------------------------------------------

describe('waitForModelVersion', () => {
  // Each timer test gets a fresh fake-timer environment and its own fetch spy
  // that is reset so prior-test call counts don't bleed through.
  beforeEach(() => {
    jest.useFakeTimers();
    fetchSpy.mockReset();
  });

  describe('primary version matches on first poll', () => {
    it('resolves with success:true immediately', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          body: { model_version: 'v2', candidate_version: null },
        })
      );

      const promise = waitForModelVersion('v2', { timeoutMs: 15000 });
      // Allow the initial fetch microtask to settle
      await jest.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('primary version matches on retry', () => {
    it('first poll returns old version, second poll returns new version', async () => {
      fetchSpy
        // First poll — stale version
        .mockResolvedValueOnce(
          makeResponse({
            ok: true,
            body: { model_version: 'v1', candidate_version: null },
          })
        )
        // Second poll — correct version
        .mockResolvedValueOnce(
          makeResponse({
            ok: true,
            body: { model_version: 'v2', candidate_version: null },
          })
        );

      const promise = waitForModelVersion('v2', { timeoutMs: 30000 });

      // First poll runs immediately; advance past the 5 s sleep before second poll
      await jest.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout', () => {
    it('returns success:false when version never matches within the timeout', async () => {
      // Always returns wrong version
      fetchSpy.mockResolvedValue(
        makeResponse({
          ok: true,
          body: { model_version: 'v1', candidate_version: null },
        })
      );

      // Control Date.now to fast-forward the timeout check
      const startMs = 1_000_000;
      let currentMs = startMs;
      jest.spyOn(Date, 'now').mockImplementation(() => currentMs);

      const promise = waitForModelVersion('v2', { timeoutMs: 10000 });

      // Each iteration: fetch (instant), then 5 s sleep.
      // After 2 iterations we advance Date.now past 10 000 ms to break the loop.
      await jest.advanceTimersByTimeAsync(5000);
      currentMs = startMs + 10001; // now past timeout threshold
      await jest.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/10s/);
    });
  });

  describe('candidateOnly mode', () => {
    it('checks candidate_version and ignores model_version', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          // model_version is still old — should be ignored
          body: { model_version: 'v1', candidate_version: 'v2-candidate' },
        })
      );

      const promise = waitForModelVersion('v2-candidate', {
        timeoutMs: 15000,
        candidateOnly: true,
      });
      await jest.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does not succeed when only model_version matches; waits for candidate too', async () => {
      fetchSpy
        // First poll: primary matches but candidate does not
        .mockResolvedValueOnce(
          makeResponse({
            ok: true,
            body: { model_version: 'v2', candidate_version: 'v1' },
          })
        )
        // Second poll: candidate matches
        .mockResolvedValueOnce(
          makeResponse({
            ok: true,
            body: { model_version: 'v2', candidate_version: 'v2' },
          })
        );

      const promise = waitForModelVersion('v2', {
        timeoutMs: 30000,
        candidateOnly: true,
      });

      // Advance past the 5 s sleep between polls
      await jest.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('expectedCandidateVersion', () => {
    it('requires both model_version and candidate_version to match', async () => {
      fetchSpy
        // First poll: primary matches, candidate does not yet
        .mockResolvedValueOnce(
          makeResponse({
            ok: true,
            body: { model_version: 'v2', candidate_version: 'v1-candidate' },
          })
        )
        // Second poll: both match
        .mockResolvedValueOnce(
          makeResponse({
            ok: true,
            body: {
              model_version: 'v2',
              candidate_version: 'v2-candidate',
            },
          })
        );

      const promise = waitForModelVersion('v2', {
        timeoutMs: 30000,
        expectedCandidateVersion: 'v2-candidate',
      });

      await jest.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('succeeds on first poll when both versions match immediately', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          body: { model_version: 'v2', candidate_version: 'v2-candidate' },
        })
      );

      const promise = waitForModelVersion('v2', {
        timeoutMs: 15000,
        expectedCandidateVersion: 'v2-candidate',
      });
      await jest.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetch error during polling', () => {
    it('retries after a fetch error and succeeds on a later poll', async () => {
      fetchSpy
        // First poll — network error
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        // Second poll — correct version
        .mockResolvedValueOnce(
          makeResponse({
            ok: true,
            body: { model_version: 'v2', candidate_version: null },
          })
        );

      const promise = waitForModelVersion('v2', { timeoutMs: 30000 });

      // The first poll throws; advance past the 5 s sleep so the retry runs
      await jest.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('keeps retrying when every poll fails and eventually times out', async () => {
      fetchSpy.mockRejectedValue(new Error('Service unavailable'));

      const startMs = 2_000_000;
      let currentMs = startMs;
      jest.spyOn(Date, 'now').mockImplementation(() => currentMs);

      const promise = waitForModelVersion('v2', { timeoutMs: 10000 });

      await jest.advanceTimersByTimeAsync(5000);
      currentMs = startMs + 10001;
      await jest.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result.success).toBe(false);
    });
  });

  describe('custom ML_SERVICE_URL', () => {
    it('polls the custom URL instead of the default fly.dev URL', async () => {
      process.env.ML_SERVICE_URL = 'http://localhost:8080';

      fetchSpy.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          body: { model_version: 'v3', candidate_version: null },
        })
      );

      const promise = waitForModelVersion('v3', { timeoutMs: 15000 });
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toBe('http://localhost:8080/health');
      expect(calledUrl).not.toContain('fly.dev');
    });

    it('falls back to the default quiver-ml.fly.dev URL when ML_SERVICE_URL is unset', async () => {
      delete process.env.ML_SERVICE_URL;

      fetchSpy.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          body: { model_version: 'v3', candidate_version: null },
        })
      );

      const promise = waitForModelVersion('v3', { timeoutMs: 15000 });
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toBe('https://quiver-ml.fly.dev/health');
    });
  });
});
