'use client';

import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

export function SurfCallSignInCTA() {
  const { user } = useAuth();
  if (user) return null;
  return (
    <Link
      href="/auth/sign-in"
      className="text-[11px] text-ocean-blue/70 hover:text-ocean-blue transition-colors"
    >
      Sign in for your call (board + level)
    </Link>
  );
}
