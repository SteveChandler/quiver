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
      <div className="container px-4 py-4">
        <div className="flex items-start">
          <Link href="/" className="mr-3 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold mb-1">
              {isPlanning ? "Plan Session" : "Log Session"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isPlanning
                ? "Plan your upcoming surf session - set your goals, choose your spot, and get ready to charge!"
                : "Record your completed surf session - share how it went, rate the conditions, and track your progress."}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
