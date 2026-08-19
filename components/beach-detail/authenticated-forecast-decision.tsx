"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/auth-context";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

interface AuthenticatedForecastDecision {
  report: SurfCallResult | null;
  context: ForecastRecommendationContext | null;
  isTomorrow: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isProvided: boolean;
}

type ForecastDecisionState = Omit<
  AuthenticatedForecastDecision,
  "isAuthenticated" | "isProvided"
>;

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
  const [decision, setDecision] = useState<ForecastDecisionState>(
    DEFAULT_DECISION,
  );

  useEffect(() => {
    if (!userId) {
      setDecision(DEFAULT_DECISION);
      return;
    }

    const controller = new AbortController();
    setDecision((current) => ({ ...current, isLoading: true }));

    async function fetchDecision(): Promise<void> {
      try {
        const response = await fetch(`/api/surf/call?beachId=${beachId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          setDecision(DEFAULT_DECISION);
          return;
        }

        const payload = await response.json();
        const data = payload?.data;
        if (!data?.report) {
          setDecision(DEFAULT_DECISION);
          return;
        }

        setDecision({
          report: data.report as SurfCallResult,
          context:
            (data.forecastContext as ForecastRecommendationContext | null) ??
            null,
          isTomorrow: Boolean(data.isTomorrow),
          isLoading: false,
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setDecision(DEFAULT_DECISION);
      }
    }

    void fetchDecision();
    return () => controller.abort();
  }, [beachId, userId]);

  const value = useMemo(
    () => ({
      ...decision,
      isLoading: authLoading || decision.isLoading,
      isAuthenticated: Boolean(userId),
      isProvided: true,
    }),
    [authLoading, decision, userId],
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
