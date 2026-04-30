/**
 * Firebase Admin SDK initialization for server-side push notifications
 * Used to send FCM push notifications to iOS/Android devices
 */

import admin from "firebase-admin";
import * as Sentry from "@sentry/nextjs";

let initAttempted = false;
let missingEnvWarned = false;
let initErrorLogged = false;

function initializeFirebaseAdminIfNeeded(): void {
  if (admin.apps.length > 0) return;
  if (initAttempted) return;
  initAttempted = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    if (!missingEnvWarned) {
      missingEnvWarned = true;
      const missing = [
        !projectId && "FIREBASE_PROJECT_ID",
        !clientEmail && "FIREBASE_CLIENT_EMAIL",
        !privateKey && "FIREBASE_PRIVATE_KEY",
      ]
        .filter(Boolean)
        .join(", ");
      const message = `Firebase Admin SDK not initialized — push notifications are silently disabled. Missing: ${missing}`;
      console.error(message);
      // In production, escalate to Sentry so this can't go unnoticed (it
      // previously hid behind a one-time console.warn).
      if (process.env.NODE_ENV === "production") {
        Sentry.captureMessage(message, {
          level: "error",
          tags: { feature: "push", subsystem: "firebase_admin" },
        });
      }
    }
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    if (!initErrorLogged) {
      initErrorLogged = true;
      console.error("Failed to initialize Firebase Admin SDK:", error);
      if (process.env.NODE_ENV === "production") {
        Sentry.captureException(error, {
          tags: { feature: "push", subsystem: "firebase_admin" },
        });
      }
    }
  }
}

/**
 * Lazily get Firebase Admin Messaging instance.
 *
 * This avoids noisy startup warnings in environments that don't configure
 * server-side push notifications (e.g. local dev) by only attempting init
 * when push is actually used.
 */
export function getFirebaseAdminMessaging(): admin.messaging.Messaging | null {
  initializeFirebaseAdminIfNeeded();
  return admin.apps.length > 0 ? admin.messaging() : null;
}





























