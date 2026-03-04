"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInWithApple } from "@/lib/mobile/apple-sign-in";
import { initiateOAuthFlow } from "@/lib/auth/auth-utils";

interface AuthMethodPickerProps {
  /** Path to redirect to after successful authentication */
  returnTo?: string;
}

export function AuthMethodPicker({ returnTo = "/" }: AuthMethodPickerProps) {
  const router = useRouter();
  const [loadingApple, setLoadingApple] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAnyLoading = loadingApple || loadingGoogle || loadingEmail;

  const handleAppleSignIn = async () => {
    setLoadingApple(true);
    setError(null);

    const result = await signInWithApple(returnTo);

    if (result.error) {
      setError(result.error);
      setLoadingApple(false);
      return;
    }

    // Native: auth completed inline — AuthContext will update and WelcomeScreen will redirect.
    // Web: OAuth redirect triggered — browser navigates away.
    setLoadingApple(false);
  };

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setError(null);

    const result = await initiateOAuthFlow("google", returnTo);

    if (result.error) {
      setError(result.error);
      setLoadingGoogle(false);
      return;
    }

    // Native: auth completed inline — AuthContext will update and WelcomeScreen will redirect.
    // Web: OAuth redirect triggered — browser navigates away.
    setLoadingGoogle(false);
  };

  const handleEmailSignUp = () => {
    setLoadingEmail(true);
    router.push("/auth/sign-up");
  };

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Error display */}
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* Apple Sign In — first per Apple HIG */}
      <Button
        onClick={handleAppleSignIn}
        variant="default"
        size="lg"
        className="w-full"
        disabled={isAnyLoading}
      >
        {loadingApple ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        )}
        Continue with Apple
      </Button>

      {/* Google Sign In */}
      <Button
        onClick={handleGoogleSignIn}
        variant="outline"
        size="lg"
        className="w-full"
        disabled={isAnyLoading}
      >
        {loadingGoogle ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        Continue with Google
      </Button>

      {/* Email Sign Up */}
      <Button
        onClick={handleEmailSignUp}
        variant="outline"
        size="lg"
        className="w-full"
        disabled={isAnyLoading}
      >
        {loadingEmail ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Mail className="mr-2 h-4 w-4" />
        )}
        Continue with Email
      </Button>

      {/* Already have an account */}
      <Button
        variant="ghost"
        size="lg"
        className="w-full text-white/60 hover:text-white/80 hover:bg-white/10"
        onClick={() => router.push("/auth/sign-in")}
        disabled={isAnyLoading}
      >
        Already have an account? <span className="ml-1 font-semibold text-white">Log in</span>
      </Button>
    </div>
  );
}
