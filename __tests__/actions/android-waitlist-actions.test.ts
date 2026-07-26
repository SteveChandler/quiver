import { revalidatePath } from "next/cache";

import { joinAndroidWaitlist } from "@/actions/android-waitlist-actions";

const mockProfileUpdate = jest.fn();
const mockProfileEq = jest.fn();
const mockProfileSelect = jest.fn();
const mockProfileMaybeSingle = jest.fn();
const mockUserEventInsert = jest.fn();
const mockServiceRoleRpc = jest.fn();
const mockSupabase = {
  from: jest.fn((table: string) => {
    if (table === "profiles") {
      return {
        update: mockProfileUpdate,
      };
    }

    if (table === "user_events") {
      return {
        insert: mockUserEventInsert,
      };
    }

    return {};
  }),
};

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/server-action-utils", () => ({
  withAuthenticatedAction: jest.fn(async (action: any) => {
    try {
      const data = await action(
        { id: "user-1", email: "surfer@example.com" },
        mockSupabase,
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({
    rpc: mockServiceRoleRpc,
  })),
}));

describe("joinAndroidWaitlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileUpdate.mockReturnValue({
      eq: mockProfileEq,
    });
    mockProfileEq.mockReturnValue({
      select: mockProfileSelect,
    });
    mockProfileSelect.mockReturnValue({
      maybeSingle: mockProfileMaybeSingle,
    });
    mockProfileMaybeSingle.mockResolvedValue({
      data: { id: "user-1" },
      error: null,
    });
    mockUserEventInsert.mockResolvedValue({ error: null });
    mockServiceRoleRpc.mockResolvedValue({
      data: "30000000-0000-4000-8000-000000000003",
      error: null,
    });
  });

  it("sets the Android waitlist profile flag and records a profile update event", async () => {
    const result = await joinAndroidWaitlist({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
    });

    expect(result.success).toBe(true);
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        wants_android_access: true,
        android_waitlist_source: "features-hero-android-waitlist",
        android_waitlist_surface: "features-page",
        android_waitlist_placement: "hero_secondary",
        android_waitlist_joined_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    expect(mockProfileEq).toHaveBeenCalledWith("id", "user-1");
    expect(mockProfileSelect).toHaveBeenCalledWith("id");
    expect(mockProfileMaybeSingle).toHaveBeenCalled();
    expect(mockServiceRoleRpc).toHaveBeenCalledWith(
      "resolve_android_waitlist_entry",
      expect.objectContaining({
        p_user_id: "user-1",
        p_normalized_email_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_roster_entry_id: null,
        p_source_kind: "profile_intent",
        p_source_id: "user-1",
        p_source: "features-hero-android-waitlist",
        p_surface: "features-page",
        p_placement: "hero_secondary",
      }),
    );
    expect(mockUserEventInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_type: "profile_update",
      metadata: expect.objectContaining({
        cta_family: "android_waitlist",
        destination_type: "profile_flag",
        platform: "android",
        profile_flag_set: true,
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/features");
    expect(revalidatePath).toHaveBeenCalledWith("/pbsc");
    expect(revalidatePath).toHaveBeenCalledWith("/plans");
    expect(revalidatePath).toHaveBeenCalledWith("/pricing");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("rejects invalid intent metadata before updating profiles", async () => {
    const result = await joinAndroidWaitlist({
      source: "",
      surface: "features-page",
      placement: "hero_secondary",
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid Android waitlist intent",
    });
    expect(mockProfileUpdate).not.toHaveBeenCalled();
    expect(mockUserEventInsert).not.toHaveBeenCalled();
  });

  it("fails when the profile flag cannot be saved", async () => {
    mockProfileUpdate.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "profile update failed" },
          }),
        }),
      }),
    });

    const result = await joinAndroidWaitlist({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("profile update failed");
    expect(mockUserEventInsert).not.toHaveBeenCalled();
  });

  it("fails when no profile row is updated", async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await joinAndroidWaitlist({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("No profile row was updated");
    expect(mockUserEventInsert).not.toHaveBeenCalled();
  });

  it("fails closed when the canonical waitlist resolver is unavailable", async () => {
    mockServiceRoleRpc.mockResolvedValue({
      data: null,
      error: { message: "resolver unavailable" },
    });

    const result = await joinAndroidWaitlist({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      "Canonical Android waitlist resolver unavailable",
    );
    expect(mockUserEventInsert).not.toHaveBeenCalled();
  });
});
