import { consolidateRegionalSwellEvents } from "@/lib/alerts/swell-watch/regional-consolidator";

function stable(regionalEventId: string, regionKey = "southern-california") {
  return {
    regionalEventId,
    regionKey,
    evaluationIds: ["one", "two"],
    status: "stable" as const,
    aliases: [regionalEventId],
  };
}

describe("regional swell consolidation", () => {
  it("consolidates only the canonical UUID returned by the matched episode", () => {
    expect(
      consolidateRegionalSwellEvents([
        { beachId: "malibu", regionalEvent: stable("swell_abc") },
        { beachId: "trestles", regionalEvent: stable("swell_abc") },
      ]),
    ).toEqual([
      {
        regionalEventId: "swell_abc",
        regionKey: "southern-california",
        beachIds: ["malibu", "trestles"],
        status: "stable",
        aliases: ["swell_abc"],
      },
    ]);
  });

  it("never merges matching measurements from different regions or separated episodes", () => {
    const first = stable("swell_first");
    const second = { ...stable("swell_second"), aliases: first.aliases };
    const otherRegion = {
      ...stable("swell_other", "northern-california"),
      aliases: first.aliases,
    };
    expect(
      consolidateRegionalSwellEvents([
        { beachId: "malibu", regionalEvent: first },
        { beachId: "trestles", regionalEvent: second },
        { beachId: "ocean-beach", regionalEvent: otherRegion },
      ]),
    ).toHaveLength(3);
  });

  it("is order-independent for a transitive beach merge inside one episode", () => {
    const candidates = [
      { beachId: "malibu", regionalEvent: stable("swell_abc") },
      { beachId: "trestles", regionalEvent: stable("swell_abc") },
      { beachId: "blacks", regionalEvent: stable("swell_abc") },
    ];
    expect(consolidateRegionalSwellEvents(candidates)).toEqual(
      consolidateRegionalSwellEvents([...candidates].reverse()),
    );
  });
});
