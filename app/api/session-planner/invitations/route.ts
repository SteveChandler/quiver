import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-response-utils";
import { createActivityForInvite } from "@/lib/notifications";
import { sendSessionInviteEmail } from "@/lib/mailer/sessionInviteEmail";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const invitations: SessionInvitation[] = [];
    const errors: string[] = [];
    let invitationsSent = 0;

    // Process each invitee
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
            continue;
          } else {
            errors.push(
              `Failed to invite ${invitee.email || invitee.name || "user"}: ${
                invitationError.message
              }`
            );
            continue;
          }
        }

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
              activityId = await createActivityForInvite({
                actorId: user.id,
                recipientId: inviteeUserId,
                sessionId: sessionId,
                metadata: {
                  beachName: session.beach_name,
                  when: session.arrival_time,
                  message: message || null,
                },
              });
            }

            if (prefs?.email && prefs.email_session_invites !== false) {
              const appUrl =
                process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
              try {
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

    return createSuccessResponse(response);
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
            full_name,
            avatar_url,
            email
          )
        `
        )
        .eq("follower_id", user.id)
        .limit(50);

      if (followingError) {
        console.error("Error fetching friends:", followingError);
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

    let query = supabase.from("session_invitations").select(`
        *,
        session:sessions(
          id,
          beach_name,
          beach_id,
          arrival_time,
          status,
          notes
        ),
        inviter:profiles!session_invitations_inviter_id_fkey(
          id,
          full_name,
          avatar_url,
          email
        ),
        invitee:profiles!session_invitations_invitee_id_fkey(
          id,
          full_name,
          avatar_url,
          email
        )
      `);

    if (type === "sent") {
      query = query.eq("inviter_id", user.id);
    } else {
      // Received invitations - check both user ID and email
      query = query.or(
        `invitee_id.eq.${user.id},invitee_email.eq.${user.email}`
      );
    }

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    query = query.order("created_at", { ascending: false });

    const { data: invitations, error: invitationsError } = await query;

    if (invitationsError) {
      console.error("Error fetching invitations:", invitationsError);
      return createErrorResponse(
        "Failed to fetch invitations",
        invitationsError.message
      );
    }

    return createSuccessResponse({
      type,
      invitations: invitations || [],
    });
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
