/**
 * @jest-environment node
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

describe("vercel.json", () => {
  it("keeps staging, production, and explicit preview deployments enabled", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(config.git.deploymentEnabled).toEqual({
      "**": false,
      main: true,
      prod: true,
      "preview/**": true,
    });
  });

  it("skips docs-only commits but builds runtime changes", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "vercel-ignore-"));
    const git = (...args) =>
      execFileSync("git", args, { cwd: repoPath, stdio: "ignore" });
    const runIgnoreCommand = (env = {}) =>
      spawnSync(config.ignoreCommand, {
        cwd: repoPath,
        env: { ...process.env, ...env },
        shell: true,
      }).status;

    try {
      git("init");
      git("config", "user.email", "test@example.com");
      git("config", "user.name", "Test User");

      fs.writeFileSync(path.join(repoPath, "README.md"), "baseline\n");
      fs.mkdirSync(path.join(repoPath, "components"));
      fs.writeFileSync(path.join(repoPath, "components", "example.tsx"), "baseline\n");
      git("add", ".");
      git("commit", "-m", "baseline");
      const baselineSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repoPath,
        encoding: "utf8",
      }).trim();

      fs.writeFileSync(path.join(repoPath, "README.md"), "docs update\n");
      git("add", "README.md");
      git("commit", "-m", "docs update");
      expect(runIgnoreCommand()).toBe(0);

      fs.mkdirSync(path.join(repoPath, "__tests__"));
      fs.writeFileSync(
        path.join(repoPath, "__tests__", "example.test.ts"),
        "test update\n",
      );
      git("add", "__tests__/example.test.ts");
      git("commit", "-m", "test update");
      expect(runIgnoreCommand()).toBe(0);

      fs.writeFileSync(
        path.join(repoPath, "components", "example.tsx"),
        "runtime update\n",
      );
      git("add", "components/example.tsx");
      git("commit", "-m", "runtime update");
      expect(runIgnoreCommand()).toBe(1);

      fs.writeFileSync(path.join(repoPath, "README.md"), "follow-up docs\n");
      git("add", "README.md");
      git("commit", "-m", "follow-up docs");
      expect(runIgnoreCommand()).toBe(0);
      expect(
        runIgnoreCommand({ VERCEL_GIT_PREVIOUS_SHA: baselineSha }),
      ).toBe(1);
    } finally {
      fs.rmSync(repoPath, { force: true, recursive: true });
    }

    expect(Array.isArray(config.crons)).toBe(true);
    expect(config.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/api/monitoring/forecast-health" }),
        expect.objectContaining({ path: "/api/cron/similarity-alerts" }),
      ]),
    );
  });

  it("refreshes tide predictions twice weekly to stay inside warning freshness", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(config.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/api/cron/forecasts/refresh?source=tide&maxBeaches=261",
          schedule: "0 4 * * 0,3",
        }),
      ]),
    );
  });
});
