/**
 * Public Share Page Client Component
 * Handles UI rendering and authentication state for public share pages
 */

"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import type { SessionWithDetails } from "@/types/database";
import SurfSessionCard from "@/components/session/SurfSessionCard";
import { ShareBar } from "@/components/share/ShareBar";
import AuthGate from "@/components/auth/auth-gate";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import { format } from "date-fns";
import { Calendar, MapPin, User, Star, LogIn } from "lucide-react";
import Link from "next/link";

interface SharePageClientProps {
  session: SessionWithDetails;
  sessionId: string;
}

export function SharePageClient({
  session: initialSession,
  sessionId,
}: SharePageClientProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [session, setSession] = useState<SessionWithDetails>(initialSession);

  const beachName = session.beaches?.name || "Unknown Beach";
  const userName = session.profiles?.full_name || "QuiverSurf User";
  const date = format(new Date(session.arrival_time), "MMMM d, yyyy");
  const hasNotes = session.notes && session.notes.trim().length > 0;

  // Track page view on mount
  useEffect(() => {
    track("share_page_viewed", {
      sessionId,
      beachName,
      isAuthenticated: !!user,
      hasNotes,
    });
  }, [sessionId, beachName, user, hasNotes]);

  // Handle sign-in CTA click
  const handleSignInClick = () => {
    setAuthModalOpen(true);
    trackAuthModalOpened({
      mode: "signup",
      source: "public-share-page",
      context: `session_${sessionId}`,
    });
    track("sign_up_from_share_clicked", {
      sessionId,
      beachName,
    });
  };

  // Handle session updates (e.g., privacy changes)
  const handleSessionUpdated = useCallback((updatedSession: SessionWithDetails) => {
    setSession(updatedSession);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Container */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
            {beachName}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {userName}'s Surf Session
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Session Card Preview */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden shadow-xl">
              <CardContent className="p-0">
                {/* Session Card - Scaled to fit viewport */}
                <div className="flex justify-center items-center p-8 bg-gray-100 dark:bg-gray-800">
                  <div className="transform scale-75 md:scale-90 origin-center">
                    <SurfSessionCard
                      session={session}
                      variant={1}
                      aspectRatio="1:1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session Notes (if public and available) */}
            {hasNotes && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Session Notes
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {session.notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Share Bar for Re-sharing */}
            {user && (
              <div className="mt-6">
                <ShareBar
                  session={session}
                  sessionId={sessionId}
                  defaultVariant={1}
                  defaultRatio="1:1"
                  surface="public_share_page"
                  onSessionUpdated={handleSessionUpdated}
                />
              </div>
            )}
          </div>

          {/* Right Column: Session Info & CTA */}
          <div className="lg:col-span-1">
            {/* Session Details Card */}
            <Card className="sticky top-8">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-bold mb-4">Session Details</h3>

                  {/* Date */}
                  <div className="flex items-start gap-3 mb-4">
                    <Calendar className="w-5 h-5 text-cyan-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Date
                      </p>
                      <p className="font-medium">{date}</p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-3 mb-4">
                    <MapPin className="w-5 h-5 text-cyan-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Location
                      </p>
                      <p className="font-medium">{beachName}</p>
                      {session.beaches?.slug && (
                        <Link
                          href={`/beach/${session.beaches.slug}`}
                          className="text-sm text-cyan-600 hover:underline"
                        >
                          View beach details →
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Surfer */}
                  <div className="flex items-start gap-3 mb-4">
                    <User className="w-5 h-5 text-cyan-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Surfer
                      </p>
                      <p className="font-medium">{userName}</p>
                    </div>
                  </div>

                  {/* Rating */}
                  {session.rating && (
                    <div className="flex items-start gap-3">
                      <Star className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Rating
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{session.rating}/5</p>
                          <div className="flex">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < Math.floor(session.rating!)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-gray-700" />

                {/* CTA Section */}
                {!user ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-center">
                      Track Your Surf Sessions
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      Join QuiverSurf to log your sessions, track conditions,
                      and share with the community.
                    </p>
                    <Button
                      onClick={handleSignInClick}
                      className="w-full"
                      size="lg"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign Up Free
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                      Free forever. No credit card required.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-center">
                      Welcome back, {user.email}!
                    </h4>
                    <Link href="/sessions/new">
                      <Button className="w-full" size="lg">
                        Log Your Session
                      </Button>
                    </Link>
                    <Link href="/sessions">
                      <Button variant="outline" className="w-full">
                        View All Sessions
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer CTA for Mobile */}
        {!user && (
          <div className="mt-8 p-6 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg text-white text-center lg:hidden">
            <h3 className="text-2xl font-bold mb-2">
              Start Tracking Your Sessions
            </h3>
            <p className="mb-4 opacity-90">
              Join thousands of surfers using QuiverSurf
            </p>
            <Button
              onClick={handleSignInClick}
              variant="secondary"
              size="lg"
              className="w-full max-w-md"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign Up Free
            </Button>
          </div>
        )}
      </div>

      {/* Auth Gate - 5 second delay for non-authenticated users */}
      {!user && (
        <Suspense fallback={null}>
          <AuthGate delayMs={5000} block={false} closable={true} />
        </Suspense>
      )}

      {/* Unified Auth Modal */}
      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source="public-share-page"
        returnTo={pathname}
        isAuthGate={false}
        dismissible={true}
        showCloseButton={true}
      />
    </div>
  );
}
