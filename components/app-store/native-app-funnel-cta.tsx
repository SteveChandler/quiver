import type { ReactElement, ReactNode } from "react";

import { IosAppStoreCta } from "@/components/app-store/ios-app-store-cta";
import { SendToPhoneCta } from "@/components/app-store/send-to-phone-cta";
import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";
import { IOS_APP_STORE_CTA } from "@/lib/constants/app-store";
import { ANDROID_WAITLIST_CTA } from "@/lib/constants/android-waitlist";

interface NativeAppFunnelCtaProps {
  platform: FirstTouchPlatform;
  source: string;
  surface: string;
  placement: string;
  variant?: string;
  /** Applied to the iOS/Android button surfaces. Desktop module is self-styled. */
  className?: string;
  /** Desktop send-to-phone card className. */
  desktopClassName?: string;
  iosLabel?: ReactNode;
  androidLabel?: ReactNode;
}

/** Single source of device-aware native routing for navbar, hero, platform
 * strip, and final CTA. Prevents CTA logic from drifting per surface. */
export function NativeAppFunnelCta({
  platform,
  source,
  surface,
  placement,
  variant,
  className,
  desktopClassName,
  iosLabel = IOS_APP_STORE_CTA,
  androidLabel = ANDROID_WAITLIST_CTA,
}: NativeAppFunnelCtaProps): ReactElement {
  if (platform === "android") {
    return (
      <AndroidWaitlistCta
        source={source}
        surface={surface}
        placement={placement}
        className={className}
      >
        {androidLabel}
      </AndroidWaitlistCta>
    );
  }

  if (platform === "desktop") {
    return (
      <SendToPhoneCta
        source={source}
        surface={surface}
        placement={placement}
        variant={variant}
        className={desktopClassName}
      />
    );
  }

  return (
    <IosAppStoreCta
      source={source}
      surface={surface}
      placement={placement}
      className={className}
    >
      {iosLabel}
    </IosAppStoreCta>
  );
}
