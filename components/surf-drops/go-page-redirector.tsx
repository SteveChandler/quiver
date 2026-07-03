"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useClaimDropSlug } from "@/hooks/use-claim-drop-slug";
import { useTrackEvent } from "@/hooks/use-track-event";

interface GoPageRedirectorProps {
  slug: string;
  action: "claim" | "redirect";
  dropId?: string;
}

/**
 * Client-side auto-claim + redirect for /go/[slug] when the viewer is
 * authorized but the server rendered a placeholder shell. Fires
 * `surf_drop_link_view_authenticated` before navigating.
 */
export function GoPageRedirector({ slug, action, dropId }: GoPageRedirectorProps) {
  const router = useRouter();
  const { claim } = useClaimDropSlug();
  const { track } = useTrackEvent();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void track("surf_drop_link_view_authenticated" , {
      metadata: { slug },
    });

    (async () => {
      let targetDropId = dropId ?? null;
      if (action === "claim") {
        try {
          const result = await claim(slug);
          targetDropId = result.drop_id;
          void track("surf_drop_claimed" , {
            metadata: { slug, drop_id: result.drop_id },
          });
        } catch {
          router.replace("/");
          return;
        }
      }
      if (targetDropId) {
        router.replace(`/drops/${targetDropId}?from=go&slug=${slug}`);
      }
    })();
  }, [action, claim, dropId, router, slug, track]);

  return (
    <div className="surf-drop-loading" role="status" aria-live="polite">
      <p>Opening the Surf Drop…</p>
    </div>
  );
}
