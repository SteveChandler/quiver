"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePathname } from "next/navigation";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface AlertRule {
  id: string;
  beach_id: string;
}

interface BeachAlertCtaProps {
  beachId: string;
  beachName: string;
  compact?: boolean;
  className?: string;
  /** Called when the user clicks to open the alert creation/management flow */
  onOpenAlerts?: () => void;
}

export function BeachAlertCta({ beachId, beachName, compact, className, onOpenAlerts }: BeachAlertCtaProps) {
  const { user } = useAuth();
  const { pendingAction, setPendingAction, clearPendingAction } = usePendingAction();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Fetch alert rules only for authenticated users — filter by beach_id client-side
  const fetchRules = useCallback(async (): Promise<AlertRule[]> => {
    const res = await fetch("/api/alerts/rules");
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []) as AlertRule[];
  }, []);

  const { data: allRules } = useDataFetcher(fetchRules, {
    skip: !user,
    cacheKey: user ? `alert-rules-${user.id}` : undefined,
  });

  const ruleCount = useMemo(
    () => (allRules ?? []).filter((r) => r.beach_id === beachId).length,
    [allRules, beachId]
  );

  const hasAlerts = ruleCount > 0;

  // Deferred action: after sign-in, open alert flow if pending action matches
  useEffect(() => {
    if (
      user &&
      pendingAction?.type === "alert" &&
      pendingAction.beachId === beachId
    ) {
      clearPendingAction();
      onOpenAlerts?.();
    }
  }, [user, pendingAction, beachId, clearPendingAction, onOpenAlerts]);

  function handleClick() {
    if (!user) {
      setPendingAction({ type: "alert", beachId, beachName });
      setAuthModalOpen(true);
      return;
    }
    onOpenAlerts?.();
  }

  if (compact) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          aria-label={hasAlerts ? `Alerts active (${ruleCount})` : "Set up alerts"}
          className={className}
        >
          {hasAlerts ? (
            <BellRing className="h-4 w-4" style={{ color: "#F78E42" }} />
          ) : (
            <Bell className="h-4 w-4" style={{ color: "#F78E42" }} />
          )}
          {hasAlerts && (
            <span
              className="ml-1 inline-flex items-center justify-center rounded-full text-xs font-semibold leading-none w-4 h-4 text-white"
              style={{ backgroundColor: "#F78E42", fontSize: "10px" }}
            >
              {ruleCount}
            </span>
          )}
        </Button>

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

  return (
    <>
      <div className="flex flex-col gap-1 flex-1">
        <Button
          variant="outline"
          onClick={handleClick}
          aria-label={hasAlerts ? `Manage alerts (${ruleCount} active)` : "Get alerts"}
          className={`h-12 w-full px-6 text-base font-semibold rounded-md active:scale-[0.98] transition-all border-2 ${
            hasAlerts
              ? "border-[#F78E42] text-[#F78E42] hover:bg-[#F78E42]/10"
              : "border-[#F78E42] text-[#F78E42] hover:bg-[#F78E42]/10"
          } ${className ?? ""}`}
        >
          {hasAlerts ? (
            <BellRing className="h-5 w-5 mr-2" style={{ color: "#F78E42" }} />
          ) : (
            <Bell className="h-5 w-5 mr-2" style={{ color: "#F78E42" }} />
          )}
          {hasAlerts ? (
            <span className="flex items-center gap-1.5">
              Alerts Active
              <span
                className="inline-flex items-center justify-center rounded-full text-white font-bold leading-none w-5 h-5"
                style={{ backgroundColor: "#F78E42", fontSize: "11px" }}
              >
                {ruleCount}
              </span>
            </span>
          ) : (
            "Get Alerts"
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {hasAlerts ? "Tap to manage your alert rules" : "Notify me when conditions are ideal"}
        </p>
      </div>

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
