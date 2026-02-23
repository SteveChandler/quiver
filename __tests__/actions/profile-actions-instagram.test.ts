import { updateProfile } from "@/actions/profile-actions";

// Mock Next.js revalidation functions
jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// Mock server action utils to execute the callback with a fake user and supabase client
jest.mock("@/lib/server-action-utils", () => {
  const single = jest.fn().mockResolvedValue({ data: { id: "user-1", instagram: "newhandle" }, error: null });
  const select = jest.fn(() => ({ single }));
  const eq = jest.fn(() => ({ select }));
  const update = jest.fn((payload: any) => {
    // expose last payload for assertions
    // @ts-expect-error
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

describe("updateProfile instagram field handling", () => {
  it("passes instagram field directly to database", async () => {
    // Clear global payload
    // @ts-expect-error
    global.__lastUpdatePayload = undefined;

    const result = await updateProfile({ instagram: "newhandle" } as any);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.instagram).toBe("newhandle");

    // Assert that DB payload used 'instagram' field directly
    // @ts-expect-error
    const payload = global.__lastUpdatePayload;
    expect(payload).toBeTruthy();
    expect(payload.instagram).toBe("newhandle");
  });
});
