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
import { validateEmail, formErrors } from "@/lib/form-utils";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";
import Link from "next/link";
import { getClientBrowserClient } from "@/lib/supabase";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl =
    searchParams.get("redirectTo") || searchParams.get("redirectUrl") || "/";
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
      localStorage.setItem("redirectAttempts", "0");

      // Clear any potentially stuck cookies by signing out
      fetch("/api/auth/supabase", {
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

    // Validate email format before submitting
    const emailValidation = validateEmail(email);
    if (emailValidation) {
      setError(emailValidation);
      setIsLoading(false);
      return;
    }

    try {
      // First clear any existing auth state to prevent conflicts
      localStorage.removeItem("supabase.auth.token");
      sessionStorage.removeItem("supabase.auth.token");

      // Instead of directly authenticating with the client,
      // we'll use our custom API route which handles cookies properly
      const response = await fetch("/api/auth/supabase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error("Auth failed:", result.error);

        // Handle "invalid_credentials" specifically
        if (result.error?.code === "invalid_credentials") {
          setError(
            "Invalid email or password. Please check your credentials and try again."
          );
        } else if (result.error?.message?.includes("email not confirmed")) {
          setError(
            "Your email address has not been confirmed. Please check your inbox for a confirmation email or click below to request a new one."
          );
          setShowResendConfirmation(true);
        } else {
          setError(result.error?.message || "Authentication failed");
        }
        setIsLoading(false);
        return;
      }

      // --- IMPORTANT ---
      // Although the API route has set the authentication cookies that the
      // server (middleware, RSC, etc.) relies on, the Supabase client running
      // in the browser is still unaware of the new session because no tokens
      // have been persisted to `localStorage`. This means
      // `supabase.auth.getSession()` will continue to return `null`, causing
      // our AuthContext to think the user is unauthenticated and triggering
      // client-side redirect loops.
      //
      // To keep the client and server in sync we perform a *second* sign-in
      // via the browser Supabase client. This stores the access / refresh
      // tokens locally so subsequent calls to `supabase.auth.getSession()` (or
      // `refreshSession`) succeed.
      //
      // Because the credentials have just been validated by the API route we
      // can safely repeat the call here. Any error at this stage is treated as
      // unexpected but non-fatal – we'll still fall back to the server cookie.

      try {
        const supabaseBrowser = getClientBrowserClient();
        const { error: clientSignInError } =
          await supabaseBrowser.auth.signInWithPassword({
            email,
            password,
          });

        if (clientSignInError) {
          // Log the error but don't abort – server cookies are already set so
          // protected routes will still work. The client will simply refresh
          // its session on the next `refreshSession()` call.
          console.warn(
            "Secondary client-side sign-in failed (session cookies are still set):",
            clientSignInError
          );
        }
      } catch (clientSignInException) {
        console.warn(
          "Exception during secondary client-side sign-in:",
          clientSignInException
        );
      }

      // Indicate we're about to redirect
      setIsRedirecting(true);

      // Add a delay to ensure cookies are properly set
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Explicitly refresh the session to ensure it's recognized in our auth context
      await refreshSession();

      // Reset redirect attempts counter on successful login
      localStorage.setItem("redirectAttempts", "0");

      // Redirect with router instead of location change for smoother experience

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
            {isLoading
              ? AuthLoadingStates.signingIn()
              : isRedirecting
              ? AuthLoadingStates.redirecting()
              : "Sign In"}
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
