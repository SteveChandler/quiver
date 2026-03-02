import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.quiversurf.mobile",
  appName: "Quiver",
  webDir: "out",
  server: {
    androidScheme: "https",
    url: "https://www.quiversurf.app/welcome",
    cleartext: false,
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
