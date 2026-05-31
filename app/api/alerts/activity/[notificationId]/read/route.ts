import type { NextRequest } from "next/server";

import {
  createNotFoundError,
  createSuccessResponse,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALERT_TYPES = ["forecast_alert", "similarity_match"] as const;

interface AlertNotificationReadRow {
  id: string;
  type: (typeof ALERT_TYPES)[number];
  read_at: string | null;
}

export const POST = withAuth(
  async (
    _request: NextRequest,
    { params, user, supabase }: AuthenticatedContext,
  ) => {
    const notificationId = params.notificationId;
    const { data: notification, error } = await (supabase as any)
      .from("notifications")
      .select("id, type, read_at")
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .in("type", ALERT_TYPES)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!notification) {
      return createNotFoundError("Alert notification");
    }

    const row = notification as AlertNotificationReadRow;
    if (row.read_at) {
      return createSuccessResponse({ id: row.id, read_at: row.read_at });
    }

    const readAt = new Date().toISOString();
    const { data: updatedNotification, error: updateError } = await (
      supabase as any
    )
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", row.id)
      .eq("user_id", user.id)
      .in("type", ALERT_TYPES)
      .select("id, read_at")
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updatedNotification) {
      return createNotFoundError("Alert notification");
    }

    return createSuccessResponse(updatedNotification);
  },
  { errorMessage: "Failed to mark alert activity as read" },
);
