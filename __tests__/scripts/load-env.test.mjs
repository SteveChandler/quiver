import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { config } from "../../scripts/load-env.mjs";

test("optional env loading preserves existing values unless override is set", () => {
  const dir = mkdtempSync(join(tmpdir(), "quiver-env-"));
  const file = join(dir, ".env");
  const name = "QUIVER_ENV_LOADER_TEST";
  const previous = process.env[name];

  try {
    writeFileSync(file, `${name}=file-value\n`);
    process.env[name] = "existing-value";
    config({ path: join(dir, "missing") });
    config({ path: file });
    assert.equal(process.env[name], "existing-value");
    config({ path: file, override: true });
    assert.equal(process.env[name], "file-value");
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
