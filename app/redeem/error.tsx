"use client";

import type { ReactElement } from "react";

import { RedeemView, type RedeemViewState } from "./redeem-view";

interface RedeemErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const ERROR_STATE: RedeemViewState = { kind: "error" };

export default function RedeemError({
  reset,
}: RedeemErrorProps): ReactElement {
  return <RedeemView onRetry={reset} platform="desktop" state={ERROR_STATE} />;
}
