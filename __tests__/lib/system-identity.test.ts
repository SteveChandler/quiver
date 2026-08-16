/**
 * @jest-environment node
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isSystemAuthored,
  resolveSystemIdentity,
  SYSTEM_IDENTITY,
} from "@/lib/system-identity";
import type { Database } from "@/types/database.generated";

type QueryResult = {
  data: { id: string; full_name?: string } | null;
  error: { message: string } | null;
};

function createIdentityQuery(result: QueryResult) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    limit: jest.fn(),
    single: jest.fn<Promise<QueryResult>, []>(() => Promise.resolve(result)),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function createIdentityClient(query: ReturnType<typeof createIdentityQuery>) {
  return {
    from: jest.fn(() => query),
  } as unknown as Pick<SupabaseClient<Database>, "from">;
}

describe("system identity", () => {
  it("resolves the canonical profile by its stable UUID", async () => {
    const query = createIdentityQuery({
      data: { id: SYSTEM_IDENTITY.profileId },
      error: null,
    });

    const identity = await resolveSystemIdentity(createIdentityClient(query));

    expect(identity).toBe(SYSTEM_IDENTITY.profileId);
    expect(query.eq).toHaveBeenCalledWith("id", SYSTEM_IDENTITY.profileId);
    expect(query.eq).toHaveBeenCalledWith("is_system_account", true);
    expect(query.eq).not.toHaveBeenCalledWith("full_name", expect.anything());
  });

  it("continues to resolve when the profile display name is renamed", async () => {
    const query = createIdentityQuery({
      data: {
        id: SYSTEM_IDENTITY.profileId,
        full_name: "A renamed forecast publisher",
      },
      error: null,
    });

    await expect(resolveSystemIdentity(createIdentityClient(query))).resolves.toBe(
      SYSTEM_IDENTITY.profileId
    );
    expect(query.eq).not.toHaveBeenCalledWith(
      "full_name",
      "A renamed forecast publisher"
    );
  });

  it("throws when the canonical profile is missing", async () => {
    const query = createIdentityQuery({
      data: null,
      error: { message: "No rows" },
    });

    await expect(resolveSystemIdentity(createIdentityClient(query))).rejects.toThrow(
      "Unable to resolve system identity"
    );
  });

  it("recognizes system profiles and posts without labeling human records", () => {
    expect(
      isSystemAuthored({ id: SYSTEM_IDENTITY.profileId, is_system_account: false })
    ).toBe(true);
    expect(isSystemAuthored({ id: "human-user", is_system_account: true })).toBe(true);
    expect(isSystemAuthored({ user_id: SYSTEM_IDENTITY.profileId })).toBe(true);
    expect(
      isSystemAuthored({ id: "post-id", user_id: SYSTEM_IDENTITY.profileId })
    ).toBe(true);
    expect(
      isSystemAuthored({
        user_id: "human-user",
        profiles: { id: "human-user", is_system_account: false },
      })
    ).toBe(false);
    expect(isSystemAuthored(null)).toBe(false);
  });
});
