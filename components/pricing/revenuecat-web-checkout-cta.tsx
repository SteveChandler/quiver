"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useAuth } from "@/context/auth-context";
import {
  buildRevenueCatWebCheckoutUrl,
  hasRevenueCatWebCheckoutConfiguration,
} from "@/lib/subscription/revenuecat-web-checkout";

export function RevenueCatWebCheckoutCta() {
  const { user, isLoading } = useAuth();
  const checkoutUrl = useMemo(
    () => (user?.id ? buildRevenueCatWebCheckoutUrl(user.id) : null),
    [user?.id],
  );

  if (isLoading || !hasRevenueCatWebCheckoutConfiguration()) return null;

  if (!checkoutUrl) {
    if (user) return null;

    return (
      <div className="mt-5 border-t-2 border-dashed border-[#11100D]/25 pt-5 sm:max-w-sm">
        <p className="text-sm leading-6 text-[#11100D]/72">
          Already have a Quiver account? Sign in to continue to secure web
          checkout.
        </p>
        <Link
          href="/auth/sign-in?redirectTo=%2Fplans"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-[#11100D] bg-[#D9EEF4] px-5 font-semibold text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.24)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D] sm:max-w-sm"
          data-testid="revenuecat-web-checkout-sign-in"
        >
          Sign in for web checkout
          <LockKeyhole className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t-2 border-dashed border-[#11100D]/25 pt-5 sm:max-w-sm">
      <p className="text-sm leading-6 text-[#11100D]/72">
        Checkout securely on the web and keep your Quiver account connected.
      </p>
      <a
        href={checkoutUrl}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-[#11100D] bg-[#D9EEF4] px-5 font-semibold text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.24)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D] sm:max-w-sm"
        data-testid="revenuecat-web-checkout-cta"
      >
        Start web checkout
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
      <p className="mt-2 text-xs font-medium text-[#11100D]/60 sm:max-w-sm">
        Your signed-in Quiver account is used to connect the purchase.
      </p>
    </div>
  );
}
