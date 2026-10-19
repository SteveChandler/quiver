/**
 * @jest-environment node
 */
// __tests__/lib/services/discovery/nhc-storms.test.ts
import { createNhcStormClient, parseActiveStorms } from "@/lib/services/discovery/nhc-storms";

const FEED = {
  activeStorms: [
    { id: "ep182026", name: "Rachel", classification: "HU", latitudeNumeric: 20.1, longitudeNumeric: -114.3 },
    { id: "al092026", name: "Nigel", classification: "TS", latitudeNumeric: 25.2, longitudeNumeric: -60.1 },
  ],
};

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe("parseActiveStorms", () => {
  it("reads id, name, basin and position", () => {
    expect(parseActiveStorms(FEED)).toEqual([
      { id: "ep182026", name: "Rachel", basin: "ep", lat: 20.1, lon: -114.3 },
      { id: "al092026", name: "Nigel", basin: "other", lat: 25.2, lon: -60.1 },
    ]);
  });

  it("drops malformed entries and tolerates any other shape", () => {
    expect(parseActiveStorms({ activeStorms: [null, 3, { id: "ep1", name: "", latitudeNumeric: 1, longitudeNumeric: 2 }, { id: "ep2", name: "X", latitudeNumeric: "20N", longitudeNumeric: 2 }] })).toEqual([]);
    expect(parseActiveStorms(null)).toEqual([]);
    expect(parseActiveStorms({ activeStorms: "none" })).toEqual([]);
    expect(parseActiveStorms([])).toEqual([]);
  });

  it("recognizes Pacific basins case-insensitively and trims names", () => {
    expect(parseActiveStorms({ activeStorms: [
      { id: "CP012026", name: "  Iona  ", latitudeNumeric: 0, longitudeNumeric: 180 },
      { id: "EP022026", name: "Gil", latitudeNumeric: 15, longitudeNumeric: -120 },
    ] })).toEqual([
      { id: "CP012026", name: "Iona", basin: "cp", lat: 0, lon: 180 },
      { id: "EP022026", name: "Gil", basin: "ep", lat: 15, lon: -120 },
    ]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "drops non-finite coordinates (%s) while preserving valid storms",
    (coordinate: number): void => {
      expect(parseActiveStorms({ activeStorms: [
        FEED.activeStorms[0],
        { ...FEED.activeStorms[1], latitudeNumeric: coordinate },
        { ...FEED.activeStorms[1], longitudeNumeric: coordinate },
      ] })).toEqual([
        { id: "ep182026", name: "Rachel", basin: "ep", lat: 20.1, lon: -114.3 },
      ]);
    },
  );

  it("drops missing or wrongly typed fields and whitespace-only names", () => {
    expect(parseActiveStorms({ activeStorms: [
      {},
      { ...FEED.activeStorms[0], id: 1 },
      { ...FEED.activeStorms[0], name: null },
      { ...FEED.activeStorms[0], name: " \t " },
      { ...FEED.activeStorms[0], longitudeNumeric: "114W" },
    ] })).toEqual([]);
  });
});

describe("createNhcStormClient", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("caches a good answer for fifteen minutes", async () => {
    let clock = 0;
    const fetchImpl = jest.fn(async () => ok(FEED));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    expect(await client.getActiveStorms()).toHaveLength(2);
    clock += 14 * 60_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock += 2 * 60_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a network error", async () => { throw new Error("ECONNRESET"); }],
    ["a timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
    ["a non-200", async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response],
    ["invalid JSON", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } }) as unknown as Response],
    ["an unexpected shape", async () => ok({ storms: [] })],
    ["a null payload", async () => ok(null)],
    ["an array payload", async () => ok([])],
    ["a non-array storm list", async () => ok({ activeStorms: "none" })],
    ["a non-200 success status", async () => ({ ok: true, status: 201, json: async () => FEED }) as unknown as Response],
    ["a synchronous fetch error", (): Response => { throw new Error("synchronous failure"); }],
    ["a non-Error rejection", async (): Promise<Response> => { throw { toString: () => { throw new Error("cannot stringify"); } }; }],
  ])("returns no storms, never throws, on %s", async (_label, impl) => {
    let clock = 0;
    const fetchImpl = jest.fn<Response | Promise<Response>, []>(impl);
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    clock = 119_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 120_000;
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("remembers a failure for two minutes so a bad feed is not hammered", async () => {
    let clock = 0;
    const fetchImpl = jest.fn(async () => { throw new Error("down"); });
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    await client.getActiveStorms();
    clock += 60_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock += 61_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent callers", async () => {
    const fetchImpl = jest.fn(async () => ok(FEED));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await Promise.all([client.getActiveStorms(), client.getActiveStorms(), client.getActiveStorms()]))
      .toEqual([parseActiveStorms(FEED), parseActiveStorms(FEED), parseActiveStorms(FEED)]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches a valid empty feed for fifteen minutes, expiring at the boundary", async () => {
    let clock = 0;
    const fetchImpl = jest.fn(async (): Promise<Response> => ok({ activeStorms: [] }));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    clock = 899_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 900_000;
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("requests the NHC JSON feed with a four-second abort signal", async () => {
    const signal = new AbortController().signal;
    const timeout = jest.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchImpl = jest.fn(async (): Promise<Response> => ok(FEED));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(timeout).toHaveBeenCalledWith(4000);
    expect(fetchImpl).toHaveBeenCalledWith("https://www.nhc.noaa.gov/CurrentStorms.json", {
      signal,
      headers: { accept: "application/json" },
    });
  });

  it("shares a pending failure, then starts one recovery request after expiry", async () => {
    let clock = 0;
    let rejectFetch!: (reason: Error) => void;
    const fetchImpl = jest.fn((): Promise<Response> => new Promise((_resolve, reject) => {
      rejectFetch = reject;
    }));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    const pending = Promise.all([client.getActiveStorms(), client.getActiveStorms()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock = 30_000;
    rejectFetch(new Error("down"));
    await expect(pending).resolves.toEqual([[], []]);
    clock = 149_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 150_000;
    await expect(Promise.all([client.getActiveStorms(), client.getActiveStorms()]))
      .resolves.toEqual([parseActiveStorms(FEED), parseActiveStorms(FEED)]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("caches failures before warning even when console.warn throws", async () => {
    let clock = 0;
    const warn = jest.mocked(console.warn).mockImplementation((): never => {
      throw new Error("logging failed");
    });
    const fetchImpl = jest.fn(async (): Promise<Response> => { throw new Error("down"); });
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    await expect(Promise.all([
      client.getActiveStorms(), client.getActiveStorms(), client.getActiveStorms(),
    ])).resolves.toEqual([[], [], []]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    clock = 119_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 120_000;
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("caches failures and logs safely when an Error message getter throws", async () => {
    let clock = 0;
    const error = new Error("down");
    Object.defineProperty(error, "message", {
      get: (): never => { throw new Error("message unavailable"); },
    });
    const fetchImpl = jest.fn(async (): Promise<Response> => { throw error; });
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    await expect(Promise.all([
      client.getActiveStorms(), client.getActiveStorms(), client.getActiveStorms(),
    ])).resolves.toEqual([[], [], []]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "[nhc-storms] feed unavailable; storm names omitted", "Unknown error",
    );
    clock = 119_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 120_000;
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("resolves empty results when the injected clock always throws", async () => {
    const fetchImpl = jest.fn(async (): Promise<Response> => ok(FEED));
    const client = createNhcStormClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: (): never => { throw new Error("clock unavailable"); },
    });
    await expect(Promise.all([
      client.getActiveStorms(), client.getActiveStorms(), client.getActiveStorms(),
    ])).resolves.toEqual([[], [], []]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolves an empty result if the clock throws while reading a populated cache", async () => {
    const now = jest.fn((): number => 0);
    const fetchImpl = jest.fn(async (): Promise<Response> => ok(FEED));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now });
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    now.mockImplementation((): never => { throw new Error("clock unavailable"); });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now.mockReturnValue(60_000);
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("resolves an empty result if the clock fails when storing a successful feed", async () => {
    let clock = 0;
    let clockUnavailable = false;
    const now = (): number => {
      if (clockUnavailable) throw new Error("clock unavailable");
      return clock;
    };
    const fetchImpl = jest.fn(async (): Promise<Response> => {
      clockUnavailable = true;
      return ok(FEED);
    });
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    clockUnavailable = false;
    clock = 119_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 120_000;
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("preserves failure back-off if the clock throws in the failure handler", async () => {
    let clock = 0;
    let clockUnavailable = false;
    const now = (): number => {
      if (clockUnavailable) throw new Error("clock unavailable");
      return clock;
    };
    const fetchImpl = jest.fn(async (): Promise<Response> => {
      clockUnavailable = true;
      throw new Error("down");
    });
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    clockUnavailable = false;
    clock = 119_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 120_000;
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("treats a nonempty feed with no parseable storms as one briefly cached failure", async () => {
    let clock = 0;
    const fetchImpl = jest.fn(async (): Promise<Response> => ok({ activeStorms: [
      null, 3, { id: "ep182026", name: " ", latitudeNumeric: 20.1, longitudeNumeric: -114.3 },
    ] }));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    clock = 119_999;
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    fetchImpl.mockResolvedValueOnce(ok(FEED));
    clock = 120_000;
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("isolates returned arrays and storm objects from concurrent results and the cache", async () => {
    const fetchImpl = jest.fn(async (): Promise<Response> => ok(FEED));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: (): number => 0 });
    const [first, concurrent] = await Promise.all([client.getActiveStorms(), client.getActiveStorms()]);
    first[0].name = "changed";
    first.pop();
    expect(concurrent).toEqual(parseActiveStorms(FEED));
    const cachedResult = await client.getActiveStorms();
    expect(cachedResult).toEqual(parseActiveStorms(FEED));
    cachedResult[0].name = "changed again";
    cachedResult.splice(0);
    await expect(client.getActiveStorms()).resolves.toEqual(parseActiveStorms(FEED));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("isolates returned failure arrays from the cached empty result", async () => {
    const fetchImpl = jest.fn(async (): Promise<Response> => { throw new Error("down"); });
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: (): number => 0 });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    const result = await client.getActiveStorms();
    expect(result).toEqual([]);
    result.push(...parseActiveStorms(FEED));
    await expect(client.getActiveStorms()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
