import path from "node:path";

import {
  resolveBrandVaultDir,
  resolveSeoAuditDir,
  resolveSeoAuditFile,
  resolveSeoAuditRoot,
} from "@/lib/seo/agent-workflow/audit-paths";

describe("SEO workflow audit paths", () => {
  const rootDir = "/Users/stevenchandler/Desktop/dev/quiver";

  it("defaults audit artifacts to Brand-Vault outside the app repo", () => {
    expect(resolveBrandVaultDir(rootDir)).toBe("/Users/stevenchandler/Desktop/dev/Brand-Vault");
    expect(resolveSeoAuditRoot(rootDir)).toBe("/Users/stevenchandler/Desktop/dev/Brand-Vault/seo-audit");
    expect(resolveSeoAuditDir("2026-05-20", rootDir)).toBe("/Users/stevenchandler/Desktop/dev/Brand-Vault/seo-audit/2026-05-20");
    expect(resolveSeoAuditFile("SEO-WEEKLY-REPORT.md", "2026-05-20", rootDir)).toBe(
      "/Users/stevenchandler/Desktop/dev/Brand-Vault/seo-audit/2026-05-20/SEO-WEEKLY-REPORT.md",
    );
  });

  it("allows overriding the audit root", () => {
    const original = process.env.QUIVER_SEO_AUDIT_ROOT;
    process.env.QUIVER_SEO_AUDIT_ROOT = path.join("/tmp", "quiver-seo-audit");

    try {
      expect(resolveSeoAuditFile("GSC-EXPORT.json", "2026-05-20", rootDir)).toBe(
        "/tmp/quiver-seo-audit/2026-05-20/GSC-EXPORT.json",
      );
    } finally {
      if (original === undefined) {
        delete process.env.QUIVER_SEO_AUDIT_ROOT;
      } else {
        process.env.QUIVER_SEO_AUDIT_ROOT = original;
      }
    }
  });
});
