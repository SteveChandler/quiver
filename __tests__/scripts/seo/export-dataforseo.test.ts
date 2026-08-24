import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "seo", "export-dataforseo.ts");
const TSX_LOADER_PATH = require.resolve("tsx");
const execFileAsync = promisify(execFile);

describe("export-dataforseo script", () => {
  jest.setTimeout(45000);

  it("honors DATAFORSEO_ENABLED=false before making paid API calls", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = createDataForSeoServer(requests);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const cwd = makeTempWorkspace({
      google: {
        domain: "quiversurf.app",
        device: "mobile",
        depth: 100,
        keywords: ["surf forecast app"],
        locations: [{ name: "United States", code: 2840 }],
      },
      aso: {
        depth: 100,
        keywords: [],
        quiver: { iosAppId: "6759300320", androidAppId: "app.quiversurf.surf" },
      },
      competitors: [],
    });
    const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "false",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        NODE_ENV: "test",
      });

      expect(requests).toHaveLength(0);
      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        googleRankings: [],
        asoRankings: [],
        competitorKeywords: [],
        missing: ["DATAFORSEO_DISABLED_BY_CONFIG"],
      });
    } finally {
      await closeServer(server);
    }
  });

  it("batches Google SERP live tasks and preserves keyword overview output", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = createDataForSeoServer(requests);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }
      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: ["surf forecast app", "best surf app"],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          keywords: [],
          quiver: { iosAppId: "6759300320", androidAppId: "app.quiversurf.surf" },
        },
        competitors: [],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        DATAFORSEO_GOOGLE_BATCH_SIZE: "5",
        NODE_ENV: "test",
      });

      expect(requests.map((item) => item.path)).toEqual([
        "/v3/serp/google/organic/live/advanced",
        "/v3/dataforseo_labs/google/keyword_overview/live",
      ]);
      expect(requests.map((item) => Array.isArray(item.body) ? item.body.length : 0)).toEqual([2, 1]);
      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "complete",
        completedPhases: ["googleRankings", "keywordMetrics", "asoRankings", "competitorKeywords"],
        keywordMetrics: [{
          keyword: "surf forecast app",
          searchVolume: 720,
          intent: { main: "commercial" },
        }, {
          keyword: "best surf app",
          searchVolume: 260,
          intent: { main: "commercial" },
        }],
      });
    } finally {
      await closeServer(server);
    }
  });

  it("gives Google live-SERP responses a longer budget than shared requests", async () => {
    const server = http.createServer((request, response) => {
      response.setHeader("content-type", "application/json");

      if (request.url === "/v3/serp/google/organic/live/advanced") {
        setTimeout(() => {
          response.end(JSON.stringify({
            status_code: 20000,
            status_message: "Ok.",
            tasks: [{
              result: [{
                items: [{
                  type: "organic",
                  domain: "www.quiversurf.app",
                  url: "https://www.quiversurf.app/",
                  title: "Quiver",
                  rank_absolute: 2,
                }],
              }],
            }],
          }));
        }, 150);
        return;
      }

      response.end(JSON.stringify({
        status_code: 20000,
        status_message: "Ok.",
        tasks: [{ result: [{ items: [] }] }],
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }
      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: ["surf forecast app"],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          platforms: ["ios"],
          keywords: [],
          quiver: { iosAppId: "6759300320" },
        },
        competitors: [],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        DATAFORSEO_TIMEOUT_MS: "100",
        DATAFORSEO_REQUEST_RETRIES: "1",
        NODE_ENV: "test",
      });

      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "complete",
        googleRankings: [{ keyword: "surf forecast app", quiverRank: 2 }],
        missing: [],
      });
    } finally {
      await closeServer(server);
    }
  });

  it("skips Android ASO checks when the watchlist only enables iOS", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = createDataForSeoServer(requests);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }
      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: [],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          platforms: ["ios"],
          disabledPlatforms: [{
            platform: "android",
            reason: "Google Play ASO checks are disabled until the Android store listing is live.",
          }],
          keywords: ["surf forecast"],
          quiver: { iosAppId: "6759300320" },
        },
        competitors: [],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        NODE_ENV: "test",
      });

      expect(requests.map((item) => item.path)).toEqual([
        "/v3/app_data/apple/app_searches/task_post",
        "/v3/app_data/apple/app_searches/task_get/advanced/task-1",
      ]);
      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        asoRankings: [{
          keyword: "surf forecast",
          platform: "ios",
          quiverRank: 8,
        }],
        missing: [],
      });
    } finally {
      await closeServer(server);
    }
  });

  it("dispatches all ASO batches before waiting for any batch result", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    let heldFirstPostResponse: http.ServerResponse | null = null;
    const server = http.createServer(async (request, response) => {
      const body = await readRequestBody(request);
      const parsedBody = body.length > 0 ? JSON.parse(body) : null;
      const pathName = request.url ?? "";
      requests.push({ path: pathName, body: parsedBody });
      response.setHeader("content-type", "application/json");

      if (pathName === "/v3/app_data/apple/app_searches/task_post") {
        const keyword = Array.isArray(parsedBody) && isRecord(parsedBody[0])
          ? String(parsedBody[0].keyword)
          : "";
        const payload = JSON.stringify({
          status_code: 20000,
          status_message: "Ok.",
          tasks: [{ id: `task-${keyword}`, status_code: 20000, status_message: "Ok." }],
        });

        if (keyword === "surf forecast") {
          heldFirstPostResponse = response;
          return;
        }

        heldFirstPostResponse?.end(payload);
        heldFirstPostResponse = null;
        response.end(payload);
        return;
      }

      response.end(JSON.stringify({
        status_code: 20000,
        status_message: "Ok.",
        tasks: [{
          result: [{
            items: [
              { title: "Lazy Surfer", app_id: "1450887020", rank_absolute: 1 },
              { title: "Quiver", app_id: "6759300320", rank_absolute: 8 },
            ],
          }],
        }],
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }
      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: [],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          platforms: ["ios"],
          keywords: ["surf forecast", "free surf forecast"],
          quiver: { iosAppId: "6759300320" },
        },
        competitors: [],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        DATAFORSEO_APP_BATCH_SIZE: "1",
        NODE_ENV: "test",
      });

      expect(requests.filter((item) => item.path === "/v3/app_data/apple/app_searches/task_post")).toHaveLength(2);
      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "complete",
        completedPhases: ["googleRankings", "keywordMetrics", "asoRankings", "competitorKeywords"],
        asoRankings: [
          { keyword: "surf forecast", quiverRank: 8 },
          { keyword: "free surf forecast", quiverRank: 8 },
        ],
      });
    } finally {
      (heldFirstPostResponse as http.ServerResponse | null)?.destroy();
      await closeServer(server);
    }
  });

  it("merges Apple Search Ads campaign keywords into the ASO watchlist", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = createDataForSeoServer(requests);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }
      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: [],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          platforms: ["ios"],
          keywords: ["surf forecast"],
          quiver: { iosAppId: "6759300320" },
        },
        competitors: [],
      }, {
        keywords: [
          { keyword: "surf tracker", status: "enabled" },
          { keyword: "wave forecast", status: "paused" },
          { keyword: "quiver surf app", enabled: true },
        ],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        NODE_ENV: "test",
      });

      const appSearchPost = requests.find((item) => item.path === "/v3/app_data/apple/app_searches/task_post");
      expect(appSearchPost).toMatchObject({ path: "/v3/app_data/apple/app_searches/task_post" });
      expect(appSearchPost?.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ keyword: "surf forecast" }),
        expect.objectContaining({ keyword: "surf tracker" }),
        expect.objectContaining({ keyword: "quiver surf app" }),
      ]));
      expect(appSearchPost?.body).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ keyword: "wave forecast" }),
      ]));
    } finally {
      await closeServer(server);
    }
  });

  it("fails fast into missing output when the API stalls mid-response body", async () => {
    const server = http.createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      if (request.url === "/v3/serp/google/organic/live/advanced") {
        response.write('{"status_code":20000,"status_message":"Ok.","tasks":[');
        return;
      }

      response.end(JSON.stringify({
        status_code: 20000,
        status_message: "Ok.",
        tasks: [{ result: [{ items: [] }] }],
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }

      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: ["surf forecast app"],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          keywords: [],
          quiver: { iosAppId: "6759300320", androidAppId: "app.quiversurf.surf" },
        },
        competitors: [],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        DATAFORSEO_TIMEOUT_MS: "100",
        DATAFORSEO_GOOGLE_TIMEOUT_MS: "100",
        DATAFORSEO_REQUEST_RETRIES: "1",
        NODE_ENV: "test",
      });

      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "partial",
        googleRankings: [],
        missing: [expect.stringContaining("The operation was aborted due to timeout")],
      });
    } finally {
      await closeServer(server);
    }
  });

  it("writes partial output when the global deadline is reached", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = createDataForSeoServer(requests);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected local test server address");
      }
      const cwd = makeTempWorkspace({
        google: {
          domain: "quiversurf.app",
          device: "mobile",
          depth: 100,
          keywords: ["surf forecast app"],
          locations: [{ name: "United States", code: 2840 }],
        },
        aso: {
          depth: 100,
          keywords: ["surf forecast"],
          quiver: { iosAppId: "6759300320" },
          platforms: ["ios"],
        },
        competitors: [{ name: "Lazy Surfer", domain: "lazysurfer.app" }],
      });
      const outputPath = path.join(cwd, "DATAFORSEO-EXPORT.json");

      await runExporter(cwd, outputPath, {
        DATAFORSEO_API_BASE: `http://127.0.0.1:${address.port}`,
        DATAFORSEO_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        DATAFORSEO_DEADLINE_MS: "1",
        NODE_ENV: "test",
      });

      expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "timed_out",
        deadlineReached: true,
        completedPhases: [],
        failedPhases: ["googleRankings"],
      });
    } finally {
      await closeServer(server);
    }
  });
});

function createDataForSeoServer(
  requests: Array<{ path: string; body: unknown }>,
): http.Server {
  return http.createServer(async (request, response) => {
    const body = await readRequestBody(request);
    const parsedBody = body.length > 0 ? JSON.parse(body) : null;
    requests.push({
      path: request.url ?? "",
      body: parsedBody,
    });
    response.setHeader("content-type", "application/json");
    if (request.url?.includes("task_post")) {
      const tasks = Array.isArray(parsedBody) ? parsedBody.map((_, index) => ({
        id: `task-${index + 1}`,
        status_code: 20000,
        status_message: "Ok.",
      })) : [{
        id: "task-1",
        status_code: 20000,
        status_message: "Ok.",
      }];
      response.end(JSON.stringify({
        status_code: 20000,
        status_message: "Ok.",
        tasks,
      }));
      return;
    }

    if (request.url === "/v3/dataforseo_labs/google/keyword_overview/live") {
      response.end(JSON.stringify({
        status_code: 20000,
        status_message: "Ok.",
        tasks: [{
          result: [{
            items: Array.isArray(parsedBody) && isRecord(parsedBody[0]) && Array.isArray(parsedBody[0].keywords)
              ? parsedBody[0].keywords.map((keyword: unknown) => ({
                keyword,
                keyword_info: {
                  search_volume: keyword === "surf forecast app" ? 720 : 260,
                  competition_level: "LOW",
                },
                search_volume_trend: {
                  monthly: 8,
                  quarterly: 3,
                  yearly: 24,
                },
                search_intent_info: {
                  main_intent: "commercial",
                  foreign_intent: ["informational"],
                },
              }))
              : [],
          }],
        }],
      }));
      return;
    }

    const bodyArray = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
    response.end(JSON.stringify({
      status_code: 20000,
      status_message: "Ok.",
      tasks: bodyArray.map(() => ({
        result: [{
          items: request.url?.includes("app_searches")
            ? [
              { title: "Lazy Surfer", app_id: "1450887020", rank_absolute: 1 },
              { title: "Quiver", app_id: "6759300320", rank_absolute: 8 },
            ]
            : [
              {
                type: "organic",
                domain: "www.quiversurf.app",
                url: "https://www.quiversurf.app/",
                title: "Quiver",
                rank_absolute: 2,
              },
            ],
        }],
      })),
    }));
  });
}

function makeTempWorkspace(watchlist: unknown, appleSearchAdsKeywords?: unknown): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-dataforseo-"));
  const seoDocsPath = path.join(cwd, "docs", "seo");
  fs.mkdirSync(seoDocsPath, { recursive: true });
  fs.writeFileSync(
    path.join(seoDocsPath, "dataforseo-watchlist.json"),
    `${JSON.stringify(watchlist, null, 2)}\n`,
  );
  if (appleSearchAdsKeywords !== undefined) {
    fs.writeFileSync(
      path.join(seoDocsPath, "apple-search-ads-keywords.json"),
      `${JSON.stringify(appleSearchAdsKeywords, null, 2)}\n`,
    );
  }
  return cwd;
}

async function runExporter(
  cwd: string,
  outputPath: string,
  env: Partial<NodeJS.ProcessEnv>,
): Promise<void> {
  await execFileAsync(
    process.execPath,
    ["--import", TSX_LOADER_PATH, SCRIPT_PATH, "--output", outputPath],
    {
      cwd,
      env: {
        ...process.env,
        DATAFORSEO_APP_POLL_MS: "100",
        DATAFORSEO_APP_POLL_INTERVAL_MS: "10",
        DATAFORSEO_COMPETITOR_KEYWORD_LIMIT: "10",
        ...env,
      },
      timeout: 20000,
    },
  );
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
