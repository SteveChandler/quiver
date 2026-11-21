import 'server-only';

import { performance } from 'node:perf_hooks';
import { recordStage } from '@/lib/observability/request-timing';

/**
 * Week Scout ranking is CPU-bound (3-5 s of CPU on prod). When Home's 7 days and
 * Explore's 10 days land on one instance together, both share one event loop and
 * each takes about twice as long (Nov 20-21 watch: 19-29 s, past the app's 25 s
 * timeout, and the app then asks again). Two instance-local fixes:
 *
 * - One ranking at a time: later requests wait in order, up to MAX_QUEUE_WAIT_MS,
 *   so the first answer returns at its own speed instead of both at the shared one.
 * - Reuse: a request with the same key as one in flight joins it, and one that comes
 *   within REUSE_MS after it gets the same answer. That covers the app's retry after
 *   a slow answer.
 *
 * Both are per instance. They never serve one user's answer to another (the key
 * hashes the user id) and they end with the instance.
 */

export const REUSE_MS = 60 * 1000;
export const MAX_QUEUE_WAIT_MS = 10_000;
const MAX_ENTRIES = 100;

export type AnswerReuse = 'miss' | 'joined' | 'hit' | 'off';

interface Entry {
  promise: Promise<unknown>;
  settledAt: number | null;
}

const entries = new Map<string, Entry>();
let queueTail: Promise<void> = Promise.resolve();

export function isWeekScoutAnswerReuseEnabled(): boolean {
  return process.env.WEEK_SCOUT_ANSWER_REUSE !== 'false';
}

export function isWeekScoutRankingQueueEnabled(): boolean {
  return process.env.WEEK_SCOUT_RANKING_QUEUE !== 'false';
}

function prune(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.settledAt !== null && now - entry.settledAt > REUSE_MS) entries.delete(key);
  }
  // Map keeps insertion order, so the oldest entries go first.
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

async function runQueued<T>(work: () => Promise<T>): Promise<T> {
  if (!isWeekScoutRankingQueueEnabled()) return work();
  const previous = queueTail;
  let release!: () => void;
  queueTail = new Promise<void>((resolve) => { release = resolve; });
  const waitStartedAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    previous,
    new Promise<void>((resolve) => { timer = setTimeout(resolve, MAX_QUEUE_WAIT_MS); }),
  ]);
  clearTimeout(timer);
  recordStage('ws-queue', performance.now() - waitStartedAt);
  try {
    return await work();
  } finally {
    release();
  }
}

/**
 * Runs `compute` for `key`, or reuses an answer for the same key on this instance.
 * A failed computation is never reused: the next request computes again.
 * Callers that reuse get a deep copy, so no request can change another's answer.
 */
export async function reuseWeekScoutAnswer<T>(
  key: string,
  compute: () => Promise<T>,
  onReuse: (reuse: AnswerReuse) => void = () => undefined,
): Promise<T> {
  if (!isWeekScoutAnswerReuseEnabled()) {
    onReuse('off');
    return runQueued(compute);
  }
  const now = Date.now();
  prune(now);
  const existing = entries.get(key);
  if (existing) {
    onReuse(existing.settledAt === null ? 'joined' : 'hit');
    return structuredClone(await (existing.promise as Promise<T>));
  }
  onReuse('miss');
  const entry: Entry = { promise: runQueued(compute), settledAt: null };
  entries.set(key, entry);
  entry.promise.then(
    () => { entry.settledAt = Date.now(); },
    () => { if (entries.get(key) === entry) entries.delete(key); },
  );
  return entry.promise as Promise<T>;
}

/** Test seam: forget every answer and empty the queue. */
export function resetWeekScoutAnswerReuseForTests(): void {
  entries.clear();
  queueTail = Promise.resolve();
}
