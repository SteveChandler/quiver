import { type LucideIcon, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ZeroStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}

export interface ZeroStateProps {
  /** Lucide icon to display */
  icon: LucideIcon;
  /** Main heading text */
  title: string;
  /** Description text below heading */
  description: string;
  /** Primary call-to-action button */
  action?: ZeroStateAction;
  /** Optional secondary action button */
  secondaryAction?: ZeroStateAction;
  /** Optional pro tip text */
  proTip?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable zero state component for empty states.
 * Follows the Screen State Planner pattern with icon, heading, description, and CTA.
 */
export function ZeroState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  proTip,
  className,
}: ZeroStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12",
        className
      )}
    >
      <Icon className="h-16 w-16 text-muted-foreground" />
      <h3 className="text-xl font-semibold text-foreground mt-4">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs text-center">
        {description}
      </p>

      {/* Action buttons */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {action && <ActionButton action={action} variant="default" />}
          {secondaryAction && (
            <ActionButton action={secondaryAction} variant="outline" />
          )}
        </div>
      )}

      {/* Pro tip */}
      {proTip && (
        <div className="mt-6 bg-info/10 border border-info/20 rounded-lg p-4 max-w-sm">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">{proTip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionButtonProps {
  action: ZeroStateAction;
  variant: "default" | "outline";
}

function ActionButton({ action, variant }: ActionButtonProps) {
  const buttonContent = (
    <>
      {action.icon && <action.icon className="h-4 w-4 mr-2" />}
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <Button variant={variant} asChild>
        <Link href={action.href}>{buttonContent}</Link>
      </Button>
    );
  }

  return (
    <Button variant={variant} onClick={action.onClick}>
      {buttonContent}
    </Button>
  );
}
