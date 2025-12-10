import type { CapacitorConfig } from "@capacitor/cli";

/**
 * LOCAL DEVELOPMENT CONFIG - SECURE TUNNEL
 * 
 * This is an example file. Copy it to capacitor.config.dev.ts and add your tunnel URL.
 * 
 * SETUP:
 * 1. Copy this file: cp capacitor.config.dev.example.ts capacitor.config.dev.ts
 * 2. Start tunnel: cloudflared tunnel --url http://localhost:3000
 * 3. Update the URL below with your tunnel URL
 * 4. Sync: npm run mobile:sync:local
 */

const config: CapacitorConfig = {
  appId: "app.quiversurf.mobile",
  appName: "Quiver Dev",
  webDir: "out",
  server: {
    androidScheme: "https",
    // REPLACE THIS URL with your tunnel URL
    // Example: 'https://abc-123-xyz.trycloudflare.com'
    // Example: 'https://abc123xyz.ngrok-free.app'
    url: process.env.CAPACITOR_DEV_URL || 'https://YOUR-TUNNEL-URL-HERE.trycloudflare.com',
    cleartext: false,
    allowNavigation: ['*']
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








