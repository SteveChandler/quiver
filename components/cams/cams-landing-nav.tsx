"use client";

import type { ReactElement } from "react";
import { Navbar } from "@/components/landing-page/navbar";
import { useAuth } from "@/context/auth-context";

export function CamsLandingNav(): ReactElement | null {
  const { user } = useAuth();

  if (user) return null;

  return <Navbar position="static" />;
}
