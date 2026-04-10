import { getFirebaseAdminMessaging } from "../services/firebase-admin";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  imageUrl?: string;
}

export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const expoMessages = messages.filter((m) => m.to.startsWith("ExponentPushToken"));
  const fcmMessages = messages.filter((m) => !m.to.startsWith("ExponentPushToken"));

  const tasks: Promise<void>[] = [];

  if (expoMessages.length > 0) {
    tasks.push(
      (async () => {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expoMessages.map((m) => ({ ...m, sound: m.sound ?? "default" }))),
        });
        if (!response.ok) {
          console.error("[push-sender] Expo push failed:", await response.text());
        }
      })()
    );
  }

  if (fcmMessages.length > 0) {
    tasks.push(
      (async () => {
        const messaging = getFirebaseAdminMessaging();
        if (!messaging) {
          console.error(
            "[push-sender] Firebase Admin SDK unavailable — FCM messages not sent. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
          );
          return;
        }

        const firebaseMessages = fcmMessages.map((m) => ({
          token: m.to,
          notification: {
            title: m.title,
            body: m.body,
            ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
          },
          ...(m.data
            ? {
                data: Object.fromEntries(
                  Object.entries(m.data).map(([k, v]) => [
                    k,
                    typeof v === "string" ? v : JSON.stringify(v),
                  ])
                ),
              }
            : {}),
        }));

        await messaging.sendEach(firebaseMessages);
      })()
    );
  }

  await Promise.all(tasks);
}
