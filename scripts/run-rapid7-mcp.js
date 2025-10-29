#!/usr/bin/env node

/**
 * Starts the Rapid7 MCP server after loading environment variables from .env.
 * Ensures the provided RAPID7_API_KEY is available to the server process.
 */

const path = require("node:path");
const { spawn } = require("node:child_process");
const { config } = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");

config({ path: path.join(projectRoot, ".env") });

if (!process.env.RAPID7_API_KEY) {
  console.error(
    "RAPID7_API_KEY is not set in the environment. Add it to .env before starting the Rapid7 MCP server."
  );
  process.exit(1);
}

const child = spawn("npx", ["-y", "github:el95149/rapid7-mcp-server"], {
  stdio: "inherit",
  cwd: projectRoot,
  env: { ...process.env },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
