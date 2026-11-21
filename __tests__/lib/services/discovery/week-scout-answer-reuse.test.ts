/** @jest-environment node */
jest.mock('server-only', () => ({}));

import {
  MAX_QUEUE_WAIT_MS,
  REUSE_MS,
  resetWeekScoutAnswerReuseForTests,
  reuseWeekScoutAnswer,
  type AnswerReuse,
} from '@/lib/services/discovery/week-scout-answer-reuse';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe('reuseWeekScoutAnswer', () => {
  beforeEach(() => {
    resetWeekScoutAnswerReuseForTests();
    delete process.env.WEEK_SCOUT_ANSWER_REUSE;
    delete process.env.WEEK_SCOUT_RANKING_QUEUE;
  });
  afterEach(() => {
    jest.useRealTimers();
    delete process.env.WEEK_SCOUT_ANSWER_REUSE;
    delete process.env.WEEK_SCOUT_RANKING_QUEUE;
  });

  it('computes once for two requests with the same key and gives the second its own copy', async () => {
    const compute = jest.fn(async () => ({ days: [{ pick: 'a' }] }));
    const seen: AnswerReuse[] = [];
    const [first, second] = await Promise.all([
      reuseWeekScoutAnswer('user-1|k', compute, (reuse) => seen.push(reuse)),
      reuseWeekScoutAnswer('user-1|k', compute, (reuse) => seen.push(reuse)),
    ]);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['miss', 'joined']);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    second.days[0].pick = 'changed';
    expect(first.days[0].pick).toBe('a');
  });

  it('reuses a settled answer inside the window and computes again after it', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    jest.setSystemTime(new Date('2026-11-21T15:00:00Z'));
    let calls = 0;
    const compute = jest.fn(async (): Promise<{ n: number }> => ({ n: ++calls }));
    const seen: AnswerReuse[] = [];
    await reuseWeekScoutAnswer('user-1|k', compute, (reuse) => seen.push(reuse));
    jest.setSystemTime(new Date(Date.now() + REUSE_MS - 1000));
    await reuseWeekScoutAnswer('user-1|k', compute, (reuse) => seen.push(reuse));
    jest.setSystemTime(new Date(Date.now() + 2000));
    await reuseWeekScoutAnswer('user-1|k', compute, (reuse) => seen.push(reuse));
    expect(seen).toEqual(['miss', 'hit', 'miss']);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('never shares an answer across different keys', async () => {
    const compute = jest.fn(async () => ({}));
    await reuseWeekScoutAnswer('user-1|k', compute);
    await reuseWeekScoutAnswer('user-2|k', compute);
    await reuseWeekScoutAnswer('user-1|other', compute);
    expect(compute).toHaveBeenCalledTimes(3);
  });

  it('passes an error through unchanged and computes again on the next request', async () => {
    const boom = new TypeError('unrelated failure');
    const compute = jest.fn()
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce({ ok: true });
    await expect(reuseWeekScoutAnswer('user-1|k', compute)).rejects.toBe(boom);
    await expect(reuseWeekScoutAnswer('user-1|k', compute)).resolves.toEqual({ ok: true });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('runs one ranking at a time, in order of arrival', async () => {
    const first = deferred<string>();
    const order: string[] = [];
    const a = reuseWeekScoutAnswer('user-1|seven', async () => { order.push('start-7'); const v = await first.promise; order.push('end-7'); return v; });
    const b = reuseWeekScoutAnswer('user-1|ten', async () => { order.push('start-10'); return 'ten'; });
    await flush();
    expect(order).toEqual(['start-7']);
    first.resolve('seven');
    await expect(a).resolves.toBe('seven');
    await expect(b).resolves.toBe('ten');
    expect(order).toEqual(['start-7', 'end-7', 'start-10']);
  });

  it('stops waiting for a stuck ranking after the queue limit', async () => {
    jest.useFakeTimers();
    const stuck = deferred<string>();
    void reuseWeekScoutAnswer('user-1|seven', () => stuck.promise);
    const compute = jest.fn(async () => 'ten');
    const b = reuseWeekScoutAnswer('user-1|ten', compute);
    await jest.advanceTimersByTimeAsync(MAX_QUEUE_WAIT_MS - 1);
    expect(compute).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await expect(b).resolves.toBe('ten');
    stuck.resolve('seven');
  });

  it('turns each part off on its own', async () => {
    process.env.WEEK_SCOUT_ANSWER_REUSE = 'false';
    process.env.WEEK_SCOUT_RANKING_QUEUE = 'false';
    const gate = deferred<string>();
    const compute = jest.fn(() => gate.promise);
    const seen: AnswerReuse[] = [];
    const a = reuseWeekScoutAnswer('user-1|k', compute, (reuse) => seen.push(reuse));
    const b = reuseWeekScoutAnswer('user-1|k', compute, (reuse) => seen.push(reuse));
    await flush();
    expect(compute).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(['off', 'off']);
    gate.resolve('done');
    await Promise.all([a, b]);
  });
});
