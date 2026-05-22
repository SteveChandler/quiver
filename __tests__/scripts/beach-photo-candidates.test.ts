import { readFileSync } from "fs";
import { join } from "path";

import {
  buildOpenverseSearchUrl,
  candidateFromManualSource,
  candidateFromOpenverseResult,
  formatCandidateReport,
  isSeoUsableCreativeCommonsLicense,
  parseApprovedRuntimePhotos,
  parseBeachPhotoTargets,
  runtimeAssetPathForSlug,
} from "@/scripts/lib/beach-photo-candidates";

describe("SEO beach photo candidate pipeline", () => {
  it("keeps the SoCal beginner target manifest focused on beach-specific rows", () => {
    const manifestPath = join(
      process.cwd(),
      "scripts/data/socal-beginner-photo-targets.json",
    );
    const targets = parseBeachPhotoTargets(
      JSON.parse(readFileSync(manifestPath, "utf8")),
    );
    const slugs = targets.map((target) => target.slug);

    expect(slugs).toEqual(
      expect.arrayContaining([
        "blackies",
        "bolsa-chica",
        "huntington-state-beach",
        "goldenwest",
        "doheny-beach",
        "san-onofre-state-beach",
        "la-jolla-shores",
        "tourmaline-surf-park",
        "santa-monica-beach-santa-monica-ca",
        "will-rogers-state-beach-santa-monica-ca",
        "dockweiler-state-beach-playa-del-rey-ca",
        "venice-beach-venice-ca",
        "torrance-beach-rat-beach-torrance-ca",
        "72nd-place-long-beach-ca",
        "mondos-beach-ventura-ca",
        "refugio-state-beach-goleta-ca",
      ]),
    );
  });

  it("rejects licenses that are risky for cropped or optimized SEO images", () => {
    expect(isSeoUsableCreativeCommonsLicense("cc0")).toBe(true);
    expect(isSeoUsableCreativeCommonsLicense("by")).toBe(true);
    expect(isSeoUsableCreativeCommonsLicense("by-sa")).toBe(true);
    expect(isSeoUsableCreativeCommonsLicense("CC BY-SA 4.0")).toBe(true);

    expect(isSeoUsableCreativeCommonsLicense("by-nc")).toBe(false);
    expect(isSeoUsableCreativeCommonsLicense("by-nd")).toBe(false);
    expect(isSeoUsableCreativeCommonsLicense("by-nc-sa")).toBe(false);
    expect(isSeoUsableCreativeCommonsLicense(null)).toBe(false);
  });

  it("builds commercial-use Openverse searches from exact beach targets", () => {
    const url = new URL(
      buildOpenverseSearchUrl(
        {
          slug: "dockweiler-state-beach-playa-del-rey-ca",
          name: "Dockweiler State Beach",
          query: "Dockweiler State Beach surf",
        },
        {
          apiUrl: "https://api.openverse.org/v1/images/",
          limit: 5,
          source: "wikimedia",
        },
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://api.openverse.org/v1/images/",
    );
    expect(url.searchParams.get("q")).toBe("Dockweiler State Beach surf");
    expect(url.searchParams.get("license_type")).toBe("commercial");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("page_size")).toBe("5");
    expect(url.searchParams.get("source")).toBe("wikimedia");
  });

  it("maps Openverse results into unapproved review metadata shape", () => {
    const candidate = candidateFromOpenverseResult(
      {
        slug: "will-rogers-state-beach-santa-monica-ca",
        name: "Will Rogers State Beach",
        city: "Santa Monica",
      },
      {
        id: "abc123",
        url: "https://upload.wikimedia.org/example.jpg",
        thumbnail: "https://thumb.example/image.jpg?format=json",
        title: "Will Rogers State Beach",
        creator: "JCS",
        creator_url: "https://commons.wikimedia.org/wiki/User:JCS",
        license: "by-sa",
        license_version: "3.0",
        license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
        provider: "wikimedia",
        foreign_landing_url:
          "https://commons.wikimedia.org/wiki/File:Will_Rogers_State_Beach_1.JPG",
      },
    );

    expect(candidate).toEqual(
      expect.objectContaining({
        targetSlug: "will-rogers-state-beach-santa-monica-ca",
        source: "openverse",
        sourceId: "abc123",
        imageUrl: "https://upload.wikimedia.org/example.jpg",
        thumbUrl: "https://thumb.example/image.jpg",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Will_Rogers_State_Beach_1.JPG",
        title: "Will Rogers State Beach",
        creatorName: "JCS",
        licenseCode: "BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
        licenseStatus: "defensible",
        provider: "wikimedia",
        runtimeAssetPath:
          "public/images/seo-dioramas/beginner/socal/will-rogers-state-beach-santa-monica-ca-photo.webp",
      }),
    );
    expect(candidate?.attributionHtml).toContain("BY-SA 3.0");
    expect(candidate?.usageNotes).toContain("manual beach-match review");
    expect(candidate?.confidence).toBeGreaterThan(0);
  });

  it("maps manual source rows into grey-review candidates only when an image exists", () => {
    const target = {
      slug: "mondos-beach-ventura-ca",
      name: "Mondos Beach",
      query: "Mondos Beach Ventura surf",
    };
    const candidate = candidateFromManualSource(target, {
      source: "official",
      sourceId: "ventura-tourism-mondos",
      imageUrl: "https://example.com/mondos.jpg",
      sourceUrl: "https://example.com/mondos-source",
      title: "Mondos Beach",
      creator: "Ventura Tourism",
      licenseCode: "review required",
      licenseStatus: "grey_review",
      usageNotes:
        "Official/tourism source for review report only; not approved for runtime use.",
      confidence: 65,
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        targetSlug: "mondos-beach-ventura-ca",
        source: "manual",
        licenseStatus: "grey_review",
        confidence: 65,
        runtimeAssetPath: runtimeAssetPathForSlug("mondos-beach-ventura-ca"),
      }),
    );

    expect(
      candidateFromManualSource(target, {
        source: "official",
        sourceId: "blocked-mondos",
        imageUrl: "https://example.com/mondos.jpg",
        sourceUrl: "https://example.com/mondos-source",
        licenseStatus: "blocked",
        usageNotes: "Blocked licensing.",
      }),
    ).toBeNull();
  });

  it("keeps approved runtime photos defensible and scoped to the SoCal asset directory", () => {
    const manifestPath = join(
      process.cwd(),
      "scripts/data/socal-beginner-approved-photos.json",
    );
    const photos = parseApprovedRuntimePhotos(
      JSON.parse(readFileSync(manifestPath, "utf8")),
    );

    expect(photos).toHaveLength(12);
    expect(photos.map((photo) => photo.slug)).toEqual(
      expect.arrayContaining([
        "bolsa-chica",
        "huntington-state-beach",
        "doheny-beach",
        "san-onofre-state-beach",
        "la-jolla-shores",
        "tourmaline-surf-park",
        "santa-monica-beach-santa-monica-ca",
        "will-rogers-state-beach-santa-monica-ca",
        "dockweiler-state-beach-playa-del-rey-ca",
        "venice-beach-venice-ca",
        "torrance-beach-rat-beach-torrance-ca",
        "refugio-state-beach-goleta-ca",
      ]),
    );

    for (const photo of photos) {
      expect(photo.licenseStatus).toBe("defensible");
      expect(photo.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(photo.runtimeAssetPath).toBe(runtimeAssetPathForSlug(photo.slug));
    }
  });

  it("drops licensed images that are not useful as beach-specific SEO photos", () => {
    const candidate = candidateFromOpenverseResult(
      {
        slug: "dockweiler-state-beach-playa-del-rey-ca",
        name: "Dockweiler State Beach",
      },
      {
        id: "plane-1",
        url: "https://upload.wikimedia.org/plane.jpg",
        title:
          "N348AN, Boeing 767-300ER of American Airlines flying, photo taken from Dockweiler State Beach",
        license: "by-sa",
        license_version: "2.0",
      },
    );

    expect(candidate).toBeNull();
  });

  it("formats a manual-review report with source and license links", () => {
    const targets = [
      {
        slug: "will-rogers-state-beach-santa-monica-ca",
        name: "Will Rogers State Beach",
        query: "Will Rogers State Beach surf",
      },
      {
        slug: "mondos-beach-ventura-ca",
        name: "Mondos Beach",
        query: "Mondos Beach Ventura surf",
      },
    ];
    const candidate = candidateFromOpenverseResult(targets[0], {
      id: "abc123",
      url: "https://upload.wikimedia.org/example.jpg",
      title: "Will Rogers State Beach",
      creator: "JCS",
      license: "by-sa",
      license_version: "3.0",
      license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
      foreign_landing_url:
        "https://commons.wikimedia.org/wiki/File:Will_Rogers_State_Beach_1.JPG",
    });

    const report = formatCandidateReport({
      generatedAt: "2026-05-22T17:00:00.000Z",
      sourceLabel: "Openverse",
      targetPath: "scripts/data/socal-beginner-photo-targets.json",
      targets,
      candidates: candidate ? [candidate] : [],
    });

    expect(report).toContain("# Beach Photo Candidate Report");
    expect(report).toContain("review candidates only");
    expect(report).toContain("Will Rogers State Beach");
    expect(report).toContain("License status");
    expect(report).toContain("Runtime path");
    expect(report).toContain("manual beach-match review");
    expect(report).toContain(
      "[BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)",
    );
    expect(report).toContain(
      "public/images/seo-dioramas/beginner/socal/will-rogers-state-beach-santa-monica-ca-photo.webp",
    );
    expect(report).toContain(
      "[source](https://commons.wikimedia.org/wiki/File:Will_Rogers_State_Beach_1.JPG)",
    );
    expect(report).toContain("No license-safe candidates returned.");
  });
});
