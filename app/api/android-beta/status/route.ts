import type { NextRequest } from "next/server";

import { normalizedEmailSha256 } from "@/lib/android-tester-roster/waitlist";
import {
  createSuccessResponse,
  withAuth,
  withNoStore,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const getStatus = withAuth(
  async (_request: NextRequest, { user }: AuthenticatedContext) => {
    const identityFilters = [`user_id.eq.${user.id}`];
    if (user.email) {
      identityFilters.push(
        `normalized_email_sha256.eq.${normalizedEmailSha256(user.email)}`,
      );
    }

    const serviceRole = await createSupabaseServiceRoleClient();
    const { data, error } = await serviceRole
      .from("android_waitlist_entries")
      .select("id")
      .or(identityFilters.join(","))
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error("Failed to load Android waitlist status");
    }

    return createSuccessResponse({ hasJoinedAndroidWaitlist: Boolean(data) });
  },
  { errorMessage: "Failed to load Android waitlist status" },
);

export const GET = withNoStore(getStatus);
