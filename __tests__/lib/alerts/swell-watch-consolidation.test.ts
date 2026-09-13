import {
  consolidateSwellWatchRecipients,
  type SwellWatchRecipientCandidate,
} from "@/lib/alerts/swell-watch/regional-consolidator";

const candidate = (
  overrides: Partial<SwellWatchRecipientCandidate> = {},
): SwellWatchRecipientCandidate => ({
  recipientUserId: "user-a",
  regionalEventId: "event-a",
  beachId: "beach-a",
  reason: "rule",
  projectedImpact: 4,
  confidence: 0.8,
  ...overrides,
});

describe("Swell Watch recipient consolidation", () => {
  it("collapses multiple affected beaches to one home-preferred announcement identity", () => {
    expect(
      consolidateSwellWatchRecipients([
        candidate({ beachId: "favorite-high-impact", reason: "favorite", projectedImpact: 12, confidence: 1 }),
        candidate({ beachId: "home-low-impact", reason: "home", projectedImpact: 1, confidence: 0.1 }),
        candidate({ beachId: "rule", reason: "rule", projectedImpact: 20, confidence: 1 }),
      ]),
    ).toEqual([
      { recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "home-low-impact" },
    ]);
  });

  it("prefers a favorite over a higher-impact rule", () => {
    expect(
      consolidateSwellWatchRecipients([
        candidate({ beachId: "rule", reason: "rule", projectedImpact: 20, confidence: 1 }),
        candidate({ beachId: "favorite", reason: "favorite", projectedImpact: 1, confidence: 0.1 }),
      ]),
    ).toEqual([
      { recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "favorite" },
    ]);
  });

  it("uses finite projected impact inside a relationship tier", () => {
    expect(
      consolidateSwellWatchRecipients([
        candidate({ beachId: "beach-low", reason: "favorite", projectedImpact: 6, confidence: 0.9 }),
        candidate({ beachId: "beach-high", reason: "favorite", projectedImpact: 7, confidence: 0.2 }),
      ]),
    ).toEqual([{ recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-high" }]);
  });

  it("uses confidence when projected impact is tied", () => {
    expect(
      consolidateSwellWatchRecipients([
        candidate({ beachId: "beach-low-confidence", reason: "favorite", projectedImpact: 6, confidence: 0.2 }),
        candidate({ beachId: "beach-high-confidence", reason: "favorite", projectedImpact: 6, confidence: 0.9 }),
      ]),
    ).toEqual([{ recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-high-confidence" }]);
  });

  it("uses stable beach IDs after tied finite scores", () => {
    expect(
      consolidateSwellWatchRecipients([
        candidate({ beachId: "beach-z", reason: "favorite", projectedImpact: 6, confidence: 0.9 }),
        candidate({ beachId: "beach-a", reason: "favorite", projectedImpact: 6, confidence: 0.9 }),
      ]),
    ).toEqual([{ recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-a" }]);
  });

  it("uses confidence and stable beach IDs deterministically when scores are invalid", () => {
    const invalidImpact = [
      candidate({ beachId: "beach-z", reason: "favorite", projectedImpact: Number.NaN, confidence: 0.2 }),
      candidate({ beachId: "beach-a", reason: "favorite", projectedImpact: Number.NaN, confidence: 0.9 }),
    ];
    const invalidConfidence = [
      candidate({ beachId: "beach-z", reason: "favorite", projectedImpact: 6, confidence: Number.NaN }),
      candidate({ beachId: "beach-a", reason: "favorite", projectedImpact: 6, confidence: Number.NaN }),
    ];

    expect(consolidateSwellWatchRecipients(invalidImpact)).toEqual([
      { recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-a" },
    ]);
    expect(consolidateSwellWatchRecipients([...invalidImpact].reverse())).toEqual([
      { recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-a" },
    ]);
    expect(consolidateSwellWatchRecipients(invalidConfidence)).toEqual([
      { recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-a" },
    ]);
    expect(consolidateSwellWatchRecipients([...invalidConfidence].reverse())).toEqual([
      { recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-a" },
    ]);
  });

  it("returns one deterministic recipient/event row across duplicate candidates and input order", () => {
    const candidates = [
      candidate({ beachId: "beach-b", reason: "rule" }),
      candidate({ beachId: "beach-a", reason: "rule" }),
      candidate({ beachId: "beach-a", reason: "rule" }),
      candidate({ recipientUserId: "user-b", regionalEventId: "event-a", beachId: "beach-c", reason: "favorite" }),
      candidate({ regionalEventId: "event-b", beachId: "beach-d", reason: "home" }),
    ];

    const expected = [
      { recipientUserId: "user-a", regionalEventId: "event-a", leadBeachId: "beach-a" },
      { recipientUserId: "user-a", regionalEventId: "event-b", leadBeachId: "beach-d" },
      { recipientUserId: "user-b", regionalEventId: "event-a", leadBeachId: "beach-c" },
    ];
    expect(consolidateSwellWatchRecipients(candidates)).toEqual(expected);
    expect(consolidateSwellWatchRecipients([...candidates].reverse())).toEqual(expected);
  });

  it("returns an allowlisted durable announcement shape without relationship or impact evidence", () => {
    const [recipient] = consolidateSwellWatchRecipients([candidate()]);
    expect(Object.keys(recipient).sort()).toEqual(["leadBeachId", "recipientUserId", "regionalEventId"]);
    expect(recipient).not.toHaveProperty("reason");
    expect(recipient).not.toHaveProperty("projectedImpact");
    expect(recipient).not.toHaveProperty("confidence");
  });
});
