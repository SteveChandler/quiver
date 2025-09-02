import { updateProfile } from "@/actions/profile-actions";

// Mock Next.js revalidation functions
jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// Mock server action utils to execute the callback with a fake user and supabase client
jest.mock("@/lib/server-action-utils", () => {
  const single = jest.fn().mockResolvedValue({ 
    data: { 
      id: "user-1", 
      full_name: "Test User",
      avatar_url: null 
    }, 
    error: null 
  });
  const select = jest.fn(() => ({ single }));
  const eq = jest.fn(() => ({ select }));
  const update = jest.fn((payload: any) => {
    // expose last payload for assertions
    // @ts-ignore
    global.__lastUpdatePayload = payload;
    return { eq } as any;
  });
  const from = jest.fn(() => ({ update }));

  const fakeSupabase = { from } as any;
  const fakeUser = { id: "user-1" } as any;

  return {
    withAuthenticatedAction: (fn: any) => fn(fakeUser, fakeSupabase).then((data: any) => ({ success: true, data })),
  };
});

describe("updateProfile avatar_url validation", () => {
  beforeEach(() => {
    // Clear global payload before each test
    // @ts-ignore
    global.__lastUpdatePayload = undefined;
  });

  it("should succeed when empty string is passed for avatar_url (after fix)", async () => {
    const profileData = {
      full_name: "Test User",
      avatar_url: "" // Empty string should now be treated as unset
    };

    const result = await updateProfile(profileData as any);
    
    // After fix, empty strings should succeed
    expect(result.success).toBe(true);
    
    // And the payload should not include avatar_url field (it's omitted)
    // @ts-ignore
    const payload = global.__lastUpdatePayload;
    expect(payload.avatar_url).toBe(undefined);
  });

  it("should succeed when valid URL is passed for avatar_url", async () => {
    const profileData = {
      full_name: "Test User",
      avatar_url: "https://example.com/avatar.jpg"
    };

    const result = await updateProfile(profileData as any);
    
    expect(result.success).toBe(true);
    
    // @ts-ignore
    const payload = global.__lastUpdatePayload;
    expect(payload.avatar_url).toBe("https://example.com/avatar.jpg");
  });

  it("should succeed when null is passed for avatar_url", async () => {
    const profileData = {
      full_name: "Test User",
      avatar_url: null
    };

    const result = await updateProfile(profileData as any);
    
    expect(result.success).toBe(true);
    
    // @ts-ignore
    const payload = global.__lastUpdatePayload;
    expect(payload.avatar_url).toBe(null);
  });

  it("should succeed when undefined is passed for avatar_url", async () => {
    const profileData = {
      full_name: "Test User",
      avatar_url: undefined
    };

    const result = await updateProfile(profileData as any);
    
    expect(result.success).toBe(true);
    
    // @ts-ignore
    const payload = global.__lastUpdatePayload;
    expect(payload.avatar_url).toBe(undefined);
  });

  it("should succeed when avatar_url field is omitted", async () => {
    const profileData = {
      full_name: "Test User"
      // avatar_url field omitted entirely
    };

    const result = await updateProfile(profileData as any);
    
    expect(result.success).toBe(true);
    
    // @ts-ignore
    const payload = global.__lastUpdatePayload;
    expect(payload.avatar_url).toBe(undefined);
  });
});

describe("updateProfile empty string handling", () => {
  beforeEach(() => {
    // @ts-ignore
    global.__lastUpdatePayload = undefined;
  });

  it("should treat empty string avatar_url as unset after fix", async () => {
    const profileData = {
      full_name: "Test User",
      avatar_url: "" // Empty string should be treated as unset
    };

    const result = await updateProfile(profileData as any);
    
    // After fix, this should succeed
    expect(result.success).toBe(true);
    
    // And the payload should not include avatar_url field
    // @ts-ignore
    const payload = global.__lastUpdatePayload;
    expect(payload.avatar_url).toBe(undefined);
  });

  it("should handle multiple empty string fields correctly", async () => {
    const profileData = {
      full_name: "Test User",
      avatar_url: "",
      bio: "",
      location: "",
      instagram: ""
    };

    const result = await updateProfile(profileData as any);
    
    expect(result.success).toBe(true);
    
    // @ts-ignore
    const payload = global.__lastUpdatePayload;
    
    // avatar_url should be omitted when empty
    expect(payload.avatar_url).toBe(undefined);
    
    // Other empty string fields should be preserved as empty strings
    expect(payload.bio).toBe("");
    expect(payload.location).toBe("");
    expect(payload.instagram).toBe("");
  });
});