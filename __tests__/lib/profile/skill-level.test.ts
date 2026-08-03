import {
  getProfileExperienceLevel,
  getVerifiedProfileExperience,
} from "@/lib/profile/skill-level";

type ProfileSkillClient = Parameters<typeof getProfileExperienceLevel>[0];

function asProfileSkillClient(supabase: unknown): ProfileSkillClient {
  return supabase as ProfileSkillClient;
}

function supabaseWithProfileResult(result: {
  data: { experience_level: string | null } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));

  return {
    supabase: { from },
    from,
    select,
    eq,
    maybeSingle,
  };
}

describe("getProfileExperienceLevel", () => {
  it("returns a parsed skill level from profile.experience_level", async () => {
    const { supabase } = supabaseWithProfileResult({
      data: { experience_level: "ADVANCED" },
      error: null,
    });

    await expect(
      getProfileExperienceLevel(asProfileSkillClient(supabase), "user-1")
    ).resolves.toBe("advanced");
  });

  it("returns null for missing users, invalid values, and profile errors", async () => {
    const invalid = supabaseWithProfileResult({
      data: { experience_level: "pro" },
      error: null,
    });
    const errored = supabaseWithProfileResult({
      data: null,
      error: { message: "profile unavailable" },
    });

    await expect(
      getProfileExperienceLevel(asProfileSkillClient(invalid.supabase), "user-1")
    ).resolves.toBeNull();
    await expect(
      getProfileExperienceLevel(asProfileSkillClient(errored.supabase), "user-1")
    ).resolves.toBeNull();
    await expect(
      getProfileExperienceLevel(asProfileSkillClient(invalid.supabase), null)
    ).resolves.toBeNull();
  });

  it("queries the profile row by user id", async () => {
    const { supabase, from, select, eq, maybeSingle } = supabaseWithProfileResult({
      data: { experience_level: "beginner" },
      error: null,
    });

    await getProfileExperienceLevel(asProfileSkillClient(supabase), "user-123");

    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("experience_level");
    expect(eq).toHaveBeenCalledWith("id", "user-123");
    expect(maybeSingle).toHaveBeenCalled();
  });
});

describe("getVerifiedProfileExperience", () => {
  function supabaseWithAuth(
    authResult: {
      data: { user: { id: string } | null };
      error: { message: string } | null;
    },
    experienceLevel: string | null = null
  ) {
    const { supabase } = supabaseWithProfileResult({
      data: experienceLevel ? { experience_level: experienceLevel } : null,
      error: null,
    });
    return {
      ...supabase,
      auth: { getUser: jest.fn().mockResolvedValue(authResult) },
    };
  }

  it("returns the user id and parsed experience for a verified session", async () => {
    const supabase = supabaseWithAuth(
      { data: { user: { id: "user-1" } }, error: null },
      "intermediate"
    );

    await expect(
      getVerifiedProfileExperience(asProfileSkillClient(supabase))
    ).resolves.toEqual({ userId: "user-1", profileExperience: "intermediate" });
  });

  it("collapses missing users, auth errors, and thrown auth failures to nulls", async () => {
    const missingUser = supabaseWithAuth({ data: { user: null }, error: null });
    const authError = supabaseWithAuth({
      data: { user: { id: "user-1" } },
      error: { message: "expired" },
    });
    const throwing = {
      auth: { getUser: jest.fn().mockRejectedValue(new Error("network")) },
    };

    const anonymous = { userId: null, profileExperience: null };
    await expect(
      getVerifiedProfileExperience(asProfileSkillClient(missingUser))
    ).resolves.toEqual(anonymous);
    await expect(
      getVerifiedProfileExperience(asProfileSkillClient(authError))
    ).resolves.toEqual(anonymous);
    await expect(
      getVerifiedProfileExperience(asProfileSkillClient(throwing))
    ).resolves.toEqual(anonymous);
  });
});
