import { defineConfig } from "@capacitor/assets";

export default defineConfig({
  appIconSource: "mobile/assets/app-icon.png",
  splashScreenSource: "mobile/assets/splash-foreground.png",
  backgroundColor: "#0f172a",
  themeColor: "#0f172a",
  ios: {
    darkModeBackgroundColor: "#020617",
    darkModeSplashScreenSource: "mobile/assets/splash-foreground.png",
  },
  android: {
    adaptiveIconBackgroundColor: "#0f172a",
    adaptiveIconForegroundSource: "mobile/assets/app-icon.png",
  },
});
