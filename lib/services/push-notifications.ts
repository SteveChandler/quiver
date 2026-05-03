/**
 * Push Notification Service
 * Handles sending FCM push notifications to iOS/Android devices
 */

import type { messaging } from "firebase-admin";
import { getFirebaseAdminMessaging } from "./firebase-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  dispatchPushMessages,
  type PushMessage as SharedPushMessage,
} from "./push-delivery";

interface PushResult {
  success: number;
  failed: number;
  errors?: string[];
}

export type PushMessage = SharedPushMessage;

let firebaseSkipWarned = false;

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

  const result = await dispatchPushMessages({ messages, fcm });
  const invalidTokens = result.invalidTokens;

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

  return {
    success: result.success,
    failed: result.failed,
    ...(result.errors.length > 0 ? { errors: result.errors } : {}),
  };
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
 * Send a generic push notification to specific users
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
