import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
  createValidationError,
  createNotFoundError,
  withNoStore,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";
import {
  alertEmailEarliestSchema,
  DEFAULT_ALERT_EMAIL_EARLIEST,
  isMissingAlertEmailEarliestColumn,
} from "@/lib/profile/alert-email-earliest";

export const dynamic = "force-dynamic";

type Client = AuthenticatedContext["supabase"];
// The column is newer than database.generated.ts; this is the only place that names it.
const profiles = (supabase: Client) => (supabase as unknown as {
  from: (table: "profiles") => {
    select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { alert_email_earliest?: string } | null; error: unknown }> } };
    update: (values: Record<string, string>) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => PromiseLike<{ data: { alert_email_earliest?: string } | null; error: unknown }> } } };
  };
}).from("profiles");

/**
 * GET /api/profile/alert-email-earliest
 * `supported: false` means the column is not in this database yet; the page hides the setting.
 */
const handleGet = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { data, error } = await profiles(supabase).select("alert_email_earliest").eq("id", user.id).maybeSingle();
    if (error) {
      if (isMissingAlertEmailEarliestColumn(error)) {
        return createSuccessResponse({ earliest: DEFAULT_ALERT_EMAIL_EARLIEST, supported: false });
      }
      throw error;
    }
    const parsed = alertEmailEarliestSchema.safeParse(data?.alert_email_earliest);
    return createSuccessResponse({ earliest: parsed.success ? parsed.data : DEFAULT_ALERT_EMAIL_EARLIEST, supported: true });
  },
  { errorMessage: "Failed to load alert email setting" },
);

/** PATCH /api/profile/alert-email-earliest { earliest: "05:00" | "06:00" | "07:00" | "09:00" } */
const handlePatch = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const body = await request.json().catch(() => null);
    const parsed = alertEmailEarliestSchema.safeParse((body as { earliest?: unknown } | null)?.earliest);
    if (!parsed.success) return createValidationError("earliest must be 05:00, 06:00, 07:00 or 09:00");
    const { data, error } = await profiles(supabase)
      .update({ alert_email_earliest: parsed.data })
      .eq("id", user.id)
      .select("alert_email_earliest")
      .single();
    if (error) {
      if (isMissingAlertEmailEarliestColumn(error)) {
        return createErrorResponse("Alert email setting is not available yet", { code: "not_available" }, 503);
      }
      // .single() on zero updated rows: the signed-in user has no profile row.
      if ((error as { code?: unknown }).code === "PGRST116") return createNotFoundError("Profile not found");
      throw error;
    }
    return createSuccessResponse({ earliest: data?.alert_email_earliest ?? parsed.data, supported: true });
  },
  { errorMessage: "Failed to save alert email setting" },
);

// Per-user state and a mutation: never cached.
export const GET = withErrorNoStore(withNoStore(handleGet), "/api/profile/alert-email-earliest");
export const PATCH = withErrorNoStore(withNoStore(handlePatch), "/api/profile/alert-email-earliest");
