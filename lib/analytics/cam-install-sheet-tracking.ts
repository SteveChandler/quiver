import { track } from "@/lib/analytics";
import { CAM_INSTALL_SHEET_PLACEMENT } from "@/lib/app-store/cam-install-sheet";
import type { SpotAskVariant } from "@/lib/app-store/spot-ask-copy";

export const CAM_INSTALL_SHEET_SURFACE = "beach_detail";

interface CamSheetTrackingBase {
  pathname: string;
  variant: SpotAskVariant;
  platform: "iphone" | "desktop";
}

export function trackCamInstallSheetView(base: CamSheetTrackingBase): void {
  track("cam_install_sheet_view", {
    cta_family: "cam_install_sheet",
    surface: CAM_INSTALL_SHEET_SURFACE,
    placement: CAM_INSTALL_SHEET_PLACEMENT,
    ...base,
  });
}

export function trackCamInstallSheetDismiss(
  base: CamSheetTrackingBase & { method: "not_now" | "escape" },
): void {
  track("cam_install_sheet_dismiss", {
    cta_family: "cam_install_sheet",
    surface: CAM_INSTALL_SHEET_SURFACE,
    placement: CAM_INSTALL_SHEET_PLACEMENT,
    ...base,
  });
}
