import Link from "next/link";

interface ForecastDecisionLoginLinkProps {
  returnTo: string;
  compact?: boolean;
}

export function ForecastDecisionLoginLink({
  returnTo,
  compact = false,
}: ForecastDecisionLoginLinkProps) {
  return (
    <Link
      href={`/auth/sign-in?redirectTo=${encodeURIComponent(returnTo)}`}
      className={
        compact
          ? "inline-block border-b border-[#11100D] font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#11100D]/70 hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE5CF]"
          : "inline-block -rotate-1 border-2 border-[#11100D] bg-[#EFE5CF] px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D] shadow-[2px_2px_0_#11100D] hover:bg-[#F7E7BE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE5CF]"
      }
    >
      {compact ? "Sign in" : "Sign in to reveal"}
    </Link>
  );
}
