/**
 * Push Notification Service
 * Handles sending FCM push notifications to iOS/Android devices
 * Following patterns from lib/mailer/sessionInviteEmail.tsx
 */

import { messaging, isFirebaseInitialized } from "./firebase-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

interface SendSessionInvitePushParams {
  inviteeIds: string[];
  inviterName: string;
  beachName?: string;
  arrivalTime?: string;
  sessionId: string;
  message?: string;
}

interface PushResult {
  success: number;
  failed: number;
  errors?: string[];
}

/**
 * Send push notifications for session invitations
 * Uses Firebase Cloud Messaging (FCM) to deliver notifications
 */
export async function sendSessionInvitePush({
  inviteeIds,
  inviterName,
  beachName,
  arrivalTime,
  sessionId,
  message,
}: SendSessionInvitePushParams): Promise<PushResult> {
  if (!inviteeIds.length) {
    return { success: 0, failed: 0 };
  }

  // Check if Firebase is initialized
  if (!isFirebaseInitialized() || !messaging) {
    console.warn("Firebase Admin SDK not initialized, skipping push notifications");
    return { success: 0, failed: 0, errors: ["Firebase not configured"] };
  }

  try {
    const supabase = createSupabaseServiceRoleClient();

    // Get device tokens for invitees
    const { data: devices, error: devicesError } = await supabase
      .from("user_devices")
      .select("device_token, platform, user_id")
      .in("user_id", inviteeIds);

    if (devicesError) {
      console.error("Failed to fetch device tokens:", devicesError);
      return { success: 0, failed: 0, errors: [devicesError.message] };
    }

    if (!devices?.length) {
      console.log("No device tokens found for invitees");
      return { success: 0, failed: 0 };
    }

    // Extract tokens for batch sending
    const tokens = devices.map((d) => d.device_token);

    // Build notification payload
    const title = "New Surf Session Invite";
    const body = `${inviterName} invited you${beachName ? ` to ${beachName}` : ""}${
      arrivalTime ? ` • ${new Date(arrivalTime).toLocaleString()}` : ""
    }`;

    // Send push notification via FCM
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        type: "session_invite",
        session_id: sessionId,
        message: message || "",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "session_invites",
          priority: "high",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            alert: {
              title,
              body,
            },
          },
        },
      },
    });

    // Prune invalid tokens
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (
        resp.error?.code === "messaging/registration-token-not-registered" ||
        resp.error?.code === "messaging/invalid-registration-token"
      ) {
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length > 0) {
      console.log(`Pruning ${invalidTokens.length} invalid device tokens`);
      const { error: deleteError } = await supabase
        .from("user_devices")
        .delete()
        .in("device_token", invalidTokens);

      if (deleteError) {
        console.error("Failed to prune invalid tokens:", deleteError);
      }
    }

    console.log(
      `Push notifications sent: ${response.successCount} success, ${response.failureCount} failed`
    );

    return {
      success: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error("Push notification error:", error);
    return {
      success: 0,
      failed: inviteeIds.length,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Send a generic push notification to specific users
 * Can be used for other notification types beyond session invites
 */
export async function sendPushNotification({
  userIds,
  title,
  body,
  data,
}: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<PushResult> {
  if (!userIds.length) {
    return { success: 0, failed: 0 };
  }

  if (!isFirebaseInitialized() || !messaging) {
    console.warn("Firebase Admin SDK not initialized, skipping push notifications");
    return { success: 0, failed: 0, errors: ["Firebase not configured"] };
  }

  try {
    const supabase = createSupabaseServiceRoleClient();

    // Get device tokens
    const { data: devices, error: devicesError } = await supabase
      .from("user_devices")
      .select("device_token")
      .in("user_id", userIds);

    if (devicesError || !devices?.length) {
      return { success: 0, failed: 0 };
    }

    const tokens = devices.map((d) => d.device_token);

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data || {},
    });

    return {
      success: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error("Push notification error:", error);
    return { success: 0, failed: userIds.length };
  }
}

