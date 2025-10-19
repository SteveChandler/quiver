"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, Mail, Sparkles, AlertCircle } from "lucide-react";
import { track } from "@/lib/analytics";

type Props = {
  /** If true, prevent any background interaction entirely */
  block?: boolean;
  /** Delay in milliseconds before showing the auth wall (default: 5000ms) */
  delayMs?: number;
  /** Allow closing the dialog (default: true for preview mode) */
  closable?: boolean;
};

export default function AuthGate({
  block = true,
  delayMs = 5000,
  closable = true,
}: Props) {
  const sb = React.useMemo(() => createSupabaseBrowser(), []);
  const [checking, setChecking] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [showEmailInput, setShowEmailInput] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [emailSent, setEmailSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Email validation
  const isEmailValid = React.useMemo(() => {
    if (!email) return false;
    // Basic email validation: contains @ and has characters before and after it
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, [email]);

  const pathname = usePathname();
  const search = useSearchParams();

  const returnTo = React.useMemo(() => {
    const q = search?.toString();
    return q ? `${pathname}?${q}` : pathname || "/";
  }, [pathname, search]);

  // Track when user dismissed the modal
  const dismissalTimeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    let timer: NodeJS.Timeout;

    (async () => {
      const { data } = await sb.auth.getSession();
      if (!alive) return;

      console.log("[AuthGate] Session check:", { hasSession: !!data.session });

      // If user is already authenticated, don't show the modal
      if (data.session) {
        console.log("[AuthGate] User authenticated, hiding modal");
        setChecking(false);
        return;
      }

      console.log(
        "[AuthGate] No session, will show modal after delay:",
        delayMs
      );

      // Check if user recently dismissed (within last 30 seconds)
      const lastDismissal = localStorage.getItem("auth_gate_dismissed");
      if (lastDismissal) {
        const dismissedAt = parseInt(lastDismissal, 10);
        const timeSinceDismissal = Date.now() - dismissedAt;

        // If dismissed less than 30 seconds ago, wait remaining time
        if (timeSinceDismissal < 30000) {
          const remainingDelay = 30000 - timeSinceDismissal;
          timer = setTimeout(() => {
            if (alive) {
              setOpen(true);
              setChecking(false);
              if (block) {
                document.body.style.overflow = "hidden";
              }
              // Track analytics
              track("auth_wall_shown", {
                page: pathname,
                delay_ms: delayMs + remainingDelay,
              });
            }
          }, remainingDelay);
          setChecking(false);
          return;
        }
      }

      // Show modal after delay
      timer = setTimeout(() => {
        if (alive) {
          console.log("[AuthGate] Timer fired, showing modal");
          setOpen(true);
          setChecking(false);
          if (block) {
            document.body.style.overflow = "hidden";
          }
          // Track analytics
          track("auth_wall_shown", {
            page: pathname,
            delay_ms: delayMs,
          });
        }
      }, delayMs);

      console.log("[AuthGate] Timer set for", delayMs, "ms");
      setChecking(false);
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [sb, block, delayMs, pathname]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!closable) return;

    if (!newOpen) {
      // User dismissed the modal
      dismissalTimeRef.current = Date.now();
      localStorage.setItem("auth_gate_dismissed", String(Date.now()));
      document.body.style.overflow = "";

      track("auth_wall_dismissed", {
        page: pathname,
      });
    }

    setOpen(newOpen);
  };

  const startOAuth = async (provider: "google") => {
    setLoading(true);
    setError(null);
    const origin = window.location.origin;

    track("auth_wall_provider_clicked", {
      provider,
      page: pathname,
    });

    try {
      const { error: oauthError } = await sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(
            returnTo
          )}`,
        },
      });

      if (oauthError) {
        console.error("OAuth error:", oauthError);
        setError(
          "Unable to sign in with Google. Please try email sign-in instead."
        );
        setLoading(false);
      }
      // If successful, browser will redirect to Google OAuth, so no need to setLoading(false)
    } catch (error) {
      console.error("OAuth exception:", error);
      setError(
        "An unexpected error occurred. Please try email sign-in instead."
      );
      setLoading(false);
    }
  };

  const startEmailLink = async () => {
    if (!email || !email.includes("@")) {
      return;
    }

    setLoading(true);
    setError(null);
    const origin = window.location.origin;

    track("auth_wall_provider_clicked", {
      provider: "email",
      page: pathname,
    });

    try {
      const { error: emailError } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(
            returnTo
          )}`,
        },
      });

      if (emailError) {
        console.error("Email magic link error:", emailError);
        setError("Failed to send magic link. Please try again.");
      } else {
        setEmailSent(true);
      }
    } catch (error) {
      console.error("Exception during email magic link:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => !closable && e.preventDefault()}
        onEscapeKeyDown={(e) => !closable && e.preventDefault()}
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2">
            <Image
              src="/logoQuiver.png"
              alt="Quiver Logo"
              width={20}
              height={20}
            />
            Keep exploring with Quiver
          </DialogTitle>
          <DialogDescription>
            Log in or sign up for free to view full maps, plan sessions, and
            join the surf community.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {emailSent ? (
          <div className="py-4 text-center space-y-3">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Check your email</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a magic link to{" "}
                <span className="font-medium">{email}</span>
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setEmailSent(false);
                setEmail("");
                setError(null);
              }}
              className="mt-4"
            >
              Try a different email
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 pt-2">
            {!showEmailInput ? (
              <>
                <Button
                  onClick={() => startOAuth("google")}
                  className="w-full"
                  size="lg"
                  variant="default"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      or
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setShowEmailInput(true);
                    setError(null);
                  }}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Sign in with Email
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        startEmailLink();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <Button
                  onClick={startEmailLink}
                  className="w-full"
                  size="lg"
                  disabled={!isEmailValid || loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Send Magic Link
                </Button>
                <Button
                  onClick={() => {
                    setShowEmailInput(false);
                    setError(null);
                  }}
                  variant="ghost"
                  className="w-full"
                >
                  Back to sign in options
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-2 flex items-center justify-center gap-1">
          <Sparkles className="h-3 w-3" />
          You'll return to <span className="font-medium">{returnTo}</span> after
          login.
        </p>
      </DialogContent>
    </Dialog>
  );
}
