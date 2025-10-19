"use client";

import { BeachDetail } from "@/components/beach-detail";
import { useAuth } from "@/context/auth-context";
import { useEffect, Suspense } from "react";
import { trackPublicPageView } from "@/lib/analytics";
import type { Beach } from "@/types/database";
import AuthGate from "@/components/auth/auth-gate";

interface BeachDetailClientProps {
  beach: Beach;
  slug: string;
}

export function BeachDetailClient({ beach, slug }: BeachDetailClientProps) {
  const { user } = useAuth();

  useEffect(() => {
    // Track public page view
    if (!user) {
      trackPublicPageView("beach-detail", { slug });
    }
  }, [slug, user]);

  return (
    <>
      <Suspense fallback={null}>
        <AuthGate block />
      </Suspense>
      <BeachDetail id={beach.id} publicMode={!user} initialBeach={beach} />
    </>
  );
}
