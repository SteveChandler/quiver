"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";
import { cn } from "@/lib/utils";

interface FoundingAccessCtaProps {
  className?: string;
  source?: string;
  surface?: string;
}

const CTA_TEXT = "Join the founding access waitlist";

export function FoundingAccessCta({
  className,
  source = "pricing-founding-access",
  surface = "pricing-page",
}: FoundingAccessCtaProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (user || isLoading || hasTrackedView.current) return;

    hasTrackedView.current = true;
    trackSignupCtaView({
      source,
      surface,
      cta_type: "founding_access_waitlist",
      cta_copy_variant: "founding_access_waitlist_v1",
    });
  }, [isLoading, source, surface, user]);

  if (!isLoading && user) {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-white/12 bg-white/[0.04] p-5 text-left sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
        data-testid="founding-access-signed-in-state"
      >
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#7BDCB5]" />
          <div>
            <p className="font-semibold text-white">You&apos;re signed in.</p>
            <p className="mt-1 text-sm leading-6 text-white/65">
              Log 5 surf sessions in Quiver to qualify for Pro for lifetime
              when plans open.
            </p>
          </div>
        </div>
        <Button
          asChild
          className="shrink-0 rounded-full bg-[#F78E42] px-5 text-[#11100D] hover:bg-[#ff9f55]"
        >
          <Link href="/map">Open Quiver</Link>
        </Button>
      </div>
    );
  }

  const handleClick = () => {
    if (isLoading || user) return;

    trackSignupCtaClick({
      source,
      surface,
      cta_type: "founding_access_waitlist",
      cta_text: CTA_TEXT,
      cta_copy_variant: "founding_access_waitlist_v1",
    });
    setAuthModalOpen(true);
  };

  return (
    <div className={cn("flex flex-col items-start gap-3", className)}>
      <Button
        size="lg"
        disabled={isLoading}
        className="rounded-full bg-[#F78E42] px-6 font-semibold text-[#11100D] hover:bg-[#ff9f55] focus-visible:ring-[#F78E42] focus-visible:ring-offset-[#0D1020]"
        onClick={handleClick}
      >
        {CTA_TEXT}
        <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-sm leading-6 text-white/55">
        Log 5 surf sessions to qualify for Pro for lifetime when plans open.
      </p>
      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={source}
        returnTo={pathname || "/pricing"}
        contextMessage={{
          title: "Join early",
          description:
            "Create a free Quiver account so your 5-session founding access offer is tied to you.",
        }}
      />
    </div>
  );
}
