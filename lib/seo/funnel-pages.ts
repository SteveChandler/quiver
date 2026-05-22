export type SeoPageType =
  | "longboard"
  | "beginner"
  | "surf-report-today"
  | "surf-cams";

export type SeoImageAssetType = "diorama" | "photo";

export interface SeoImage {
  assetType: SeoImageAssetType;
  id: string;
  src: string;
  alt: string;
  caption: string;
  prompt: string;
}

type SeoImageSeedEntry = [
  id: string,
  theme: string,
  alt: string,
  caption: string,
  assetType?: SeoImageAssetType,
];

export interface SeoPageSection {
  heading: string;
  body: string;
}

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoInternalLink {
  label: string;
  href: string;
  description?: string;
  kind?: "beach" | "cam" | "forecast" | "guide" | "map" | "tide" | "water-temp";
}

export interface SeoSpotLink extends SeoInternalLink {
  beachSlug?: string;
  imageSrc?: string;
  imageAlt?: string;
}

export interface SeoCta {
  label: string;
  href: string;
}

export interface SeoDecisionConfig {
  primarySpotSlug: string;
  fallbackSpotName: string;
  nearbySpotSlugs: string[];
  boardCall: string;
  wetsuitCall: string;
  tideRisk: string;
  windRisk: string;
  crowdParkingNote: string;
}

export interface SeoCamRegionConfig {
  states?: string[];
  cities?: string[];
  regionSlugs?: string[];
}

export interface SeoPageConfig {
  type: SeoPageType;
  slug: string;
  path: string;
  title: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  intro: string;
  locationName: string;
  heroImage: SeoImage;
  images: SeoImage[];
  sections: SeoPageSection[];
  faqs: SeoFaqItem[];
  internalLinks: SeoInternalLink[];
  nearbySpots: SeoSpotLink[];
  primaryCta: SeoCta;
  secondaryCta?: SeoCta;
  relatedSpotIds?: string[];
  primarySpotId?: string;
  decision?: SeoDecisionConfig;
  camRegion?: SeoCamRegionConfig;
  indexable: boolean;
}

interface CanonicalSpotPath {
  citySlug: string;
  stateSlug: string;
  spotSlug: string;
}

const APP_CTA: SeoCta = {
  label: "Open Quiver",
  href: "/auth/sign-up",
};

const MAP_CTA: SeoCta = {
  label: "Explore nearby spots",
  href: "/map",
};

interface SpotImageConfig {
  src: string;
  alt: string;
}

const SPOT_IMAGE_BY_KEY: Record<string, SpotImageConfig> = {
  "3rd-avenue-jetty-belmar-nj": {
    src: "/images/seo-dioramas/surf-report/belmar-today/belmar-beachbreak-check-diorama.webp",
    alt: "Belmar beachbreak surf check near the jetties",
  },
  "8th-avenue-jetty-belmar-nj": {
    src: "/images/seo-dioramas/surf-report/belmar-today/jersey-boardwalk-forecast-diorama.webp",
    alt: "Belmar boardwalk and beachbreak surf context",
  },
  "belmar-fishing-pier-belmar-nj": {
    src: "/images/seo-dioramas/surf-report/belmar-today/belmar-beachbreak-check-diorama.webp",
    alt: "Belmar pier and beachbreak surf context",
  },
  "blacks-beach": {
    src: "/images/blacks.webp",
    alt: "Blacks Beach surf lineup",
  },
  blackies: {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-open-wave-photo.webp",
    alt: "Newport and North Orange County sandy beachbreak context near Blackies",
  },
  "bolsa-chica": {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-sunset-beach-photo.webp",
    alt: "Bolsa Chica and Huntington sandy beachbreak context",
  },
  goldenwest: {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-aerial-shore-photo.webp",
    alt: "Goldenwest and North Huntington sandy beachbreak context",
  },
  "capitola-beach": {
    src: "/images/seo-dioramas/beginner/santa-cruz/boardwalk-surf-check-diorama.webp",
    alt: "Santa Cruz beginner surf check near Capitola",
  },
  "cocoa-beach-pier": {
    src: "/images/seo-dioramas/beginner/cocoa-beach/cocoa-pier-beginner-diorama.webp",
    alt: "Cocoa Beach Pier beginner surf context",
  },
  "doheny-beach": {
    src: "/images/seo-dioramas/spot-backgrounds/doheny-state-beach-photo.webp",
    alt: "Doheny State Beach shoreline and surf lineup",
  },
  "dockweiler-state-beach-playa-del-rey-ca": {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-aerial-shore-photo.webp",
    alt: "Wide Southern California sandy beachbreak context near Dockweiler",
  },
  domes: {
    src: "/images/seo-scenes/rincon-domes.webp",
    alt: "Domes surf context in Rincon Puerto Rico",
  },
  "72nd-place-long-beach-ca": {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-open-wave-photo.webp",
    alt: "Small clean Southern California beachbreak context near 72nd Place",
  },
  "el-porto-manhattan": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-crowd-awareness-diorama.webp",
    alt: "Los Angeles beachbreak crowd and surf-planning context",
  },
  grandview: {
    src: "/images/Beacons_Beach.webp",
    alt: "Encinitas beach and reef surf context near Grandview",
  },
  "la-jolla-shores": {
    src: "/images/seo-dioramas/spot-backgrounds/la-jolla-shores-photo.webp",
    alt: "La Jolla Shores beach and surf lineup",
  },
  leadbetter: {
    src: "/images/seo-dioramas/longboard/santa-barbara/santa-barbara-palm-check-diorama.webp",
    alt: "Santa Barbara longboard surf context near Leadbetter",
  },
  "malibu-first-point-surfrider": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-point-wave-diorama.webp",
    alt: "Malibu First Point surf context",
  },
  "leo-carrillo-state-beach-malibu-ca": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-coastal-drive-check-diorama.webp",
    alt: "Malibu coast surf-check context near Leo Carrillo",
  },
  "huntington-state-beach": {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-aerial-shore-photo.webp",
    alt: "Huntington State Beach sandy surf zone context",
  },
  marias: {
    src: "/images/seo-scenes/rincon-marias.webp",
    alt: "Maria's surf context in Rincon Puerto Rico",
  },
  middles: {
    src: "/images/seo-scenes/san-onofre-clean.webp",
    alt: "San Onofre surf context near Middles",
  },
  mondos: {
    src: "/images/seo-dioramas/longboard/ventura/c-street-point-diorama.webp",
    alt: "Ventura point-wave longboard context near Mondos",
  },
  "mondos-beach-ventura-ca": {
    src: "/images/seo-dioramas/longboard/ventura/c-street-point-diorama.webp",
    alt: "Ventura soft point-wave context near Mondos",
  },
  "moonlight-beach": {
    src: "/images/seo-dioramas/longboard/encinitas/moonlight-peelers-diorama.webp",
    alt: "Moonlight Beach mellow surf context",
  },
  "san-onofre-state-beach": {
    src: "/images/seo-scenes/san-onofre-plan-clean.webp",
    alt: "San Onofre State Beach surf planning context",
  },
  scripps: {
    src: "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
    alt: "Scripps Pier surf lineup",
  },
  "santa-monica-beach-santa-monica-ca": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-coastal-drive-check-diorama.webp",
    alt: "Los Angeles coastline surf-planning context near Santa Monica",
  },
  "refugio-state-beach-goleta-ca": {
    src: "/images/seo-dioramas/longboard/santa-barbara/santa-barbara-palm-check-diorama.webp",
    alt: "Santa Barbara coast beginner surf context near Refugio",
  },
  "tourmaline-surf-park": {
    src: "/images/seo-dioramas/spot-backgrounds/tourmaline-photo.webp",
    alt: "Tourmaline shoreline and mellow surf context",
  },
  "torrance-beach-rat-beach-torrance-ca": {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-open-wave-photo.webp",
    alt: "South Bay sandy beachbreak context near Torrance",
  },
  "venice-beach-venice-ca": {
    src: "/images/seo-dioramas/surf-cams/orange-county/orange-county-sunset-beach-photo.webp",
    alt: "Southern California sandy beachbreak context near Venice",
  },
  "will-rogers-state-beach-santa-monica-ca": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-point-wave-diorama.webp",
    alt: "North Los Angeles beginner surf context near Will Rogers",
  },
  "waikiki-beach": {
    src: "/images/seo-dioramas/longboard/honolulu/waikiki-canoes-diorama.webp",
    alt: "Waikiki beginner and longboard surf context",
  },
  "waikiki-canoes": {
    src: "/images/seo-dioramas/longboard/honolulu/waikiki-canoes-diorama.webp",
    alt: "Waikiki Canoes longboard surf context",
  },
  "/beginner/cocoa-beach": {
    src: "/images/seo-dioramas/beginner/cocoa-beach/cocoa-pier-beginner-diorama.webp",
    alt: "Cocoa Beach beginner surf context",
  },
  "/beginner/honolulu": {
    src: "/images/seo-dioramas/beginner/honolulu/waikiki-lesson-zone-diorama.webp",
    alt: "Honolulu beginner surf context at Waikiki",
  },
  "/beginner/los-angeles": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-coastal-drive-check-diorama.webp",
    alt: "Los Angeles beginner surf planning context",
  },
  "/beginner/orange-county": {
    src: "/images/seo-dioramas/spot-backgrounds/doheny-state-beach-photo.webp",
    alt: "Orange County beginner surf context at Doheny",
  },
  "/beginner/san-diego": {
    src: "/images/seo-dioramas/spot-backgrounds/la-jolla-shores-photo.webp",
    alt: "San Diego beginner surf context at La Jolla",
  },
  "/beginner/san-onofre": {
    src: "/images/seo-scenes/san-onofre-clean.webp",
    alt: "San Onofre beginner surf context",
  },
  "/beginner/santa-barbara": {
    src: "/images/seo-dioramas/longboard/santa-barbara/santa-barbara-palm-check-diorama.webp",
    alt: "Santa Barbara beginner surf planning context",
  },
  "/beginner/ventura": {
    src: "/images/seo-dioramas/longboard/ventura/c-street-point-diorama.webp",
    alt: "Ventura beginner surf planning context near Mondos",
  },
  "/longboard/fl": {
    src: "/images/seo-dioramas/longboard/fl/cocoa-beach-pier-log-diorama.webp",
    alt: "Florida longboard surf context at Cocoa Beach",
  },
  "/longboard/honolulu": {
    src: "/images/seo-dioramas/longboard/honolulu/waikiki-canoes-diorama.webp",
    alt: "Honolulu longboard surf context at Waikiki",
  },
  "/longboard/la-jolla": {
    src: "/images/hero/hero-3-windansea.webp",
    alt: "La Jolla longboard surf context at Windansea",
  },
  "/longboard/ventura": {
    src: "/images/seo-dioramas/longboard/ventura/c-street-point-diorama.webp",
    alt: "Ventura longboard surf context",
  },
  "/map?search=Florida": {
    src: "/images/seo-dioramas/surf-cams/florida/florida-dawn-beachbreak-photo.webp",
    alt: "Florida beachbreak surf context",
  },
  "/map?search=Hawaii": {
    src: "/images/seo-dioramas/surf-cams/hawaii/hawaii-surf-check-photo.webp",
    alt: "Hawaii surf-check context",
  },
  "/map?search=La%20Ocho": {
    src: "/images/seo-dioramas/longboard/pr/tropical-beach-road-check-diorama.webp",
    alt: "Puerto Rico warm-water surf context near La Ocho",
  },
  "/map?search=Malibu%20Second%20Point": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-crowd-awareness-diorama.webp",
    alt: "Malibu Second Point surf context",
  },
  "/map?search=Orange%20County": {
    src: "/images/seo-dioramas/spot-backgrounds/doheny-state-beach-photo.webp",
    alt: "Orange County beach and surf context",
  },
  "/map?search=Pleasure%20Point": {
    src: "/images/seo-dioramas/beginner/santa-cruz/soft-point-beginner-diorama.webp",
    alt: "Pleasure Point soft surf context",
  },
  "/map?search=Rincon": {
    src: "/images/seo-dioramas/longboard/santa-barbara/rincon-right-diorama.webp",
    alt: "Rincon long right-hand point-wave context",
  },
  "/map?search=Santa%20Cruz": {
    src: "/images/seo-dioramas/beginner/santa-cruz/cowells-beginner-diorama.webp",
    alt: "Santa Cruz beginner surf context",
  },
  "/map?search=Santa%20Barbara": {
    src: "/images/seo-dioramas/longboard/santa-barbara/santa-barbara-palm-check-diorama.webp",
    alt: "Santa Barbara surf map context",
  },
  "/map?search=Ventura%20Pier": {
    src: "/images/seo-dioramas/longboard/ventura/ventura-pier-check-diorama.webp",
    alt: "Ventura Pier surf context",
  },
  "zuma-beach-malibu-ca": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-coastal-drive-check-diorama.webp",
    alt: "Malibu beachbreak context near Zuma",
  },
  "/surf-cams/florida": {
    src: "/images/seo-dioramas/surf-cams/florida/florida-choppy-sea-photo.webp",
    alt: "Florida surf cam beachbreak context",
  },
  "/surf-cams/hawaii": {
    src: "/images/seo-dioramas/surf-cams/hawaii/hawaii-surf-check-photo.webp",
    alt: "Hawaii surf cam context",
  },
  "/surf-cams/orange-county": {
    src: "/images/seo-dioramas/spot-backgrounds/doheny-state-beach-photo.webp",
    alt: "Orange County surf cam wave context",
  },
  "/surf-cams/san-diego": {
    src: "/images/seo-dioramas/surf-cams/san-diego/san-diego-ocean-beach-line-photo.webp",
    alt: "San Diego surf cam wave context",
  },
  "/surf-report/malibu-today": {
    src: "/images/seo-dioramas/surf-report/malibu-today/malibu-point-wave-diorama.webp",
    alt: "Malibu point-wave surf report context",
  },
  "/surf-report/scripps-pier-today": {
    src: "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
    alt: "Scripps Pier surf report context",
  },
  "/surf-report/tourmaline-today": {
    src: "/images/seo-dioramas/spot-backgrounds/tourmaline-photo.webp",
    alt: "Tourmaline surf report context",
  },
};

function withSpotImages(spots: SeoSpotLink[]): SeoSpotLink[] {
  return spots.map((spot) => {
    const image =
      (spot.beachSlug ? SPOT_IMAGE_BY_KEY[spot.beachSlug] : undefined) ??
      SPOT_IMAGE_BY_KEY[spot.href];

    return image ? { ...spot, imageSrc: image.src, imageAlt: image.alt } : spot;
  });
}

function parseCanonicalSpotPath(href: string): CanonicalSpotPath | null {
  const match = href.match(/^\/([a-z]{2})\/([^/?#]+)\/([^/?#]+)$/);
  if (!match) return null;

  return {
    stateSlug: match[1],
    citySlug: match[2],
    spotSlug: match[3],
  };
}

function isExistingFunnelPath(path: string): boolean {
  return SEO_FUNNEL_PAGES.some((page) => page.path === path);
}

function addUniqueInternalLink(
  links: SeoInternalLink[],
  seen: Set<string>,
  link: SeoInternalLink,
): void {
  if (seen.has(link.href)) return;

  links.push(link);
  seen.add(link.href);
}

function getMapSearchLink(page: SeoPageConfig): SeoInternalLink {
  return {
    label: `${page.locationName} surf map`,
    href: `/map?search=${encodeURIComponent(page.locationName)}`,
    description: `Compare nearby breaks around ${page.locationName} before choosing the drive.`,
    kind: "map",
  };
}

function getRelatedCamLink(page: SeoPageConfig): SeoInternalLink | null {
  if (page.type === "surf-cams") return null;

  const camLink = page.internalLinks.find((link) =>
    link.href.startsWith("/surf-cams/"),
  );

  if (!camLink || !isExistingFunnelPath(camLink.href)) return null;

  return {
    label: camLink.label,
    href: camLink.href,
    description:
      "Use live camera context with the forecast before you move spots.",
    kind: "cam",
  };
}

function getRelatedReportLinks(page: SeoPageConfig): SeoInternalLink[] {
  if (page.type === "surf-report-today") return [];

  return page.internalLinks
    .filter((link) => link.href.startsWith("/surf-report/"))
    .filter((link) => isExistingFunnelPath(link.href))
    .map((link) => ({
      label: link.label,
      href: link.href,
      description: "Check the current surf-call page for a spot-specific read.",
      kind: "forecast" as const,
    }));
}

function getCanonicalSpotLinks(page: SeoPageConfig): SeoInternalLink[] {
  return page.nearbySpots.flatMap((spot) => {
    const parsed = parseCanonicalSpotPath(spot.href);
    if (!parsed) return [];

    const labelPrefix = spot.label;
    const beachPath = `/${parsed.stateSlug}/${parsed.citySlug}/${parsed.spotSlug}`;

    return [
      {
        label: `${labelPrefix} forecast`,
        href: beachPath,
        description: `Open the live beach page for ${labelPrefix} forecast, conditions, and local context.`,
        kind: "beach" as const,
      },
      {
        label: `${labelPrefix} tide chart`,
        href: `${beachPath}/tides`,
        description: `Check tide timing before committing to ${labelPrefix}.`,
        kind: "tide" as const,
      },
      {
        label: `${labelPrefix} water temperature`,
        href: `${beachPath}/water-temp`,
        description: `Dial wetsuit choice from the ${labelPrefix} water-temp page.`,
        kind: "water-temp" as const,
      },
    ];
  });
}

export function getSeoFunnelInternalLinks(
  page: SeoPageConfig,
): SeoInternalLink[] {
  const links: SeoInternalLink[] = [];
  const seen = new Set<string>();

  for (const link of page.internalLinks) {
    const kind =
      link.kind ??
      (link.href.startsWith("/surf-cams/")
        ? "cam"
        : link.href.startsWith("/surf-report/")
          ? "forecast"
          : link.href.startsWith("/map")
            ? "map"
            : "guide");

    addUniqueInternalLink(links, seen, { ...link, kind });
  }

  for (const link of getCanonicalSpotLinks(page)) {
    addUniqueInternalLink(links, seen, link);
  }

  const camLink = getRelatedCamLink(page);
  if (camLink) addUniqueInternalLink(links, seen, camLink);

  for (const link of getRelatedReportLinks(page)) {
    addUniqueInternalLink(links, seen, link);
  }

  addUniqueInternalLink(links, seen, getMapSearchLink(page));

  return links.filter((link) => link.href !== page.path);
}

const DIORAMA_STYLE =
  "A miniature diorama scene in the Quiver surf app brand style, soft coastal lighting, playful but premium, clean product-marketing composition, no text, no logos, no readable signs, no watermark, location-specific surf landmark, tiny surfers, surfboards, beach parking details, ocean forecast vibe, warm sand tones, ocean blues, subtle orange accents. Original composition, not copied from a photo.";

const IMAGE_DIR_BY_TYPE: Record<SeoPageType, string> = {
  longboard: "longboard",
  beginner: "beginner",
  "surf-report-today": "surf-report",
  "surf-cams": "surf-cams",
};

function makeImage(
  type: SeoPageType,
  slug: string,
  id: string,
  theme: string,
  alt: string,
  caption: string,
): SeoImage {
  const directory = IMAGE_DIR_BY_TYPE[type];

  return {
    assetType: "diorama",
    id,
    src: `/images/seo-dioramas/${directory}/${slug}/${id}.webp`,
    alt,
    caption,
    prompt: [
      "Use case: ads-marketing",
      "Asset type: Quiver SEO landing page diorama image",
      `Primary request: ${theme}`,
      `Scene/backdrop: ${theme}`,
      "Subject: location-specific surf decision scene with tiny surfers and boards",
      `Style constraints: ${DIORAMA_STYLE}`,
      "Avoid: copyrighted photo replication, real brand logos, readable text, signs, UI text, watermarks, generic stock-photo framing.",
    ].join("\n"),
  };
}

function makePhotoImage(
  type: SeoPageType,
  slug: string,
  id: string,
  theme: string,
  alt: string,
  caption: string,
): SeoImage {
  const directory = IMAGE_DIR_BY_TYPE[type];

  return {
    assetType: "photo",
    id,
    src: `/images/seo-dioramas/${directory}/${slug}/${id}.webp`,
    alt,
    caption,
    prompt: [
      "Use case: ads-marketing",
      "Asset type: Quiver SEO landing page real photo image",
      `Primary request: ${theme}`,
      `Scene/backdrop: ${theme}`,
      "Subject: real coastline, beach, and surf-condition reference photography",
      "Style constraints: preserve the source photo's natural location cues, avoid synthetic effects, no text overlays, no logos, no readable signs, no watermark.",
      "Avoid: generated-scene claims, invented landmarks, copyrighted logo focus, or implying the photo shows a specific break when it only shows a representative coastline.",
    ].join("\n"),
  };
}

function makeExistingPhotoImage(
  id: string,
  src: string,
  theme: string,
  alt: string,
  caption: string,
): SeoImage {
  return {
    assetType: "photo",
    id,
    src,
    alt,
    caption,
    prompt: [
      "Use case: ads-marketing",
      "Asset type: Quiver SEO landing page real photo image",
      `Primary request: ${theme}`,
      `Scene/backdrop: ${theme}`,
      "Subject: real coastline, beach, and surf-condition reference photography",
      "Style constraints: preserve the source photo's natural location cues, avoid synthetic effects, no text overlays, no logos, no readable signs, no watermark.",
      "Avoid: generated-scene claims, invented landmarks, copyrighted logo focus, or implying the photo shows a specific break when it only shows a representative coastline.",
    ].join("\n"),
  };
}

function makeExistingDioramaImage(
  id: string,
  src: string,
  theme: string,
  alt: string,
  caption: string,
): SeoImage {
  return {
    assetType: "diorama",
    id,
    src,
    alt,
    caption,
    prompt: [
      "Use case: ads-marketing",
      "Asset type: Quiver SEO landing page diorama image",
      `Primary request: ${theme}`,
      `Scene/backdrop: ${theme}`,
      "Subject: location-specific surf decision scene with tiny surfers and boards",
      `Style constraints: ${DIORAMA_STYLE}`,
      "Avoid: copyrighted photo replication, real brand logos, readable text, signs, UI text, watermarks, generic stock-photo framing.",
    ].join("\n"),
  };
}

function makeImages(
  type: SeoPageType,
  slug: string,
  entries: SeoImageSeedEntry[],
): SeoImage[] {
  return entries.map(([id, theme, alt, caption, assetType]) =>
    assetType === "photo"
      ? makePhotoImage(type, slug, id, theme, alt, caption)
      : makeImage(type, slug, id, theme, alt, caption),
  );
}

function makePhotoImages(
  type: SeoPageType,
  slug: string,
  entries: SeoImageSeedEntry[],
): SeoImage[] {
  return entries.map(([id, theme, alt, caption]) =>
    makePhotoImage(type, slug, id, theme, alt, caption),
  );
}

function pagePath(type: SeoPageType, slug: string): string {
  if (type === "surf-report-today") return `/surf-report/${slug}`;
  if (type === "surf-cams") return `/surf-cams/${slug}`;
  return `/${type}/${slug}`;
}

interface LocationSeed {
  type: "longboard" | "beginner";
  slug: string;
  imageAssetType?: SeoImageAssetType;
  locationName: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  bestZones: string;
  conditions: string;
  boardCall: string;
  localNotes: string;
  namedBreaks: string[];
  links: SeoInternalLink[];
  spots: SeoSpotLink[];
  images: SeoImageSeedEntry[];
  existingImages?: SeoImage[];
}

function buildLocationPage(seed: LocationSeed): SeoPageConfig {
  const images =
    seed.existingImages ??
    (seed.imageAssetType === "photo"
      ? makePhotoImages(seed.type, seed.slug, seed.images)
      : makeImages(seed.type, seed.slug, seed.images));
  const intentLabel = seed.type === "longboard" ? "longboard" : "beginner";

  return {
    type: seed.type,
    slug: seed.slug,
    path: pagePath(seed.type, seed.slug),
    title: seed.title,
    metaDescription: seed.metaDescription,
    h1: seed.h1,
    eyebrow:
      seed.type === "longboard"
        ? "Longboard surf guide"
        : "Beginner surf guide",
    intro: seed.intro,
    locationName: seed.locationName,
    heroImage: images[0],
    images,
    sections: [
      {
        heading: `Where ${seed.locationName} works best`,
        body: seed.bestZones,
      },
      {
        heading: "Best conditions to watch for",
        body: seed.conditions,
      },
      {
        heading:
          seed.type === "longboard"
            ? "Log vs mid-length call"
            : "Board and safety call",
        body: seed.boardCall,
      },
      {
        heading: "Local read before you drive",
        body: seed.localNotes,
      },
    ],
    faqs: [
      {
        question: `Is ${seed.locationName} good for ${intentLabel} surfing?`,
        answer: `${seed.locationName} can be a strong ${intentLabel} zone when the swell, tide, and wind line up. Use this guide for the local pattern, then check Quiver before you drive for the freshest conditions.`,
      },
      {
        question: `What conditions are best in ${seed.locationName}?`,
        answer: seed.conditions,
      },
      {
        question:
          seed.type === "longboard"
            ? `Should I bring a log or mid-length in ${seed.locationName}?`
            : `What board should a beginner bring in ${seed.locationName}?`,
        answer: seed.boardCall,
      },
      {
        question: `Which local breaks should I check near ${seed.locationName}?`,
        answer: `Start with ${seed.namedBreaks.join(", ")} when they match your skill level. Treat named spots as a planning list, not a guarantee that every break is right today.`,
      },
    ],
    internalLinks: seed.links,
    nearbySpots: withSpotImages(seed.spots),
    primaryCta: APP_CTA,
    secondaryCta: MAP_CTA,
    relatedSpotIds: seed.spots.flatMap((spot) =>
      spot.beachSlug ? [spot.beachSlug] : [],
    ),
    indexable: true,
  };
}

const LONGBOARD_PAGES = [
  buildLocationPage({
    type: "longboard",
    slug: "encinitas",
    locationName: "Encinitas",
    title: "Best Longboard Waves in Encinitas | Quiver Surf Guide",
    metaDescription:
      "Find Encinitas longboard waves with Quiver's local guide to Cardiff, Swami's, Moonlight, tide windows, board calls, and nearby surf spots.",
    h1: "Best Longboard Waves in Encinitas",
    intro:
      "Encinitas is built for patient longboard sessions: reefy corners, soft summer peelers, and enough local texture that the right tide matters.",
    bestZones:
      "Cardiff and Swami's are the classic checks when the swell is organized and not too steep. Moonlight and nearby beachbreak corners are better when the reefs are too crowded or the tide is not lining up.",
    conditions:
      "Look for clean morning wind, a manageable west or southwest swell, and tide windows that leave enough water on the reef without flattening the wave. If it is peaky and fast, switch to a mid-length or fish.",
    boardCall:
      "Bring the log for lined-up shoulder-high or smaller peelers. A mid-length makes more sense when there is extra push, texture, or crowd pressure and you need earlier speed without swinging a 9-foot board through traffic.",
    localNotes:
      "Parking fills early near Cardiff and Swami's. If the bluff lots are stacked, use Quiver to compare nearby windows before committing to a packed lineup.",
    namedBreaks: ["Cardiff", "Swami's", "Moonlight Beach", "Grandview"],
    links: [
      { label: "Beginner surf in San Diego", href: "/beginner/san-diego" },
      { label: "La Jolla longboard guide", href: "/longboard/la-jolla" },
      { label: "San Diego surf cams", href: "/surf-cams/san-diego" },
    ],
    spots: [
      {
        label: "Moonlight Beach",
        href: "/ca/encinitas/moonlight-beach",
        beachSlug: "moonlight-beach",
      },
      {
        label: "Grandview",
        href: "/ca/encinitas/grandview",
        beachSlug: "grandview",
      },
      { label: "Tourmaline today", href: "/surf-report/tourmaline-today" },
    ],
    images: [
      [
        "cardiff-log-diorama",
        "Cardiff reef longboard diorama at golden hour",
        "Quiver-style diorama of a longboard surfer checking Cardiff reef in Encinitas",
        "Cardiff-inspired longboard morning",
      ],
      [
        "swamis-bluff-diorama",
        "Swami's bluff overlook with tiny longboarders",
        "Miniature Swami's bluff surf-check scene with tiny longboarders",
        "Swami's bluff check",
      ],
      [
        "moonlight-peelers-diorama",
        "Moonlight Beach mellow summer peelers",
        "Miniature Moonlight Beach summer longboard scene with soft peelers",
        "Moonlight summer peelers",
      ],
    ],
  }),
  buildLocationPage({
    type: "longboard",
    slug: "la-jolla",
    locationName: "La Jolla",
    title: "Best Longboard Waves in La Jolla | Quiver Surf Guide",
    metaDescription:
      "Plan a La Jolla longboard session with Quiver's guide to Tourmaline, La Jolla Shores, mellow reef days, tide risk, and nearby backups.",
    h1: "Best Longboard Waves in La Jolla",
    intro:
      "La Jolla rewards surfers who know when to trade power for glide. The right small-to-moderate swell can turn the zone into a clean longboard plan.",
    bestZones:
      "Tourmaline is the reliable longboard check. La Jolla Shores can be friendlier when the reefs are too crowded, while Windansea-inspired reef days are for confident surfers only when conditions stay mellow.",
    conditions:
      "Prioritize soft, organized surf with light wind and enough tide to keep the takeoff forgiving. Avoid bigger, punchier reef energy if the goal is classic trim and easy exits.",
    boardCall:
      "Use a log for slow Tourmaline runners and summer texture. Bring a mid-length if the wave has more wall, if the crowd is tight, or if you want easier positioning around mixed craft.",
    localNotes:
      "Tourmaline parking is the first constraint. If the lot is full or the wind turns onshore, compare Scripps, La Jolla Shores, and San Diego cams before driving south.",
    namedBreaks: ["Tourmaline", "La Jolla Shores", "Scripps", "Windansea"],
    links: [
      {
        label: "Tourmaline surf report today",
        href: "/surf-report/tourmaline-today",
      },
      { label: "Scripps Pier today", href: "/surf-report/scripps-pier-today" },
      { label: "San Diego surf cams", href: "/surf-cams/san-diego" },
    ],
    spots: [
      {
        label: "Tourmaline Surf Park",
        href: "/ca/san-diego/tourmaline-surf-park",
        beachSlug: "tourmaline-surf-park",
      },
      {
        label: "La Jolla Shores",
        href: "/ca/la-jolla/la-jolla-shores",
        beachSlug: "la-jolla-shores",
      },
      { label: "Scripps", href: "/ca/la-jolla/scripps", beachSlug: "scripps" },
    ],
    images: [
      [
        "tourmaline-lineup-diorama",
        "Tourmaline longboard lineup with soft rolling waves",
        "Miniature Tourmaline longboard lineup with soft rolling waves",
        "Tourmaline soft runners",
      ],
      [
        "la-jolla-cove-cliffs-diorama",
        "La Jolla cove cliffs with tiny surfboards and ocean texture",
        "Quiver diorama of La Jolla cliffs with tiny surfboards and textured ocean",
        "La Jolla cliff texture",
      ],
      [
        "windansea-mellow-reef-diorama",
        "Windansea-inspired reef scene, mellow not heavy",
        "Mellow Windansea-inspired reef diorama with longboards and no heavy surf",
        "Mellow reef read",
      ],
    ],
  }),
  buildLocationPage({
    type: "longboard",
    slug: "ventura",
    locationName: "Ventura",
    title: "Best Longboard Waves in Ventura | Quiver Surf Guide",
    metaDescription:
      "Use Quiver's Ventura longboard guide for C-Street style points, mellow beach checks, board calls, wind windows, and nearby backups.",
    h1: "Best Longboard Waves in Ventura",
    intro:
      "Ventura is a point-break longboard town when the wind stays down and the swell has enough line to wrap instead of crumble.",
    bestZones:
      "C-Street style point waves are the main draw on organized west and northwest energy. Mondos and softer beach checks help when you need something easier and less competitive.",
    conditions:
      "Morning glass, lined-up swell, and a tide that keeps the point from getting too sectiony are the signs to watch. Afternoon wind can turn a clean plan into a bumpy paddle quickly.",
    boardCall:
      "Bring a log for waist-to-shoulder-high point surf with open faces. A mid-length is better when sections are faster, the wind has texture, or you need more paddle speed in current.",
    localNotes:
      "C-Street can feel like a conveyor belt on the good days. If the lot and lineup look maxed, compare Mondos and nearby beachbreaks before forcing it.",
    namedBreaks: ["C-Street", "Mondos", "Ventura Pier", "Emma Wood"],
    links: [
      {
        label: "Santa Barbara longboard guide",
        href: "/longboard/santa-barbara",
      },
      { label: "Malibu surf report today", href: "/surf-report/malibu-today" },
      { label: "Open the Quiver map", href: "/map?search=Ventura" },
    ],
    spots: [
      { label: "Mondos", href: "/ca/ventura/mondos", beachSlug: "mondos" },
      { label: "Ventura Pier", href: "/map?search=Ventura%20Pier" },
      { label: "Malibu today", href: "/surf-report/malibu-today" },
    ],
    images: [
      [
        "c-street-point-diorama",
        "C-Street point-break diorama with long peeling right",
        "Miniature C-Street point-break diorama with a long peeling right",
        "C-Street-style peelers",
      ],
      [
        "ventura-pier-check-diorama",
        "Ventura pier morning check",
        "Quiver diorama of a Ventura pier morning surf check",
        "Pier morning check",
      ],
      [
        "ventura-log-wagon-diorama",
        "Coastal parking lot with logs stacked on a wagon",
        "Miniature Ventura coastal parking lot with longboards stacked on a wagon",
        "Logs in the lot",
      ],
    ],
  }),
  buildLocationPage({
    type: "longboard",
    slug: "santa-barbara",
    locationName: "Santa Barbara",
    title: "Best Longboard Waves in Santa Barbara | Quiver Surf Guide",
    metaDescription:
      "Find Santa Barbara longboard windows with Quiver's guide to Rincon-style points, Leadbetter checks, tide notes, crowd reads, and board calls.",
    h1: "Best Longboard Waves in Santa Barbara",
    intro:
      "Santa Barbara longboarding is about patience: the right swell direction, the right tide, and a willingness to wait for point waves to wake up.",
    bestZones:
      "Rincon-inspired point surf is the headline when the swell wraps. Leadbetter and palm-lined town checks are easier calls when the points are small, crowded, or too fast.",
    conditions:
      "Look for clean morning wind, long-period west energy, and a tide that keeps the inside sections connected. Too much tide can soften the wave; too little can make the line unforgiving.",
    boardCall:
      "A log fits the slower town waves and connected point peelers. A mid-length is the safer call when the wave has more speed, kelp, or crowd pressure.",
    localNotes:
      "The best Santa Barbara longboard days are not secret. Build a backup plan before you drive, especially around holiday mornings and the first real swell after a lull.",
    namedBreaks: [
      "Rincon",
      "Leadbetter",
      "Hammonds",
      "Santa Barbara town beaches",
    ],
    links: [
      { label: "Ventura longboard guide", href: "/longboard/ventura" },
      { label: "Malibu surf report today", href: "/surf-report/malibu-today" },
      { label: "Open Quiver map", href: "/map?search=Santa%20Barbara" },
    ],
    spots: [
      {
        label: "Leadbetter",
        href: "/ca/santa-barbara/leadbetter",
        beachSlug: "leadbetter",
      },
      { label: "Rincon search", href: "/map?search=Rincon" },
      { label: "Ventura longboard", href: "/longboard/ventura" },
    ],
    images: [
      [
        "rincon-right-diorama",
        "Rincon-inspired long right-hand point wave",
        "Original Rincon-inspired miniature long right-hand point wave scene",
        "Long right-hand line",
      ],
      [
        "santa-barbara-palm-check-diorama",
        "Santa Barbara palm-lined beach check",
        "Miniature Santa Barbara palm-lined beach surf-check diorama",
        "Palm-lined beach check",
      ],
      [
        "bluff-wax-up-diorama",
        "Longboard wax-up scene near coastal bluffs",
        "Quiver-style diorama of a longboard wax-up scene near coastal bluffs",
        "Bluff-side wax-up",
      ],
    ],
  }),
  buildLocationPage({
    type: "longboard",
    slug: "honolulu",
    locationName: "Honolulu",
    title: "Best Longboard Waves in Honolulu | Quiver Surf Guide",
    metaDescription:
      "Plan Honolulu longboard sessions with Quiver's guide to Waikiki, Queens, Canoes, Diamond Head context, board calls, and warm-water windows.",
    h1: "Best Longboard Waves in Honolulu",
    intro:
      "Honolulu can be as classic as longboarding gets: warm water, rolling Waikiki lines, and plenty of traffic when the window turns obvious.",
    bestZones:
      "Queens, Canoes, and Waikiki Beach are the longboard anchors. Diamond Head adds variety when the trades, swell, and skill level make sense.",
    conditions:
      "Clean south shore swell, manageable trades, and a tide that leaves room over reef are the main checks. When the surf gets crowded, choose patience over squeezing inside.",
    boardCall:
      "Bring a log for Waikiki runners and soft summer surf. A mid-length is useful when wind or crowd spacing makes quick positioning more important than pure trim.",
    localNotes:
      "Respect local etiquette and lesson zones. Warm water does not make a crowded lineup low-risk, especially around mixed skill levels and rental boards.",
    namedBreaks: ["Waikiki", "Queens", "Canoes", "Diamond Head"],
    links: [
      { label: "Honolulu beginner surf", href: "/beginner/honolulu" },
      { label: "Hawaii surf cams", href: "/surf-cams/hawaii" },
      { label: "Open Quiver map", href: "/map?search=Honolulu" },
    ],
    spots: [
      {
        label: "Waikiki Beach",
        href: "/hi/honolulu/waikiki-beach",
        beachSlug: "waikiki-beach",
      },
      {
        label: "Waikiki Canoes",
        href: "/hi/honolulu/waikiki-canoes",
        beachSlug: "waikiki-canoes",
      },
      { label: "Hawaii cams", href: "/surf-cams/hawaii" },
    ],
    images: [
      [
        "waikiki-canoes-diorama",
        "Waikiki Queens and Canoes-inspired mellow longboard wave",
        "Miniature Waikiki Queens and Canoes-inspired mellow longboard wave",
        "Waikiki runners",
      ],
      [
        "diamond-head-lineup-diorama",
        "Diamond Head in background with tiny surfers",
        "Quiver diorama with Diamond Head in the background and tiny surfers",
        "Diamond Head backdrop",
      ],
      [
        "tropical-board-rack-diorama",
        "Tropical board rack with longboards and Quiver colors",
        "Miniature tropical board rack with longboards and Quiver orange-blue accents",
        "Tropical board rack",
      ],
    ],
  }),
  buildLocationPage({
    type: "longboard",
    slug: "pr",
    locationName: "Puerto Rico",
    title: "Best Longboard Waves in Puerto Rico | Quiver Surf Guide",
    metaDescription:
      "Use Quiver's Puerto Rico longboard guide for Rincon-friendly reefs, warm-water surf checks, board calls, tide notes, and nearby spots.",
    h1: "Best Longboard Waves in Puerto Rico",
    intro:
      "Puerto Rico is not only for heavy winter surf. The right Rincon and north coast windows can be warm, clean, and longboard-friendly.",
    bestZones:
      "Rincon-area reefs are the anchor when the swell is mellow and organized. Beach-road checks help when you need cleaner wind, less size, or a more forgiving takeoff.",
    conditions:
      "Look for smaller, organized swell, light morning wind, and reef-aware tides. If the swell jumps or the period gets serious, treat the same coast as a different skill level.",
    boardCall:
      "A log works for soft, warm-water runners. A mid-length is better when reef speed, current, or mixed-size sets make a full log feel slow to redirect.",
    localNotes:
      "Puerto Rico spots change character quickly with swell size. Use Quiver for the live read, and do not treat a beginner-friendly day as a permanent label.",
    namedBreaks: ["Rincon", "Domes", "Maria's", "Pine Grove", "La Ocho"],
    links: [
      { label: "Florida longboard guide", href: "/longboard/fl" },
      { label: "Open Quiver map", href: "/map?search=Puerto%20Rico" },
      { label: "Best time to surf", href: "/best-time-to-surf" },
    ],
    spots: [
      { label: "Domes", href: "/pr/rincon/domes", beachSlug: "domes" },
      { label: "Maria's", href: "/pr/rincon/marias", beachSlug: "marias" },
      { label: "La Ocho", href: "/map?search=La%20Ocho" },
    ],
    images: [
      [
        "rincon-pr-reef-diorama",
        "Rincon Puerto Rico longboard-friendly reef scene",
        "Original Rincon Puerto Rico longboard-friendly reef diorama",
        "Rincon reef glide",
      ],
      [
        "tropical-beach-road-check-diorama",
        "Tropical beach road surf check",
        "Miniature Puerto Rico tropical beach road surf-check scene",
        "Beach road check",
      ],
      [
        "warm-water-longboard-diorama",
        "Warm-water longboard session with palm trees and clear water",
        "Quiver diorama of a warm-water longboard session with palms and clear water",
        "Warm-water runners",
      ],
    ],
  }),
  buildLocationPage({
    type: "longboard",
    slug: "fl",
    locationName: "Florida",
    title: "Best Longboard Waves in Florida | Quiver Surf Guide",
    metaDescription:
      "Find Florida longboard windows with Quiver's guide to Cocoa Beach, small clean beachbreaks, boardwalk checks, wind risk, and nearby cams.",
    h1: "Best Longboard Waves in Florida",
    intro:
      "Florida longboarding is about reading small windows well. Clean waist-high surf can be a better call than a bigger, windier beachbreak day.",
    bestZones:
      "Cocoa Beach and mellow Atlantic beachbreaks are the main longboard checks. Piers and boardwalk zones help you read shape, drift, and crowd before you unload the log.",
    conditions:
      "Look for light morning wind, small-to-moderate easterly swell, and enough tide to soften closeouts. Hard onshore wind can erase a longboard window fast.",
    boardCall:
      "Bring a log for small, clean peelers and foamier summer mornings. A mid-length or fish is better when the surf has push but the sections are too fast for classic trim.",
    localNotes:
      "Check cams before committing to a drive. Florida can look fun for one tide window and then flatten or blow out before lunch.",
    namedBreaks: [
      "Cocoa Beach",
      "New Smyrna",
      "Ponce Inlet",
      "Jacksonville Beach",
    ],
    links: [
      { label: "Cocoa Beach beginner surf", href: "/beginner/cocoa-beach" },
      { label: "Florida surf cams", href: "/surf-cams/florida" },
      { label: "Puerto Rico longboard guide", href: "/longboard/pr" },
    ],
    spots: [
      {
        label: "Cocoa Beach Pier",
        href: "/fl/cocoa-beach/cocoa-beach-pier",
        beachSlug: "cocoa-beach-pier",
      },
      { label: "Florida cams", href: "/surf-cams/florida" },
      { label: "Cocoa beginner guide", href: "/beginner/cocoa-beach" },
    ],
    images: [
      [
        "cocoa-beach-pier-log-diorama",
        "Cocoa Beach pier longboard diorama",
        "Miniature Cocoa Beach pier longboard diorama",
        "Cocoa pier glide",
      ],
      [
        "small-clean-florida-diorama",
        "Small clean Florida beachbreak with foamies and logs",
        "Quiver diorama of small clean Florida beachbreak with foamies and longboards",
        "Small clean beachbreak",
      ],
      [
        "sunrise-boardwalk-check-diorama",
        "Sunrise boardwalk surf check",
        "Miniature Florida sunrise boardwalk surf-check scene",
        "Sunrise boardwalk check",
      ],
    ],
  }),
];

const BEGINNER_PAGES = [
  buildLocationPage({
    type: "beginner",
    slug: "san-diego",
    imageAssetType: "photo",
    locationName: "San Diego",
    title: "Beginner Surf Spots in San Diego | Quiver",
    metaDescription:
      "Find beginner surf spots in San Diego with Quiver's guide to La Jolla Shores, Tourmaline, Mission Beach, safer size ranges, tides, and board calls.",
    h1: "Beginner Surf Spots in San Diego",
    intro:
      "San Diego has several beginner-friendly zones, but the safest call still depends on size, wind, tide, and how crowded the inside is.",
    bestZones:
      "La Jolla Shores is the most straightforward learner zone. Tourmaline is softer and more longboard-friendly, while Mission Beach can work when the beachbreak is small and organized.",
    conditions:
      "Keep beginners in smaller surf with light wind, visible channels, and enough tide to soften the inside. Treat overhead sets, strong drift, and fast closeouts as a no-go.",
    boardCall:
      "A soft-top is the default for first sessions. Move to a longboard only when the surfer can control the board, turtle roll safely, and avoid crowded takeoff zones.",
    localNotes:
      "Parking and lesson traffic build early. If La Jolla Shores or Tourmaline is packed, check cams and Quiver's nearby spots before forcing a crowded inside lineup.",
    namedBreaks: [
      "La Jolla Shores",
      "Tourmaline",
      "Mission Beach",
      "Pacific Beach",
    ],
    links: [
      { label: "San Diego surf cams", href: "/surf-cams/san-diego" },
      { label: "Scripps Pier today", href: "/surf-report/scripps-pier-today" },
      { label: "La Jolla longboard guide", href: "/longboard/la-jolla" },
      { label: "Orange County beginner surf", href: "/beginner/orange-county" },
      { label: "Los Angeles beginner surf", href: "/beginner/los-angeles" },
    ],
    spots: [
      {
        label: "La Jolla Shores",
        href: "/ca/la-jolla/la-jolla-shores",
        beachSlug: "la-jolla-shores",
      },
      { label: "Tourmaline", href: "/surf-report/tourmaline-today" },
      { label: "Scripps today", href: "/surf-report/scripps-pier-today" },
    ],
    images: [
      [
        "la-jolla-shores-photo",
        "La Jolla Shores beach photo for beginner surf planning",
        "La Jolla Shores beach with boards and soft beginner-friendly surf",
        "La Jolla Shores",
      ],
      [
        "tourmaline-shoreline-real-photo",
        "Tourmaline shoreline photo for beginner and longboard planning",
        "Tourmaline shoreline with soft rolling waves and open beach",
        "Tourmaline shoreline",
      ],
      [
        "ocean-beach-wave-real-photo",
        "Ocean Beach wave photo for San Diego beginner context",
        "Ocean Beach wave line with surfers used for broader San Diego context",
        "Ocean Beach wave line",
      ],
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "santa-cruz",
    locationName: "Santa Cruz",
    title: "Beginner Surf Spots in Santa Cruz | Quiver",
    metaDescription:
      "Plan beginner surfing in Santa Cruz with Quiver's guide to Cowell's, Capitola, Pleasure Point context, tide windows, safety notes, and live nearby forecast links.",
    h1: "Beginner Surf Spots in Santa Cruz",
    intro:
      "Santa Cruz has iconic learner waves, but it also has reefs, cold water, crowds, and fast-changing swell. Keep the beginner plan honest.",
    bestZones:
      "Cowell's is the classic learner reference, and Capitola is a strong nearby beginner/longboard check. Pleasure Point can offer softer corners, but it is not a blanket beginner recommendation.",
    conditions:
      "Low-to-mid tide, small friendly surf, and manageable wind are the key filters. If winter swell is up, many Santa Cruz spots stop being beginner terrain.",
    boardCall:
      "Use a foam board or stable longboard in true learner zones. Beginners should avoid crowded reef takeoffs, bigger winter sets, and spots where they cannot safely exit.",
    localNotes:
      "Quiver-backed live forecast coverage should stay separate from local editorial guidance. Capitola has nearby Quiver spot coverage; Cowell's and other learner references should not be shown as live Quiver forecast spots until they exist in the DB.",
    namedBreaks: ["Cowell's", "Capitola", "Pleasure Point", "38th Avenue"],
    links: [
      {
        label: "Santa Cruz longboard-style spots",
        href: "/beginner/santa-cruz",
      },
      { label: "San Onofre beginner surf", href: "/beginner/san-onofre" },
      { label: "Open Quiver map", href: "/map?search=Santa%20Cruz" },
    ],
    spots: [
      {
        label: "Capitola Beach",
        href: "/ca/capitola/capitola-beach",
        beachSlug: "capitola-beach",
      },
      { label: "Pleasure Point search", href: "/map?search=Pleasure%20Point" },
      { label: "Santa Cruz map", href: "/map?search=Santa%20Cruz" },
    ],
    images: [
      [
        "cowells-beginner-diorama",
        "Cowell's beginner wave diorama",
        "Miniature Cowell's beginner wave diorama with tiny learners",
        "Cowell's learner wave",
      ],
      [
        "boardwalk-surf-check-diorama",
        "Santa Cruz boardwalk surf check",
        "Quiver diorama of a Santa Cruz boardwalk surf-check scene",
        "Boardwalk surf check",
      ],
      [
        "soft-point-beginner-diorama",
        "Soft rolling point wave with beginner surfers",
        "Miniature soft rolling Santa Cruz point wave with beginner surfers",
        "Soft point-wave lesson",
      ],
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "orange-county",
    locationName: "Orange County",
    title: "Beginner Surf Spots in Orange County | Quiver",
    metaDescription:
      "Find beginner-friendly Orange County surf zones with Quiver's guide to Bolsa Chica, Huntington Beach, Blackies, Doheny, tide windows, and nearby cams.",
    h1: "Beginner Surf Spots in Orange County",
    intro:
      "Orange County has plenty of surf, but beginner-friendly usually means choosing the softest corner, the right tide, and the cleanest morning window.",
    bestZones:
      "Bolsa Chica, small clean Huntington sandbars, and Blackies are the North OC checks when the surf is tiny and organized. Doheny and San Onofre stay useful softer-wave references farther south.",
    conditions:
      "For Huntington-style sandy beaches, look for 1-2 ft surf, light wind, 6-10am glass, and low-to-mid tide. Avoid tiny high-tide windows where the waves may not break cleanly.",
    boardCall:
      "A soft-top or stable longboard is the right starting point. Keep learners away from fast inside sections where boards and bodies get pushed into shallow water.",
    localNotes:
      "Any Huntington sandbar can be usable for learners on a small clean morning, but the pier peaks, Newland, Huntington St., and Cliffs are not blanket beginner calls. If the tide or wind is wrong, wait rather than forcing it.",
    namedBreaks: [
      "Bolsa Chica",
      "Blackies",
      "Huntington State Beach",
      "Doheny",
      "Old Man's",
    ],
    links: [
      { label: "Huntington beginner surf", href: "/beginner/huntington-beach" },
      { label: "Orange County surf cams", href: "/surf-cams/orange-county" },
      { label: "San Onofre beginner surf", href: "/beginner/san-onofre" },
      { label: "San Diego beginner surf", href: "/beginner/san-diego" },
      { label: "Los Angeles beginner surf", href: "/beginner/los-angeles" },
      { label: "Ventura beginner surf", href: "/beginner/ventura" },
    ],
    spots: [
      {
        label: "Bolsa Chica",
        href: "/ca/huntington-beach/bolsa-chica",
        beachSlug: "bolsa-chica",
      },
      {
        label: "Blackies",
        href: "/ca/newport-beach/blackies",
        beachSlug: "blackies",
      },
      {
        label: "Goldenwest / North HB Streets",
        href: "/ca/huntington-beach/goldenwest",
        beachSlug: "goldenwest",
      },
      {
        label: "Doheny Beach",
        href: "/ca/dana-point/doheny-beach",
        beachSlug: "doheny-beach",
      },
      { label: "San Onofre", href: "/beginner/san-onofre" },
      { label: "Orange County cams", href: "/surf-cams/orange-county" },
    ],
    images: [
      [
        "doheny-beginner-diorama",
        "Doheny beginner-friendly longboard scene",
        "Miniature Doheny beginner-friendly longboard scene",
        "Doheny learner glide",
      ],
      [
        "san-clemente-inside-diorama",
        "San Clemente mellow inside wave",
        "Quiver diorama of a mellow San Clemente inside wave",
        "San Clemente inside wave",
      ],
      [
        "oc-softtop-parking-diorama",
        "Beach parking and soft-top board setup",
        "Miniature Orange County beach parking scene with soft-top board setup",
        "Soft-top setup",
      ],
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "huntington-beach",
    locationName: "Huntington Beach",
    title: "Beginner Surf Spots in Huntington Beach | Quiver",
    metaDescription:
      "Plan beginner surfing in Huntington Beach with Quiver's guide to Bolsa Chica, small HB sandbars, Huntington State Beach, Blackies nearby, tide timing, and morning wind.",
    h1: "Beginner Surf Spots in Huntington Beach",
    intro:
      "Huntington can work for beginners, but the useful filter is practical: small waves, low wind, an early glass window, and low-to-mid tide.",
    bestZones:
      "Bolsa Chica is the easiest Huntington-first learner reference. Huntington State Beach and the broader HB sandbars can work on tiny clean mornings, while nearby Blackies in Newport is a strong longboard and learner alternate.",
    conditions:
      "The local beginner pattern is 1-2 ft surf, light wind, 6-10am, and low-to-mid tide. High tide on a tiny day can flatten the wave or create awkward shore wash instead of clean whitewater reps.",
    boardCall:
      "Use a foam board for first sessions and keep the goal simple: whitewater reps, clean paddles, and predictable takeoffs. A longboard makes sense only when the surfer can control it around other learners.",
    localNotes:
      "Do not treat the pier, Newland, Huntington St., or Cliffs as default beginner zones. On the right small morning, Goldenwest and other HB sandbars can be friendly; on the wrong tide or wind, the same beach can be frustrating fast.",
    namedBreaks: [
      "Bolsa Chica",
      "Huntington State Beach",
      "Goldenwest / North HB Streets",
      "Blackies",
    ],
    links: [
      { label: "Orange County beginner surf", href: "/beginner/orange-county" },
      { label: "Orange County surf cams", href: "/surf-cams/orange-county" },
      { label: "Open Huntington map", href: "/map?search=Huntington%20Beach" },
      { label: "Los Angeles beginner surf", href: "/beginner/los-angeles" },
      { label: "San Onofre beginner surf", href: "/beginner/san-onofre" },
    ],
    spots: [
      {
        label: "Bolsa Chica",
        href: "/ca/huntington-beach/bolsa-chica",
        beachSlug: "bolsa-chica",
      },
      {
        label: "Huntington State Beach",
        href: "/ca/huntington-beach/huntington-state-beach",
        beachSlug: "huntington-state-beach",
      },
      {
        label: "Goldenwest / North HB Streets",
        href: "/ca/huntington-beach/goldenwest",
        beachSlug: "goldenwest",
      },
      {
        label: "Blackies",
        href: "/ca/newport-beach/blackies",
        beachSlug: "blackies",
      },
    ],
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "huntington-beginner-open-wave-photo",
        "/images/seo-dioramas/surf-cams/orange-county/orange-county-open-wave-photo.webp",
        "Small clean North Orange County beachbreak for beginner surf planning",
        "Small clean North Orange County beachbreak context for beginner surf planning",
        "Small clean morning",
      ),
      makeExistingPhotoImage(
        "huntington-beginner-sunset-beach-photo",
        "/images/seo-dioramas/surf-cams/orange-county/orange-county-sunset-beach-photo.webp",
        "Huntington and Bolsa Chica sandy beachbreak context",
        "Huntington and Bolsa Chica sandy beachbreak context",
        "Huntington sandbar context",
      ),
      makeExistingPhotoImage(
        "huntington-beginner-aerial-shore-photo",
        "/images/seo-dioramas/surf-cams/orange-county/orange-county-aerial-shore-photo.webp",
        "North Orange County sandy beach and surf-access context",
        "North Orange County sandy beach and surf-access context",
        "Sandy beach access context",
      ),
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "los-angeles",
    locationName: "Los Angeles",
    title: "Beginner Surf Spots in Los Angeles | Quiver",
    metaDescription:
      "Plan beginner surfing in Los Angeles with Quiver's guide to Santa Monica, Will Rogers, Dockweiler, Venice, Torrance, small-wave windows, and unsafe-spot caveats.",
    h1: "Beginner Surf Spots in Los Angeles",
    intro:
      "Los Angeles beginner surf is less about chasing famous names and more about finding a small, clean, uncrowded sandbar with soft whitewater.",
    bestZones:
      "Santa Monica, Will Rogers, Dockweiler, Venice, Torrance/RAT Beach, and 72nd Place are the sandy beginner checks when the surf is small. El Porto, Zuma, and Leo Carrillo need stricter filtering because size, rocks, or beachbreak power can change the risk fast.",
    conditions:
      "Use the same conservative sandy-beach filter: 0.5-2 ft is best, light morning wind, low-to-mid tide, and no post-rain water-quality concern. If the inside is pitching or drifting, it is not a beginner window.",
    boardCall:
      "Start with a soft-top and keep the session in whitewater until the surfer can steer, stop, and avoid other learners. A longboard is only useful once board control is reliable.",
    localNotes:
      "Do not treat every Los Angeles beach row with beginner wording as a blanket learner call. El Porto, Zuma, and Leo Carrillo are small-day conditional checks, while faster or rocky zones should stay out of sandy beginner alerts.",
    namedBreaks: [
      "Santa Monica",
      "Will Rogers",
      "Dockweiler",
      "Venice",
      "Torrance/RAT Beach",
      "72nd Place",
    ],
    links: [
      { label: "Orange County beginner surf", href: "/beginner/orange-county" },
      { label: "San Diego beginner surf", href: "/beginner/san-diego" },
      { label: "Ventura beginner surf", href: "/beginner/ventura" },
      { label: "Santa Barbara beginner surf", href: "/beginner/santa-barbara" },
    ],
    spots: [
      {
        label: "Santa Monica Beach",
        href: "/ca/santa-monica/santa-monica-beach-santa-monica-ca",
        beachSlug: "santa-monica-beach-santa-monica-ca",
      },
      {
        label: "Will Rogers",
        href: "/ca/santa-monica/will-rogers-state-beach-santa-monica-ca",
        beachSlug: "will-rogers-state-beach-santa-monica-ca",
      },
      {
        label: "Dockweiler",
        href: "/ca/playa-del-rey/dockweiler-state-beach-playa-del-rey-ca",
        beachSlug: "dockweiler-state-beach-playa-del-rey-ca",
      },
      {
        label: "Venice Beach",
        href: "/ca/venice/venice-beach-venice-ca",
        beachSlug: "venice-beach-venice-ca",
      },
      {
        label: "Torrance/RAT Beach",
        href: "/ca/torrance/torrance-beach-rat-beach-torrance-ca",
        beachSlug: "torrance-beach-rat-beach-torrance-ca",
      },
      {
        label: "72nd Place",
        href: "/ca/long-beach/72nd-place-long-beach-ca",
        beachSlug: "72nd-place-long-beach-ca",
      },
    ],
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "los-angeles-beginner-open-wave-photo",
        "/images/seo-dioramas/surf-cams/orange-county/orange-county-open-wave-photo.webp",
        "Small clean Southern California beachbreak for Los Angeles beginner surf planning",
        "Small clean Southern California beachbreak context for Los Angeles beginner surf planning",
        "Small clean LA-style window",
      ),
      makeExistingPhotoImage(
        "los-angeles-beginner-aerial-shore-photo",
        "/images/seo-dioramas/surf-cams/orange-county/orange-county-aerial-shore-photo.webp",
        "Wide sandy Southern California beach for beginner surf logistics",
        "Wide sandy Southern California beach and access context",
        "Wide sandy learner zone",
      ),
      makeExistingPhotoImage(
        "los-angeles-beginner-sunset-beach-photo",
        "/images/seo-dioramas/surf-cams/orange-county/orange-county-sunset-beach-photo.webp",
        "Southern California sandy beachbreak context for beginner caveats",
        "Southern California sandy beachbreak and crowd-timing context",
        "Crowd and tide context",
      ),
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "ventura",
    locationName: "Ventura",
    title: "Beginner Surf Spots in Ventura | Quiver",
    metaDescription:
      "Use Quiver's Ventura beginner surf guide for Mondos, soft small-day windows, board calls, access caveats, and links toward Santa Barbara and Los Angeles.",
    h1: "Beginner Surf Spots in Ventura",
    intro:
      "Ventura beginner planning should start with soft, source-backed waves instead of assuming every point or beachbreak works for learners.",
    bestZones:
      "Mondos is the strongest beginner anchor because it is known for small, rolling waves and longboard-friendly lessons. Ventura Pier and C Street-style checks belong in the broader planning path, not the sandy beginner alert model.",
    conditions:
      "Small clean surf, light wind, and low-to-mid tide are the filter. Bigger west swell, rocks, tight crowds, or wind texture should push beginners out of the water.",
    boardCall:
      "Use a soft-top or stable longboard only when the surfer can control it around others. Keep early learners on the soft shoulder or whitewater and avoid the main rotation.",
    localNotes:
      "Mondos can look easy because it is soft, but parking, rocks, and crowd etiquette still matter. Solimar-style reef rows should not inherit beginner alert behavior from Mondos.",
    namedBreaks: ["Mondos", "Ventura Pier", "C Street context"],
    links: [
      { label: "Los Angeles beginner surf", href: "/beginner/los-angeles" },
      { label: "Santa Barbara beginner surf", href: "/beginner/santa-barbara" },
      { label: "Ventura longboard guide", href: "/longboard/ventura" },
      { label: "Orange County beginner surf", href: "/beginner/orange-county" },
    ],
    spots: [
      {
        label: "Mondos Beach",
        href: "/ca/ventura/mondos-beach-ventura-ca",
        beachSlug: "mondos-beach-ventura-ca",
      },
      { label: "Ventura longboard", href: "/longboard/ventura" },
      { label: "Ventura Pier search", href: "/map?search=Ventura%20Pier" },
      { label: "Santa Barbara beginner", href: "/beginner/santa-barbara" },
    ],
    images: [],
    existingImages: [
      makeExistingDioramaImage(
        "ventura-beginner-mondos-diorama",
        "/images/seo-dioramas/longboard/ventura/c-street-point-diorama.webp",
        "Ventura soft point-wave decision scene for Mondos-style beginner planning",
        "Ventura soft point-wave beginner planning scene",
        "Soft point-wave check",
      ),
      makeExistingDioramaImage(
        "ventura-beginner-pier-check-diorama",
        "/images/seo-dioramas/longboard/ventura/ventura-pier-check-diorama.webp",
        "Ventura Pier surf-check context for beginner backups and no-go calls",
        "Ventura Pier surf-check scene used for beginner backup planning",
        "Pier backup check",
      ),
      makeExistingDioramaImage(
        "ventura-beginner-log-wagon-diorama",
        "/images/seo-dioramas/longboard/ventura/ventura-log-wagon-diorama.webp",
        "Ventura longboard and soft-top setup for small beginner waves",
        "Ventura small-wave board setup scene",
        "Small-wave board setup",
      ),
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "santa-barbara",
    locationName: "Santa Barbara",
    title: "Beginner Surf Spots in Santa Barbara | Quiver",
    metaDescription:
      "Plan beginner surf around Santa Barbara with Quiver's guide to Refugio, Mondos nearby, small clean windows, and caveats for point and reef learners.",
    h1: "Beginner Surf Spots in Santa Barbara",
    intro:
      "Santa Barbara beginner surf works best when the call is specific: soft small waves, clear access, and no assumption that a famous point is safe today.",
    bestZones:
      "Refugio can be a conditional Santa Barbara-area beginner check when small and clean. Mondos, just down the coast toward Ventura, is the stronger source-backed soft learner anchor; Leadbetter-style longboard copy should stay separate from the sandy alert model unless conditions are clearly forgiving.",
    conditions:
      "Look for small clean surf, light wind, and low-to-mid tide. Strong west swell, reef/rock exposure, and crowded point-wave rotations should turn beginner promotion off.",
    boardCall:
      "Bring a soft-top or stable longboard only for small, soft waves with space. If the takeoff requires lineup judgment around rocks or a tight point crowd, it is not a beginner session.",
    localNotes:
      "This page connects Santa Barbara planning to Ventura and Los Angeles without claiming every local learner reference is a sandy beginner alert candidate. Refugio is conditional; Mondos is the safer beginner anchor when it is small.",
    namedBreaks: ["Refugio", "Mondos", "Leadbetter context"],
    links: [
      { label: "Ventura beginner surf", href: "/beginner/ventura" },
      { label: "Los Angeles beginner surf", href: "/beginner/los-angeles" },
      { label: "Santa Barbara longboard guide", href: "/longboard/santa-barbara" },
      { label: "Orange County beginner surf", href: "/beginner/orange-county" },
    ],
    spots: [
      {
        label: "Refugio State Beach",
        href: "/ca/goleta/refugio-state-beach-goleta-ca",
        beachSlug: "refugio-state-beach-goleta-ca",
      },
      {
        label: "Mondos Beach",
        href: "/ca/ventura/mondos-beach-ventura-ca",
        beachSlug: "mondos-beach-ventura-ca",
      },
      {
        label: "Leadbetter context",
        href: "/ca/santa-barbara/leadbetter",
        beachSlug: "leadbetter",
      },
      { label: "Santa Barbara map", href: "/map?search=Santa%20Barbara" },
    ],
    images: [],
    existingImages: [
      makeExistingDioramaImage(
        "santa-barbara-beginner-palm-check-diorama",
        "/images/seo-dioramas/longboard/santa-barbara/santa-barbara-palm-check-diorama.webp",
        "Santa Barbara small-wave surf-check scene for beginner planning",
        "Santa Barbara small-wave surf-check scene",
        "Palm-lined surf check",
      ),
      makeExistingDioramaImage(
        "santa-barbara-beginner-bluff-wax-up-diorama",
        "/images/seo-dioramas/longboard/santa-barbara/bluff-wax-up-diorama.webp",
        "Santa Barbara bluff and board setup for cautious beginner planning",
        "Santa Barbara bluff board setup scene for cautious beginner planning",
        "Bluff board setup",
      ),
      makeExistingDioramaImage(
        "santa-barbara-beginner-rincon-context-diorama",
        "/images/seo-dioramas/longboard/santa-barbara/rincon-right-diorama.webp",
        "Santa Barbara point-wave context used to explain beginner caveats",
        "Santa Barbara point-wave context for beginner caveats",
        "Point-wave caveat",
      ),
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "honolulu",
    locationName: "Honolulu",
    title: "Beginner Surf Spots in Honolulu | Quiver",
    metaDescription:
      "Plan beginner surf in Honolulu with Quiver's guide to Waikiki learner zones, warm-water board calls, Diamond Head context, and safety notes.",
    h1: "Beginner Surf Spots in Honolulu",
    intro:
      "Honolulu is one of the world's great places to learn, but beginner-friendly still means matching the zone, crowd, and reef depth to the day.",
    bestZones:
      "Waikiki learner zones are the obvious start. Diamond Head can be more exposed and should be treated as a different call when wind or size rises.",
    conditions:
      "Soft rolling surf, visible channels, and manageable trades are the main filters. Avoid bigger south shore pulses unless you are with a qualified instructor.",
    boardCall:
      "Start with a soft-top or stable longboard. Warm water makes repetition easier, but reef awareness and lineup control still matter.",
    localNotes:
      "Respect lesson zones and local etiquette. Crowds can be thick, so a smaller cleaner wave with space is often better than a famous wave with traffic.",
    namedBreaks: ["Waikiki", "Canoes", "Queens", "Diamond Head"],
    links: [
      { label: "Honolulu longboard guide", href: "/longboard/honolulu" },
      { label: "Hawaii surf cams", href: "/surf-cams/hawaii" },
      { label: "Open Quiver map", href: "/map?search=Honolulu" },
    ],
    spots: [
      {
        label: "Waikiki Beach",
        href: "/hi/honolulu/waikiki-beach",
        beachSlug: "waikiki-beach",
      },
      {
        label: "Waikiki Canoes",
        href: "/hi/honolulu/waikiki-canoes",
        beachSlug: "waikiki-canoes",
      },
      { label: "Hawaii cams", href: "/surf-cams/hawaii" },
    ],
    images: [
      [
        "waikiki-lesson-zone-diorama",
        "Waikiki beginner lesson zone",
        "Miniature Waikiki beginner lesson zone with soft-top boards",
        "Waikiki lesson zone",
      ],
      [
        "diamond-head-beginner-diorama",
        "Diamond Head tropical beginner scene",
        "Quiver diorama of a tropical beginner surf scene with Diamond Head",
        "Diamond Head learner view",
      ],
      [
        "warm-sand-softtops-diorama",
        "Soft-top board lineup on warm sand",
        "Miniature Honolulu soft-top board lineup on warm sand",
        "Warm sand soft-tops",
      ],
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "cocoa-beach",
    locationName: "Cocoa Beach",
    title: "Beginner Surf Spots in Cocoa Beach | Quiver",
    metaDescription:
      "Use Quiver's Cocoa Beach beginner surf guide for pier checks, small Florida beachbreaks, soft-top calls, wind risk, and nearby cams.",
    h1: "Beginner Surf Spots in Cocoa Beach",
    intro:
      "Cocoa Beach is a friendly Florida learner zone when the surf stays small, clean, and organized enough for repetition.",
    bestZones:
      "The pier area is the recognizable check, but beginner sessions should favor the least crowded small-wave bank with easy exits.",
    conditions:
      "Light wind and small easterly swell are ideal. Avoid heavy shorebreak, strong side-shore drift, lightning risk, and windy closeouts.",
    boardCall:
      "A soft-top is the best call for first sessions. A longboard can work for progressing beginners on cleaner small days with enough room.",
    localNotes:
      "Florida wind can change the plan quickly. Check the cam plus forecast before loading boards, especially when the window is early and short.",
    namedBreaks: [
      "Cocoa Beach Pier",
      "Cocoa Beach",
      "nearby small beachbreaks",
    ],
    links: [
      { label: "Florida surf cams", href: "/surf-cams/florida" },
      { label: "Florida longboard guide", href: "/longboard/fl" },
      { label: "Open Quiver map", href: "/map?search=Cocoa%20Beach" },
    ],
    spots: [
      {
        label: "Cocoa Beach Pier",
        href: "/fl/cocoa-beach/cocoa-beach-pier",
        beachSlug: "cocoa-beach-pier",
      },
      { label: "Florida cams", href: "/surf-cams/florida" },
      { label: "Florida longboard", href: "/longboard/fl" },
    ],
    images: [
      [
        "cocoa-pier-beginner-diorama",
        "Cocoa Beach pier beginner wave",
        "Miniature Cocoa Beach pier beginner wave diorama",
        "Pier learner wave",
      ],
      [
        "florida-surf-school-feel-diorama",
        "Small Florida beachbreak with surf school feel",
        "Quiver diorama of a small Florida beachbreak with surf school feel",
        "Small beachbreak lesson",
      ],
      [
        "sunrise-softtop-session-diorama",
        "Sunrise soft-top session",
        "Miniature Cocoa Beach sunrise soft-top session",
        "Sunrise soft-top session",
      ],
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "san-onofre",
    locationName: "San Onofre",
    title: "Beginner Surf Spots in San Onofre | Quiver",
    metaDescription:
      "Plan a beginner San Onofre surf day with Quiver's guide to Old Man's, gentle rolling waves, board calls, access notes, and nearby cams.",
    h1: "Beginner Surf Spots in San Onofre",
    intro:
      "San Onofre is a classic progression zone when the swell is friendly, the crowd is patient, and the walk down is part of the plan.",
    bestZones:
      "Old Man's and softer San Onofre corners are the draw. Choose gentle rolling waves over steeper peaks, especially for first-time or low-confidence surfers.",
    conditions:
      "Small-to-moderate swell, clean wind, and enough tide for forgiving takeoffs are the right filters. Bigger south swell can turn the same wave into a different challenge.",
    boardCall:
      "A soft-top or longboard is the default. A bigger board helps learners catch waves early, but only if they can manage it safely in the lineup.",
    localNotes:
      "Access and parking require patience. Bring a simple setup, watch the lineup before paddling out, and avoid crowding the main takeoff if you are still learning.",
    namedBreaks: ["Old Man's", "San Onofre State Beach", "Middles", "Trails"],
    links: [
      { label: "Orange County beginner surf", href: "/beginner/orange-county" },
      { label: "Orange County surf cams", href: "/surf-cams/orange-county" },
      { label: "Encinitas longboard guide", href: "/longboard/encinitas" },
      { label: "San Diego beginner surf", href: "/beginner/san-diego" },
      { label: "Los Angeles beginner surf", href: "/beginner/los-angeles" },
    ],
    spots: [
      {
        label: "San Onofre State Beach",
        href: "/ca/san-onofre/san-onofre-state-beach",
        beachSlug: "san-onofre-state-beach",
      },
      {
        label: "Middles",
        href: "/ca/san-onofre/middles",
        beachSlug: "middles",
      },
      { label: "Orange County cams", href: "/surf-cams/orange-county" },
    ],
    images: [
      [
        "old-mans-beginner-diorama",
        "Old Man's longboard and beginner scene",
        "Miniature Old Man's longboard and beginner surf scene",
        "Old Man's learner line",
      ],
      [
        "san-onofre-trail-carry-diorama",
        "San Onofre beach trail and board carry",
        "Quiver diorama of San Onofre beach trail and board carry",
        "Trail board carry",
      ],
      [
        "gentle-logs-softtops-diorama",
        "Gentle rolling wave with classic logs and soft tops",
        "Miniature gentle rolling wave with classic logs and soft-top boards",
        "Gentle rolling wave",
      ],
    ],
  }),
];

interface TodaySeed {
  slug: string;
  locationName: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  primarySpotSlug: string;
  fallbackSpotName: string;
  nearbySpotSlugs: string[];
  boardCall: string;
  wetsuitCall: string;
  tideRisk: string;
  windRisk: string;
  crowdParkingNote: string;
  sections: SeoPageSection[];
  links: SeoInternalLink[];
  spots: SeoSpotLink[];
  images: SeoImageSeedEntry[];
}

function buildTodayPage(seed: TodaySeed): SeoPageConfig {
  const images = makeImages("surf-report-today", seed.slug, seed.images);

  return {
    type: "surf-report-today",
    slug: seed.slug,
    path: pagePath("surf-report-today", seed.slug),
    title: seed.title,
    metaDescription: seed.metaDescription,
    h1: seed.h1,
    eyebrow: "Should you surf today?",
    intro: seed.intro,
    locationName: seed.locationName,
    heroImage: images[0],
    images,
    sections: seed.sections,
    faqs: [
      {
        question: `Should you surf ${seed.locationName} today?`,
        answer: `Use Quiver's live verdict, best window, wind, tide, and backup spot notes for ${seed.locationName}. If live conditions are unavailable, check the app again before you drive.`,
      },
      {
        question: `What board should I bring to ${seed.locationName} today?`,
        answer: seed.boardCall,
      },
      {
        question: `What are the main risks at ${seed.locationName}?`,
        answer: `${seed.tideRisk} ${seed.windRisk}`,
      },
      {
        question: `What are good backup spots near ${seed.locationName}?`,
        answer: `Start with ${seed.spots.map((spot) => spot.label).join(", ")} and compare live conditions before changing plans.`,
      },
    ],
    internalLinks: seed.links,
    nearbySpots: withSpotImages(seed.spots),
    primaryCta: {
      label: "Check again before you drive",
      href: "/auth/sign-up",
    },
    secondaryCta: MAP_CTA,
    relatedSpotIds: [seed.primarySpotSlug, ...seed.nearbySpotSlugs],
    decision: {
      primarySpotSlug: seed.primarySpotSlug,
      fallbackSpotName: seed.fallbackSpotName,
      nearbySpotSlugs: seed.nearbySpotSlugs,
      boardCall: seed.boardCall,
      wetsuitCall: seed.wetsuitCall,
      tideRisk: seed.tideRisk,
      windRisk: seed.windRisk,
      crowdParkingNote: seed.crowdParkingNote,
    },
    indexable: true,
  };
}

const TODAY_PAGES = [
  buildTodayPage({
    slug: "scripps-pier-today",
    locationName: "Scripps Pier",
    title: "Scripps Pier Surf Report Today | Should You Surf?",
    metaDescription:
      "Wondering if Scripps Pier is worth paddling out today? See Quiver's live surf verdict, best window, tide risk, board call, wetsuit guidance, and backups.",
    h1: "Should You Surf Scripps Pier Today?",
    intro:
      "Scripps can be tempting from the parking lot, but tide, wind, and beachbreak shape decide whether it is worth paddling out.",
    primarySpotSlug: "scripps",
    fallbackSpotName: "Scripps Pier",
    nearbySpotSlugs: [
      "la-jolla-shores",
      "tourmaline-surf-park",
      "blacks-beach",
    ],
    boardCall:
      "Start with a fish or shortboard if Scripps has clean push. Bring a log only when the surf is small, soft, and not closing out.",
    wetsuitCall:
      "San Diego usually means a fullsuit outside the warmest stretch. Check Quiver's current water-temperature context before you leave.",
    tideRisk:
      "The beach shape can get touchy around steeper tide swings, especially near the pier pilings and inside bars.",
    windRisk:
      "Morning glass is the best bet; west or southwest texture can make the peak harder to read.",
    crowdParkingNote:
      "Parking fills around campus and beach access points. If Scripps is packed, compare Shores and Tourmaline before committing.",
    sections: [
      {
        heading: "How to read Scripps today",
        body: "Use the verdict as a first filter, then look at whether the best window lines up with your drive. Scripps changes quickly with tide and wind, so a stale read is not enough.",
      },
      {
        heading: "When Scripps is worth it",
        body: "Clean waist-to-shoulder-high surf with light wind is the sweet spot. If the report shows short windows or low confidence, treat it as a quick-check wave, not a guaranteed session.",
      },
      {
        heading: "Backup plan",
        body: "La Jolla Shores is the softer option, Tourmaline is the longboard fallback, and Blacks is only a fit when your skill level and conditions make sense.",
      },
    ],
    links: [
      { label: "San Diego surf cams", href: "/surf-cams/san-diego" },
      { label: "Beginner surf in San Diego", href: "/beginner/san-diego" },
      { label: "Tourmaline today", href: "/surf-report/tourmaline-today" },
    ],
    spots: [
      {
        label: "La Jolla Shores",
        href: "/ca/la-jolla/la-jolla-shores",
        beachSlug: "la-jolla-shores",
      },
      {
        label: "Tourmaline",
        href: "/surf-report/tourmaline-today",
        beachSlug: "tourmaline-surf-park",
      },
      {
        label: "Blacks Beach",
        href: "/ca/la-jolla/blacks-beach",
        beachSlug: "blacks-beach",
      },
    ],
    images: [
      [
        "scripps-pier-surf-check-diorama",
        "Scripps Pier miniature surf-check diorama",
        "Miniature Scripps Pier surf-check diorama with pier pilings and surfers",
        "Pier surf check",
      ],
      [
        "scripps-board-choice-diorama",
        "Board choice scene with shortboard, fish, and log",
        "Quiver diorama showing shortboard, fish, and log board choice near Scripps",
        "Board choice table",
      ],
      [
        "scripps-clean-set-photo",
        "Clean San Diego wave photo for Scripps surf report context",
        "Clean San Diego wave with surfers used for Scripps surf report context",
        "Clean San Diego wave",
        "photo",
      ],
    ],
  }),
  buildTodayPage({
    slug: "belmar-today",
    locationName: "Belmar",
    title: "Belmar Surf Report Today | Should You Surf?",
    metaDescription:
      "Check if Belmar is worth surfing today with Quiver's live verdict, best window, board call, cold-water wetsuit guidance, wind risk, and backup spots.",
    h1: "Should You Surf Belmar Today?",
    intro:
      "Belmar can switch from fun beachbreak to drift-heavy work fast. The right call starts with wind, tide, and whether the best window is still open.",
    primarySpotSlug: "belmar-belmar-nj",
    fallbackSpotName: "Belmar",
    nearbySpotSlugs: [
      "3rd-avenue-jetty-belmar-nj",
      "8th-avenue-jetty-belmar-nj",
      "belmar-fishing-pier-belmar-nj",
    ],
    boardCall:
      "Use a shortboard or fish when Belmar has clean punch. A longboard only makes sense on smaller, softer days with room between peaks.",
    wetsuitCall:
      "Treat Belmar as cold-water planning outside summer. Hood, boots, and gloves may matter in winter and early spring.",
    tideRisk:
      "Belmar beachbreak can get dumpy or sectiony depending on sandbar and tide. Watch for fast inside closeouts.",
    windRisk:
      "Offshore or light wind is the difference between a clean Jersey window and a drift session.",
    crowdParkingNote:
      "Boardwalk access helps, but summer parking and beach traffic can change the plan. Have a north/south backup ready.",
    sections: [
      {
        heading: "How to read Belmar today",
        body: "Do not treat a generic wave-height number as the call. Belmar needs tide, wind, sandbar, and drift context before it is worth loading the car.",
      },
      {
        heading: "When Belmar is worth it",
        body: "Clean, organized shoulder-high or smaller surf with manageable current is the best setup. Bigger can still work, but it becomes less forgiving quickly.",
      },
      {
        heading: "Backup plan",
        body: "Compare the jetties and nearby Jersey beachbreaks. A small move can change wind angle, crowd, and drift enough to save a session.",
      },
    ],
    links: [
      { label: "Open Quiver map", href: "/map?search=Belmar" },
      { label: "Beginner surf in San Diego", href: "/beginner/san-diego" },
      { label: "San Diego cams", href: "/surf-cams/san-diego" },
    ],
    spots: [
      {
        label: "3rd Avenue Jetty",
        href: "/nj/belmar/3rd-avenue-jetty-belmar-nj",
        beachSlug: "3rd-avenue-jetty-belmar-nj",
      },
      {
        label: "8th Avenue Jetty",
        href: "/nj/belmar/8th-avenue-jetty-belmar-nj",
        beachSlug: "8th-avenue-jetty-belmar-nj",
      },
      {
        label: "Belmar Fishing Pier",
        href: "/nj/belmar/belmar-fishing-pier-belmar-nj",
        beachSlug: "belmar-fishing-pier-belmar-nj",
      },
    ],
    images: [
      [
        "belmar-beachbreak-check-diorama",
        "Belmar beachbreak surf-check diorama",
        "Miniature Belmar beachbreak surf-check diorama",
        "Belmar beachbreak check",
      ],
      [
        "jersey-boardwalk-forecast-diorama",
        "Jersey shore boardwalk surf forecast scene",
        "Quiver diorama of a Jersey shore boardwalk surf forecast scene",
        "Boardwalk forecast read",
      ],
      [
        "cold-water-wetsuit-call-diorama",
        "Cold-water wetsuit and board call scene",
        "Miniature cold-water wetsuit and board call scene for Belmar",
        "Cold-water board call",
      ],
    ],
  }),
  buildTodayPage({
    slug: "tourmaline-today",
    locationName: "Tourmaline",
    title: "Tourmaline Surf Report Today | Should You Surf?",
    metaDescription:
      "See if Tourmaline is worth surfing today with Quiver's live verdict, best longboard window, board call, tide and wind risk, parking note, and backups.",
    h1: "Should You Surf Tourmaline Today?",
    intro:
      "Tourmaline is often the softer call, but the crowd, tide, and wind still decide whether it is a glide session or a frustrating paddle.",
    primarySpotSlug: "tourmaline-surf-park",
    fallbackSpotName: "Tourmaline",
    nearbySpotSlugs: ["tourmaline", "la-jolla-shores", "scripps"],
    boardCall:
      "Start with a log when the surf is small and soft. A mid-length is the right compromise when wind texture or crowd spacing makes the lineup harder to navigate.",
    wetsuitCall:
      "San Diego water often calls for a fullsuit outside late summer. Check current Quiver water-temperature context before dawn patrol.",
    tideRisk:
      "Too much tide can soften the wave; too little can crowd the best takeoff lanes.",
    windRisk:
      "Tourmaline is best before the onshore texture arrives. If wind is already up, compare nearby cams before you drive.",
    crowdParkingNote:
      "The lot is part of the forecast. If parking is already stacked, have a Shores or Scripps backup ready.",
    sections: [
      {
        heading: "How to read Tourmaline today",
        body: "The best Tourmaline call balances wave shape and crowd. A smaller clean window can be better than a bigger day with too much traffic.",
      },
      {
        heading: "When Tourmaline is worth it",
        body: "Soft waist-to-shoulder-high runners, light wind, and enough tide for trim are the classic ingredients.",
      },
      {
        heading: "Backup plan",
        body: "Check La Jolla Shores when Tourmaline is too crowded, and Scripps when you want more beachbreak energy.",
      },
    ],
    links: [
      { label: "La Jolla longboard guide", href: "/longboard/la-jolla" },
      { label: "San Diego surf cams", href: "/surf-cams/san-diego" },
      { label: "Scripps Pier today", href: "/surf-report/scripps-pier-today" },
    ],
    spots: [
      {
        label: "La Jolla Shores",
        href: "/ca/la-jolla/la-jolla-shores",
        beachSlug: "la-jolla-shores",
      },
      {
        label: "Scripps Pier",
        href: "/surf-report/scripps-pier-today",
        beachSlug: "scripps",
      },
      { label: "San Diego cams", href: "/surf-cams/san-diego" },
    ],
    images: [
      [
        "tourmaline-parking-check-diorama",
        "Tourmaline parking lot morning check",
        "Miniature Tourmaline parking lot morning surf-check diorama",
        "Parking lot check",
      ],
      [
        "tourmaline-longboard-lineup-diorama",
        "Mellow longboard lineup with tiny surfers",
        "Miniature mellow Tourmaline longboard lineup with tiny surfers",
        "Mellow lineup",
      ],
      [
        "tourmaline-wind-tide-decision-diorama",
        "Wind and tide decision diorama",
        "Quiver diorama of wind and tide decision-making at Tourmaline",
        "Wind and tide call",
      ],
    ],
  }),
  buildTodayPage({
    slug: "malibu-today",
    locationName: "Malibu",
    title: "Malibu Surf Report Today | Should You Surf?",
    metaDescription:
      "Check if Malibu is worth surfing today with Quiver's live verdict, best point-wave window, board call, tide risk, crowd note, and nearby backups.",
    h1: "Should You Surf Malibu Today?",
    intro:
      "Malibu can be magic or mayhem. The decision is not just wave height; it is tide, wind, crowd, and whether the point has room to breathe.",
    primarySpotSlug: "malibu-first-point-surfrider",
    fallbackSpotName: "Malibu",
    nearbySpotSlugs: [
      "malibu-surfrider-first-point-malibu-ca",
      "malibu-second-point-malibu-ca",
      "malibu-third-point-malibu-ca",
    ],
    boardCall:
      "Bring a log for classic smaller Malibu runners. A mid-length is useful when the wave has more speed or the crowd makes positioning tight.",
    wetsuitCall:
      "Malibu usually needs Southern California wetsuit planning outside the warmest months. Check the current water read before you leave.",
    tideRisk:
      "Point shape changes with tide; too high can soften sections and too low can expose less forgiving inside water.",
    windRisk:
      "Light morning wind is the cleanest window. Afternoon texture can turn a long point wave into a bumpy traffic jam.",
    crowdParkingNote:
      "Crowd awareness is the main Malibu risk. If the lineup is packed, a backup spot may be the better surf decision.",
    sections: [
      {
        heading: "How to read Malibu today",
        body: "The live verdict tells you whether the window is worth considering, but Malibu also requires a crowd read. A good forecast with no space can still be a bad session.",
      },
      {
        heading: "When Malibu is worth it",
        body: "Clean, organized south or west energy with a tide that keeps the point connected is the classic setup.",
      },
      {
        heading: "Backup plan",
        body: "Compare nearby point and beachbreak options before committing to the drive. If the crowd is the problem, not the surf, moving early matters.",
      },
    ],
    links: [
      { label: "Ventura longboard guide", href: "/longboard/ventura" },
      {
        label: "Santa Barbara longboard guide",
        href: "/longboard/santa-barbara",
      },
      { label: "Open Quiver map", href: "/map?search=Malibu" },
    ],
    spots: [
      {
        label: "Malibu First Point",
        href: "/ca/malibu/malibu-first-point-surfrider",
        beachSlug: "malibu-first-point-surfrider",
      },
      { label: "Second Point", href: "/map?search=Malibu%20Second%20Point" },
      { label: "Ventura longboard", href: "/longboard/ventura" },
    ],
    images: [
      [
        "malibu-point-wave-diorama",
        "Malibu point wave diorama",
        "Miniature Malibu point-wave diorama with tiny longboarders",
        "Malibu point wave",
      ],
      [
        "malibu-crowd-awareness-diorama",
        "Longboard lineup and crowd-awareness scene",
        "Quiver diorama of a Malibu longboard lineup with crowd-awareness cues",
        "Crowd-awareness read",
      ],
      [
        "malibu-coastal-drive-check-diorama",
        "Coastal drive surf-check scene",
        "Miniature Malibu coastal drive surf-check scene",
        "Coastal drive check",
      ],
    ],
  }),
];

interface CamSeed {
  slug: string;
  locationName: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  camRegion: SeoCamRegionConfig;
  sections: SeoPageSection[];
  links: SeoInternalLink[];
  spots: SeoSpotLink[];
  images: SeoImageSeedEntry[];
}

function buildCamPage(seed: CamSeed): SeoPageConfig {
  const images = makePhotoImages("surf-cams", seed.slug, seed.images);

  return {
    type: "surf-cams",
    slug: seed.slug,
    path: pagePath("surf-cams", seed.slug),
    title: seed.title,
    metaDescription: seed.metaDescription,
    h1: seed.h1,
    eyebrow: "Surf cams plus forecast",
    intro: seed.intro,
    locationName: seed.locationName,
    heroImage: images[0],
    images,
    sections: seed.sections,
    faqs: [
      {
        question: `Are ${seed.locationName} surf cams enough to choose a spot?`,
        answer:
          "Cams are useful for seeing shape, crowd, and texture, but they do not replace tide, wind, swell direction, or forecast confidence. Use cams and Quiver together.",
      },
      {
        question: `What should I look for on ${seed.locationName} surf cams?`,
        answer:
          "Watch wave shape, closeouts, drift, crowd spacing, and whether the best sets match the forecast. One good-looking set is not enough by itself.",
      },
      {
        question: `How does Quiver combine cams and forecasts?`,
        answer:
          "Quiver links real camera coverage with live forecast context so you can compare what the ocean looks like with what the data says should happen next.",
      },
      {
        question: `Why is there no Santa Cruz surf cam page here?`,
        answer:
          "This SEO cam system only indexes regions where Quiver has real cam coverage. Santa Cruz should stay out of the sitemap until real camera rows exist.",
      },
    ],
    internalLinks: seed.links,
    nearbySpots: withSpotImages(seed.spots),
    primaryCta: APP_CTA,
    secondaryCta: MAP_CTA,
    camRegion: seed.camRegion,
    indexable: true,
  };
}

const CAM_PAGES = [
  buildCamPage({
    slug: "san-diego",
    locationName: "San Diego",
    title: "San Diego Surf Cams | Quiver",
    metaDescription:
      "Watch San Diego surf cams with Quiver forecast context for Scripps, Tourmaline, Pacific Beach, La Jolla, Ocean Beach, and nearby spots.",
    h1: "San Diego Surf Cams",
    intro:
      "Use San Diego cams to verify shape and crowd, then use Quiver to decide whether the tide and wind window is still worth the drive.",
    camRegion: {
      states: ["CA"],
      cities: [
        "San Diego",
        "La Jolla",
        "Del Mar",
        "Encinitas",
        "Carlsbad",
        "Oceanside",
        "Imperial Beach",
        "Coronado",
      ],
    },
    sections: [
      {
        heading: "What to watch on San Diego cams",
        body: "Check whether Scripps and PB are closing out, whether Tourmaline is soft enough for logs, and whether the wind line is already moving down the coast.",
      },
      {
        heading: "Cam plus forecast",
        body: "A cam tells you what one angle looks like now. Quiver adds tide, wind, swell, and best-window context so you can decide before you park.",
      },
      {
        heading: "Nearby planning links",
        body: "Pair cams with today's Scripps or Tourmaline call, then keep beginner and longboard alternatives ready.",
      },
    ],
    links: [
      { label: "Scripps Pier today", href: "/surf-report/scripps-pier-today" },
      { label: "Tourmaline today", href: "/surf-report/tourmaline-today" },
      { label: "Beginner surf in San Diego", href: "/beginner/san-diego" },
    ],
    spots: [
      {
        label: "Scripps Pier",
        href: "/ca/la-jolla/scripps",
        beachSlug: "scripps",
      },
      {
        label: "Tourmaline",
        href: "/ca/san-diego/tourmaline-surf-park",
        beachSlug: "tourmaline-surf-park",
      },
      { label: "La Jolla longboard", href: "/longboard/la-jolla" },
    ],
    images: [
      [
        "san-diego-la-jolla-shores-photo",
        "La Jolla Shores beach photo for San Diego cam planning",
        "La Jolla Shores beach with boards and soft surf",
        "La Jolla Shores",
      ],
      [
        "san-diego-tourmaline-break-photo",
        "Tourmaline surf photo for checking mellow San Diego waves",
        "Tourmaline shoreline with longboard-friendly surf",
        "Tourmaline shoreline",
      ],
      [
        "san-diego-ocean-beach-line-photo",
        "Ocean Beach wave photo for San Diego cam context",
        "Ocean Beach wave line with surfers used for San Diego cam planning",
        "Ocean Beach wave line",
      ],
    ],
  }),
  buildCamPage({
    slug: "orange-county",
    locationName: "Orange County",
    title: "Orange County Surf Cams | Quiver",
    metaDescription:
      "Watch Orange County surf cams with Quiver forecast context for Doheny, San Clemente, Salt Creek, San Onofre, and nearby beginner zones.",
    h1: "Orange County Surf Cams",
    intro:
      "Use Orange County cams to separate a clean beginner window from a famous spot that is too crowded, too steep, or already blown out.",
    camRegion: {
      states: ["CA"],
      cities: [
        "Huntington Beach",
        "Newport Beach",
        "Laguna Beach",
        "Dana Point",
        "San Clemente",
        "San Onofre",
        "Seal Beach",
      ],
    },
    sections: [
      {
        heading: "What to watch on Orange County cams",
        body: "Look for shorebreak, drift, crowd density, and whether the inside waves at Doheny or San Onofre are actually beginner-friendly today.",
      },
      {
        heading: "Cam plus forecast",
        body: "The camera shows one angle. Quiver adds tide and wind timing so you know whether the window is improving or already fading.",
      },
      {
        heading: "Nearby planning links",
        body: "Pair the cams with beginner and longboard guides before choosing a board or driving between beaches.",
      },
    ],
    links: [
      {
        label: "Beginner surf in Orange County",
        href: "/beginner/orange-county",
      },
      { label: "San Onofre beginner surf", href: "/beginner/san-onofre" },
      { label: "Encinitas longboard guide", href: "/longboard/encinitas" },
    ],
    spots: [
      {
        label: "Doheny Beach",
        href: "/ca/dana-point/doheny-beach",
        beachSlug: "doheny-beach",
      },
      {
        label: "San Onofre State Beach",
        href: "/ca/san-onofre/san-onofre-state-beach",
        beachSlug: "san-onofre-state-beach",
      },
      { label: "Open OC map", href: "/map?search=Orange%20County" },
    ],
    images: [
      [
        "orange-county-open-wave-photo",
        "Open Southern California wave photo for Orange County cam context",
        "Clean blue wave used as broad Orange County cam context",
        "Open wave check",
      ],
      [
        "orange-county-sunset-beach-photo",
        "Southern California beach sunset photo for Orange County planning",
        "Golden beach sunset used for Orange County surf-cam planning",
        "Sunset beach read",
      ],
      [
        "orange-county-aerial-shore-photo",
        "Aerial shoreline photo for Orange County camera planning",
        "Aerial shoreline and beachbreak sandbars from the coast",
        "Aerial shoreline",
      ],
    ],
  }),
  buildCamPage({
    slug: "hawaii",
    locationName: "Hawaii",
    title: "Hawaii Surf Cams | Quiver",
    metaDescription:
      "Watch Hawaii surf cams with Quiver forecast context for Waikiki, North Shore, Hanalei, Waimea, Pipeline, Canoes, and nearby spots.",
    h1: "Hawaii Surf Cams",
    intro:
      "Hawaii cams help you see the real ocean energy, but the decision still needs wind, tide, swell direction, and skill-level honesty.",
    camRegion: {
      states: ["HI"],
      regionSlugs: ["hawaii"],
    },
    sections: [
      {
        heading: "What to watch on Hawaii cams",
        body: "Look for set spacing, reef exposure, channel traffic, and whether the lineup matches your ability. Warm water does not make heavy surf forgiving.",
      },
      {
        heading: "Cam plus forecast",
        body: "Use cams to verify the visual read, then use Quiver's forecast context to decide whether the next window is improving or getting less safe.",
      },
      {
        heading: "Nearby planning links",
        body: "For Waikiki-style waves, pair cams with Honolulu beginner and longboard guides. For heavier surf, make the safety filter the first decision.",
      },
    ],
    links: [
      { label: "Honolulu beginner surf", href: "/beginner/honolulu" },
      { label: "Honolulu longboard guide", href: "/longboard/honolulu" },
      { label: "Open Quiver map", href: "/map?search=Hawaii" },
    ],
    spots: [
      {
        label: "Waikiki Beach",
        href: "/hi/honolulu/waikiki-beach",
        beachSlug: "waikiki-beach",
      },
      {
        label: "Waikiki Canoes",
        href: "/hi/honolulu/waikiki-canoes",
        beachSlug: "waikiki-canoes",
      },
      { label: "Hawaii map", href: "/map?search=Hawaii" },
    ],
    images: [
      [
        "hawaii-surf-check-photo",
        "Surfer checking waves photo for Hawaii surf-cam planning",
        "Surfer watching the lineup used as broad Hawaii camera planning context",
        "Surf-check moment",
      ],
      [
        "hawaii-aerial-swell-photo",
        "Aerial swell photo for Hawaii camera context",
        "Aerial view of swell lines moving toward a broad coastline",
        "Aerial swell view",
      ],
      [
        "hawaii-misty-lineup-photo",
        "Misty lineup photo for Hawaii surf-cam context",
        "Misty surf lineup used for Hawaii camera planning context",
        "Misty lineup",
      ],
    ],
  }),
  buildCamPage({
    slug: "florida",
    locationName: "Florida",
    title: "Florida Surf Cams | Quiver",
    metaDescription:
      "Watch Florida surf cams with Quiver forecast context for Cocoa Beach, New Smyrna, Ponce Inlet, Jacksonville, Satellite Beach, and nearby spots.",
    h1: "Florida Surf Cams",
    intro:
      "Florida surf cams are essential because wind and tide can change the whole session. Use the cam for proof and Quiver for the window.",
    camRegion: {
      states: ["FL"],
      regionSlugs: ["florida"],
    },
    sections: [
      {
        heading: "What to watch on Florida cams",
        body: "Look for wind texture, drift, closeouts, and whether the sets are organized enough for your board choice.",
      },
      {
        heading: "Cam plus forecast",
        body: "A Florida cam can look fun for a few minutes, then go flat or bumpy. Quiver adds best-window timing so you can decide before the window closes.",
      },
      {
        heading: "Nearby planning links",
        body: "Pair cams with Cocoa Beach beginner guidance and Florida longboard planning when the surf is small and clean.",
      },
    ],
    links: [
      { label: "Cocoa Beach beginner surf", href: "/beginner/cocoa-beach" },
      { label: "Florida longboard guide", href: "/longboard/fl" },
      { label: "Open Quiver map", href: "/map?search=Florida" },
    ],
    spots: [
      {
        label: "Cocoa Beach Pier",
        href: "/fl/cocoa-beach/cocoa-beach-pier",
        beachSlug: "cocoa-beach-pier",
      },
      { label: "Florida longboard", href: "/longboard/fl" },
      { label: "Open Florida map", href: "/map?search=Florida" },
    ],
    images: [
      [
        "florida-dawn-beachbreak-photo",
        "Dawn beachbreak photo for Florida cam planning",
        "Dawn shoreline with small surf used for Florida camera context",
        "Dawn beachbreak",
      ],
      [
        "florida-choppy-sea-photo",
        "Wind-textured ocean photo for Florida surf checks",
        "Choppy ocean texture used for Florida wind and cam context",
        "Wind texture",
      ],
      [
        "florida-sunset-shore-photo",
        "Beach sunset photo for Florida cam fallback context",
        "Warm beach sunset used as broad Florida cam planning context",
        "Sunset shoreline",
      ],
    ],
  }),
];

export const SEO_FUNNEL_PAGES: SeoPageConfig[] = [
  ...LONGBOARD_PAGES,
  ...BEGINNER_PAGES,
  ...TODAY_PAGES,
  ...CAM_PAGES,
];

export const INDEXABLE_SEO_FUNNEL_PAGES: SeoPageConfig[] =
  SEO_FUNNEL_PAGES.filter((page) => page.indexable);

export function getSeoFunnelPageByPath(path: string): SeoPageConfig | null {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return SEO_FUNNEL_PAGES.find((page) => page.path === normalized) ?? null;
}

export function getSeoFunnelPageByTypeAndSlug(
  type: SeoPageType,
  slug: string,
): SeoPageConfig | null {
  return (
    SEO_FUNNEL_PAGES.find((page) => page.type === type && page.slug === slug) ??
    null
  );
}

export function getSeoFunnelPageByIntentRoute(
  intent: string,
  slug: string,
): SeoPageConfig | null {
  if (intent !== "beginner" && intent !== "longboard") return null;
  return getSeoFunnelPageByTypeAndSlug(intent, slug);
}

export function getIndexableSeoFunnelRoutes(): string[] {
  return INDEXABLE_SEO_FUNNEL_PAGES.map((page) => page.path);
}

export function getSeoFunnelImagePrompts(): Array<{
  path: string;
  image: SeoImage;
}> {
  return SEO_FUNNEL_PAGES.flatMap((page) =>
    page.images.map((image) => ({ path: page.path, image })),
  );
}

export function filterSeoCamBeaches<
  T extends {
    state: string;
    city: string;
    regionSlug?: string;
  },
>(page: SeoPageConfig, beaches: T[]): T[] {
  if (page.type !== "surf-cams" || !page.camRegion) return [];

  const stateSet = new Set(
    page.camRegion.states?.map((state) => state.toUpperCase()) ?? [],
  );
  const citySet = new Set(
    page.camRegion.cities?.map((city) => city.toLowerCase()) ?? [],
  );
  const regionSet = new Set(
    page.camRegion.regionSlugs?.map((region) => region.toLowerCase()) ?? [],
  );

  return beaches.filter((beach) => {
    if (stateSet.size > 0 && stateSet.has(beach.state.toUpperCase())) {
      if (citySet.size === 0) return true;
      return citySet.has(beach.city.toLowerCase());
    }

    if (regionSet.size > 0 && beach.regionSlug) {
      return regionSet.has(beach.regionSlug.toLowerCase());
    }

    return false;
  });
}
