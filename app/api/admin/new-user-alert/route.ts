import { withAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { sendNewUserAlert } from "@/lib/services/new-user-alerts";

export const POST = withAuth(
  async (request, { user, supabase }) => {
    const body = await request.json();

    // Only fire for users created in the last 60 seconds
    const createdAt = new Date(user.created_at!).getTime();
    if (Date.now() - createdAt > 60_000) {
      return createSuccessResponse({ skipped: true });
    }

    // Get profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    await sendNewUserAlert({
      userId: user.id,
      email: user.email || "unknown",
      name: profile?.full_name || null,
      signupMethod: body.method || "unknown",
      device: body.device,
      viewportWidth: body.viewportWidth,
      entryPage: body.entryPage,
    });

    return createSuccessResponse({ ok: true });
  },
  { errorMessage: "Failed to send new user alert" },
);
