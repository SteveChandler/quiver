const DEFAULT_STALL_MS = 8_000;
const DEFAULT_COOLDOWN_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;

type ReloadableSource = { reload?: () => void };

export interface TileStallWatchdogMap {
  areTilesLoaded: () => boolean;
  getSource: (id: string) => unknown;
  getStyle: () => { sources?: Record<string, unknown> } | null | undefined;
  isSourceLoaded?: (id: string) => boolean;
  on: (event: "move", listener: () => void) => unknown;
  off: (event: "move", listener: () => void) => unknown;
}

interface TileStallWatchdogOptions {
  stallMs?: number;
  cooldownMs?: number;
  maxAttempts?: number;
}

export function createTileStallWatchdog(
  map: TileStallWatchdogMap,
  options: TileStallWatchdogOptions = {},
): { dispose: () => void } {
  const stallMs = options.stallMs ?? DEFAULT_STALL_MS;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const pollMs = Math.max(1, Math.min(1_000, stallMs));
  let stallStartedAt: number | null = null;
  let lastAttemptAt: number | null = null;
  let attempts = 0;
  let disposed = false;

  const resetForMove = (): void => {
    stallStartedAt = null;
    lastAttemptAt = null;
    attempts = 0;
  };

  const reloadStalledSources = (): void => {
    let sourceIds: string[] = [];
    try {
      sourceIds = Object.keys(map.getStyle()?.sources ?? {});
    } catch {
      return;
    }

    for (const sourceId of sourceIds) {
      try {
        if (map.isSourceLoaded?.(sourceId)) continue;
      } catch {
        // If source status is unavailable, the map-wide stall is enough evidence.
      }

      let source: ReloadableSource | null = null;
      try {
        source = map.getSource(sourceId) as ReloadableSource | null;
      } catch {
        // Fall through to Mapbox's guarded internal recovery hook.
      }

      if (typeof source?.reload === "function") {
        try {
          source.reload();
        } catch {
          // A failed source reload must not take down the map.
        }
        continue;
      }

      try {
        (
          map as TileStallWatchdogMap & {
            style?: { _reloadSource?: (id: string) => void };
          }
        ).style?._reloadSource?.(sourceId);
      } catch {
        // Private Mapbox internals vary by release; recovery is best-effort.
      }
    }
  };

  const check = (): void => {
    if (disposed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      stallStartedAt = null;
      return;
    }

    let tilesLoaded = true;
    try {
      tilesLoaded = map.areTilesLoaded();
    } catch {
      stallStartedAt = null;
      return;
    }
    if (tilesLoaded) {
      stallStartedAt = null;
      return;
    }

    const now = Date.now();
    stallStartedAt ??= now;
    if (now - stallStartedAt < stallMs || attempts >= maxAttempts) return;
    if (lastAttemptAt !== null && now - lastAttemptAt < cooldownMs) return;

    attempts += 1;
    lastAttemptAt = now;
    reloadStalledSources();
  };

  const handleMove = (): void => {
    resetForMove();
    check();
  };

  try {
    map.on("move", handleMove);
  } catch {
    // Polling still provides recovery if the map listener cannot be attached.
  }
  document.addEventListener("visibilitychange", check);
  const timer = window.setInterval(check, pollMs);
  check();

  return {
    dispose: (): void => {
      if (disposed) return;
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      try {
        map.off("move", handleMove);
      } catch {
        // Disposal remains safe if Mapbox has already torn down the map.
      }
    },
  };
}
