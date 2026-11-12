/**
 * @jest-environment node
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const API_DIR = join(process.cwd(), "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return /^route\.(ts|tsx|js)$/.test(name) ? [path] : [];
  });
}

// The /api/* blanket in next.config.mjs caches any response without its own
// Cache-Control for 60 s. A GET that is not wrapped can send a 401, 404 or 500
// that browsers and iOS replay; see lib/middleware/api-wrappers/error-cache-wrapper.ts.
describe("every API GET keeps its errors out of caches", () => {
  const files = routeFiles(API_DIR);

  it("finds the API routes", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it.each(files.map((f) => [relative(process.cwd(), f), f]))("%s", (_name, file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/^export\s+(async\s+)?function\s+GET\b/m);
    expect(source).not.toMatch(/export\s*\{[^}]*\bGET\b[^}]*\}/);
    const exportsGet = /^export\s+const\s+GET\s*=/m.test(source);
    if (!exportsGet) return;
    const direct = /^export\s+const\s+GET\s*=\s*withErrorNoStore\(/m.test(source);
    const alias = source.match(/^export\s+const\s+GET\s*=\s*(\w+)\s*;/m)?.[1];
    const aliasWrapped =
      alias !== undefined && new RegExp(`const\\s+${alias}\\s*=\\s*withErrorNoStore\\(`).test(source);
    expect(direct || aliasWrapped).toBe(true);
  });
});
