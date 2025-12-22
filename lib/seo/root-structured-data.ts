import { SEO_CONFIG } from "@/lib/constants/seo";

type JsonLdObject = Record<string, unknown>;

function stripAtContext(node: JsonLdObject): JsonLdObject {
  // We prefer a single top-level @context on the root object (via @graph).
  // Many consumers tolerate nested @context, but removing it from nodes is cleaner.
  const copy: JsonLdObject = { ...node };
  delete copy["@context"];
  return copy;
}

/**
 * Build root JSON-LD structured data as a Schema.org `@graph` object.
 *
 * This avoids emitting a top-level JSON array in `application/ld+json`, which
 * can break some runtime parsers that assume the value is an object with
 * `@context`.
 */
export function buildRootStructuredDataGraph(): {
  "@context": "https://schema.org";
  "@graph": JsonLdObject[];
} {
  const org = stripAtContext(
    SEO_CONFIG.structuredData.organization as unknown as JsonLdObject
  );
  const website = stripAtContext(
    SEO_CONFIG.structuredData.website as unknown as JsonLdObject
  );

  return {
    "@context": "https://schema.org",
    "@graph": [org, website],
  };
}

