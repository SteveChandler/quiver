/**
 * @jest-environment node
 */

import { normalizedEmailSha256 } from "@/lib/android-tester-roster/waitlist";

const mockSelect = jest.fn();
const mockOr = jest.fn();
const mockLimit = jest.fn();
const mockMaybeSingle = jest.fn();
const mockFrom = jest.fn(() => ({ select: mockSelect }));
let mockAuthUser = {
  id: "20000000-0000-4000-8000-000000000002",
  email: "SURFER@example.com",
};

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any) => (request: any) =>
      handler(request, { user: mockAuthUser }),
  };
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe("GET /api/android-beta/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = {
      id: "20000000-0000-4000-8000-000000000002",
      email: "SURFER@example.com",
    };
    mockSelect.mockReturnValue({ or: mockOr });
    mockOr.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({
      data: { id: "30000000-0000-4000-8000-000000000003" },
      error: null,
    });
  });

  it("checks the canonical entry by user ID or normalized email hash", async () => {
    const { GET } = await import("@/app/api/android-beta/status/route");

    const response = await GET(new Request("http://localhost/api/android-beta/status") as any);

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { hasJoinedAndroidWaitlist: true },
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, no-cache, must-revalidate",
    );
    expect(mockFrom).toHaveBeenCalledWith("android_waitlist_entries");
    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockOr).toHaveBeenCalledWith(
      `user_id.eq.${mockAuthUser.id},normalized_email_sha256.eq.${normalizedEmailSha256(mockAuthUser.email)}`,
    );
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockMaybeSingle).toHaveBeenCalled();
  });

  it("returns false when no canonical entry matches", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { GET } = await import("@/app/api/android-beta/status/route");

    const response = await GET(new Request("http://localhost/api/android-beta/status") as any);

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { hasJoinedAndroidWaitlist: false },
    });
  });
});
