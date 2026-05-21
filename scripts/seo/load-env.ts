import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const SEO_ENV_FILES = [".env", ".env.production.local", ".env.local"] as const;

export function loadSeoEnv(): void {
  const shellEnvKeys = new Set(Object.keys(process.env));

  for (const fileName of SEO_ENV_FILES) {
    const envPath = path.join(process.cwd(), fileName);
    if (fs.existsSync(envPath)) {
      const parsed = parse(fs.readFileSync(envPath));
      for (const [key, value] of Object.entries(parsed)) {
        if (!shellEnvKeys.has(key)) {
          process.env[key] = value;
        }
      }
    }
  }
}
