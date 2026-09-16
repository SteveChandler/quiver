import {
  createTileStallWatchdog,
  type TileStallWatchdogMap,
} from "@/components/map/tile-stall-watchdog";

type Handler = () => void;

function createMap(tilesLoaded = false): {
  map: TileStallWatchdogMap;
  handlers: Record<string, Handler[]>;
  reload: jest.Mock;
  setTilesLoaded: (loaded: boolean) => void;
} {
  let loaded = tilesLoaded;
  const handlers: Record<string, Handler[]> = {};
  const reload = jest.fn();
  const map: TileStallWatchdogMap = {
    areTilesLoaded: jest.fn(() => loaded),
    getStyle: jest.fn(() => ({
      sources: { loaded: {}, stalled: {} },
    })),
    getSource: jest.fn((id: string) => id === "stalled" ? { reload } : {}),
    isSourceLoaded: jest.fn((id: string) => id === "loaded"),
    on: jest.fn((event: string, handler: Handler) => {
      (handlers[event] ??= []).push(handler);
    }),
    off: jest.fn((event: string, handler: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((item) => item !== handler);
    }),
  };

  return {
    map,
    handlers,
    reload,
    setTilesLoaded: (next: boolean): void => {
      loaded = next;
    },
  };
}

describe("createTileStallWatchdog", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does nothing while tiles load normally", () => {
    const { map, reload } = createMap(true);
    const watchdog = createTileStallWatchdog(map, { stallMs: 1_000 });

    jest.advanceTimersByTime(10_000);

    expect(reload).not.toHaveBeenCalled();
    watchdog.dispose();
  });

  it("reloads only non-loaded sources after the stall threshold", () => {
    const { map, reload } = createMap();
    const watchdog = createTileStallWatchdog(map, { stallMs: 1_000 });

    jest.advanceTimersByTime(999);
    expect(reload).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(map.getSource).toHaveBeenCalledWith("stalled");
    expect(map.getSource).not.toHaveBeenCalledWith("loaded");
    watchdog.dispose();
  });

  it("falls back to the guarded style reload hook", () => {
    const { map } = createMap();
    const reloadSource = jest.fn();
    map.getSource = jest.fn(() => ({}));
    (map as TileStallWatchdogMap & {
      style: { _reloadSource: (id: string) => void };
    }).style = { _reloadSource: reloadSource };
    const watchdog = createTileStallWatchdog(map, { stallMs: 1_000 });

    jest.advanceTimersByTime(1_000);

    expect(reloadSource).toHaveBeenCalledWith("stalled");
    watchdog.dispose();
  });

  it("rate-limits recovery attempts by cooldown", () => {
    const { map, reload } = createMap();
    const watchdog = createTileStallWatchdog(map, {
      stallMs: 1_000,
      cooldownMs: 3_000,
    });

    jest.advanceTimersByTime(3_999);
    expect(reload).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);

    expect(reload).toHaveBeenCalledTimes(2);
    watchdog.dispose();
  });

  it("stops after the maximum attempts for a camera position", () => {
    const { map, reload } = createMap();
    const watchdog = createTileStallWatchdog(map, {
      stallMs: 1_000,
      cooldownMs: 1_000,
      maxAttempts: 2,
    });

    jest.advanceTimersByTime(10_000);

    expect(reload).toHaveBeenCalledTimes(2);
    watchdog.dispose();
  });

  it("resets attempts after a move event", () => {
    const { map, handlers, reload } = createMap();
    const watchdog = createTileStallWatchdog(map, {
      stallMs: 1_000,
      cooldownMs: 1_000,
      maxAttempts: 1,
    });
    jest.advanceTimersByTime(2_000);
    expect(reload).toHaveBeenCalledTimes(1);

    handlers.move[0]();
    jest.advanceTimersByTime(1_000);

    expect(reload).toHaveBeenCalledTimes(2);
    watchdog.dispose();
  });

  it("dispose clears its timer and listeners", () => {
    const { map, handlers, reload } = createMap();
    const watchdog = createTileStallWatchdog(map, { stallMs: 1_000 });

    watchdog.dispose();
    handlers.move.forEach((handler) => handler());
    jest.advanceTimersByTime(10_000);

    expect(reload).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(map.off).toHaveBeenCalledWith("move", expect.any(Function));
  });

  it("suppresses recovery while the document is hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const { map, reload } = createMap();
    const watchdog = createTileStallWatchdog(map, { stallMs: 1_000 });

    jest.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    jest.advanceTimersByTime(1_000);

    expect(reload).toHaveBeenCalledTimes(1);
    watchdog.dispose();
  });
});
