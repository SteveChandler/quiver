"use client";

import type React from "react";

import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getClientBrowserClient } from "@/lib/supabase";
import { copyBoardTemplates } from "@/actions/board-actions";

console.log("AuthContext module loaded - " + new Date().toISOString());

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const supabase = getClientBrowserClient();

  // Function to refresh session
  const refreshSession = async () => {
    setIsLoading(true);
    try {
      // First try direct Supabase getSession to see if we have a session in localStorage
      console.log(
        "AuthContext: refreshSession - Checking for client-side session"
      );
      const clientSession = await supabase.auth.getSession();
      const hasClientSession = !!clientSession.data.session;

      console.log(
        "AuthContext: refreshSession - Client-side session exists:",
        hasClientSession
      );

      // Also check with the API endpoint to ensure cookies are refreshed
      console.log(
        "AuthContext: refreshSession - Checking for server-side session"
      );
      let apiRes;
      try {
        apiRes = await fetch("/api/auth/[...supabase]", {
          method: "GET",
          credentials: "include",
        });
      } catch (e) {
        console.warn("API session fetch failed:", e);
      }

      // If the API call failed, try the direct Supabase call
      if (!apiRes?.ok) {
        console.warn("API session refresh failed, relying on client session");
      }

      // Try to get session data from the API response
      let sessionFromApi = null;
      try {
        if (apiRes?.ok) {
          sessionFromApi = await apiRes.json();
          console.log("Session from API:", sessionFromApi);
        }
      } catch (e) {
        console.warn("Failed to parse API session response", e);
      }

      // Check if we have some form of session
      if (hasClientSession) {
        console.log("Using client-side session data");
        setSession(clientSession.data.session);
        setUser(clientSession.data.session?.user || null);
        setIsAuthenticated(true);
        return;
      } else if (sessionFromApi) {
        console.log("Using API-provided session data");
        // If we have a session from the API but not the client, try a direct session sync
        try {
          const refreshResult = await supabase.auth.refreshSession();
          if (refreshResult.data.session) {
            setSession(refreshResult.data.session);
            setUser(refreshResult.data.session.user);
            setIsAuthenticated(true);
            return;
          }
        } catch (refreshError) {
          console.error("Failed to refresh after API session:", refreshError);
        }
      }

      // If we got here, try one more getSession as a final attempt
      const {
        data: { session: finalAttemptSession },
      } = await supabase.auth.getSession();

      console.log(
        "AuthContext: refreshSession - Final session check:",
        finalAttemptSession
      );

      if (finalAttemptSession) {
        setSession(finalAttemptSession);
        setUser(finalAttemptSession.user);
        setIsAuthenticated(true);
      } else {
        setSession(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error refreshing session:", error);
      // On error, clear local state to prevent inconsistencies
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle user setup (profile creation and board template copying)
  const setupUserAccount = async (userId: string) => {
    if (!userId || setupComplete) return;

    try {
      // Add a significant delay to ensure auth is fully established
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Copy board templates
      const result = await copyBoardTemplates(userId);

      if (!result.success) {
        console.error("Error setting up user account:", result.error);
      } else {
        console.log("User account setup complete:", result.message);
        setSetupComplete(true);
      }
    } catch (error) {
      console.error("Exception in setupUserAccount:", error);
      // Don't sign out the user if setup fails
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      setIsLoading(true);
      console.log(
        "AuthContext: getInitialSession - Attempting to get session..."
      );
      try {
        // First try to get the session from the server to ensure cookies are in sync
        try {
          const serverSessionRes = await fetch("/api/auth/[...supabase]", {
            method: "GET",
            credentials: "include",
          });

          if (serverSessionRes.ok) {
            const serverSession = await serverSessionRes.json();
            console.log(
              "AuthContext: getInitialSession - Session from server:",
              serverSession
            );
          }
        } catch (e) {
          console.warn("Failed to get session from server", e);
        }

        // Now check client-side
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log(
          "AuthContext: getInitialSession - Full session object:",
          session
        );
        console.log("AuthContext: getInitialSession - Result:", {
          hasSession: !!session,
          userId: session?.user?.id,
        });

        if (session) {
          setSession(session);
          setUser(session.user);
          setIsAuthenticated(true);

          // If user is already logged in, set up their account
          setupUserAccount(session.user.id);
        } else {
          // If client doesn't have a session, check if we should perform a session recovery
          try {
            // Try to refresh the session explicitly
            const { data: refreshData, error: refreshError } =
              await supabase.auth.refreshSession();

            if (refreshData.session) {
              console.log(
                "AuthContext: getInitialSession - Session recovered through refresh"
              );
              setSession(refreshData.session);
              setUser(refreshData.session.user);
              setIsAuthenticated(true);
              return;
            } else if (refreshError) {
              console.log(
                "AuthContext: getInitialSession - Session refresh failed:",
                refreshError
              );
            }
          } catch (refreshError) {
            console.error("Error refreshing session:", refreshError);
          }

          // No session was found or recovered
          setSession(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error getting session:", error);
        // Don't reset user state on error to prevent unintended sign-outs
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "AuthContext: onAuthStateChange - Event:",
        event,
        "Full session received:",
        session
      );

      if (session) {
        if (event === "SIGNED_IN") {
          console.log(
            "AuthContext: onAuthStateChange - SIGNED_IN event. User ID:",
            session.user?.id,
            "Session:",
            session
          );
        }
        setSession(session);
        setUser(session.user);
        setIsAuthenticated(true);
        setIsLoading(false);

        // If this is a new sign-up or sign-in, ensure profile exists and copy board templates
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          console.log(
            "AuthContext: onAuthStateChange - SIGNED_IN or USER_UPDATED event for setupUserAccount, current user:",
            session.user?.id
          );
          setupUserAccount(session.user.id);
        }
      } else {
        if (event === "SIGNED_OUT") {
          console.log("AuthContext: onAuthStateChange - SIGNED_OUT event.");
        }
        console.log(
          "AuthContext: onAuthStateChange - No session from auth state change, event:",
          event
        );
        // Only clear user state on explicit sign out
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setIsAuthenticated(false);
          setSetupComplete(false);
        }
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Sign up error:", error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // First clear any existing sessions to prevent conflicts
      console.log(
        "AuthContext: signIn - Attempting to sign out before signing in..."
      );
      await supabase.auth.signOut();
      console.log(
        "AuthContext: signIn - Sign out completed. Resetting redirect attempts."
      );

      // Reset redirect attempts counter
      localStorage.setItem("redirectAttempts", "0");

      console.log(
        "AuthContext: signIn - Attempting to signInWithPassword for email:",
        email
      );
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log(
        "AuthContext: signIn - signInWithPassword response. Data:",
        data,
        "Error:",
        error
      );

      if (error) {
        console.error(
          "AuthContext: signIn - Error from signInWithPassword:",
          error
        );
        throw error;
      }

      // TEMPORARILY COMMENTED OUT FOR DIAGNOSTICS: Rely on onAuthStateChange for state updates
      // if (data?.session) {
      //   console.log("AuthContext: signIn - Session data received from signInWithPassword. Manually setting context (temporarily disabled).");
      //   // setSession(data.session);
      //   // setUser(data.session.user);
      //   // setIsAuthenticated(true);

      //   // // Ensure browser has the session before redirecting
      //   // await new Promise((resolve) => setTimeout(resolve, 800));

      //   // // Force a session refresh to ensure cookies are set
      //   // console.log("AuthContext: signIn - Calling supabase.auth.getSession() client-side (temporarily disabled).");
      //   // await supabase.auth.getSession();

      //   // // Also call our API endpoint to ensure cookies are properly set
      //   // console.log("AuthContext: signIn - Fetching /api/auth/[...supabase] GET (temporarily disabled).");
      //   // await fetch("/api/auth/[...supabase]", {
      //   //   method: "GET",
      //   //   credentials: "include",
      //   // });
      // } else {
      //   console.log("AuthContext: signIn - No session data in response from signInWithPassword.");
      // }
      // End of temporarily commented out section

      // If signInWithPassword is successful, onAuthStateChange SHOULD fire with SIGNED_IN.
      // We are now relying on that for state updates.
    } catch (error) {
      console.error(
        "AuthContext: signIn - Error during sign in process:",
        error
      );
      // Clear any inconsistent state on error
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setSetupComplete(false);
      console.log("AuthContext: signOut - Attempting to sign out...");
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error(
          "AuthContext: signOut - Error from supabase.auth.signOut:",
          error
        );
        throw error;
      }
      console.log(
        "AuthContext: signOut - Sign out successful from Supabase. Clearing local context state."
      );

      // Clear session state immediately
      // This will also be handled by onAuthStateChange if event fires correctly, but good for immediate feedback.
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
