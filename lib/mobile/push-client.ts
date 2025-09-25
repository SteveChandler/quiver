import { getNativePlatform, isNativeApp, type NativePlatform } from "./platform";

export interface PushRegistrationOptions {
  onRegister?: (data: { token: string; platform: NativePlatform }) =>
    | Promise<void>
    | void;
  onError?: (error: unknown) => void;
  timeoutMs?: number;
}

export type PushRegistrationResult =
  | { status: "granted"; token: string; platform: NativePlatform }
  | { status: "denied"; reason: string }
  | { status: "unsupported" }
  | { status: "error"; error: string };

export async function ensurePushRegistration(
  options: PushRegistrationOptions = {}
): Promise<PushRegistrationResult> {
  if (!isNativeApp()) {
    return { status: "unsupported" };
  }

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );

    let permissionState = (await PushNotifications.checkPermissions()).receive;

    if (permissionState === "prompt") {
      permissionState = (await PushNotifications.requestPermissions()).receive;
    }

    if (permissionState !== "granted") {
      return { status: "denied", reason: permissionState };
    }

    const platform = getNativePlatform();
    const timeoutMs = options.timeoutMs ?? 10000;

    await PushNotifications.register();

    return await new Promise<PushRegistrationResult>((resolve) => {
      let resolved = false;
      const cleanup = async () => {
        await Promise.allSettled([
          registrationListener.remove(),
          errorListener.remove(),
        ]);
        clearTimeout(timeoutHandle);
      };

      const finish = async (result: PushRegistrationResult) => {
        if (!resolved) {
          resolved = true;
          await cleanup();
          resolve(result);
        }
      };

      const registrationListener = PushNotifications.addListener(
        "registration",
        async ({ value }) => {
          try {
            await options.onRegister?.({ token: value, platform });
            await finish({ status: "granted", token: value, platform });
          } catch (error) {
            console.error("Push registration callback failed", error);
            await finish({
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      );

      const errorListener = PushNotifications.addListener(
        "registrationError",
        async (error) => {
          options.onError?.(error);
          await finish({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : typeof error === "string"
                ? error
                : "Unknown push registration error",
          });
        }
      );

      const timeoutHandle = setTimeout(() => {
        options.onError?.(new Error("Push registration timed out"));
        void finish({
          status: "error",
          error: "Push registration timed out",
        });
      }, timeoutMs);
    });
  } catch (error) {
    console.error("Failed to initialize push notifications", error);
    options.onError?.(error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
