/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications for web
 *
 * This file MUST be at the root of the public directory (/firebase-messaging-sw.js)
 * Service workers have scope restrictions and can only intercept requests at their level or below
 */

// Import Firebase scripts
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js"
);

// Initialize Firebase in the service worker
// Note: These values are public and safe to include in client-side code
firebase.initializeApp({
  apiKey: "AIzaSyDFcuLm-nSV4faCeYJhnADym_hVTEqEFVw",
  authDomain: "quiver-1f787.firebaseapp.com",
  projectId: "quiver-1f787",
  storageBucket: "quiver-1f787.appspot.com",
  messagingSenderId: "230741354184",
  appId: "1:230741354184:web:d03a8737719b1a9d3c67fd",
});

const messaging = firebase.messaging();

/**
 * Handle background messages
 * This is called when a push notification arrives while the app is in the background
 */
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Received background message", payload);

  const notificationTitle = payload.notification?.title || "Quiver";
  const notificationOptions = {
    body: payload.notification?.body || "New notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: payload.data,
    tag: payload.data?.type || "default",
    requireInteraction: false,
  };

  // Show notification
  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

/**
 * Handle notification click
 * Navigate to the appropriate page when user clicks the notification
 */
self.addEventListener("notificationclick", (event) => {
  console.log("[firebase-messaging-sw] Notification clicked", event);

  event.notification.close();

  const data = event.notification.data;
  let urlToOpen = self.location.origin;

  // Route based on notification type
  if (data.type === "session_invite" && data.session_id) {
    urlToOpen = `${self.location.origin}/sessions/${data.session_id}`;
  } else if (data.type === "comment" && data.session_id) {
    urlToOpen = `${self.location.origin}/sessions/${data.session_id}#comments`;
  } else if (data.type === "like" && data.session_id) {
    urlToOpen = `${self.location.origin}/sessions/${data.session_id}`;
  } else if (data.type === "follow" && data.user_id) {
    urlToOpen = `${self.location.origin}/user/${data.user_id}`;
  }

  // Open the URL in a new window/tab or focus existing one
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with this URL
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // If no window/tab is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});


