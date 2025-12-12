import type { CapacitorConfig } from "@capacitor/cli";

/**
 * PRODUCTION CONFIG
 * 
 * This config is for production builds that connect to the live
 * production server at quiversurf.app
 */

const config: CapacitorConfig = {
  appId: "app.quiversurf.mobile",
  appName: "Quiver",
  webDir: "out",
  server: {
    androidScheme: "https",
    url: "https://www.quiversurf.app",
    cleartext: false,
    allowNavigation: ['*']
  },
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














































