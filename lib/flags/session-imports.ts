const SESSION_IMPORTS_ENABLED_FLAG = "SESSION_IMPORTS_ENABLED";
const SESSION_IMPORTS_USER_ALLOWLIST_FLAG = "SESSION_IMPORTS_USER_ALLOWLIST";

export function isSessionImportsEnabled(): boolean {
  return process.env[SESSION_IMPORTS_ENABLED_FLAG] === "true";
}

export function isSessionImportsUserAllowed(userId: string): boolean {
  if (!isSessionImportsEnabled()) return false;

  return (process.env[SESSION_IMPORTS_USER_ALLOWLIST_FLAG] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}
