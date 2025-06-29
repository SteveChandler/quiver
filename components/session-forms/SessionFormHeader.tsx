"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import {
  getFormText,
  getModeStyles,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";

interface SessionFormHeaderProps {
  mode: SessionFormMode;
}

export function SessionFormHeader({ mode }: SessionFormHeaderProps) {
  const text = getFormText(mode);
  const styles = getModeStyles(mode);
  const isPlanning = mode === "plan";

  return (
    <header
      className={`sticky top-0 z-10 border-b ${styles.headerBg} ${styles.headerBorder}`}
    >
      <div className="container px-4 py-4">
        <div className="flex items-start">
          <Link href="/" className="mr-3 mt-1">
            <ArrowLeft className={`h-5 w-5 ${styles.headerText}`} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isPlanning ? (
                <Calendar className={`h-5 w-5 ${styles.iconColor}`} />
              ) : (
                <CheckCircle2 className={`h-5 w-5 ${styles.iconColor}`} />
              )}
              <h1 className={`text-xl font-bold ${styles.headerText}`}>
                {text.pageTitle}
              </h1>
            </div>
            <p className={`text-sm ${styles.headerText} opacity-80`}>
              {text.pageDescription}
            </p>

            {/* Mode indicator badge */}
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  isPlanning
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-green-100 text-green-800 border border-green-200"
                }`}
              >
                {isPlanning ? "📅 Planning Mode" : "✅ Logging Mode"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
