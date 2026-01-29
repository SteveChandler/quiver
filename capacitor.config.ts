import type { CapacitorConfig } from "@capacitor/cli";

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
    StatusBar: {
      overlay: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
