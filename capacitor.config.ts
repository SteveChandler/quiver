import type { CapacitorConfig } from "@capacitor/cli";
import fs from "node:fs";
import path from "node:path";

function getDevTunnelUrl(): string | undefined {
  const envUrl = process.env.CAPACITOR_DEV_URL?.trim();
  if (envUrl) return envUrl;

  // When using `yarn tunnel:*`, the script writes `.tunnel-url` at the repo root.
  try {
    const filePath = path.join(process.cwd(), ".tunnel-url");
    const fileUrl = fs.readFileSync(filePath, "utf8").trim();
    if (fileUrl) return fileUrl;
  } catch {
    // ignore
  }

  return undefined;
}

/**
 * LOCAL DEVELOPMENT CONFIG - SECURE TUNNEL
 * 
 * This config bypasses Vercel entirely by pointing the mobile app
 * to your local Next.js dev server via a secure tunnel.
 * 
 * SETUP:
 * 1. Start your local dev server:
 *    npm run dev
 * 
 * 2. Expose it with a tunnel (choose one):
 *    
 *    Option A - Cloudflare Tunnel (recommended, free):
 *    cloudflared tunnel --url http://localhost:3000
 *    
 *    Option B - ngrok:
 *    ngrok http 3000
 * 
 * 3. Copy the HTTPS URL from the tunnel output
 * 
 * 4. Replace the URL below with your tunnel URL
 * 
 * 5. Sync and run:
 *    npm run mobile:sync:local
 *    # Then open in Android Studio and run
 * 
 * BENEFITS:
 * - No Vercel protection bypass needed
 * - Instant hot reload from local changes
 * - Full dev environment with all env vars
 * - No deployment delays
 */

const config: CapacitorConfig = {
  appId: "app.quiversurf.mobile",
  appName: "Quiver Dev",
  webDir: "out",
  server: {
    androidScheme: "https",
    // Local dev runs via a secure tunnel. Prefer CAPACITOR_DEV_URL, then `.tunnel-url`.
    // If neither is set, fall back to a placeholder to avoid silently pointing at a stale tunnel.
    url:
      getDevTunnelUrl() ||
      "https://YOUR-TUNNEL-URL-HERE.trycloudflare.com",
    cleartext: false,
    allowNavigation: ["*"],
  },
  loggingBehavior: "debug",
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
