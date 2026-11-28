import {
  closeInstallAskClaim,
  getInstallAskClaimState,
  isInstallAskClaimed,
  openInstallAskClaim,
  resetInstallAskClaimForTests,
  subscribeInstallAskClaim,
} from "@/lib/app-store/install-ask-claim";

const KEY = "quiver_install_ask_claimed_v1";

beforeEach(() => {
  window.sessionStorage.clear();
  resetInstallAskClaimForTests();
  jest.restoreAllMocks();
});

describe("install ask claim", () => {
  it("starts unclaimed, opens, then stays claimed for the visit", () => {
    expect(getInstallAskClaimState()).toBe("none");

    openInstallAskClaim();
    expect(getInstallAskClaimState()).toBe("open");
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull();

    closeInstallAskClaim();
    expect(getInstallAskClaimState()).toBe("done");
  });

  it("reads an earlier claim in the same tab session (a new page load)", () => {
    window.sessionStorage.setItem(KEY, "cam_install_sheet");
    expect(isInstallAskClaimed()).toBe(true);
    expect(getInstallAskClaimState()).toBe("done");
  });

  it("notifies subscribers so mounted asks leave at once", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeInstallAskClaim(listener);
    openInstallAskClaim();
    closeInstallAskClaim();
    unsubscribe();
    openInstallAskClaim();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("holds the claim in memory for the page load when storage is blocked", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(getInstallAskClaimState()).toBe("none");
    expect(() => openInstallAskClaim()).not.toThrow();
    expect(getInstallAskClaimState()).toBe("open");
  });

  it("does not swallow an unrelated error from a subscriber in the storage fallback", () => {
    const unsubscribe = subscribeInstallAskClaim(() => {
      throw new TypeError("subscriber bug");
    });
    try {
      expect(() => openInstallAskClaim()).toThrow("subscriber bug");
    } finally {
      unsubscribe();
    }
  });
});
