"use client";

import { useSyncExternalStore } from "react";

import {
  getInstallAskClaimState,
  subscribeInstallAskClaim,
  type InstallAskClaimState,
} from "@/lib/app-store/install-ask-claim";

// The server and the hydration pass see "none", so CDN-shared HTML never
// depends on a visitor's session; the real state lands right after hydration.
const getServerState = (): InstallAskClaimState => "none";

export function useInstallAskClaim(): InstallAskClaimState {
  return useSyncExternalStore(
    subscribeInstallAskClaim,
    getInstallAskClaimState,
    getServerState,
  );
}
