export interface DirectoryRosterMember {
  email: string;
  externalMemberId: string;
}

export interface DirectoryRosterSnapshot {
  complete: boolean;
  members: DirectoryRosterMember[];
}

export interface ExistingRosterIdentity {
  id: string;
  email: string;
  externalMemberId: string;
  eligibilityStatus: "eligible" | "ineligible";
  purgeAfter: string | null;
  isLinked?: boolean;
}

export type RosterObservation =
  | {
      kind: "new";
      observedAt: string;
      email: string;
      externalMemberId: string;
    }
  | {
      kind: "seen";
      entryId: string;
      observedAt: string;
    }
  | {
      kind: "identity_refresh";
      entryId: string;
      observedAt: string;
      email: string;
      externalMemberId: string;
    }
  | {
      kind: "rejoined";
      entryId: string;
      observedAt: string;
      email: string;
      externalMemberId: string;
    }
  | {
      kind: "left";
      entryId: string;
      observedAt: string;
      purgeAfter: string;
    }
  | {
      kind: "rejoined_linked";
      entryId: string;
      observedAt: string;
    }
  | {
      kind: "left_linked";
      entryId: string;
      observedAt: string;
    };

export interface RosterReconciliationResult {
  complete: boolean;
  observations: RosterObservation[];
  purgeEntryIds: string[];
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function reconcileRosterSnapshot({
  now,
  snapshot,
  existing,
}: {
  now: string;
  snapshot: DirectoryRosterSnapshot;
  existing: ExistingRosterIdentity[];
}): RosterReconciliationResult {
  if (!snapshot.complete) {
    return { complete: false, observations: [], purgeEntryIds: [] };
  }

  const nowMs = new Date(now).getTime();
  const existingByMemberId = new Map(
    existing
      .filter((entry) => entry.externalMemberId.length > 0)
      .map((entry) => [entry.externalMemberId, entry]),
  );
  const existingByEmail = new Map(
    existing.map((entry) => [normalizedEmail(entry.email), entry]),
  );
  const seenEntryIds = new Set<string>();
  const observations: RosterObservation[] = [];

  for (const member of snapshot.members) {
    const email = normalizedEmail(member.email);
    const matched =
      existingByMemberId.get(member.externalMemberId) ??
      existingByEmail.get(email);

    if (!matched) {
      observations.push({
        kind: "new",
        observedAt: now,
        email,
        externalMemberId: member.externalMemberId,
      });
      continue;
    }

    seenEntryIds.add(matched.id);
    if (matched.eligibilityStatus === "ineligible") {
      if (matched.isLinked) {
        observations.push({
          kind: "rejoined_linked",
          entryId: matched.id,
          observedAt: now,
        });
        continue;
      }
      observations.push({
        kind: "rejoined",
        entryId: matched.id,
        observedAt: now,
        email,
        externalMemberId: member.externalMemberId,
      });
      continue;
    }

    if (
      !matched.isLinked &&
      (normalizedEmail(matched.email) !== email ||
        matched.externalMemberId !== member.externalMemberId)
    ) {
      observations.push({
        kind: "identity_refresh",
        entryId: matched.id,
        observedAt: now,
        email,
        externalMemberId: member.externalMemberId,
      });
      continue;
    }

    observations.push({
      kind: "seen",
      entryId: matched.id,
      observedAt: now,
    });
  }

  for (const entry of existing) {
    if (
      entry.eligibilityStatus === "eligible" &&
      !seenEntryIds.has(entry.id)
    ) {
      if (entry.isLinked) {
        observations.push({
          kind: "left_linked",
          entryId: entry.id,
          observedAt: now,
        });
        continue;
      }
      observations.push({
        kind: "left",
        entryId: entry.id,
        observedAt: now,
        purgeAfter: new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return {
    complete: true,
    observations,
    purgeEntryIds: existing
      .filter(
        (entry) =>
          !entry.isLinked &&
          entry.eligibilityStatus === "ineligible" &&
          entry.purgeAfter !== null &&
          new Date(entry.purgeAfter).getTime() <= nowMs,
      )
      .map((entry) => entry.id),
  };
}
