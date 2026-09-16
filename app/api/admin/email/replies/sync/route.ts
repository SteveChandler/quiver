import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";
import { syncGmailReplies } from "@/lib/email/gmail-replies";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = withAdminAuth(async () => {
  try {
    return NextResponse.json(await syncGmailReplies(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    Sentry.captureException(error, { tags: { component: "gmail-reply-sync" } });
    return NextResponse.json({ error: "Reply sync failed. Review checkpoint and run records before resuming email." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}, { errorMessage: "Reply synchronization failed" });
