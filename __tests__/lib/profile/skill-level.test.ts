import { getProfileExperienceLevel } from "@/lib/profile/skill-level";

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
