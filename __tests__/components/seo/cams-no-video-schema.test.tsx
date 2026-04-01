import React from "react";
import { render } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";

const baseUrl = "https://www.quiversurf.app";

function getJsonLdScripts(container: HTMLElement) {
  const scripts = container.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  return Array.from(scripts).map((s) => JSON.parse(s.textContent || "{}"));
}

describe("Cams pages structured data", () => {
  describe("VideoObject schema removal", () => {
    it("cam-schema.tsx component file has been deleted", () => {
      const filePath = path.resolve(
        __dirname,
        "../../../components/seo/cam-schema.tsx"
      );
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("/cams hub page does not import the old CamSchema component", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../../app/cams/page.tsx"),
        "utf-8"
      );
      // Ensure the old cam-schema import path is gone (LiveCamSchema from live-cam-schema is fine)
      expect(source).not.toMatch(/from\s+["'].*\/cam-schema["']/);
    });

    it("/cams/[region] page does not import the old CamSchema component", () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../../app/cams/[region]/page.tsx"),
        "utf-8"
      );
      // Ensure the old cam-schema import path is gone (LiveCamSchema from live-cam-schema is fine)
      expect(source).not.toMatch(/from\s+["'].*\/cam-schema["']/);
      expect(source).not.toContain("VideoObject");
    });
  });

  describe("BreadcrumbStructuredData on cams pages", () => {
    it("renders BreadcrumbList JSON-LD for /cams hub", () => {
      const { container } = render(
        <BreadcrumbStructuredData
          items={[
            { name: "Quiver", url: baseUrl },
            { name: "Live Surf Cams", url: `${baseUrl}/cams` },
          ]}
        />
      );

      const schemas = getJsonLdScripts(container);
      const breadcrumb = schemas.find((s) => s["@type"] === "BreadcrumbList");
      expect(breadcrumb).toBeDefined();
      expect(breadcrumb.itemListElement).toHaveLength(2);
      expect(breadcrumb.itemListElement[0].name).toBe("Quiver");
      expect(breadcrumb.itemListElement[1].name).toBe("Live Surf Cams");
    });

    it("renders BreadcrumbList JSON-LD for /cams/[region] with region breadcrumb", () => {
      const { container } = render(
        <BreadcrumbStructuredData
          items={[
            { name: "Quiver", url: baseUrl },
            { name: "Live Surf Cams", url: `${baseUrl}/cams` },
            {
              name: "Southern California",
              url: `${baseUrl}/cams/southern-california`,
            },
          ]}
        />
      );

      const schemas = getJsonLdScripts(container);
      const breadcrumb = schemas.find((s) => s["@type"] === "BreadcrumbList");
      expect(breadcrumb).toBeDefined();
      expect(breadcrumb.itemListElement).toHaveLength(3);
      expect(breadcrumb.itemListElement[0].name).toBe("Quiver");
      expect(breadcrumb.itemListElement[1].name).toBe("Live Surf Cams");
      expect(breadcrumb.itemListElement[2].name).toBe("Southern California");
    });
  });
});
