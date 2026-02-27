"use client";

import { useState, useCallback, useEffect } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { enableFavoriteAlerts } from "@/actions/beach/beach-favorite-actions";
import { toast } from "@/components/ui/use-toast";

interface BeachAlertCtaProps {
  beachId: string;
  beachName: string;
  compact?: boolean;
  className?: string;
}

export function BeachAlertCta({ beachId, beachName, compact, className }: BeachAlertCtaProps) {
  const { user } = useAuth();
  const { pendingAction, setPendingAction, clearPendingAction } = usePendingAction();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const enableAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await enableFavoriteAlerts(beachId);
      if (!result.success) throw new Error(result.error || "Failed to enable alerts");
      setShowSuccess(true);
      clearPendingAction();
    } catch (error) {
      toast({
        title: "Failed to enable alerts",
        description:
          error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [beachId, clearPendingAction]);

  // Deferred action: auto-trigger after sign-in when a matching pending alert exists
  useEffect(() => {
    if (
      user &&
      pendingAction?.type === "alert" &&
      pendingAction.beachId === beachId
    ) {
      enableAlerts();
    }
    // enableAlerts is stable via useCallback; including it satisfies the linter
    // without causing extra re-runs since its identity only changes when beachId does.
  }, [user, pendingAction, beachId, enableAlerts]);

  function handleClick() {
    if (!user) {
      setPendingAction({ type: "alert", beachId, beachName });
      setAuthModalOpen(true);
      return;
    }
    enableAlerts();
  }

  return (
    <>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={handleClick}
        disabled={isLoading}
        aria-label={compact ? "Get alerts" : undefined}
        className={compact
          ? className
          : "h-12 px-6 text-base font-semibold rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all"}
      >
        {isLoading ? (
          <Loader2 className={compact ? "h-4 w-4 animate-spin" : "h-5 w-5 mr-2 animate-spin"} />
        ) : (
          <Bell className={compact ? "h-4 w-4" : "h-5 w-5 mr-2"} />
        )}
        {!compact && "Get Alerts"}
      </Button>

      {showSuccess && (
        <p className="text-sm text-green-700 mt-2">
          Alerts enabled for {beachName}! Customize in{" "}
          <Link href="/profile" className="underline">
            Settings
          </Link>
          .
        </p>
      )}

      {authModalOpen && (
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
      )}
    </>
  );
}
