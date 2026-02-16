import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  validateUuidParam,
  createValidationError,
  createNotFoundError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { IntelReportSchema } from "@/lib/validation/schemas";
import { validateOrError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/intel/[id]/report
 * Report an intel post for review
 */
export const POST = withAuth(
  async (request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    // Validate UUID parameter
    const uuidResult = validateUuidParam(params.id, "intel");
    if ("error" in uuidResult) return uuidResult.error;
    const intelPostId = uuidResult.value;

    // Parse and validate request body (reason is optional)
    let reason: string | undefined;
    try {
      const parseResult = await parseAndValidateJson(request);
      if (!("error" in parseResult)) {
        const validationResult = validateOrError(IntelReportSchema, parseResult.data);
        if (!("error" in validationResult)) {
          reason = validationResult.data.reason;
        }
      }
    } catch {
      // Body parsing failed, continue without reason
    }

    // Check if intel post exists and is active
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id, is_active")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return createNotFoundError("Intel post");
    }

    // Prevent users from reporting their own posts
    if (intelPost.user_id === user.id) {
      return createValidationError("You cannot report your own post");
    }

    // Check if user has already reported this post
    // Note: intel_reports table created by migration 20260113145000
    // Using type assertion until types are regenerated after migration
    const { data: existingReport, error: checkError } = await (supabase as any)
      .from("intel_reports")
      .select("id")
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing report:", checkError);
      throw checkError;
    }

    if (existingReport) {
      return createValidationError("You have already reported this post");
    }

    // Create the report
    // Note: intel_reports table created by migration 20260113145000
    const { error: reportError } = await (supabase as any)
      .from("intel_reports")
      .insert({
        intel_post_id: intelPostId,
        user_id: user.id,
        reason,
      });

    if (reportError) {
      console.error("Error creating report:", reportError);
      throw reportError;
    }

    return createSuccessResponse({
      reported: true,
      message: "Thank you for your report. We'll review this post.",
    });
  },
  { errorMessage: "Failed to report intel post" }
);
