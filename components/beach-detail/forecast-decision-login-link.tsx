import Link from "next/link";

interface ForecastDecisionLoginLinkProps {
  returnTo: string;
  compact?: boolean;
  label?: string;
}

export function ForecastDecisionLoginLink({
  returnTo,
  compact = false,
  label,
}: ForecastDecisionLoginLinkProps) {
  return (
    <Link
      href={`/auth/sign-in?redirectTo=${encodeURIComponent(returnTo)}`}
      className={
        compact
          ? "inline-block border-b border-[#11100D] font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#11100D]/70 hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE5CF]"
          : "inline-flex min-h-9 items-center rounded-full border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D] hover:bg-[#F6E9CE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
      }
    >
      {label ?? (compact ? "Sign in" : "Sign in to reveal")}
    </Link>
  );
}
