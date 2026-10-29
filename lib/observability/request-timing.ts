import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

export interface StageTiming {
  name: string;
  ms: number;
}

const storage = new AsyncLocalStorage<StageTiming[]>();

function roundMs(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/** Records a stage on the current request; a no-op outside runWithStageTimings. */
export function recordStage(name: string, ms: number): void {
  storage.getStore()?.push({ name, ms: roundMs(ms) });
}

export async function timeStage<T>(name: string, work: () => Promise<T>): Promise<T> {
  if (!storage.getStore()) return work();
  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    recordStage(name, performance.now() - startedAt);
  }
}

export function timeStageSync<T>(name: string, work: () => T): T {
  if (!storage.getStore()) return work();
  const startedAt = performance.now();
  try {
    return work();
  } finally {
    recordStage(name, performance.now() - startedAt);
  }
}

/**
 * Runs `fn` with its own stage list. Stages recorded by detached work that
 * outlives `fn` still land in the same list, so read it after `fn` settles.
 */
export function runWithStageTimings<T>(fn: () => Promise<T>): { stages: StageTiming[]; result: Promise<T> } {
  const stages: StageTiming[] = [];
  return { stages, result: storage.run(stages, fn) };
}

/** Server-Timing header value: `name;dur=ms` entries, names limited to token characters. */
export function formatServerTiming(stages: readonly StageTiming[]): string {
  return stages
    .map(({ name, ms }) => `${name.replace(/[^A-Za-z0-9_.-]/g, '_')};dur=${ms}`)
    .join(', ');
}

export interface InstanceProbeResult {
  /** First request this instance served. */
  cold: boolean;
  /** Requests in flight on this instance when this one started, itself included. */
  inflight: number;
  /** Process CPU (user + system) spent during the request, neighbors included. */
  cpuMs: number;
  /** Longest event-loop stall seen during the request. */
  loopDelayMaxMs: number;
  /** Instance memory when the request ended; the heap is shared with neighbors. */
  rssMb: number;
  heapUsedMb: number;
}

let servedRequests = 0;
let inflightRequests = 0;

/**
 * Instance-level signals that separate "this request waited on IO" from
 * "the instance was busy": fluid compute runs concurrent requests on one
 * event loop, so CPU and loop stalls are shared with neighbors.
 */
export function startInstanceProbe(): () => InstanceProbeResult {
  const cold = servedRequests === 0;
  servedRequests += 1;
  inflightRequests += 1;
  const inflight = inflightRequests;
  const cpuStart = process.cpuUsage();
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();
  let result: InstanceProbeResult | null = null;
  return () => {
    if (result) return result;
    loopDelay.disable();
    inflightRequests -= 1;
    const cpu = process.cpuUsage(cpuStart);
    const maxNs = loopDelay.max;
    const memory = process.memoryUsage();
    result = {
      cold,
      inflight,
      cpuMs: Math.round((cpu.user + cpu.system) / 1000),
      loopDelayMaxMs: Number.isFinite(maxNs) && maxNs > 0 ? Math.round(maxNs / 1e6) : 0,
      rssMb: Math.round(memory.rss / 1048576),
      heapUsedMb: Math.round(memory.heapUsed / 1048576),
    };
    return result;
  };
}
