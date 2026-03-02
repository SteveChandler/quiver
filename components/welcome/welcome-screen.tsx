"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { isNativeApp } from "@/lib/mobile/platform";
import { OrbitAnimation } from "./orbit-animation";
import { AuthMethodPicker } from "./auth-method-picker";
import { Button } from "@/components/ui/button";

/** Animation phase order for the splash sequence */
type Phase = "splash" | "orbit" | "content" | "cta" | "auth";

/**
 * Full-screen mobile onboarding welcome screen.
 *
 * Animation sequence:
 *   0.0s  — Logo fades in (splash)
 *   0.8s  — Orbit rings appear (orbit)
 *   1.8s  — Wordmark + tagline fade in (content)
 *   2.6s  — "Get Started" CTA slides up (cta)
 *
 * Tap "Get Started" → auth picker slides up (auth phase).
 * Authenticated users are immediately redirected to "/".
 */
export function WelcomeScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("splash");

  // Redirect returning/authenticated users immediately.
  // Also redirect desktop/web visitors — this page is native-app only.
  useEffect(() => {
    if (!isLoading && !isNativeApp()) {
      router.replace("/");
      return;
    }
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  // Advance animation phases on a timer
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("orbit"), 800),
      setTimeout(() => setPhase("content"), 1800),
      setTimeout(() => setPhase("cta"), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleGetStarted = () => {
    setPhase("auth");
  };

  // Auth is still resolving — show minimal spinner to avoid flash
  if (isLoading) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-sky-950 to-blue-900"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  // Don't render the welcome UI if the user is authenticated (redirect in flight)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-sky-950 via-blue-900 to-blue-950"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Decorative background radial */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0,180,216,0.12) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Center section: logo + orbit + wordmark */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {/* Logo with orbit animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <OrbitAnimation visible={phase !== "splash"} />
        </motion.div>

        {/* Wordmark + tagline */}
        <AnimatePresence>
          {(phase === "content" || phase === "cta" || phase === "auth") && (
            <motion.div
              key="wordmark"
              className="flex flex-col items-center gap-2 text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h1 className="text-5xl font-bold tracking-tight text-white">
                Quiver
              </h1>
              <p className="text-lg font-light text-blue-200/90">
                Gets better every session.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom section: CTA or auth picker */}
      <div className="w-full max-w-sm px-6">
        <AnimatePresence mode="wait">
          {/* Auth method picker — shown after tapping Get Started */}
          {phase === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <AuthMethodPicker returnTo="/" />
            </motion.div>
          )}

          {/* Get Started CTA */}
          {phase === "cta" && (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="w-full bg-white text-blue-900 hover:bg-white/90 active:bg-white/80 font-semibold text-base"
              >
                Get Started
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
