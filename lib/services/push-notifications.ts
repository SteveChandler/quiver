/**
 * Push Notification Service
 * Handles sending FCM push notifications to iOS/Android devices
 * Following patterns from lib/mailer/sessionInviteEmail.tsx
 */

import type { messaging } from "firebase-admin";
import { getFirebaseAdminMessaging } from "./firebase-admin";
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

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  imageUrl?: string;
  android?: messaging.AndroidConfig;
  apns?: messaging.ApnsConfig;
}

let firebaseSkipWarned = false;

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function stringifyDataPayload(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      typeof v === "string" ? v : JSON.stringify(v),
    ])
  );
}

/**
 * Core Firebase Admin sender. Takes fully-built messages, fans out via
 * `sendEach`, and prunes tokens rejected with invalid-token errors from
 * `user_devices`. All other senders in this module delegate here.
 */
async function sendViaFirebase(messages: PushMessage[]): Promise<PushResult> {
  if (messages.length === 0) return { success: 0, failed: 0 };

  const fcm = getFirebaseAdminMessaging();
  if (!fcm) {
    if (!firebaseSkipWarned) {
      firebaseSkipWarned = true;
      console.error(
        "[push-notifications] Firebase Admin SDK unavailable — FCM messages not sent. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
      );
    }
    return { success: 0, failed: messages.length, errors: ["Firebase not configured"] };
  }

  const firebaseMessages: messaging.Message[] = messages.map((m) => ({
    token: m.to,
    notification: {
      title: m.title,
      body: m.body,
      ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
    },
    ...(m.data ? { data: stringifyDataPayload(m.data) } : {}),
    ...(m.android ? { android: m.android } : {}),
    ...(m.apns ? { apns: m.apns } : {}),
  }));

  const response = await fcm.sendEach(firebaseMessages);

  const invalidTokens: string[] = [];
  response.responses.forEach((resp, idx) => {
    if (resp.error && INVALID_TOKEN_ERROR_CODES.has(resp.error.code)) {
      invalidTokens.push(messages[idx].to);
    }
  });

  if (invalidTokens.length > 0) {
    console.log(`Pruning ${invalidTokens.length} invalid device tokens`);
    const supabase = createSupabaseServiceRoleClient();
    const { error: deleteError } = await supabase
      .from("user_devices")
      .delete()
      .in("device_token", invalidTokens);

    if (deleteError) {
      console.error("Failed to prune invalid tokens:", deleteError);
    }
  }

  return { success: response.successCount, failed: response.failureCount };
}

/**
 * Send pre-built push messages directly (callers that already have
 * device tokens in hand, e.g. the condition-alert cron).
 *
 * Returns void for backwards compatibility with the original
 * `lib/alerts/push-sender.ts` signature.
 */
export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  await sendViaFirebase(messages);
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

  if (!getFirebaseAdminMessaging()) {
    if (!firebaseSkipWarned) {
      firebaseSkipWarned = true;
      console.warn("Firebase Admin SDK not initialized, skipping push notifications");
    }
    return { success: 0, failed: 0, errors: ["Firebase not configured"] };
  }

  try {
    const supabase = createSupabaseServiceRoleClient();

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

    const title = "New Surf Session Invite";
    const body = `${inviterName} invited you${beachName ? ` to ${beachName}` : ""}${
      arrivalTime ? ` • ${new Date(arrivalTime).toLocaleString()}` : ""
    }`;

    const data = {
      type: "session_invite",
      session_id: sessionId,
      message: message || "",
    };

    const android: messaging.AndroidConfig = {
      priority: "high",
      notification: {
        channelId: "session_invites",
        priority: "high",
      },
    };

    const apns: messaging.ApnsConfig = {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
          alert: { title, body },
        },
      },
    };

    const messages: PushMessage[] = devices.map((d) => ({
      to: d.device_token,
      title,
      body,
      data,
      android,
      apns,
    }));

    const result = await sendViaFirebase(messages);

    console.log(
      `Push notifications sent: ${result.success} success, ${result.failed} failed`
    );

    return result;
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

  if (!getFirebaseAdminMessaging()) {
    if (!firebaseSkipWarned) {
      firebaseSkipWarned = true;
      console.warn("Firebase Admin SDK not initialized, skipping push notifications");
    }
    return { success: 0, failed: 0, errors: ["Firebase not configured"] };
  }

  try {
    const supabase = createSupabaseServiceRoleClient();

    const { data: devices, error: devicesError } = await supabase
      .from("user_devices")
      .select("device_token")
      .in("user_id", userIds);

    if (devicesError || !devices?.length) {
      return { success: 0, failed: 0 };
    }

    const messages: PushMessage[] = devices.map((d) => ({
      to: d.device_token,
      title,
      body,
      ...(data ? { data } : {}),
    }));

    const result = await sendViaFirebase(messages);

    console.log(
      `Push notifications sent: ${result.success} success, ${result.failed} failed`
    );

    return result;
  } catch (error) {
    console.error("Push notification error:", error);
    return { success: 0, failed: userIds.length };
  }
}
