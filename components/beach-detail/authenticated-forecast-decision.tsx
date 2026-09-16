"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useSearchParams } from "next/navigation";
import { normalizeForecastDateParam, normalizeForecastWindowParam } from "@/lib/utils/forecast-window-param";

import { useAuth } from "@/context/auth-context";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

interface AuthenticatedForecastDecision {
  report: SurfCallResult | null;
  context: ForecastRecommendationContext | null;
  isTomorrow: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** False when no provider is mounted above the consumer (legacy /beach/[slug] route) — tells it to keep its own fetch. */
  isProvided: boolean;
}

type ForecastDecisionState = Omit<
  AuthenticatedForecastDecision,
  "isAuthenticated" | "isProvided"
> & { scope?: string };

const DEFAULT_DECISION: ForecastDecisionState = {
  report: null,
  context: null,
  isTomorrow: false,
  isLoading: false,
};

const DEFAULT_CONTEXT: AuthenticatedForecastDecision = {
  ...DEFAULT_DECISION,
  isAuthenticated: false,
  isProvided: false,
};

const AuthenticatedForecastDecisionContext =
  createContext<AuthenticatedForecastDecision>(DEFAULT_CONTEXT);

interface AuthenticatedForecastDecisionProviderProps {
  beachId: string;
  children: ReactNode;
}

export function AuthenticatedForecastDecisionProvider({
  beachId,
  children,
}: AuthenticatedForecastDecisionProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const searchParams = useSearchParams();
  const forecastAt = normalizeForecastDateParam(searchParams?.get("date")) ? null : normalizeForecastWindowParam(searchParams?.get("window"));
  const scope = userId ? `${userId}:${beachId}:${forecastAt ?? "latest"}` : undefined;
  const [decision, setDecision] = useState<ForecastDecisionState>(
    DEFAULT_DECISION,
  );

  useEffect(() => {
    if (!userId) {
      setDecision(DEFAULT_DECISION);
      return;
    }

    const controller = new AbortController();
    setDecision({ ...DEFAULT_DECISION, scope, isLoading: true });
    const unavailable = { ...DEFAULT_DECISION, scope };

    async function fetchDecision(): Promise<void> {
      try {
        const response = await fetch(`/api/surf/call?${new URLSearchParams({ beachId, ...(forecastAt ? { forecastAt } : {}) })}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setDecision(unavailable);
          return;
        }

        const payload = await response.json();
        if (controller.signal.aborted) return;
        const data = payload?.data;
        if (!data?.report) {
          setDecision(unavailable);
          return;
        }

        setDecision({
          scope,
          report: data.report as SurfCallResult,
          context:
            (data.forecastContext as ForecastRecommendationContext | null) ??
            null,
          isTomorrow: Boolean(data.isTomorrow),
          isLoading: false,
        });
      } catch (error) {
        if (controller.signal.aborted || (error as Error).name === "AbortError") return;
        setDecision(unavailable);
      }
    }

    void fetchDecision();
    return () => controller.abort();
  }, [beachId, userId, scope, forecastAt]);

  const value = useMemo(
    () => ({
      ...(decision.scope === scope ? decision : DEFAULT_DECISION),
      isLoading: authLoading || (Boolean(userId) && decision.scope !== scope) || decision.isLoading,
      isAuthenticated: Boolean(userId),
      isProvided: true,
    }),
    [authLoading, decision, userId, scope],
  );

  return (
    <AuthenticatedForecastDecisionContext.Provider value={value}>
      {children}
    </AuthenticatedForecastDecisionContext.Provider>
  );
}

export function useAuthenticatedForecastDecision(): AuthenticatedForecastDecision {
  return useContext(AuthenticatedForecastDecisionContext);
}
