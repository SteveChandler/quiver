/**
 * Unit tests for email logging service
 * Tests centralized email logging functionality
 */

import {
  EmailLoggingService,
  createEmailLogger,
  type EmailType,
  type EmailLogEntry,
} from "@/lib/services/email-logging-service";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

// Mock Supabase client
const mockInsert = jest.fn();
const mockSupabase = {
  from: jest.fn(() => ({
    insert: mockInsert,
  })),
};

describe("EmailLoggingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  describe("logDelivery", () => {
    it("should log email delivery with required fields", async () => {
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      const result = await logger.logDelivery({
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
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      const result = await logger.logDelivery({
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
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      await logger.logDelivery({
        userId: "user-123",
        emailType: "weekly_recap",
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.sent_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it("should derive localDate from timestamp when not provided", async () => {
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      await logger.logDelivery({
        userId: "user-123",
        emailType: "forecast_digest",
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should use null for missing optional fields", async () => {
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      await logger.logDelivery({
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

      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      const result = await logger.logDelivery({
        userId: "user-123",
        emailType: "welcome",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(dbError);
      expectConsoleErrors([/\[test-email\]/]);
    });

    it("should include context tag in error messages", async () => {
      mockInsert.mockResolvedValue({ error: new Error("Test error") });

      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[custom-context]"
      );

      await logger.logDelivery({
        userId: "user-123",
        emailType: "welcome",
      });

      expect(mockInsert).toHaveBeenCalled();
      expectConsoleErrors([/\[custom-context\]/]);
    });
  });

  describe("logBatch", () => {
    it("should return success for empty batch", async () => {
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      const result = await logger.logBatch([]);

      expect(result.success).toBe(true);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should log multiple entries in batch", async () => {
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      const entries: EmailLogEntry[] = [
        { userId: "user-1", emailType: "welcome" },
        { userId: "user-2", emailType: "reengagement", subject: "Test" },
        { userId: "user-3", emailType: "weekly_recap" },
      ];

      const result = await logger.logBatch(entries);

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: "user-1", email_type: "welcome" }),
          expect.objectContaining({
            user_id: "user-2",
            email_type: "reengagement",
            subject: "Test",
          }),
          expect.objectContaining({
            user_id: "user-3",
            email_type: "weekly_recap",
          }),
        ])
      );
    });

    it("should use same timestamp for all entries in batch", async () => {
      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      const entries: EmailLogEntry[] = [
        { userId: "user-1", emailType: "welcome" },
        { userId: "user-2", emailType: "welcome" },
      ];

      await logger.logBatch(entries);

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall[0].sent_at).toBe(insertCall[1].sent_at);
      expect(insertCall[0].local_date).toBe(insertCall[1].local_date);
    });

    it("should return error on batch insert failure", async () => {
      const dbError = new Error("Batch insert failed");
      mockInsert.mockResolvedValue({ error: dbError });

      const logger = new EmailLoggingService(
        mockSupabase as any,
        "[test-email]"
      );

      const result = await logger.logBatch([
        { userId: "user-1", emailType: "welcome" },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBe(dbError);
    });
  });

  describe("createEmailLogger factory", () => {
    it("should create an EmailLoggingService instance", () => {
      const logger = createEmailLogger(mockSupabase as any, "[factory-test]");

      expect(logger).toBeInstanceOf(EmailLoggingService);
    });

    it("should pass context tag to the service", async () => {
      mockInsert.mockResolvedValue({ error: new Error("Test") });

      const logger = createEmailLogger(mockSupabase as any, "[factory-tag]");
      await logger.logDelivery({ userId: "user-1", emailType: "welcome" });

      expect(mockInsert).toHaveBeenCalled();
      expectConsoleErrors([/\[factory-tag\]/]);
    });
  });

  describe("EmailType type", () => {
    it("should accept valid email types", async () => {
      const logger = createEmailLogger(mockSupabase as any, "[type-test]");

      const validTypes: EmailType[] = [
        "welcome",
        "forecast_digest",
        "reengagement",
        "weekly_recap",
      ];

      for (const emailType of validTypes) {
        await logger.logDelivery({ userId: "user-1", emailType });
      }

      expect(mockInsert).toHaveBeenCalledTimes(4);
    });
  });
});
