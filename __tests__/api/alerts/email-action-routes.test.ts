/** @jest-environment node */

const mockVerifyDisableToken = jest.fn();
const mockVerifyEmailUnsubscribeToken = jest.fn();
const mockUpdates: Array<{ table: string; values: unknown; column: string; value: string }> = [];

jest.mock("@/lib/alerts/email-token", () => ({
  verifyDisableToken: (...args: unknown[]) => mockVerifyDisableToken(...args),
  verifyEmailUnsubscribeToken: (...args: unknown[]) => mockVerifyEmailUnsubscribeToken(...args),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      from: (table: string) => ({
        update: (values: unknown) => ({
          eq: (column: string, value: string) => {
            mockUpdates.push({ table, values, column, value });
            return Promise.resolve({ error: null });
          },
        }),
      }),
    })
  ),
}));

describe("alert email action routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdates.length = 0;
  });

  it("allows GET disable-email links from email clients", async () => {
    mockVerifyDisableToken.mockReturnValue(true);
    const { GET } = await import("@/app/api/alerts/rules/[ruleId]/disable-email/route");

    const response = await GET(
      new Request("https://www.quiversurf.app/api/alerts/rules/rule-1/disable-email?token=good"),
      { params: Promise.resolve({ ruleId: "rule-1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Alert Email Disabled");
    expect(mockUpdates).toEqual([
      {
        table: "alert_rules",
        values: { notify_email: false },
        column: "id",
        value: "rule-1",
      },
    ]);
  });

  it("rejects invalid disable-email tokens without touching the database", async () => {
    mockVerifyDisableToken.mockReturnValue(false);
    const { GET } = await import("@/app/api/alerts/rules/[ruleId]/disable-email/route");

    const response = await GET(
      new Request("https://www.quiversurf.app/api/alerts/rules/rule-1/disable-email?token=bad"),
      { params: Promise.resolve({ ruleId: "rule-1" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Invalid Link");
    expect(mockUpdates).toHaveLength(0);
  });

  it("unsubscribes alert email recipients without requiring a web session", async () => {
    mockVerifyEmailUnsubscribeToken.mockReturnValue(true);
    const { GET } = await import("@/app/api/alerts/unsubscribe-email/route");

    const response = await GET(
      new Request("https://www.quiversurf.app/api/alerts/unsubscribe-email?user_id=user-1&token=good")
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Email Notifications Off");
    expect(mockUpdates).toEqual([
      {
        table: "profiles",
        values: { notif_email_enabled: false },
        column: "id",
        value: "user-1",
      },
    ]);
  });
});
