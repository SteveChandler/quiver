/*
 * "One ask at a time" across a visit. Once the cam install sheet has shown,
 * no other install ask (install bar, iPhone banner, in-page CTA) shows for the
 * rest of the visit. A visit is the browser tab session (sessionStorage); when
 * storage is blocked it is the page load (memory). Mounted asks subscribe, so
 * the bar leaves the screen the moment the sheet appears.
 */

export type InstallAskClaimState = "none" | "open" | "done";

const STORAGE_KEY = "quiver_install_ask_claimed_v1";

let memoryState: InstallAskClaimState = "none";
const listeners = new Set<() => void>();

function readStoredClaim(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Storage blocked (private mode, sandboxed frame): memory carries the visit.
    return false;
  }
}

function writeStoredClaim(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "cam_install_sheet");
  } catch {
    // Same as above: the in-memory state still holds for this page load.
  }
}

function setState(next: InstallAskClaimState): void {
  memoryState = next;
  listeners.forEach((listener) => listener());
}

export function getInstallAskClaimState(): InstallAskClaimState {
  if (memoryState !== "none") return memoryState;
  if (typeof window === "undefined") return "none";
  return readStoredClaim() ? "done" : "none";
}

export function isInstallAskClaimed(): boolean {
  return getInstallAskClaimState() !== "none";
}

/** The cam sheet is on screen: every other ask steps aside now. */
export function openInstallAskClaim(): void {
  writeStoredClaim();
  setState("open");
}

/** The cam sheet closed; the visit stays claimed. */
export function closeInstallAskClaim(): void {
  writeStoredClaim();
  setState("done");
}

export function subscribeInstallAskClaim(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset of the in-memory state. */
export function resetInstallAskClaimForTests(): void {
  memoryState = "none";
  listeners.clear();
}
