/**
 * Firebase Admin SDK initialization for server-side push notifications
 * Used to send FCM push notifications to iOS/Android devices
 */

import admin from "firebase-admin";

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
      console.warn("Firebase Admin SDK not initialized: Missing environment variables");
      console.warn("Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
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

// Check if Firebase is properly initialized (messaging available)
export function isFirebaseInitialized(): boolean {
  return getFirebaseAdminMessaging() !== null;
}
































