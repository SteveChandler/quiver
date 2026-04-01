"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isIndex = pathname === "/tools";

  return (
    <>
      {!isIndex && (
        <nav
          className="border-[rgba(64,76,146,0.4)] bg-[#1A2158]/80 backdrop-blur-sm border-b sticky top-0 z-30"
        >
          <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
            <Link
              href="/tools"
              className="flex items-center gap-1.5 text-sm text-[#7A8CC0] hover:text-[#F78E42] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium">Surfer&apos;s Toolkit</span>
            </Link>
          </div>
        </nav>
      )}
      {children}
    </>
  );
}
