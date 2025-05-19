"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") || "/";
  const { refreshSession } = useAuth();

  useEffect(() => {
    // Detect if we're in a potential redirect loop
    const redirectAttempts = parseInt(
      localStorage.getItem("redirectAttempts") || "0"
    );

    // Set redirectAttempts on page load, regardless of the sign-in status
    if (redirectUrl !== "/") {
      localStorage.setItem(
        "redirectAttempts",
        (redirectAttempts + 1).toString()
      );
    }

    // If too many redirect attempts, clear auth state and redirect to home
    if (redirectAttempts > 2) {
      console.log("Too many redirect attempts detected, clearing state");
      localStorage.setItem("redirectAttempts", "0");

      // Clear any potentially stuck cookies by signing out
      fetch("/api/auth/[...supabase]", {
        method: "DELETE",
        credentials: "include",
      }).then(() => {
        // Force hard refresh to homepage to clear everything
        window.location.href = "/";
      });
    }
  }, [redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // First clear any existing auth state to prevent conflicts
      localStorage.removeItem("supabase.auth.token");
      sessionStorage.removeItem("supabase.auth.token");

      // Get the Supabase client
      const { getClientBrowserClient } = await import("@/lib/supabase");
      const supabase = getClientBrowserClient();

      // First try direct Supabase auth - this will set localStorage
      console.log("Sign-in form: Attempting direct Supabase auth...");
      const { data: directAuthData, error: directAuthError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (directAuthError) {
        console.error("Direct Supabase auth failed:", directAuthError);
      } else {
        console.log(
          "Direct Supabase auth successful:",
          !!directAuthData.session
        );
      }

      // Now use the API endpoint for sign-in to properly set cookies
      console.log("Sign-in form: Attempting server-side auth...");
      const res = await fetch("/api/auth/[...supabase]", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // crucial: include credentials so Set-Cookie will stick
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const { data, error } = await res.json();

      if (error) {
        if (error.code === "email_not_confirmed") {
          setError(
            "Your email address has not been confirmed. Please check your inbox for a confirmation email or click below to request a new one."
          );
          setShowResendConfirmation(true);
        } else {
          setError(error.message);
        }
        setIsLoading(false);
        return;
      }

      // Indicate we're about to redirect
      setIsRedirecting(true);

      // Add a longer delay to ensure cookies are processed before redirecting
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Explicitly refresh the session to ensure it's recognized in our auth context
      await refreshSession();

      // Check if session is available after refreshing
      const localStorageSession = localStorage.getItem("supabase.auth.token");
      const sessionStorageSession = sessionStorage.getItem(
        "supabase.auth.token"
      );
      console.log("Sign-in form: Auth state after sign-in:", {
        localStorage: !!localStorageSession,
        sessionStorage: !!sessionStorageSession,
      });

      // Double-check session on server
      const checkSession = await fetch("/api/auth/check-session", {
        method: "GET",
        credentials: "include",
      });

      const sessionData = await checkSession.json();
      console.log("Sign-in form: Server session check result:", sessionData);

      // Skip the refresh-session call since it requires an existing session
      // and we've already tried to create one through the API and direct Supabase

      // Reset redirect attempts counter on successful login
      localStorage.setItem("redirectAttempts", "0");

      // Redirect with router instead of location change for smoother experience
      console.log("Sign-in form: Redirecting to:", redirectUrl);
      router.push(redirectUrl);
    } catch (error) {
      console.error("Sign in error:", error);
      setError("An error occurred during sign in. Please try again.");
      setIsRedirecting(false);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>
          {redirectUrl !== "/"
            ? "Sign in to continue to the protected page"
            : "Sign in to your account to continue"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
              {showResendConfirmation && (
                <Button
                  variant="link"
                  className="mt-2 p-0 h-auto text-white/90 underline"
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      const res = await fetch(
                        "/api/auth/supabase/resend-confirmation",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ email }),
                        }
                      );

                      if (res.ok) {
                        setError(
                          "Confirmation email sent! Please check your inbox."
                        );
                        setShowResendConfirmation(false);
                      } else {
                        const data = await res.json();
                        setError(
                          data.error?.message ||
                            "Failed to resend confirmation email."
                        );
                      }
                    } catch (e) {
                      setError(
                        "Failed to resend confirmation email. Please try again."
                      );
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  Resend confirmation email
                </Button>
              )}
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || isRedirecting}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...
              </>
            ) : isRedirecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/auth/sign-up" className="text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
