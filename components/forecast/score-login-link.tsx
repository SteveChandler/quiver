import Link from "next/link";

interface ScoreLoginLinkProps {
  regionSlug: string;
}

export function ScoreLoginLink({ regionSlug }: ScoreLoginLinkProps) {
  return (
    <Link
      href={`/auth/sign-in?redirectTo=/forecast/${regionSlug}`}
      className="inline-flex font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#11100D] underline decoration-[#B56A2B] decoration-2 underline-offset-4 transition-colors hover:text-[#B56A2B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#11100D]"
    >
      Log in to see scores
    </Link>
  );
}
