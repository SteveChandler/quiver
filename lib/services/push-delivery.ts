import type { messaging } from "firebase-admin";

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

export interface PushDispatchResult {
  success: number;
  failed: number;
  invalidTokens: string[];
  errors: string[];
  /** Internal correlation only; never persist the token field. */
  outcomes: PushDeliveryOutcome[];
}

export interface PushDeliveryOutcome {
  token: string;
  status: "sent" | "failed" | "unknown";
  invalidToken: boolean;
  error?: string;
}

interface DispatchPushMessagesOptions {
  messages: PushMessage[];
  fcm: messaging.Messaging | null;
  fetchImpl?: typeof fetch;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const FCM_INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const EXPO_INVALID_TOKEN_ERRORS = new Set(["DeviceNotRegistered"]);

export function isExpoPushToken(token: string): boolean {
  return /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token);
}

function stringifyDataPayload(
  data: Record<string, unknown>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      typeof v === "string" ? v : JSON.stringify(v),
    ])
  );
}

function getExpoSound(message: PushMessage): string | null {
  if (typeof message.sound === "string") return message.sound;
  const apnsSound = message.apns?.payload?.aps?.sound;
  return typeof apnsSound === "string" ? apnsSound : null;
}

async function dispatchFcmMessages(
  messages: PushMessage[],
  fcm: messaging.Messaging | null
): Promise<PushDispatchResult> {
  if (messages.length === 0) {
    return { success: 0, failed: 0, invalidTokens: [], errors: [], outcomes: [] };
  }
  if (!fcm) {
    return {
      success: 0,
      failed: messages.length,
      invalidTokens: [],
      errors: ["Firebase not configured"],
      outcomes: messages.map((message) => ({
        token: message.to,
        status: "unknown",
        invalidToken: false,
        error: "Firebase not configured",
      })),
    };
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
  const responseItems = Array.isArray(response?.responses) ? response.responses : [];
  const invalidTokens: string[] = [];
  const errors: string[] = [];
  const outcomes: PushDeliveryOutcome[] = messages.map((message, idx) => {
    const responseItem = responseItems[idx];
    if (!responseItem) {
      return { token: message.to, status: "unknown", invalidToken: false };
    }
    if (responseItem.success) {
      return { token: message.to, status: "sent", invalidToken: false };
    }
    const error = responseItem.error
      ? `${responseItem.error.code}: ${responseItem.error.message}`
      : "FCM delivery outcome was ambiguous";
    const invalidToken = Boolean(
      responseItem.error && FCM_INVALID_TOKEN_ERROR_CODES.has(responseItem.error.code),
    );
    return {
      token: message.to,
      status: invalidToken ? "failed" : "unknown",
      invalidToken,
      error,
    };
  });
  responseItems.forEach((resp, idx) => {
    const message = messages[idx];
    if (!message) return;
    if (resp.error) {
      errors.push(`${resp.error.code}: ${resp.error.message}`);
    }
    if (resp.error && FCM_INVALID_TOKEN_ERROR_CODES.has(resp.error.code)) {
      invalidTokens.push(message.to);
    }
  });

  const success = typeof response?.successCount === "number"
    ? response.successCount
    : outcomes.filter((outcome) => outcome.status === "sent").length;
  const failed = typeof response?.failureCount === "number"
    ? response.failureCount
    : messages.length - success;
  return {
    success,
    failed,
    invalidTokens,
    errors,
    outcomes,
  };
}

async function dispatchExpoMessages(
  messages: PushMessage[],
  fetchImpl: typeof fetch
): Promise<PushDispatchResult> {
  if (messages.length === 0) {
    return { success: 0, failed: 0, invalidTokens: [], errors: [], outcomes: [] };
  }

  const payload = messages.map((m) => ({
    to: m.to,
    title: m.title,
    body: m.body,
    ...(m.data ? { data: m.data } : {}),
    ...(m.imageUrl ? { richContent: { image: m.imageUrl } } : {}),
    ...(getExpoSound(m) ? { sound: getExpoSound(m) } : {}),
    ...(typeof m.apns?.payload?.aps?.badge === "number"
      ? { badge: m.apns.payload.aps.badge }
      : {}),
    ...(m.android?.notification?.channelId
      ? { channelId: m.android.notification.channelId }
      : {}),
    ...(m.android?.priority ? { priority: m.android.priority } : {}),
  }));

  const response = await fetchImpl(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return {
      success: 0,
      failed: messages.length,
      invalidTokens: [],
      errors: [`Expo push request failed with HTTP ${response.status}`],
      outcomes: messages.map((message) => ({
        token: message.to,
        status: "unknown",
        invalidToken: false,
        error: `Expo push request failed with HTTP ${response.status}`,
      })),
    };
  }

  const body = (await response.json()) as {
    data?: Array<{
      status?: "ok" | "error";
      message?: string;
      details?: { error?: string };
    }>;
    errors?: Array<{ message?: string }>;
  };

  const tickets = Array.isArray(body.data) ? body.data : [];
  const invalidTokens: string[] = [];
  const outcomes: PushDeliveryOutcome[] = messages.map((message, idx) => {
    const ticket = tickets[idx];
    if (!ticket || (ticket.status !== "ok" && ticket.status !== "error")) {
      return { token: message.to, status: "unknown", invalidToken: false };
    }
    if (ticket.status === "ok") return { token: message.to, status: "sent", invalidToken: false };
    const invalidToken = Boolean(
      ticket.details?.error && EXPO_INVALID_TOKEN_ERRORS.has(ticket.details.error),
    );
    return {
      token: message.to,
      status: "failed",
      invalidToken,
      ...(ticket.message ? { error: ticket.message } : {}),
    };
  });
  const errors = (body.errors ?? [])
    .map((e) => e.message)
    .filter((m): m is string => !!m);

  let success = 0;
  let failed = 0;
  tickets.forEach((ticket, idx) => {
    if (ticket.status === "ok") {
      success += 1;
      return;
    }
    failed += 1;
    if (ticket.details?.error && EXPO_INVALID_TOKEN_ERRORS.has(ticket.details.error)) {
      invalidTokens.push(messages[idx].to);
    }
    if (ticket.message) errors.push(ticket.message);
  });

  if (tickets.length < messages.length) {
    failed += messages.length - tickets.length;
  }

  return { success, failed, invalidTokens, errors, outcomes };
}

export async function dispatchPushMessages({
  messages,
  fcm,
  fetchImpl = fetch,
}: DispatchPushMessagesOptions): Promise<PushDispatchResult> {
  const expoMessages = messages.filter((m) => isExpoPushToken(m.to));
  const fcmMessages = messages.filter((m) => !isExpoPushToken(m.to));

  const [expoResult, fcmResult] = await Promise.all([
    dispatchExpoMessages(expoMessages, fetchImpl),
    dispatchFcmMessages(fcmMessages, fcm),
  ]);

  return {
    success: expoResult.success + fcmResult.success,
    failed: expoResult.failed + fcmResult.failed,
    invalidTokens: [...expoResult.invalidTokens, ...fcmResult.invalidTokens],
    errors: [...expoResult.errors, ...fcmResult.errors],
    outcomes: [...expoResult.outcomes, ...fcmResult.outcomes],
  };
}
