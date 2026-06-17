"use client";

import { useEffect, useRef, type ReactElement } from "react";

import { SendToPhoneCta } from "@/components/app-store/send-to-phone-cta";
import { trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";

export function DesktopHandoff(): ReactElement {
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackAppHandoffView({
      source: "app_handoff_route",
      surface: "app_handoff",
      placement: "handoff_page",
      platform: "desktop",
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-4 text-center font-heading text-2xl font-bold text-white">
        Get Quiver on your phone
      </h1>
      <SendToPhoneCta
        source="app_handoff_route"
        surface="app_handoff"
        placement="handoff_page"
      />
    </main>
  );
}
