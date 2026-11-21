import 'server-only';

import { performance } from 'node:perf_hooks';
import { recordStage } from '@/lib/observability/request-timing';

/**
 * Week Scout ranking is CPU-bound (3-5 s of CPU on prod). When Home's 7 days and
 * Explore's 10 days land on one instance together, both share one event loop and
 * each takes about twice as long (Nov 20-21 watch: 19-29 s, past the app's 25 s
 * timeout, and the app then asks again). Two instance-local fixes:
 *
 * - One ranking at a time per user: that user's later request waits, up to
 *   MAX_QUEUE_WAIT_MS, so Home's answer returns at its own speed instead of both at the
 *   shared one. Other users never wait for it.
 * - Reuse: a request with the same key as one in flight joins it, and one that comes
 *   within REUSE_MS after it ends gets the same answer. That covers the app's retry
 *   after a slow answer (19 s after it in the watch). The window stays short because
 *   a forecast sync inside it is not seen until it ends.
 *
 * Both are per instance. They never serve one user's answer to another (the key
 * hashes the user id) and they end with the instance.
 */

export const REUSE_MS = 30 * 1000;
export const MAX_QUEUE_WAIT_MS = 10_000;
const MAX_ENTRIES = 100;

export type AnswerReuse = 'miss' | 'joined' | 'hit' | 'off';

interface Entry {
  promise: Promise<unknown>;
  settledAt: number | null;
}

const entries = new Map<string, Entry>();
const queueTails = new Map<string, Promise<void>>();

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

async function runQueued<T>(queueKey: string, work: () => Promise<T>): Promise<T> {
  if (!isWeekScoutRankingQueueEnabled()) return work();
  const previous = queueTails.get(queueKey) ?? Promise.resolve();
  let release!: () => void;
  const tail = new Promise<void>((resolve) => { release = resolve; });
  queueTails.set(queueKey, tail);
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
    if (queueTails.get(queueKey) === tail) queueTails.delete(queueKey);
  }
}

/** The route sends this answer as JSON, so a JSON copy is exactly what a reuser would get. */
function copyAnswer<T>(answer: T): T {
  return JSON.parse(JSON.stringify(answer)) as T;
}

/**
 * Runs `compute` for `key`, or reuses an answer for the same key on this instance.
 * `queueKey` (the user id) orders one user's rankings. A failed computation is never
 * reused: the next request computes again. Reusers get a copy, so no request can
 * change another's answer.
 */
export async function reuseWeekScoutAnswer<T>(
  key: string,
  queueKey: string,
  compute: () => Promise<T>,
  onReuse: (reuse: AnswerReuse) => void = () => undefined,
): Promise<T> {
  if (!isWeekScoutAnswerReuseEnabled()) {
    onReuse('off');
    return runQueued(queueKey, compute);
  }
  prune(Date.now());
  const existing = entries.get(key);
  if (existing) {
    onReuse(existing.settledAt === null ? 'joined' : 'hit');
    return copyAnswer(await (existing.promise as Promise<T>));
  }
  onReuse('miss');
  const entry: Entry = { promise: runQueued(queueKey, compute), settledAt: null };
  entries.set(key, entry);
  entry.promise.then(
    () => { entry.settledAt = Date.now(); },
    () => { if (entries.get(key) === entry) entries.delete(key); },
  );
  return entry.promise as Promise<T>;
}

/** Test seam: forget every answer and empty the queues. */
export function resetWeekScoutAnswerReuseForTests(): void {
  entries.clear();
  queueTails.clear();
}
