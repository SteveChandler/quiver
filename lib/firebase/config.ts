/**
 * Firebase Web SDK Configuration
 * Initializes Firebase for web push notifications
 * Used only on web platform (not mobile)
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if all required config values are present
function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

// Initialize Firebase app (singleton)
let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp | null {
  // Skip on server-side
  if (typeof window === "undefined") {
    return null;
  }

  // Check if Firebase is configured
  if (!isFirebaseConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Firebase web SDK not configured. Add NEXT_PUBLIC_FIREBASE_* environment variables."
      );
    }
    return null;
  }

  try {
    // Return existing app if already initialized
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
      return app;
    }

    // Initialize new app
    app = initializeApp(firebaseConfig);
    if (process.env.NODE_ENV === "development") {
      console.log("Firebase web SDK initialized successfully");
    }
    return app;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to initialize Firebase web SDK:", error);
    }
    return null;
  }
}

// Get Firebase Messaging instance
let messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  // Skip on server-side
  if (typeof window === "undefined") {
    return null;
  }

  // Check if messaging is supported
  if (!("Notification" in window)) {
    if (process.env.NODE_ENV === "development") {
      console.log("Push notifications not supported in this browser");
    }
    return null;
  }

  try {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) {
      return null;
    }

    // Return existing messaging instance
    if (messaging) {
      return messaging;
    }

    // Create new messaging instance
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to get Firebase messaging:", error);
    }
    return null;
  }
}
