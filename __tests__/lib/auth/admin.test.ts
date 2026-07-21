import { ADMIN_USER_IDS, isAdmin, type AdminUser } from "@/lib/auth/admin";

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    aud: "authenticated",
    role: "authenticated",
    email: "surfer@example.com",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as AdminUser;
}

describe("admin authorization", () => {
  it.each([
    ["is_admin", { is_admin: true }],
    ["role", { role: "admin" }],
  ])("rejects user-owned %s metadata", (_claim, userMetadata) => {
    expect(isAdmin(user({ user_metadata: userMetadata }))).toBe(false);
  });

  it.each([
    ["is_admin", { is_admin: true }],
    ["role", { role: "admin" }],
  ])("accepts server-owned %s metadata", (_claim, appMetadata) => {
    expect(isAdmin(user({ app_metadata: appMetadata }))).toBe(true);
  });

  it("accepts the canonical admin ID without metadata", () => {
    expect(isAdmin(user({ id: ADMIN_USER_IDS[0] }))).toBe(true);
  });
});
