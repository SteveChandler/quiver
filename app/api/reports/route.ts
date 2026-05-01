import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  createErrorResponse,
  validateOrError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { parseAndValidateJson } from "@/lib/validation/middleware";

export const dynamic = "force-dynamic";

const ContentReportSchema = z.object({
  target_type: z.enum(["user", "session", "comment"]),
  target_id: z.string().uuid("Invalid target id"),
  reason: z.enum([
    "spam",
    "harassment",
    "hate_speech",
    "sexual_content",
    "violence",
    "self_harm",
    "misinformation",
    "ip_violation",
    "other",
  ]),
  details: z.string().trim().max(1000, "Details cannot exceed 1000 characters").optional(),
});

export const POST = withRateLimit(
  withAuth(
    async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
      const parseResult = await parseAndValidateJson(request);
      if ("error" in parseResult) return parseResult.error;

      const validation = validateOrError(ContentReportSchema, parseResult.data);
      if ("error" in validation) return validation.error;

      const { target_type, target_id, reason, details } = validation.data;

      let target_owner_id: string | null = null;
      if (target_type === "user") {
        // Confirm the target profile actually exists — without this, a
        // malicious or buggy client can spam content_reports with random
        // UUIDs forever and the moderation queue fills with junk.
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", target_id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return createErrorResponse("User not found", undefined, 404);
        target_owner_id = target_id;
      } else if (target_type === "session") {
        const { data, error } = await supabase
          .from("sessions")
          .select("user_id")
          .eq("id", target_id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return createErrorResponse("Session not found", undefined, 404);
        target_owner_id = data.user_id;
      } else if (target_type === "comment") {
        const { data, error } = await supabase
          .from("comments")
          .select("user_id")
          .eq("id", target_id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return createErrorResponse("Comment not found", undefined, 404);
        target_owner_id = data.user_id;
      }

      if (target_owner_id && target_owner_id === user.id) {
        return createErrorResponse("Cannot report your own content", undefined, 400);
      }

      const { data: inserted, error: insertError } = await supabase
        .from("content_reports")
        .insert({
          reporter_id: user.id,
          target_type,
          target_id,
          target_owner_id,
          reason,
          details: details ?? null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      return createSuccessResponse({ id: inserted.id, status: "pending" });
    },
    { errorMessage: "Failed to submit report" },
  ),
  { key: "authenticated-default" },
);
