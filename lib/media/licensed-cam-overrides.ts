export type LicensedCamRightsStatus = "licensed_resolve";

export interface LicensedCamOverride {
  sourcePageUrl: string;
  importCameraUrl: string;
  provider: string;
  sourceRightsStatus: LicensedCamRightsStatus;
  note: string;
}

const LICENSED_CAM_OVERRIDES: LicensedCamOverride[] = [
  {
    sourcePageUrl:
      "https://thesurfersview.com/live-cams/california/ocean-beach-san-diego-webcam-and-surf-report/",
    importCameraUrl: "https://www.obhotel.com/Webcam-Oceanbeach.php",
    provider: "Ocean Beach Hotel / HDRelay",
    sourceRightsStatus: "licensed_resolve",
    note: "User stated on 2026-05-29 that OB Hotel and The Surfers View authorized Quiver to resolve this camera stream; import stores the official OB Hotel page URL and resolves video at runtime.",
  },
];

const LICENSED_CAM_OVERRIDES_BY_SOURCE_URL = new Map(
  LICENSED_CAM_OVERRIDES.map((override) => [
    normalizeUrlForLicensedOverride(override.sourcePageUrl),
    override,
  ])
);

export function findLicensedCamOverride(
  sourcePageUrl: string
): LicensedCamOverride | null {
  return (
    LICENSED_CAM_OVERRIDES_BY_SOURCE_URL.get(
      normalizeUrlForLicensedOverride(sourcePageUrl)
    ) ?? null
  );
}

function normalizeUrlForLicensedOverride(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/?$/, "/");
    return url.href;
  } catch {
    return value;
  }
}
