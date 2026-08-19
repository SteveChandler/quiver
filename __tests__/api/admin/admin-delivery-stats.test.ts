/**
 * @jest-environment node
 */

import { GET } from "@/app/api/admin/delivery-stats/route";
import {
  createMockAdminUser,
  createMockRequest,
  setupApiTestEnvironment,
  mockEnvVars,
} from "@/test-utils/api-test-helpers";

// Mock the admin authentication
jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

// Mock Supabase service role client
const mockSupabaseClient = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseClient),
}));

// Mock aggregation utilities
jest.mock("@/lib/utils/aggregation-utils", () => ({
  aggregateByKey: jest.fn((items, keyExtractor) => {
    if (!items) return {};
    return items.reduce((acc: Record<string, number>, item: any) => {
      const key = keyExtractor(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }),
  sumByField: jest.fn((items, valueExtractor) => {
    if (!items) return 0;
    return items.reduce((sum: number, item: any) => {
      const value = valueExtractor(item);
      return sum + (value || 0);
    }, 0);
  }),
}));

// Get access to the mocked functions
const mockAuthenticateAdmin = require("@/lib/auth/admin").authenticateAdmin;

// Helper to create a mock query chain
function createMockQueryChain(data: any, error: any = null) {
  const chain = {
    select: jest.fn(),
    gte: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    data,
    error,
    count: typeof data === "number" ? data : null,
  };

  // Make methods chainable
  chain.select.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);

  return Promise.resolve(chain);
}

function createFilterResult(result: { data: unknown; error: unknown; count: number | null }) {
  const terminal = Promise.resolve(result) as Promise<typeof result> & {
    is: jest.Mock;
    not: jest.Mock;
  };
  terminal.is = jest.fn().mockReturnValue(terminal);
  terminal.not = jest.fn().mockReturnValue(terminal);
  return terminal;
}

describe("/api/admin/delivery-stats", () => {
  let cleanup: () => void;
  let restoreEnv: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;

    restoreEnv = mockEnvVars({
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    });

    jest.clearAllMocks();

    // Default mock implementation for from()
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue(createFilterResult({ data: [], error: null, count: 0 })),
        not: jest.fn().mockReturnValue(createFilterResult({ data: [], error: null, count: 0 })),
        gte: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    cleanup?.();
    restoreEnv?.();
  });

  describe("GET - Delivery Statistics", () => {
    it("requires admin authentication", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("returns delivery statistics successfully", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock digest runs data
      const digestRunsData = [
        {
          id: "run-1",
          run_started_at: new Date().toISOString(),
          emails_sent: 100,
          emails_sent_quick: 50,
          push_sent: 80,
          push_failed: 5,
        },
        {
          id: "run-2",
          run_started_at: new Date(Date.now() - 86400000).toISOString(),
          emails_sent: 90,
          emails_sent_quick: 45,
          push_sent: 70,
          push_failed: 3,
        },
      ];

      // Mock email logs data
      const emailLogsData = [
        { email_type: "digest", local_date: "2024-01-01" },
        { email_type: "digest", local_date: "2024-01-01" },
        { email_type: "invite", local_date: "2024-01-02" },
      ];

      // Mock push logs data
      const pushLogsData = [
        {
          notification_type: "digest",
          status: "sent",
          sent_at: new Date().toISOString(),
        },
        {
          notification_type: "invite",
          status: "sent",
          sent_at: new Date().toISOString(),
        },
        {
          notification_type: "digest",
          status: "failed",
          sent_at: new Date().toISOString(),
        },
      ];

      // Mock device count data
      const deviceCountData = [
        { platform: "ios", installation_id: "install-1" },
        { platform: "ios", installation_id: null },
        { platform: "android", installation_id: "install-2" },
      ];
      const digestSelect = jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockResolvedValue({ data: digestRunsData, error: null }),
          }),
        }),
      });

      // Mock the parallel queries
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: digestSelect,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest
              .fn()
              .mockResolvedValue({ data: emailLogsData, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: pushLogsData, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(
              createFilterResult({ data: deviceCountData, error: null, count: 3 })
            ),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(
              createFilterResult({ data: null, error: null, count: 1 })
            ),
          }),
        });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("period");
      expect(data.data).toHaveProperty("digestRuns");
      expect(data.data).toHaveProperty("emails");
      expect(data.data).toHaveProperty("pushNotifications");
      expect(data.data).toHaveProperty("devices");
      expect(data.data).toHaveProperty("generatedAt");

      // Verify period
      expect(data.data.period.days).toBe(7); // Default days
      expect(data.data.period.since).toEqual(expect.any(String));

      // Verify digest runs
      expect(data.data.digestRuns.total).toBe(2);
      expect(data.data.digestRuns.recent).toHaveLength(2);
      expect(data.data.digestRuns.totals).toHaveProperty("emailsSent");
      expect(data.data.digestRuns.totals).toHaveProperty("pushSent");
      expect(digestSelect).toHaveBeenCalledWith(
        "id, run_started_at, run_completed_at, status, duration_ms, eligible_users, emails_sent, emails_sent_quick, push_sent, push_failed, push_no_tokens"
      );

      // Verify emails
      expect(data.data.emails.total).toBe(3);
      expect(data.data.emails.byType).toEqual({ digest: 2, invite: 1 });
      expect(data.data.emails.byDate).toEqual({
        "2024-01-01": 2,
        "2024-01-02": 1,
      });

      // Verify push notifications
      expect(data.data.pushNotifications.total).toBe(3);
      expect(data.data.pushNotifications.byStatus).toEqual({
        failed: 1,
        sent: 2,
      });
      expect(data.data.pushNotifications.byType).toEqual({
        digest: 2,
        invite: 1,
      });

      // Verify devices
      expect(data.data.devices.total).toBe(3);
      expect(data.data.devices.byPlatform).toEqual({ android: 1, ios: 2 });
      expect(data.data.devices.activeIdentified).toBe(2);
      expect(data.data.devices.activeLegacy).toBe(1);
      expect(data.data.devices.identifiedAdoptionPercentage).toBe(66.67);
    });

    it("fails closed when the active legacy count query errors", async () => {
      const adminUser = createMockAdminUser();
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(
              createFilterResult({ data: [], error: null, count: 5 }),
            ),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(
              createFilterResult({
                data: null,
                error: { message: "legacy count unavailable" },
                count: null,
              }),
            ),
          }),
        });

      const response = await GET(
        createMockRequest("GET", "http://localhost:3000/api/admin/delivery-stats"),
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to fetch delivery statistics");
      expect(data.data?.devices?.identifiedAdoptionPercentage).toBeUndefined();
    });

    it("accepts custom days parameter", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock empty data for simplicity
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue(
            createFilterResult({ data: [], error: null, count: 0 }),
          ),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats?days=14"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.period.days).toBe(14);
    });

    it("enforces maximum days limit (30)", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock empty data
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue(
            createFilterResult({ data: [], error: null, count: 0 }),
          ),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats?days=100"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.period.days).toBe(30); // Should be clamped to max
    });

    it("enforces minimum days limit (1)", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock empty data
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue(
            createFilterResult({ data: [], error: null, count: 0 }),
          ),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats?days=0"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.period.days).toBe(1); // Should be clamped to min
    });

    it("handles invalid days parameter gracefully", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock empty data
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue(
            createFilterResult({ data: [], error: null, count: 0 }),
          ),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats?days=invalid"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.period.days).toBe(7); // Should fall back to default
    });

    it("handles database query errors gracefully", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock database error
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to fetch delivery statistics");
    });

    it("handles authentication exceptions", async () => {
      mockAuthenticateAdmin.mockRejectedValue(
        new Error("Auth service unavailable")
      );

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toEqual(expect.any(String));
    });

    it("returns empty stats when no data is available", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock empty data for all queries
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue(createFilterResult({ data: [], error: null, count: 0 })),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.digestRuns.total).toBe(0);
      expect(data.data.emails.total).toBe(0);
      expect(data.data.pushNotifications.total).toBe(0);
    });

    it("correctly aggregates email types", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const emailLogsData = [
        { email_type: "digest", local_date: "2024-01-01" },
        { email_type: "digest", local_date: "2024-01-01" },
        { email_type: "invite", local_date: "2024-01-02" },
        { email_type: "invite", local_date: "2024-01-02" },
        { email_type: "invite", local_date: "2024-01-02" },
      ];

      // Mock specific email logs query
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest
              .fn()
              .mockResolvedValue({ data: emailLogsData, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(createFilterResult({ data: [], error: null, count: 0 })),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(createFilterResult({ data: null, error: null, count: 0 })),
          }),
        });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.emails.total).toBe(5);
      expect(data.data.emails.byType).toEqual({ digest: 2, invite: 3 });
    });

    it("correctly sums digest run totals", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const digestRunsData = [
        {
          emails_sent: 100,
          emails_sent_quick: 50,
          push_sent: 80,
          push_failed: 5,
        },
        {
          emails_sent: 90,
          emails_sent_quick: 45,
          push_sent: 70,
          push_failed: 3,
        },
      ];

      // Mock specific digest runs query
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest
                  .fn()
                  .mockResolvedValue({ data: digestRunsData, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(createFilterResult({ data: [], error: null, count: 0 })),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(createFilterResult({ data: null, error: null, count: 0 })),
          }),
        });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.digestRuns.totals).toHaveProperty("emailsSent");
      expect(data.data.digestRuns.totals).toHaveProperty("pushSent");
      expect(data.data.digestRuns.totals).toHaveProperty("pushFailed");
    });

    it("limits recent digest runs to MAX_RECENT_RUNS", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Create 15 digest runs
      const digestRunsData = Array.from({ length: 15 }, (_, i) => ({
        id: `run-${i}`,
        run_started_at: new Date(
          Date.now() - i * 86400000
        ).toISOString(),
        emails_sent: 100,
        emails_sent_quick: 50,
        push_sent: 80,
        push_failed: 5,
      }));

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest
                  .fn()
                  .mockResolvedValue({ data: digestRunsData, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(createFilterResult({ data: [], error: null, count: 0 })),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(createFilterResult({ data: null, error: null, count: 0 })),
          }),
        });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.digestRuns.total).toBe(15);
      expect(data.data.digestRuns.recent.length).toBeLessThanOrEqual(10); // MAX_RECENT_RUNS
    });
  });

  describe("Security", () => {
    it("rejects non-admin users", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");

      // Verify database was not queried
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("does not expose sensitive user data in statistics", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      // Mock empty data
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue(createFilterResult({ data: [], error: null, count: 0 })),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/delivery-stats"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify no sensitive data in response
      const responseStr = JSON.stringify(data);
      expect(responseStr).not.toMatch(/password/i);
      expect(responseStr).not.toMatch(/token/i);
      expect(responseStr).not.toMatch(/secret/i);
    });
  });
});
