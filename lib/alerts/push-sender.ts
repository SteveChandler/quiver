// lib/alerts/push-sender.ts
interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
}

export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const expoMessages = messages.filter((m) => m.to.startsWith("ExponentPushToken"));
  const fcmMessages = messages.filter((m) => !m.to.startsWith("ExponentPushToken"));

  if (expoMessages.length > 0) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expoMessages.map((m) => ({ ...m, sound: m.sound ?? "default" }))),
    });
    if (!response.ok) {
      console.error("[push-sender] Expo push failed:", await response.text());
    }
  }

  if (fcmMessages.length > 0) {
    console.log(`[push-sender] ${fcmMessages.length} FCM messages skipped (not yet implemented)`);
  }
}
