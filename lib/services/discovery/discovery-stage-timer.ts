export const DISCOVERY_STAGES = [
  'favorites', 'candidates', 'included-beaches', 'custom-spots', 'anchor-terrain',
  'forecasts', 'stale-forecasts', 'tide-series', 'preferences', 'sun-times',
  'water-quality', 'personalization', 'board-context', 'break-behavior',
  'current-water-quality', 'rainfall', 'scoring', 'similarity', 'ranking',
  'photos', 'late-scoring',
] as const;

type DiscoveryStage = typeof DISCOVERY_STAGES[number];
interface StageTiming {
  stage: DiscoveryStage;
  durationMs: number;
}

export interface DiscoveryStageSnapshot {
  completed: StageTiming[];
  pending: StageTiming[];
}

export class DiscoveryStageTimer {
  private readonly pending = new Map<DiscoveryStage, number>();
  private readonly completed = new Map<DiscoveryStage, number>();

  constructor(private readonly requestStartedAt: number = Date.now()) {}

  start(stage: DiscoveryStage): void {
    this.pending.set(stage, Date.now() - this.requestStartedAt);
  }

  end(stage: DiscoveryStage): void {
    const startedAt = this.pending.get(stage);
    if (startedAt === undefined) return;
    this.completed.set(stage, (this.completed.get(stage) ?? 0)
      + Math.max(0, Date.now() - this.requestStartedAt - startedAt));
    this.pending.delete(stage);
  }

  async time<T>(stage: DiscoveryStage, work: () => PromiseLike<T>): Promise<T> {
    this.start(stage);
    try {
      return await work();
    } finally {
      this.end(stage);
    }
  }

  snapshot(): DiscoveryStageSnapshot {
    const elapsed = Date.now() - this.requestStartedAt;
    return {
      completed: Array.from(this.completed, ([stage, durationMs]) => ({ stage, durationMs })),
      pending: Array.from(this.pending, ([stage, startedAt]) => ({
        stage,
        durationMs: Math.max(0, elapsed - startedAt),
      })),
    };
  }
}
