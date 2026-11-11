/**
 * @jest-environment node
 */

import { findStationsByAlternateId, getLatestWaveObservations } from "@/lib/services/wave-stations/lookup";

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => {
    throw new Error("tests pass a client");
  }),
}));

type Ops = Array<[string, unknown[]]>;

function fakeClient(respond: (table: string, ops: Ops) => unknown) {
  const chains: Array<{ table: string; ops: Ops }> = [];
  const client = {
    from: (table: string) => {
      const ops: Ops = [];
      chains.push({ table, ops });
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "in", "order", "range"]) {
        builder[op] = (...args: unknown[]) => {
          ops.push([op, args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: respond(table, ops), error: null }).then(resolve);
      return builder;
    },
  };
  return { client: client as never, chains };
}

const argsOf = (ops: Ops, op: string, column: string) =>
  ops.find(([name, args]) => name === op && args[0] === column)?.[1][1];

describe("findStationsByAlternateId", () => {
  it("matches the source id in both cases and the CDIP id with and without padding", async () => {
    const { client, chains } = fakeClient((_, ops) =>
      argsOf(ops, "in", "cdip_station_id") ? [{ id: "ndbc:46225", slug: "torrey" }] : [{ id: "ndbc:46225", slug: "torrey" }],
    );
    await expect(findStationsByAlternateId("100", client)).resolves.toEqual([{ id: "ndbc:46225", slug: "torrey" }]);
    expect(argsOf(chains[0].ops, "in", "source_station_id")).toEqual(["100"]);
    expect(argsOf(chains[1].ops, "in", "cdip_station_id")).toEqual(["100"]);

    const lower = fakeClient(() => []);
    await findStationsByAlternateId("ljpc1", lower.client);
    expect(argsOf(lower.chains[0].ops, "in", "source_station_id")).toEqual(["ljpc1", "LJPC1"]);
    expect(lower.chains).toHaveLength(1);

    const padded = fakeClient(() => []);
    await findStationsByAlternateId("0100", padded.client);
    expect(argsOf(padded.chains[1].ops, "in", "cdip_station_id")).toEqual(["0100", "100"]);
  });

  it("rejects ids that cannot be station ids without a query", async () => {
    const { client, chains } = fakeClient(() => []);
    await expect(findStationsByAlternateId("not/an id", client)).resolves.toEqual([]);
    expect(chains).toHaveLength(0);
  });
});

describe("getLatestWaveObservations", () => {
  it("returns only rows at each station's own last wave time", async () => {
    const { client, chains } = fakeClient(() => [
      { station_id: "ndbc:a", observed_at: "2026-11-11T03:26:00+00:00", wave_height_m: 1.4 },
      // Station b at station a's time: filtered out.
      { station_id: "ndbc:b", observed_at: "2026-11-11T03:26:00+00:00", wave_height_m: 0.9 },
      { station_id: "ndbc:b", observed_at: "2026-11-11T02:40:00+00:00", wave_height_m: 1.1 },
    ]);
    const latest = await getLatestWaveObservations(
      [
        { id: "ndbc:a", last_wave_observed_at: "2026-11-11T03:26:00Z" },
        { id: "ndbc:b", last_wave_observed_at: "2026-11-11T02:40:00Z" },
        { id: "ndbc:c", last_wave_observed_at: null },
      ],
      client,
    );
    expect([...latest.entries()].map(([id, row]) => [id, row.wave_height_m])).toEqual([
      ["ndbc:a", 1.4],
      ["ndbc:b", 1.1],
    ]);
    expect(argsOf(chains[0].ops, "in", "station_id")).toEqual(["ndbc:a", "ndbc:b"]);
    expect(argsOf(chains[0].ops, "in", "observed_at")).toEqual(["2026-11-11T03:26:00.000Z", "2026-11-11T02:40:00.000Z"]);
  });

  it("skips the query when no station has a wave time", async () => {
    const { client, chains } = fakeClient(() => []);
    await expect(getLatestWaveObservations([{ id: "x", last_wave_observed_at: null }], client)).resolves.toEqual(new Map());
    expect(chains).toHaveLength(0);
  });
});
