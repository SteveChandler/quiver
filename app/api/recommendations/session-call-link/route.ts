import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withNoStore,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

const SessionCallLinkSchema = z.object({
  sessionId: z.string().uuid(),
  callId: z.string().trim().min(1).max(128),
});

type SessionCallLinkClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          is: (column: string, value: null) => PromiseLike<{
            data: { id: string; call_id: string | null } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          is: (column: string, value: null) => PromiseLike<{
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

export const POST = withNoStore(
  withRateLimit(
    withAuth(async (request: NextRequest, { user, supabase }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" },
          { status: 400 },
        );
      }

      const parsed = SessionCallLinkSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Invalid session call link" },
          { status: 400 },
        );
      }

      const db = supabase as unknown as SessionCallLinkClient;
      const { sessionId, callId } = parsed.data;
      const { data: session, error: sessionError } = await db
        .from("sessions")
        .select("id,call_id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (sessionError) {
        return NextResponse.json(
          { success: false, error: sessionError.message },
          { status: 500 },
        );
      }

      if (!session) {
        return NextResponse.json(
          { success: false, error: "Session not found" },
          { status: 404 },
        );
      }

      if (session.call_id !== null && session.call_id !== callId) {
        return NextResponse.json(
          { success: false, error: "Session already linked to another call" },
          { status: 409 },
        );
      }

      if (session.call_id === null) {
        const { error: updateError } = await db
          .from("sessions")
          .update({ call_id: callId })
          .eq("id", sessionId)
          .eq("user_id", user.id)
          .is("call_id", null);

        if (updateError) {
          return NextResponse.json(
            { success: false, error: updateError.message },
            { status: 500 },
          );
        }
      }

      return NextResponse.json({
        success: true,
        data: { sessionId, callId, linked: true },
      });
    }, { errorMessage: "Failed to link session to call" }),
    "authenticated-default",
  ),
);
