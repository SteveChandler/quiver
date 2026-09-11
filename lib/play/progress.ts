export const PLAY_PROGRESS_KEY = "quiver.play.outside.v1";

export interface PlayProgress {
  unlockedBreakIndex: number;
  bestHeatTotals: Record<string, number>;
  bestArcadeScores: Record<string, number>;
  muted: boolean;
  controlsSeen: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressStore {
  load(): PlayProgress;
  save(progress: PlayProgress): void;
}

export const DEFAULT_PLAY_PROGRESS: PlayProgress = {
  unlockedBreakIndex: 0,
  bestHeatTotals: {},
  bestArcadeScores: {},
  muted: false,
  controlsSeen: false,
};

function parseProgress(value: string | null): PlayProgress {
  if (!value) return { ...DEFAULT_PLAY_PROGRESS };
  try {
    const parsed = JSON.parse(value) as Partial<PlayProgress>;
    return {
      unlockedBreakIndex: Number.isInteger(parsed.unlockedBreakIndex)
        ? Math.max(0, Math.min(5, parsed.unlockedBreakIndex as number))
        : 0,
      bestHeatTotals: parsed.bestHeatTotals && typeof parsed.bestHeatTotals === "object"
        ? parsed.bestHeatTotals
        : {},
      bestArcadeScores: parsed.bestArcadeScores && typeof parsed.bestArcadeScores === "object"
        ? parsed.bestArcadeScores
        : {},
      muted: parsed.muted === true,
      controlsSeen: parsed.controlsSeen === true,
    };
  } catch {
    return { ...DEFAULT_PLAY_PROGRESS };
  }
}

export function createProgressStore(storage: StorageLike): ProgressStore {
  return {
    load: (): PlayProgress => parseProgress(storage.getItem(PLAY_PROGRESS_KEY)),
    save: (progress: PlayProgress): void => {
      storage.setItem(PLAY_PROGRESS_KEY, JSON.stringify(progress));
    },
  };
}
