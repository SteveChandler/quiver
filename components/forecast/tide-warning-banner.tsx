"use client";

import * as React from "react";
import { AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TideWarning,
  TideWarningBannerProps,
  TideWarningType,
} from "@/types/tide-diagnostics";

/**
 * Get icon component for warning severity
 */
function getWarningIcon(severity: TideWarning["severity"]) {
  switch (severity) {
    case "error":
      return <XCircle className="h-4 w-4 flex-shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 flex-shrink-0" />;
    case "info":
    default:
      return <Info className="h-4 w-4 flex-shrink-0" />;
  }
}

/**
 * Get styling classes for warning severity
 */
function getWarningStyles(severity: TideWarning["severity"]) {
  switch (severity) {
    case "error":
      return {
        container: "bg-red-50 border-red-200 text-red-800",
        icon: "text-red-500",
        dismiss: "text-red-400 hover:text-red-600",
      };
    case "warning":
      return {
        container: "bg-amber-50 border-amber-200 text-amber-800",
        icon: "text-amber-500",
        dismiss: "text-amber-400 hover:text-amber-600",
      };
    case "info":
    default:
      return {
        container: "bg-blue-50 border-blue-200 text-blue-800",
        icon: "text-blue-500",
        dismiss: "text-blue-400 hover:text-blue-600",
      };
  }
}

/**
 * Single warning item component
 */
function WarningItem({
  warning,
  onDismiss,
}: {
  warning: TideWarning;
  onDismiss?: (type: TideWarningType) => void;
}) {
  const styles = getWarningStyles(warning.severity);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2",
        styles.container
      )}
      role="alert"
    >
      <span className={cn("mt-0.5", styles.icon)}>
        {getWarningIcon(warning.severity)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{warning.message}</p>
        {warning.details && (
          <p className="text-xs opacity-80 mt-0.5">{warning.details}</p>
        )}
      </div>
      {warning.dismissible && onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(warning.type)}
          className={cn("p-0.5 rounded hover:bg-black/5", styles.dismiss) + " focus-ring"}
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * TideWarningBanner - Displays warnings about tide data quality
 *
 * Shows non-blocking warnings when tide data has quality issues:
 * - Stale data (>30 min old)
 * - Fallback station used
 * - Large interpolation gaps
 * - Missing predictions
 *
 * The chart still renders; users can dismiss warnings.
 */
export function TideWarningBanner({
  warnings,
  onDismiss,
  className,
}: TideWarningBannerProps) {
  const [dismissedTypes, setDismissedTypes] = React.useState<Set<TideWarningType>>(
    new Set()
  );

  const handleDismiss = React.useCallback(
    (type: TideWarningType) => {
      setDismissedTypes((prev) => new Set(prev).add(type));
      onDismiss?.(type);
    },
    [onDismiss]
  );

  // Filter out dismissed warnings
  const visibleWarnings = warnings.filter((w) => !dismissedTypes.has(w.type));

  if (visibleWarnings.length === 0) {
    return null;
  }

  // Sort by severity: error > warning > info
  const sortedWarnings = [...visibleWarnings].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  // If multiple warnings, show in a stacked layout
  if (sortedWarnings.length > 1) {
    return (
      <div className={cn("space-y-2", className)} role="alertdialog">
        {sortedWarnings.map((warning, index) => (
          <WarningItem
            key={`${warning.type}-${index}`}
            warning={warning}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    );
  }

  // Single warning
  return (
    <div className={className}>
      <WarningItem warning={sortedWarnings[0]} onDismiss={handleDismiss} />
    </div>
  );
}

/**
 * Compact version for mobile or constrained spaces
 */
export function TideWarningBannerCompact({
  warnings,
  onDismiss,
  className,
}: TideWarningBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || warnings.length === 0) {
    return null;
  }

  // Get the most severe warning
  const mostSevere = warnings.reduce((prev, curr) => {
    const order = { error: 0, warning: 1, info: 2 };
    return order[curr.severity] < order[prev.severity] ? curr : prev;
  });

  const styles = getWarningStyles(mostSevere.severity);
  const warningCount = warnings.length;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
        styles.container,
        className
      )}
      role="alert"
    >
      <span className={styles.icon}>{getWarningIcon(mostSevere.severity)}</span>
      <span className="flex-1 truncate">
        {warningCount === 1
          ? mostSevere.message
          : `${warningCount} data quality warnings`}
      </span>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          warnings.forEach((w) => onDismiss?.(w.type));
        }}
        className={cn("p-0.5 rounded hover:bg-black/5", styles.dismiss) + " focus-ring"}
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default TideWarningBanner;
