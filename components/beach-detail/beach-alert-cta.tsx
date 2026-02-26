"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface BeachAlertCtaProps {
  beachId: string;
  beachName: string;
}

export function BeachAlertCta({ beachId, beachName }: BeachAlertCtaProps) {
  const { user } = useAuth();
  const { setPendingAction } = usePendingAction();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  function handleClick() {
    if (!user) {
      setPendingAction({ type: "alert", beachId, beachName });
      setAuthModalOpen(true);
      return;
    }
    setShowSuccess(true);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleClick}
        className="h-12 px-6 text-base font-semibold rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all"
      >
        <Bell className="h-5 w-5 mr-2" />
        Get Alerts
      </Button>

      {showSuccess && (
        <p className="text-sm text-green-700 mt-2">
          Alerts enabled for {beachName}! Customize in{" "}
          <Link href="/profile/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      )}

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source="beach-alert-cta"
        contextMessage={{
          title: "Get Surf Alerts",
          description: `Get notified when ${beachName} hits your ideal conditions`,
        }}
        returnTo={pathname}
      />
    </>
  );
}
