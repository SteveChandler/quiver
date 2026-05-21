import path from "node:path";

export function resolveBrandVaultDir(rootDir = process.cwd()): string {
  return process.env.QUIVER_BRAND_VAULT_DIR ??
    path.resolve(rootDir, "..", "Brand-Vault");
}

export function resolveSeoAuditRoot(rootDir = process.cwd()): string {
  return process.env.QUIVER_SEO_AUDIT_ROOT ??
    path.join(resolveBrandVaultDir(rootDir), "seo-audit");
}

export function currentAuditDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function resolveSeoAuditDir(
  date = currentAuditDate(),
  rootDir = process.cwd(),
): string {
  return path.join(resolveSeoAuditRoot(rootDir), date);
}

export function resolveSeoAuditFile(
  fileName: string,
  date = currentAuditDate(),
  rootDir = process.cwd(),
): string {
  return path.join(resolveSeoAuditDir(date, rootDir), fileName);
}
