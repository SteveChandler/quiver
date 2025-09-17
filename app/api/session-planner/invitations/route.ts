import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-response-utils";
import { notifySessionInvite } from "@/lib/notifications";
import { sendSessionInviteEmail } from "@/lib/mailer/sessionInviteEmail";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dev-only verbose logging helper
const DEBUG_INVITES =
  process.env.NODE_ENV !== "production" &&
  (process.env.DEBUG_INVITES === "1" || process.env.DEBUG_INVITES === "true" ||
    process.env.DEBUG_INVITES === undefined);
const debug = (...args: any[]) => {
  if (DEBUG_INVITES) {
    // eslint-disable-next-line no-console
    console.log("[INVITES]", ...args);
  }
};

interface SessionInvitation {
  id: string;
  sessionId: string;
  inviterId: string;
  inviteeId?: string;
  inviteeEmail?: string;
  status: "pending" | "accepted" | "declined";
  message?: string;
  createdAt: string;
}

interface InvitationRequest {
  sessionId: string;
  invitees: Array<{
    userId?: string;
    email?: string;
    name?: string;
  }>;
  message?: string;
}

interface InvitationResponse {
  sessionId: string;
  invitationsSent: number;
  invitations: SessionInvitation[];
  errors: string[];
}

/**
 * Send session invitations to friends
 * POST /api/session-planner/invitations
 */
export async function POST(request: NextRequest) {
  try {
    const body: InvitationRequest = await request.json();
    const { sessionId, invitees, message } = body;
    const idempotencyKey = request.headers.get("Idempotency-Key");
    let emailAttempted = false;

    debug("POST /invitations body", {
      sessionId,
      inviteesCount: Array.isArray(invitees) ? invitees.length : 0,
      messagePresent: Boolean(message && message.length > 0),
      idempotencyKey: Boolean(idempotencyKey),
    });

    if (!sessionId || !invitees || invitees.length === 0) {
      return createErrorResponse(
        "Session ID and invitees are required",
        null,
        400
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse("Authentication required", null, 401);
    }

    debug("Authenticated user", { userId: user.id });

    // Verify the user owns the session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return createErrorResponse(
        "Session not found or access denied",
        null,
        404
      );
    }

    // Ensure session is planned (not completed)
    if (session.status !== "planned") {
      return createErrorResponse(
        "Can only invite friends to planned sessions",
        null,
        400
      );
    }

    debug("Session verified", {
      sessionId: session.id,
      beach: session.beach_name,
      status: session.status,
    });

    const invitations: SessionInvitation[] = [];
    const errors: string[] = [];
    let invitationsSent = 0;
    // Lazy import XP tracker to avoid module cost when not needed
    const trackInviteXP = async (inviteId: string) => {
      try {
        const { trackXP } = await import("@/lib/gamification-actions");
        await trackXP("invite_friend", inviteId, "invite");
      } catch (err) {
        console.warn("XP tracking failed for invite:", err);
      }
    };

    // Process each invitee
    debug("Processing invitees", Array.isArray(invitees) ? invitees.length : 0);
    for (const invitee of invitees) {
      try {
        let inviteeUserId: string | null = null;

        if (invitee.userId) {
          // Direct user ID invitation
          inviteeUserId = invitee.userId;
        } else if (invitee.email) {
          // Email invitation - check if user exists
          const { data: existingUser } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", invitee.email)
            .single();

          if (existingUser) {
            inviteeUserId = existingUser.id;
          }
        }

        debug("Resolved invitee", {
          providedUserId: Boolean(invitee.userId),
          providedEmail: Boolean(invitee.email),
          resolvedUserId: inviteeUserId || null,
        });

        // Check for existing invitation (per-invitee uniqueness)
        const { data: existingInvitation } = await supabase
          .from("session_invitations")
          .select("id")
          .eq("session_id", sessionId)
          .eq(
            inviteeUserId ? "invitee_id" : "invitee_email",
            inviteeUserId || invitee.email
          )
          .single();

        if (existingInvitation) {
          errors.push(
            `Invitation already sent to ${
              invitee.email || invitee.name || "user"
            }`
          );
          debug("Duplicate invitation detected, skipping", {
            sessionId,
            inviteeUserId: inviteeUserId || null,
            inviteeEmail: invitee.email || null,
          });
          continue;
        }

        // Create invitation record
        const perInviteeIdempKey = idempotencyKey
          ? `${idempotencyKey}:${inviteeUserId || invitee.email || "unknown"}`
          : null;

        const invitationData = {
          session_id: sessionId,
          inviter_id: user.id,
          invitee_id: inviteeUserId,
          invitee_email: invitee.email,
          status: "pending" as const,
          message: message || null,
          created_at: new Date().toISOString(),
          idempotency_key: perInviteeIdempKey,
        };

        const { data: newInvitation, error: invitationError } = await supabase
          .from("session_invitations")
          .insert(invitationData)
          .select()
          .single();

        if (invitationError) {
          // Unique violation: treat as already had
          if ((invitationError as any).code === "23505") {
            errors.push(
              `Invitation already exists for ${
                invitee.email || invitee.name || "user"
              }`
            );
            debug("Unique violation on insert - treated as duplicate", {
              sessionId,
              inviteeUserId: inviteeUserId || null,
              inviteeEmail: invitee.email || null,
            });
            continue;
          } else {
            errors.push(
              `Failed to invite ${invitee.email || invitee.name || "user"}: ${
                invitationError.message
              }`
            );
            debug("Insert error", invitationError);
            continue;
          }
        }

        debug("Invitation inserted", {
          id: newInvitation.id,
          inviteeId: newInvitation.invitee_id,
          inviteeEmail: newInvitation.invitee_email ? "<redacted>" : null,
        });

        invitations.push({
          id: newInvitation.id,
          sessionId: newInvitation.session_id,
          inviterId: newInvitation.inviter_id,
          inviteeId: newInvitation.invitee_id,
          inviteeEmail: newInvitation.invitee_email,
          status: newInvitation.status,
          message: newInvitation.message,
          createdAt: newInvitation.created_at,
        });

        invitationsSent++;

        // Track XP for each friend invited
        trackInviteXP(newInvitation.id);

        // In-app activity + email only for plan-session tagging flow and per invitee prefs
        try {
          let activityId: string | undefined;

          if (inviteeUserId) {
            const { data: prefs } = await supabase
              .from("profiles")
              .select("email, email_session_invites, inapp_session_invites")
              .eq("id", inviteeUserId)
              .single();

            if (prefs?.inapp_session_invites !== false) {
              activityId = await notifySessionInvite({
                actorId: user.id,
                recipientId: inviteeUserId,
                sessionId: sessionId,
                metadata: {
                  beachName: session.beach_name,
                  when: session.arrival_time,
                  message: message || null,
                },
              });
              debug("Created in-app invite activity", { activityId });
            }

            if (prefs?.email && prefs.email_session_invites !== false) {
              const appUrl =
                process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
              try {
                debug("Sending invite email to user", {
                  to: "<redacted>",
                  appUrl,
                });
                emailAttempted = true;
                await sendSessionInviteEmail({
                  toEmail: prefs.email,
                  inviter: {
                    id: user.id,
                    name: user.user_metadata?.full_name,
                    username: user.user_metadata?.user_name,
                  },
                  session: {
                    id: session.id,
                    arrival_time: session.arrival_time,
                    beach_name: session.beach_name,
                  },
                  message: message || undefined,
                  activityId,
                  appUrl,
                });
              } catch (mailErr) {
                console.warn(
                  "Email invite skipped: RESEND not configured",
                  mailErr
                );
              }
            }
          } else if (invitee.email) {
            // Email-only invite (no in-app activity)
            const appUrl =
              process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
            try {
              debug("Sending invite email to address", {
                to: "<redacted>",
                appUrl,
              });
              emailAttempted = true;
              await sendSessionInviteEmail({
                toEmail: invitee.email,
                inviter: {
                  id: user.id,
                  name: user.user_metadata?.full_name,
                  username: user.user_metadata?.user_name,
                },
                session: {
                  id: session.id,
                  arrival_time: session.arrival_time,
                  beach_name: session.beach_name,
                },
                message: message || undefined,
                activityId,
                appUrl,
              });
            } catch (mailErr) {
              console.warn(
                "Email invite skipped: RESEND not configured",
                mailErr
              );
            }
          }
        } catch (notifyErr) {
          console.error("Invite activity/email error:", notifyErr);
          // proceed without failing overall request
        }
      } catch (error) {
        console.error("Error processing invitee:", error);
        errors.push(
          `Failed to process invitation for ${
            invitee.email || invitee.name || "user"
          }`
        );
      }
    }

    const response: InvitationResponse = {
      sessionId,
      invitationsSent,
      invitations,
      errors,
    };

    debug("POST response summary", {
      invitationsSent,
      invitationsCount: invitations.length,
      errorsCount: errors.length,
    });

    const res = createSuccessResponse(response);
    if (DEBUG_INVITES) {
      try {
        res.headers.set("x-invite-email-attempted", String(emailAttempted));
      } catch {}
    }
    return res;
  } catch (error) {
    console.error("Error sending invitations:", error);
    return createErrorResponse(
      "Failed to send invitations",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Get session invitations for the current user
 * GET /api/session-planner/invitations?type=sent|received&sessionId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "received";
    const sessionId = searchParams.get("sessionId");

    debug("GET /invitations", { type, sessionIdPresent: Boolean(sessionId) });

    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse("Authentication required", null, 401);
    }

    // Handle friends type - return user's following list
    if (type === "friends") {
      const { data: following, error: followingError } = await supabase
        .from("user_follows")
        .select(
          `
          following:profiles!user_follows_following_id_fkey(
            id,
            full_name
          )
        `
        )
        .eq("follower_id", user.id)
        .limit(50);

      if (followingError) {
        console.error("Error getting user following:", followingError);
        return createErrorResponse(
          "Failed to fetch friends",
          followingError.message
        );
      }

      const friends = (following || [])
        .map((f: any) => f.following)
        .filter(Boolean);

      return createSuccessResponse(friends);
    }

    let invitations: any[] = [];
    if (type === "sent") {
      const selectFields = `
        id,
        status,
        message,
        created_at,
        session:sessions(id, beach_name, arrival_time),
        inviter:profiles!session_invitations_inviter_id_fkey(id, full_name, email, avatar_url)
      `;
      const { data, error } = await supabase
        .from("session_invitations")
        .select(selectFields)
        .eq("inviter_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching sent invitations:", error);
        return createErrorResponse(
          "Failed to fetch invitations",
          error.message
        );
      }
      invitations = data || [];
    } else {
      // Received: fetch by ID, and separately by email if present; then merge
      const selectFields = `
        id,
        status,
        message,
        created_at,
        session:sessions(id, beach_name, arrival_time),
        inviter:profiles!session_invitations_inviter_id_fkey(id, full_name, email, avatar_url)
      `;
      const base = supabase.from("session_invitations").select(selectFields);
      const filters: any[] = [];
      const byId = base
        .eq("invitee_id", user.id)
        .order("created_at", { ascending: false });
      filters.push(byId);

      const emailVal = user.email;
      if (emailVal && typeof emailVal === "string" && emailVal.length > 0) {
        const byEmail = supabase
          .from("session_invitations")
          .select("*")
          .eq("invitee_email", emailVal)
          .order("created_at", { ascending: false });
        filters.push(byEmail);
      }

      // Execute sequentially to keep it simple and robust
      const { data: dataById, error: errId } = await byId;
      if (errId) {
        console.error("Error fetching invitations by id:", errId);
      }
      const listById = Array.isArray(dataById) ? dataById : [];

      let listByEmail: any[] = [];
      if (filters.length > 1) {
        const { data: dataByEmail, error: errEmail } =
          await (filters[1] as any);
        if (errEmail) {
          console.error("Error fetching invitations by email:", errEmail);
        }
        listByEmail = Array.isArray(dataByEmail) ? dataByEmail : [];
      }

      invitations = [...listById, ...listByEmail].reduce(
        (acc: any[], row: any) => {
          if (!acc.find((r) => r.id === row.id)) acc.push(row);
          return acc;
        },
        []
      );

      if (sessionId) {
        invitations = invitations.filter((inv) => inv.session_id === sessionId);
      }
    }

    debug("GET response summary", {
      type,
      count: Array.isArray(invitations) ? invitations.length : 0,
    });

    return createSuccessResponse(
      {
        type,
        invitations: Array.isArray(invitations) ? invitations : [],
      },
      undefined,
      200
    );
  } catch (error) {
    console.error("Error in GET /api/session-planner/invitations:", error);
    return createErrorResponse(
      "Internal server error",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Respond to a session invitation
 * PATCH /api/session-planner/invitations
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { invitationId, response: invitationResponse } = body;

    debug("PATCH /invitations", {
      invitationIdPresent: Boolean(invitationId),
      response: invitationResponse,
    });

    if (!invitationId || !invitationResponse) {
      return createErrorResponse(
        "Invitation ID and response are required",
        null,
        400
      );
    }

    if (!["accepted", "declined"].includes(invitationResponse)) {
      return createErrorResponse(
        "Response must be 'accepted' or 'declined'",
        null,
        400
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse("Authentication required", null, 401);
    }

    // Get the invitation and verify user can respond to it
    const { data: invitation, error: invitationError } = await supabase
      .from("session_invitations")
      .select("*")
      .eq("id", invitationId)
      .or(`invitee_id.eq.${user.id},invitee_email.eq.${user.email}`)
      .single();

    if (invitationError || !invitation) {
      return createErrorResponse(
        "Invitation not found or access denied",
        null,
        404
      );
    }

    if (invitation.status !== "pending") {
      return createErrorResponse(
        "Invitation has already been responded to",
        null,
        400
      );
    }

    // Update invitation status
    const { data: updatedInvitation, error: updateError } = await supabase
      .from("session_invitations")
      .update({
        status: invitationResponse,
        responded_at: new Date().toISOString(),
      })
      .eq("id", invitationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invitation:", updateError);
      return createErrorResponse(
        "Failed to update invitation",
        updateError.message
      );
    }

    debug("Invitation updated", {
      id: updatedInvitation.id,
      status: updatedInvitation.status,
    });

    // TODO: Send notification to session creator about the response
    // TODO: If accepted, add user to session participants

    return createSuccessResponse({
      invitation: updatedInvitation,
      message: `Invitation ${invitationResponse}`,
    });
  } catch (error) {
    console.error("Error responding to invitation:", error);
    return createErrorResponse(
      "Failed to respond to invitation",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
