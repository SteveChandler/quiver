/**
 * @jest-environment node
 */

import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const PUBLIC_ROOT = join(process.cwd(), "public");
const DEFAULT_MEDIA_BUDGET_BYTES = 800 * 1024;
const LANDING_IMAGE_BUDGET_BYTES = 160 * 1024;
const LANDING_HERO_VIDEO_BUDGET_BYTES = 600 * 1024;

const OVERSIZED_MEDIA_ALLOWLIST = new Map<string, string>([
  [
    "public/images/app-screenshots/forecast.png",
    "legacy PNG retained for non-landing references",
  ],
  [
    "public/images/app-screenshots/local-intel.png",
    "legacy PNG retained for non-landing references",
  ],
  [
    "public/images/app-screenshots/session.png",
    "legacy PNG retained for non-landing references",
  ],
  [
    "public/images/app-screenshots/surf-call.png",
    "legacy PNG retained for non-landing references",
  ],
  [
    "public/images/app-screenshots/verdict.png",
    "legacy PNG retained for non-landing references",
  ],
  [
    "public/images/app-screenshots/native-features/beach-detail-personal.png",
    "existing native feature screenshot outside the landing surface",
  ],
  [
    "public/images/app-screenshots/native-features/explore-beaches.png",
    "existing native feature screenshot outside the landing surface",
  ],
  ["public/videos/buoy-loop.mp4", "existing non-landing video asset"],
  ["public/videos/onboarding-hero.mp4", "existing onboarding video asset"],
  [
    "public/videos/quiver-landing-hero-1280.mp4",
    "desktop-quality fallback retained but not used for landing autoplay",
  ],
]);

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return [path];
  });
}

describe("public media asset budget", () => {
  it("keeps newly added public screenshots and videos under the default budget", () => {
    const roots = [
      join(PUBLIC_ROOT, "images", "app-screenshots"),
      join(PUBLIC_ROOT, "videos"),
    ];
    const oversized = roots
      .flatMap(listFiles)
      .map((path) => ({
        path: `public/${relative(PUBLIC_ROOT, path)}`,
        size: statSync(path).size,
      }))
      .filter(({ path, size }) => {
        return (
          size > DEFAULT_MEDIA_BUDGET_BYTES &&
          !OVERSIZED_MEDIA_ALLOWLIST.has(path)
        );
      });

    expect(oversized).toEqual([]);
  });

  it("keeps landing media on the documented lightweight assets", () => {
    const landingAssets = [
      "public/images/app-screenshots/surf-call-720.webp",
      "public/images/app-screenshots/local-intel-720.webp",
      "public/images/app-screenshots/session-log-720.webp",
    ];

    for (const asset of landingAssets) {
      expect(statSync(join(process.cwd(), asset)).size).toBeLessThanOrEqual(
        LANDING_IMAGE_BUDGET_BYTES,
      );
    }

    expect(
      statSync(
        join(process.cwd(), "public/videos/quiver-landing-hero-720.mp4"),
      ).size,
    ).toBeLessThanOrEqual(LANDING_HERO_VIDEO_BUDGET_BYTES);
  });
});
