// Public client identifiers for third-party services. Each one already ships in
// the browser bundle or a public file, so it lives here instead of in Vercel env.
// The matching env var still overrides it (tests, local experiments).

export const FIREBASE_WEB_CONFIG = {
  // Firebase web API keys identify the project; they are not credentials and ship in the bundle.
  apiKey: "AIzaSyDFcuLm-nSV4faCeYJhnADym_hVTEqEFVw", // gitleaks:allow
  authDomain: "quiver-1f787.firebaseapp.com",
  projectId: "quiver-1f787",
  storageBucket: "quiver-1f787.appspot.com",
  messagingSenderId: "230741354184",
  appId: "1:230741354184:web:d03a8737719b1a9d3c67fd",
} as const;

// Public half of the web-push key pair; browsers receive it to subscribe.
export const FIREBASE_WEB_PUSH_VAPID_KEY =
  "BOPUrm9VNqgRwNl4lL7z6jJ7qH6mf7wHRZPkEyl0fexR4MrBsufQg-NvveWMgle2K78Y1G5sECVi524Lq7pu-Ds"; // gitleaks:allow

export const APPLE_TEAM_ID = "QBA8TA48NG";
export const APPLE_APP_BUNDLE_ID = "app.quiversurf.mobile";
export const APPLE_SIGN_IN_WEB_CLIENT_ID = "app.quiversurf.mobile.web";

export const GOOGLE_WEB_CLIENT_ID =
  "230741354184-j8t18cosre28dh82fi2c6dspn4iim6at.apps.googleusercontent.com";
export const GOOGLE_SITE_VERIFICATION = "QOI_yMPWsLuNW_ORGU0Lcx_C2Gapy2PK3bes321uIw8";

/** As served by prod assetlinks.json on 2026-11-05. */
export const ANDROID_SHA256_CERT_FINGERPRINTS = [
  "02:EC:D8:87:98:E9:F2:EC:47:EE:EF:90:88:5B:AA:D4:A9:DD:9E:6B:C5:C0:D5:42:07:84:66:46:BE:D4:18:E2",
  "23:B8:8F:D1:3F:B6:58:4B:AA:1F:8D:89:DB:28:7D:9A:EC:75:A3:7C:87:76:C2:9D:9A:10:C8:32:8C:26:31:62",
  "0E:28:D0:8C:69:68:CC:8C:91:21:BB:42:79:85:90:FE:E2:54:D9:2A:D8:C1:4F:4B:F4:A5:7F:C8:23:30:88:CF",
].join(",");

export const SUPPORT_EMAIL = "support@quiversurf.app";
