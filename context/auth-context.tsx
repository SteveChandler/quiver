"use client";

import type React from "react";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

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

  // Use refs to prevent race conditions
  const initializingRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const supabase = createClient();

  // Centralized function to update auth state
  const updateAuthState = (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user || null);
    setIsAuthenticated(!!newSession);

    // Setup user account if needed
    if (newSession?.user && !setupCompleteRef.current) {
      setupUserAccount(newSession.user.id);
    }
  };

  // Simplified session refresh function
  const refreshSession = async (): Promise<void> => {
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setIsLoading(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("AuthContext: Error getting session:", error);
        updateAuthState(null);
        return;
      }

      updateAuthState(session);
    } catch (error) {
      console.error("AuthContext: Exception during session refresh:", error);
      updateAuthState(null);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  };

  // Simplified user setup function
  const setupUserAccount = async (userId: string) => {
    if (setupCompleteRef.current) return;

    try {
      // Add any user setup logic here (create profile, etc.)
      setupCompleteRef.current = true;
    } catch (error) {
      console.error("AuthContext: User setup failed:", error);
      // Don't fail auth if setup fails
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (initializingRef.current) return;

      await refreshSession();
    };

    initializeAuth();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      // Handle the auth state change
      switch (event) {
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
          updateAuthState(newSession);
          break;
        case "SIGNED_OUT":
          updateAuthState(null);
          setupCompleteRef.current = false;
          break;
        case "USER_UPDATED":
          if (newSession) {
            updateAuthState(newSession);
          }
          break;
        default:
          // For other events, just update if we have a session
          updateAuthState(newSession);
      }

      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
    } catch (error) {
      console.error("AuthContext: Sign up error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);

    try {
      // Clear any existing session first
      await supabase.auth.signOut();

      // Reset state
      setupCompleteRef.current = false;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // The onAuthStateChange listener will handle updating the state
    } catch (error) {
      console.error("AuthContext: Sign in error:", error);
      updateAuthState(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      // Reset setup state
      setupCompleteRef.current = false;

      // The onAuthStateChange listener will handle clearing the state
    } catch (error) {
      console.error("AuthContext: Sign out error:", error);
      throw error;
    } finally {
      setIsLoading(false);
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
