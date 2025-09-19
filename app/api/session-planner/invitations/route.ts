import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
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
  seenAt: string | null;
  notificationErrors?: string[];
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

type RawInvitationRow = {
  id: string;
  session_id: string | null;
  inviter_id: string | null;
  invitee_id: string | null;
  invitee_email: string | null;
  status: string;
  message: string | null;
  created_at: string;
  seen_at: string | null;
};

const BASE_INVITATION_FIELDS = `
  id,
  session_id,
  inviter_id,
  invitee_id,
  invitee_email,
  status,
  message,
  created_at,
  seen_at
`;

const buildEnrichedInvitations = async (
  client: SupabaseClient,
  rows: RawInvitationRow[]
) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [] as any[];
  }

  const sessionIds = Array.from(
    new Set(rows.map((row) => row.session_id).filter(Boolean))
  ) as string[];
  const inviterIds = Array.from(
    new Set(rows.map((row) => row.inviter_id).filter(Boolean))
  ) as string[];

  const [sessionsResult, invitersResult] = await Promise.all([
    sessionIds.length
      ? client
          .from("sessions")
          .select("id, beach_name, arrival_time")
          .in("id", sessionIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    inviterIds.length
      ? client
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", inviterIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (sessionsResult.error) {
    console.error("Error loading sessions for invitations:", sessionsResult.error);
  }
  if (invitersResult.error) {
    console.error("Error loading inviters for invitations:", invitersResult.error);
  }

  const sessionMap = new Map<string, any>();
  (sessionsResult.data || []).forEach((session) => {
    if (session?.id) {
      sessionMap.set(session.id, session);
    }
  });

  const inviterMap = new Map<string, any>();
  (invitersResult.data || []).forEach((profile) => {
    if (profile?.id) {
      inviterMap.set(profile.id, profile);
    }
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
    seen_at: row.seen_at ?? null,
    session: row.session_id ? sessionMap.get(row.session_id) || null : null,
    inviter: row.inviter_id ? inviterMap.get(row.inviter_id) || null : null,
    invitee_id: row.invitee_id,
    invitee_email: row.invitee_email,
  }));
};

const dedupeInvitationsById = (rows: RawInvitationRow[]) =>
  rows.reduce<RawInvitationRow[]>((acc, row) => {
    if (!acc.find((existing) => existing.id === row.id)) {
      acc.push(row);
    }
    return acc;
  }, []);

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
    const serviceSupabase = await createSupabaseServiceRoleClient();

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
            .ilike("email", invitee.email)
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

        const normalizedEmail = invitee.email ? invitee.email.toLowerCase() : undefined;

        // Check for existing invitation (per-invitee uniqueness)
        const { data: existingInvitation } = await serviceSupabase
          .from("session_invitations")
          .select("id")
          .eq("session_id", sessionId)
          .eq(
            inviteeUserId ? "invitee_id" : "invitee_email",
            inviteeUserId || normalizedEmail
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
          invitee_email: normalizedEmail,
          status: "pending" as const,
          message: message || null,
          created_at: new Date().toISOString(),
          idempotency_key: perInviteeIdempKey,
        };

        const { data: newInvitation, error: invitationError } = await serviceSupabase
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

        const invitationNotificationErrors: string[] = [];

        invitations.push({
          id: newInvitation.id,
          sessionId: newInvitation.session_id,
          inviterId: newInvitation.inviter_id,
          inviteeId: newInvitation.invitee_id,
          inviteeEmail: newInvitation.invitee_email,
          status: newInvitation.status,
          message: newInvitation.message,
          createdAt: newInvitation.created_at,
          seenAt: newInvitation.seen_at ?? null,
          notificationErrors: invitationNotificationErrors,
        });

        invitationsSent++;

        // Track XP for each friend invited
        trackInviteXP(newInvitation.id);

        const displayName = invitee.email || invitee.name || "user";

        let activityId: string | undefined;

        if (inviteeUserId) {
          const { data: prefs, error: prefsError } = await supabase
            .from("profiles")
            .select("email, email_session_invites, inapp_session_invites")
            .eq("id", inviteeUserId)
            .single();

          if (prefsError) {
            const messageText = `Failed to load notification preferences for ${displayName}: ${prefsError.message}`;
            errors.push(messageText);
            invitationNotificationErrors.push(messageText);
          } else {
            if (prefs?.inapp_session_invites !== false) {
              try {
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
              } catch (activityErr) {
                const msg = `Failed to create in-app notification for ${displayName}: ${activityErr instanceof Error ? activityErr.message : "Unknown error"}`;
                console.error(msg, activityErr);
                errors.push(msg);
                invitationNotificationErrors.push(msg);
              }
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
                const msg = `Failed to send invite email to ${displayName}: ${mailErr instanceof Error ? mailErr.message : "Unknown error"}`;
                console.error(msg, mailErr);
                errors.push(msg);
                invitationNotificationErrors.push(msg);
              }
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
            const msg = `Failed to send invite email to ${displayName}: ${mailErr instanceof Error ? mailErr.message : "Unknown error"}`;
            console.error(msg, mailErr);
            errors.push(msg);
            invitationNotificationErrors.push(msg);
          }
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

    const serviceSupabase = await createSupabaseServiceRoleClient();

    let invitations: any[] = [];
    if (type === "sent") {
      const { data, error } = await serviceSupabase
        .from("session_invitations")
        .select(BASE_INVITATION_FIELDS)
        .eq("inviter_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching sent invitations:", error);
        return createErrorResponse(
          "Failed to fetch invitations",
          error.message
        );
      }

      let rows: RawInvitationRow[] = Array.isArray(data) ? (data as RawInvitationRow[]) : [];
      if (sessionId) {
        rows = rows.filter((row) => row.session_id === sessionId);
      }
      rows = rows.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      invitations = await buildEnrichedInvitations(serviceSupabase, rows);
    } else {
      const { data: dataById, error: errId } = await serviceSupabase
        .from("session_invitations")
        .select(BASE_INVITATION_FIELDS)
        .eq("invitee_id", user.id)
        .order("created_at", { ascending: false });
      if (errId) {
        console.error("Error fetching invitations by id:", errId);
      }
      const listById = Array.isArray(dataById)
        ? (dataById as RawInvitationRow[])
        : [];

      let listByEmail: RawInvitationRow[] = [];
      const emailVal = user.email;
      if (emailVal && typeof emailVal === "string" && emailVal.length > 0) {
        const { data: dataByEmail, error: errEmail } = await serviceSupabase
          .from("session_invitations")
          .select(BASE_INVITATION_FIELDS)
          .ilike("invitee_email", emailVal)
          .order("created_at", { ascending: false });
        if (errEmail) {
          console.error("Error fetching invitations by email:", errEmail);
        }
        listByEmail = Array.isArray(dataByEmail)
          ? (dataByEmail as RawInvitationRow[])
          : [];
      }

      let combined = dedupeInvitationsById([...listById, ...listByEmail]);

      if (sessionId) {
        combined = combined.filter((row) => row.session_id === sessionId);
      }

      combined = combined.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      invitations = await buildEnrichedInvitations(serviceSupabase, combined);
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
    const {
      invitationId,
      response: invitationResponse,
      markSeen,
      invitationIds,
    } = body;

    debug("PATCH /invitations", {
      invitationIdPresent: Boolean(invitationId),
      response: invitationResponse,
      markSeen: Boolean(markSeen),
      invitationIdsCount: Array.isArray(invitationIds) ? invitationIds.length : 0,
    });

    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse("Authentication required", null, 401);
    }

    if (markSeen) {
      if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
        return createErrorResponse(
          "Invitation IDs are required to mark notifications as seen",
          null,
          400
        );
      }

      const { data: updatedRows, error: seenError } = await supabase
        .from("session_invitations")
        .update({ seen_at: new Date().toISOString() })
        .in("id", invitationIds)
        .select("id, seen_at");

      if (seenError) {
        console.error("Error marking invitations as seen:", seenError);
        return createErrorResponse(
          "Failed to mark invitations as seen",
          seenError.message
        );
      }

      return createSuccessResponse(
        {
          updated: updatedRows ?? [],
        },
        "Invitations marked as seen"
      );
    }

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

    // Get the invitation and verify user can respond to it
    const { data: invitation, error: invitationError } = await supabase
      .from("session_invitations")
      .select("*")
      .eq("id", invitationId)
      .or(`invitee_id.eq.${user.id},invitee_email.ilike.${user.email}`)
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
