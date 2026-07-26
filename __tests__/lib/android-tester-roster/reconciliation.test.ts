import { reconcileRosterSnapshot } from "@/lib/android-tester-roster/reconciliation";

const NOW = "2026-07-25T12:00:00.000Z";

describe("Android tester roster reconciliation", () => {
  it("does not mark anyone as left when the Directory snapshot is incomplete", () => {
    const result = reconcileRosterSnapshot({
      now: NOW,
      snapshot: { complete: false, members: [] },
      existing: [
        {
          id: "entry-1",
          email: "surfer@example.com",
          externalMemberId: "member-1",
          eligibilityStatus: "eligible",
          purgeAfter: null,
        },
      ],
    });

    expect(result).toEqual({
      complete: false,
      observations: [],
      purgeEntryIds: [],
    });
  });

  it("marks a missing member ineligible and schedules identity purge at exactly 30 days", () => {
    const result = reconcileRosterSnapshot({
      now: NOW,
      snapshot: { complete: true, members: [] },
      existing: [
        {
          id: "entry-1",
          email: "surfer@example.com",
          externalMemberId: "member-1",
          eligibilityStatus: "eligible",
          purgeAfter: null,
        },
      ],
    });

    expect(result.observations).toEqual([
      {
        kind: "left",
        entryId: "entry-1",
        observedAt: NOW,
        purgeAfter: "2026-08-24T12:00:00.000Z",
      },
    ]);
  });

  it("cancels a pending purge when the direct user rejoins", () => {
    const result = reconcileRosterSnapshot({
      now: NOW,
      snapshot: {
        complete: true,
        members: [
          {
            email: "SURFER@example.com",
            externalMemberId: "member-1",
          },
        ],
      },
      existing: [
        {
          id: "entry-1",
          email: "surfer@example.com",
          externalMemberId: "member-1",
          eligibilityStatus: "ineligible",
          purgeAfter: "2026-07-30T12:00:00.000Z",
        },
      ],
    });

    expect(result.observations).toEqual([
      {
        kind: "rejoined",
        entryId: "entry-1",
        observedAt: NOW,
        email: "surfer@example.com",
        externalMemberId: "member-1",
      },
    ]);
  });

  it("refreshes an unlinked identity when the Directory primary email changes", () => {
    const result = reconcileRosterSnapshot({
      now: NOW,
      snapshot: {
        complete: true,
        members: [
          {
            email: "new-primary@example.com",
            externalMemberId: "member-1",
          },
        ],
      },
      existing: [
        {
          id: "entry-1",
          email: "old-primary@example.com",
          externalMemberId: "member-1",
          eligibilityStatus: "eligible",
          purgeAfter: null,
        },
      ],
    });

    expect(result.observations).toEqual([
      {
        kind: "identity_refresh",
        entryId: "entry-1",
        observedAt: NOW,
        email: "new-primary@example.com",
        externalMemberId: "member-1",
      },
    ]);
  });

  it("purges due unjoined identities but never infers install, first-open, Play opt-in, or account join", () => {
    const result = reconcileRosterSnapshot({
      now: NOW,
      snapshot: { complete: true, members: [] },
      existing: [
        {
          id: "entry-1",
          email: "left@example.com",
          externalMemberId: "member-left",
          eligibilityStatus: "ineligible",
          purgeAfter: "2026-07-25T12:00:00.000Z",
        },
      ],
    });

    expect(result.purgeEntryIds).toEqual(["entry-1"]);
    expect(JSON.stringify(result)).not.toMatch(
      /play_opt_in|installed|first_open|account_join/,
    );
  });

  it("matches a linked account by transient auth email instead of recreating its deleted identity envelope", () => {
    const result = reconcileRosterSnapshot({
      now: NOW,
      snapshot: {
        complete: true,
        members: [
          {
            email: "SURFER@example.com",
            externalMemberId: "google-member-current",
          },
        ],
      },
      existing: [
        {
          id: "entry-linked",
          email: "surfer@example.com",
          externalMemberId: "",
          eligibilityStatus: "eligible",
          purgeAfter: null,
          isLinked: true,
        },
      ],
    });

    expect(result.observations).toEqual([
      {
        kind: "seen",
        entryId: "entry-linked",
        observedAt: NOW,
      },
    ]);
    expect(result.observations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "new" })]),
    );
  });

  it("updates linked eligibility on complete leave and rejoin without scheduling identity retention", () => {
    const left = reconcileRosterSnapshot({
      now: NOW,
      snapshot: { complete: true, members: [] },
      existing: [
        {
          id: "entry-linked",
          email: "surfer@example.com",
          externalMemberId: "",
          eligibilityStatus: "eligible",
          purgeAfter: null,
          isLinked: true,
        },
      ],
    });
    expect(left.observations).toEqual([
      {
        kind: "left_linked",
        entryId: "entry-linked",
        observedAt: NOW,
      },
    ]);

    const rejoined = reconcileRosterSnapshot({
      now: NOW,
      snapshot: {
        complete: true,
        members: [
          {
            email: "surfer@example.com",
            externalMemberId: "google-member-current",
          },
        ],
      },
      existing: [
        {
          id: "entry-linked",
          email: "surfer@example.com",
          externalMemberId: "",
          eligibilityStatus: "ineligible",
          purgeAfter: null,
          isLinked: true,
        },
      ],
    });
    expect(rejoined.observations).toEqual([
      {
        kind: "rejoined_linked",
        entryId: "entry-linked",
        observedAt: NOW,
      },
    ]);
  });
});
