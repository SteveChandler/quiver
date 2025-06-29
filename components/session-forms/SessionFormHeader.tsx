"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle2, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  getFormText,
  getModeStyles,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";

interface SessionFormHeaderProps {
  mode: SessionFormMode;
}

export function SessionFormHeader({ mode }: SessionFormHeaderProps) {
  const searchParams = useSearchParams();
  const convertSessionId = searchParams.get("convert");
  const isConverting = !!convertSessionId;

  const text = getFormText(mode);
  const styles = getModeStyles(mode);
  const isPlanning = mode === "plan";

  // Override text for conversion
  const headerTitle = isConverting
    ? "Complete Planned Session"
    : text.pageTitle;
  const headerDescription = isConverting
    ? "Add conditions, photos, and complete the details of your planned session"
    : text.pageDescription;

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
              {isConverting ? (
                <RotateCcw className={`h-5 w-5 ${styles.iconColor}`} />
              ) : isPlanning ? (
                <Calendar className={`h-5 w-5 ${styles.iconColor}`} />
              ) : (
                <CheckCircle2 className={`h-5 w-5 ${styles.iconColor}`} />
              )}
              <h1 className={`text-xl font-bold ${styles.headerText}`}>
                {headerTitle}
              </h1>
            </div>
            <p className={`text-sm ${styles.headerText} opacity-80`}>
              {headerDescription}
            </p>

            {/* Mode indicator badge */}
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  isConverting
                    ? "bg-orange-100 text-orange-800 border border-orange-200"
                    : isPlanning
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-green-100 text-green-800 border border-green-200"
                }`}
              >
                {isConverting
                  ? "🔄 Converting Planned Session"
                  : isPlanning
                  ? "📅 Planning Mode"
                  : "✅ Logging Mode"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
