/**
 * Unit tests for email logging service
 * Tests centralized email logging functionality
 */

import {
  logEmailDelivery,
  type EmailType,
} from "@/lib/services/email-logging-service";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

// Mock Supabase client
const mockInsert = jest.fn();
const mockSupabase = {
  from: jest.fn(() => ({
    insert: mockInsert,
  })),
};

describe("logEmailDelivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  describe("logDelivery", () => {
    it("should log email delivery with required fields", async () => {
      const result = await logEmailDelivery(mockSupabase as any, {
        userId: "user-123",
        emailType: "welcome",
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("email_send_log");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          email_type: "welcome",
        })
      );
    });

    it("should log email delivery with all optional fields", async () => {
      const result = await logEmailDelivery(mockSupabase as any, {
        userId: "user-123",
        emailType: "reengagement",
        subject: "Great waves today!",
        localDate: "2024-01-15",
        sentAt: "2024-01-15T12:00:00.000Z",
        bestScore: 8.5,
        bestBeachId: "beach-456",
        messageInstanceId: "9d1498df-a14f-429a-833d-818bc4864064",
        meta: { beach_name: "Test Beach" },
      });

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-123",
        email_type: "reengagement",
        subject: "Great waves today!",
        local_date: "2024-01-15",
        sent_at: "2024-01-15T12:00:00.000Z",
        best_score: 8.5,
        best_beach_id: "beach-456",
        message_instance_id: "9d1498df-a14f-429a-833d-818bc4864064",
        meta: { beach_name: "Test Beach" },
        resend_message_id: null,
      });
    });

    it("should use current timestamp for missing sentAt", async () => {
      await logEmailDelivery(mockSupabase as any, {
        userId: "user-123",
        emailType: "weekly_recap",
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.sent_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it("should derive localDate from timestamp when not provided", async () => {
      await logEmailDelivery(mockSupabase as any, {
        userId: "user-123",
        emailType: "forecast_digest",
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should use null for missing optional fields", async () => {
      await logEmailDelivery(mockSupabase as any, {
        userId: "user-123",
        emailType: "welcome",
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.subject).toBeNull();
      expect(insertCall.best_score).toBeNull();
      expect(insertCall.best_beach_id).toBeNull();
      expect(insertCall.message_instance_id).toBeNull();
      expect(insertCall.meta).toEqual({});
    });

    it("should return error on database failure", async () => {
      const dbError = new Error("Database error");
      mockInsert.mockResolvedValue({ error: dbError });

      const result = await logEmailDelivery(mockSupabase as any, {
        userId: "user-123",
        emailType: "welcome",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(dbError);
      expectConsoleErrors([/\[condition-alert-deliver\]/]);
    });

  });

  it("accepts every supported email type", async () => {
    const validTypes: EmailType[] = ["welcome", "forecast_digest", "reengagement", "weekly_recap"];
    for (const emailType of validTypes) {
      await logEmailDelivery(mockSupabase as any, { userId: "user-1", emailType });
    }
    expect(mockInsert).toHaveBeenCalledTimes(4);
  });
});
