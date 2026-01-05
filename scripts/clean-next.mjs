import { rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(nextDir))) {
    return;
  }

  await rm(nextDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("[clean-next] Failed to delete .next:", err);
  process.exit(1);
});













