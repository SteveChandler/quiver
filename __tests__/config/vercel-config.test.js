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

    expect(config.ignoreCommand.length).toBeLessThanOrEqual(256);

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
    const vercelIgnore = fs.readFileSync(
      path.join(process.cwd(), ".vercelignore"),
      "utf8",
    );
    const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "vercel-ignore-"));
    const git = (...args) =>
      execFileSync("git", args, { cwd: repoPath, stdio: "ignore" });
    const headSha = () =>
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repoPath,
        encoding: "utf8",
      }).trim();
    // Vercel sets VERCEL_GIT_COMMIT_SHA to the deployed commit; a normal push has a
    // different PREVIOUS_SHA, a redeploy of the last successful commit has the same one.
    const runIgnoreCommand = (env = {}) =>
      spawnSync(config.ignoreCommand, {
        cwd: repoPath,
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: "HEAD^",
          VERCEL_GIT_COMMIT_SHA: headSha(),
          ...env,
        },
        shell: true,
      }).status;

    expect(vercelIgnore).not.toMatch(/^\/\.git\/$/m);

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

      fs.writeFileSync(path.join(repoPath, "components", "README.md"), "nested docs\n");
      git("add", "components/README.md");
      git("commit", "-m", "nested docs update");
      expect(runIgnoreCommand()).toBe(0);

      fs.mkdirSync(path.join(repoPath, "__tests__"));
      fs.writeFileSync(
        path.join(repoPath, "__tests__", "example.test.ts"),
        "test update\n",
      );
      git("add", "__tests__/example.test.ts");
      git("commit", "-m", "test update");
      expect(runIgnoreCommand()).toBe(0);

      // .vercelignore keeps root scripts/ (except load-env.mjs, which the
      // type-checked playwright.config.ts imports) and supabase/ out of the
      // upload, so a commit touching only them cannot change the build.
      expect(vercelIgnore).toMatch(/^scripts\/\*$/m);
      expect(vercelIgnore).toMatch(/^!scripts\/load-env\.mjs$/m);
      expect(vercelIgnore).toMatch(/^\/supabase\/$/m);
      fs.mkdirSync(path.join(repoPath, "scripts"));
      fs.writeFileSync(path.join(repoPath, "scripts", "collector.py"), "print(1)\n");
      git("add", "scripts/collector.py");
      git("commit", "-m", "collector script update");
      expect(runIgnoreCommand()).toBe(0);

      fs.mkdirSync(path.join(repoPath, "supabase", "migrations"), { recursive: true });
      fs.writeFileSync(
        path.join(repoPath, "supabase", "migrations", "20260925000000_example.sql"),
        "select 1;\n",
      );
      git("add", "supabase");
      git("commit", "-m", "migration only");
      expect(runIgnoreCommand()).toBe(0);

      // Same folder names under runtime code still build.
      fs.mkdirSync(path.join(repoPath, "lib", "supabase"), { recursive: true });
      fs.writeFileSync(path.join(repoPath, "lib", "supabase", "server.ts"), "export {};\n");
      git("add", "lib/supabase/server.ts");
      git("commit", "-m", "runtime supabase client");
      expect(runIgnoreCommand()).toBe(1);

      fs.mkdirSync(path.join(repoPath, "lib", "scripts"), { recursive: true });
      fs.writeFileSync(path.join(repoPath, "lib", "scripts", "entry.ts"), "export {};\n");
      git("add", "lib/scripts/entry.ts");
      git("commit", "-m", "runtime scripts module");
      expect(runIgnoreCommand()).toBe(1);

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
      // A redeploy of the last successful commit has no source diff, but an
      // environment-variable change still needs a build.
      expect(runIgnoreCommand({ VERCEL_GIT_PREVIOUS_SHA: headSha() })).toBe(1);
      // Missing history must build, never silently skip an unverified change.
      expect(runIgnoreCommand({ VERCEL_GIT_PREVIOUS_SHA: "" })).toBe(1);
      expect(runIgnoreCommand({ VERCEL_GIT_PREVIOUS_SHA: "f".repeat(40) })).not.toBe(0);

      fs.writeFileSync(path.join(repoPath, "vercel.json"), '{"crons":[]}\n');
      git("add", "vercel.json");
      git("commit", "-m", "change runtime config");
      expect(runIgnoreCommand()).toBe(1);

      fs.mkdirSync(path.join(repoPath, "new-runtime"));
      fs.writeFileSync(path.join(repoPath, "new-runtime", "entry.ts"), "export {};\n");
      git("add", ".");
      git("commit", "-m", "unrecognized runtime path");
      expect(runIgnoreCommand()).toBe(1);
    } finally {
      fs.rmSync(repoPath, { force: true, recursive: true });
    }

    expect(Array.isArray(config.crons)).toBe(true);
    expect(config.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/api/monitoring/forecast-health" }),
        expect.objectContaining({
          path: "/api/cron/daily-call",
          schedule: "8 * * * *",
        }),
      ]),
    );
    expect(config.crons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/api/cron/similarity-alerts" }),
        expect.objectContaining({ path: "/api/cron/home-morning-call" }),
      ]),
    );
  });

  // 2026-10-02: /api/surf/call and every other route ran in iad1 (x-vercel-id sfo1::iad1) against
  // the us-west-1 database; Beach Detail's call took 3-9 s and even trivial authed routes 1.4 s.
  it("runs every function next to the Northern California database", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    expect(config.regions).toEqual(["sfo1"]);
  });

  // 2026-10-02: with every function next to the database, the jobs that fired together at
  // minute 0 saturated it. Statement timeouts went from 0-10 an hour to 53 and 26 in the first
  // minute, enhanced syncs and the health check failed, and a surf call returned 504 after 13 s.
  it("keeps the heavy forecast jobs off the minute the hourly sends run", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const scheduleOf = (route) => config.crons.find((cron) => cron.path === route)?.schedule;

    expect(scheduleOf("/api/cron/forecasts/refresh?source=marine&maxBeaches=130")).toBe("5 * * * *");
    expect(scheduleOf("/api/cron/enhanced-forecast-sync-cdip")).toBe("50 * * * *");
    expect(scheduleOf("/api/monitoring/forecast-health")).toBe("12,42 * * * *");
    expect(scheduleOf("/api/cron/ioos-sync?phase=observations")).toBe("35 */2 * * *");

    const firesAtMinuteZero = (schedule) => schedule.split(" ")[0].split(",").some(
      (minute) => minute === "0" || minute === "*" || minute.startsWith("*/"),
    );
    const heavy = [
      "/api/cron/forecasts/refresh?source=marine&maxBeaches=130",
      "/api/cron/enhanced-forecast-sync-cdip",
      "/api/monitoring/forecast-health",
      "/api/cron/ioos-sync?phase=observations",
    ];
    expect(config.crons.filter((cron) => heavy.includes(cron.path) && firesAtMinuteZero(cron.schedule))).toEqual([]);
  });

  // 2026-10-04 15:02-15:06 UTC: ~40 statements cancelled while the minute-0 sends, the :05 marine
  // refresh and ad-hoc analytics overlapped. These jobs select by local hour or by queue state, never
  // by the minute they fire in, so they move off minute 0 without changing who they select.
  it("keeps the hourly per-user sends off minute 0", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const moved = {
      "/api/cron/email-lifecycle": { schedule: "25 * * * *", source: "app/api/cron/email-lifecycle/route.ts" },
      "/api/cron/daily-call": { schedule: "8 * * * *", source: "app/api/cron/daily-call/route.ts" },
      "/api/cron/swell-alert": { schedule: "24 * * * *", source: "app/api/cron/swell-alert/route.ts" },
      "/api/cron/condition-alert-deliver": { schedule: "2 * * * *", source: "app/api/cron/condition-alert-deliver/route.ts" },
    };
    for (const [route, { schedule, source }] of Object.entries(moved)) {
      expect(config.crons.find((cron) => cron.path === route)?.schedule).toBe(schedule);
      // The Sentry monitor schedule lives in the route and must match, or it alerts on every run.
      if (route !== "/api/cron/condition-alert-deliver") {
        expect(fs.readFileSync(path.join(process.cwd(), source), "utf8")).toContain(`schedule: "${schedule}"`);
      }
    }

    // Distinct minutes so the moved jobs do not just form a second pile-up.
    const minutes = Object.values(moved).map(({ schedule }) => schedule.split(" ")[0]);
    expect(new Set(minutes).size).toBe(minutes.length);
    expect(minutes.map(Number).every((minute) => minute > 0)).toBe(true);
  });

  it("removes the retired swell-watch shadow route and schedule", () => {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));

    expect(config.crons).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "/api/cron/swell-watch" })]),
    );
    expect(fs.existsSync(path.join(process.cwd(), "app/api/cron/swell-watch/route.ts"))).toBe(false);
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
