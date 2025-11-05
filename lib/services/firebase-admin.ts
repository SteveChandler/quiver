/**
 * Firebase Admin SDK initialization for server-side push notifications
 * Used to send FCM push notifications to iOS/Android devices
 */

import admin from "firebase-admin";

// Initialize Firebase Admin SDK (singleton pattern)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "Firebase Admin SDK not initialized: Missing environment variables"
    );
    console.warn("Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
  } else {
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
      console.error("Failed to initialize Firebase Admin SDK:", error);
    }
  }
}

// Export messaging instance for push notifications
export const messaging = admin.apps.length > 0 ? admin.messaging() : null;

// Check if Firebase is properly initialized
export function isFirebaseInitialized(): boolean {
  return admin.apps.length > 0 && messaging !== null;
}


























