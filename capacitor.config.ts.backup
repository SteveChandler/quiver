import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.quiversurf.mobile",
  appName: "Quiver",
  webDir: "out",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
    url: process.env.CAPACITOR_LIVE_URL || "https://dev.quiversurf.app",
    cleartext: process.env.NODE_ENV !== "production",
  },
  loggingBehavior: process.env.NODE_ENV === "production" ? "production" : "debug",
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
