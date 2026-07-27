import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES: Array<{
  file: string;
  route: string;
  surface: "read" | "write" | "admin" | "retention";
  methods: string[];
}> = [
  {
    file: "app/api/community-photos/route.ts",
    route: "/api/community-photos",
    surface: "read",
    methods: ["GET"],
  },
  {
    file: "app/api/community-photos/upload/route.ts",
    route: "/api/community-photos/upload",
    surface: "write",
    methods: ["POST"],
  },
  {
    file: "app/api/community-photos/mine/route.ts",
    route: "/api/community-photos/mine",
    surface: "read",
    methods: ["GET"],
  },
  {
    file: "app/api/community-photos/[photoId]/route.ts",
    route: "/api/community-photos/:photoId",
    surface: "write",
    methods: ["DELETE"],
  },
  {
    file: "app/api/community-photos/[photoId]/vote/route.ts",
    route: "/api/community-photos/:photoId/vote",
    surface: "write",
    methods: ["PUT"],
  },
  {
    file: "app/api/community-photos/[photoId]/report/route.ts",
    route: "/api/community-photos/:photoId/report",
    surface: "write",
    methods: ["POST"],
  },
  {
    file: "app/api/community-photos/[photoId]/recover/route.ts",
    route: "/api/community-photos/:photoId/recover",
    surface: "write",
    methods: ["POST"],
  },
  {
    file: "app/api/community-photos/[photoId]/image/route.ts",
    route: "/api/community-photos/:photoId/image",
    surface: "read",
    methods: ["GET"],
  },
  {
    file: "app/api/admin/community-photos/route.ts",
    route: "/api/admin/community-photos",
    surface: "admin",
    methods: ["GET"],
  },
  {
    file: "app/api/admin/community-photos/monitoring/route.ts",
    route: "/api/admin/community-photos/monitoring",
    surface: "admin",
    methods: ["GET"],
  },
  {
    file: "app/api/admin/community-photos/[photoId]/image/route.ts",
    route: "/api/admin/community-photos/:photoId/image",
    surface: "admin",
    methods: ["GET"],
  },
  {
    file: "app/api/admin/community-photos/[photoId]/moderation/route.ts",
    route: "/api/admin/community-photos/:photoId/moderation",
    surface: "admin",
    methods: ["POST"],
  },
  {
    file: "app/api/admin/community-photos/[photoId]/pin/route.ts",
    route: "/api/admin/community-photos/:photoId/pin",
    surface: "admin",
    methods: ["POST", "DELETE"],
  },
  {
    file: "app/api/admin/community-photos/[photoId]/hold/route.ts",
    route: "/api/admin/community-photos/:photoId/hold",
    surface: "admin",
    methods: ["POST", "DELETE"],
  },
  {
    file: "app/api/admin/community-photos/[photoId]/recover/route.ts",
    route: "/api/admin/community-photos/:photoId/recover",
    surface: "admin",
    methods: ["POST"],
  },
  {
    file:
      "app/api/admin/community-photo-contributors/[contributorId]/restriction/route.ts",
    route:
      "/api/admin/community-photo-contributors/:contributorId/restriction",
    surface: "admin",
    methods: ["POST", "DELETE"],
  },
  {
    file: "app/api/cron/community-photo-retention/route.ts",
    route: "/api/cron/community-photo-retention",
    surface: "retention",
    methods: ["GET"],
  },
];

describe("community photo observability coverage", () => {
  it.each(ROUTES)(
    "wraps every method in $file",
    ({ file, route, surface, methods }) => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const compact = source.replace(/\s+/g, " ");

      expect(source).toContain("withCommunityPhotoRouteObservability");
      expect(compact).toContain(`route: "${route}"`);
      expect(compact).toContain(`surface: "${surface}"`);
      for (const method of methods) {
        expect(compact).toMatch(
          new RegExp(
            `export const ${method} = withCommunityPhotoRouteObservability`,
          ),
        );
      }
    },
  );
});
