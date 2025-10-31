#!/usr/bin/env node

/**
 * Starts the Supabase MCP server after loading credentials from project env files.
 * Ensures SUPABASE_ACCESS_TOKEN is set before delegating to the MCP package.
 */

const path = require("node:path");
const { spawn } = require("node:child_process");
const { config } = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");

// Load environment variables from .env and .env.local if available.
config({ path: path.join(projectRoot, ".env") });
config({ path: path.join(projectRoot, ".env.local"), override: true });

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    "SUPABASE_ACCESS_TOKEN is not set. Add it to .env or export it before starting the Supabase MCP server."
  );
  process.exit(1);
}

const child = spawn(
  "npx",
  [
    "-y",
    "@supabase/mcp-server-supabase@latest",
    "--read-only",
    "--project-ref=vawdnbbgawichorsjiwe",
  ],
  {
    stdio: "inherit",
    cwd: projectRoot,
    env: { ...process.env },
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
