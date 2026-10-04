import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Static, deliberately coarse guard: every file that builds an install
 * handoff link must also write a click event or sit on the exemption list.
 * Route hits are not taps (components/app-store/ARCHITECTURE.md), so a new
 * install anchor with no click event would silently break the weekly funnel.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SCAN_DIRS = ["app", "components"] as const;

const HANDOFF_BUILDERS =
  /\b(buildAppHandoffUrl|buildAppHandoffPath|createClientAppHandoffLink)\(/;

// Canonical tap = user_events cta_click (trackIosAppCtaClick or a direct
// cta_click track) or the invite/partner click event.
const CLICK_SIGNALS =
  /trackIosAppCtaClick|trackInstallBarClick|trackSwellShareCtaClick|trackPartnerEvent|trackInviteEvent|trackExactCallHandoffLinkOpened|["']cta_click["']|["']invite_app_store_clicked["']/;

const EXEMPT: Readonly<Record<string, string>> = {
  "app/api/app-link-email/route.ts": "email link, not an anchor click",
  "app/app-store/route.ts": "307 alias route; mints an id and redirects",
  "app/app/page.tsx": "the handoff route itself plus noscript links",
  "app/page.tsx": "al:ios:url metadata for link-preview fetchers, never a tap",
};

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function builderFiles(): string[] {
  return SCAN_DIRS.flatMap((dir) => listSourceFiles(join(ROOT, dir)))
    .filter((file) => HANDOFF_BUILDERS.test(readFileSync(file, "utf8")))
    .map((file) => relative(ROOT, file));
}

describe("install CTA click coverage", () => {
  const files = builderFiles();

  it("finds the known install CTA surfaces", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "components/app-store/ios-app-store-cta.tsx",
        "components/app-store/iphone-app-banner.tsx",
        "app/pbsc/pbsc-welcome-client.tsx",
      ]),
    );
  });

  it("writes a click event wherever an install handoff link is built", () => {
    const missing = files.filter(
      (file) =>
        !(file in EXEMPT) &&
        !CLICK_SIGNALS.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(EXEMPT))(
    "keeps the exemption for %s honest",
    (file) => {
      expect(existsSync(join(ROOT, file))).toBe(true);
      expect(files).toContain(file);
    },
  );
});
