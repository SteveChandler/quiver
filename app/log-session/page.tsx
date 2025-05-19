"use client";

import { SessionForm } from "@/components/session-forms/SessionForm";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LogSessionPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // This is a client-side fallback to ensure authentication
    if (!isLoading && !user) {
      console.log("No user detected in log-session, redirecting to home");
      // Redirect to home rather than login to avoid potential loops
      router.push("/");
    }
  }, [user, isLoading, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If we're not loading and have a user, show the form
  if (!isLoading && user) {
    return (
      <div className="flex flex-col min-h-screen">
        <SessionForm initialMode="log" />
        <BottomNavigation />
      </div>
    );
  }

  // This return is just for fallback while the redirect happens
  return null;
}
