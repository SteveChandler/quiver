import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(file: string): string {
  return readFileSync(join(process.cwd(), "docs/analytics", file), "utf8");
}

describe("community photo release queries", () => {
  it("defines the upload 5xx numerator, denominator, rate, and minimum sample", () => {
    const sql = read("community-photo-upload-5xx.hogql").toLowerCase();

    expect(sql).toContain("community_photo_route_outcome");
    expect(sql).toContain("/api/community-photos/upload");
    expect(sql).toMatch(/countif\([\s\S]*status[\s\S]*>= 500/);
    expect(sql).toContain("denominator");
    expect(sql).toContain("5xx_rate");
    expect(sql).toContain("interval 60 minute");
    expect(sql).toContain("minimum sample: 20");
    expect(sql).toContain("threshold: greater than 1%");
    expect(sql).toContain("> 0.01");
    expect(sql).toContain("gate_status");
    expect(sql).toContain("rollback:");
    expect(sql).toContain("owner:");
  });

  it("defines successful-upload P95 with the five-second contract", () => {
    const sql = read("community-photo-upload-p95.hogql").toLowerCase();

    expect(sql).toContain("quantile(0.95)");
    expect(sql).toContain("properties.duration_ms");
    expect(sql).toContain("upload_success");
    expect(sql).toContain("interval 60 minute");
    expect(sql).toContain("minimum sample: 20");
    expect(sql).toContain("threshold: 5000 ms");
    expect(sql).toContain("> 5000");
    expect(sql).toContain("gate_status");
  });

  it("defines stuck-processing and 31-day retention backlog database checks", () => {
    const stuck = read("community-photo-stuck-processing.sql").toLowerCase();
    const retention = read(
      "community-photo-retention-backlog.sql",
    ).toLowerCase();

    expect(stuck).toContain("public.community_spot_photos");
    expect(stuck).toContain("processing_status");
    expect(stuck).toContain("interval '15 minutes'");
    expect(stuck).toContain("gate_status");
    expect(stuck).not.toContain("storage_path");
    expect(retention).toContain("public.community_spot_photos");
    expect(retention).toContain("interval '31 days'");
    expect(retention).toContain("community_photo_investigation_holds");
    expect(retention).toContain("gate_status");
    expect(retention).not.toContain("storage_path");
  });

  it("defines the unauthorized/private-media zero-tolerance outcome check", () => {
    const sql = read(
      "community-photo-private-media-zero-tolerance.hogql",
    ).toLowerCase();

    expect(sql).toContain("community_photo_route_outcome");
    expect(sql).toContain(":photoid/image");
    expect(sql).toContain("rollout_eligibility");
    expect(sql).toContain("admin_audited_media_served");
    expect(sql).toContain("violations");
    expect(sql).toContain("zero tolerance");
    expect(sql).toContain("gate_status");
    for (const forbidden of [
      "distinct_id",
      "person_id",
      "image_url",
      "storage_path",
      "filename",
      "report_text",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});
