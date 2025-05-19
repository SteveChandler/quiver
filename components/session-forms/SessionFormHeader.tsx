"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SessionFormMode } from "@/hooks/use-session-form";

interface SessionFormHeaderProps {
  mode: SessionFormMode;
}

export function SessionFormHeader({ mode }: SessionFormHeaderProps) {
  const isPlanning = mode === "plan";

  return (
    <header className="sticky top-0 z-10 bg-background border-b">
      <div className="container flex items-center h-16 px-4">
        <Link href="/" className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">
          {isPlanning ? "Plan Session" : "Log Session"}
        </h1>
      </div>
    </header>
  );
}
