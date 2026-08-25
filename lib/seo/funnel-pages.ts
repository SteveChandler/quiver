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
    src: "/images/seo-dioramas/beginner/socal/blackies-photo.webp",
    alt: "Newport Beach surf near Blackies",
  },
  "newport-56th-st": {
    src: "/images/seo-dioramas/beginner/socal/huntington-state-beach-photo.webp",
    alt: "North Orange County sandy beachbreak context near Newport 56th Street",
  },
  "bolsa-chica": {
    src: "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
    alt: "Bolsa Chica State Beach sandy shoreline and beginner surf context",
  },
  goldenwest: {
    src: "/images/seo-dioramas/beginner/socal/huntington-state-beach-photo.webp",
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
  "ditch-plains-montauk-ny": {
    src: "/images/seo-dioramas/beginner/long-island/ditch-plains-montauk-ny-photo.webp",
    alt: "Ditch Plains shoreline and Montauk surf context",
  },
  "doheny-beach": {
    src: "/images/seo-dioramas/beginner/socal/doheny-beach-photo.webp",
    alt: "Doheny State Beach shoreline and soft learner surf context",
  },
  "dockweiler-state-beach-playa-del-rey-ca": {
    src: "/images/seo-dioramas/beginner/socal/dockweiler-state-beach-playa-del-rey-ca-photo.webp",
    alt: "Dockweiler State Beach shoreline for Los Angeles beginner surf planning",
  },
  domes: {
    src: "/images/seo-scenes/rincon-domes.webp",
    alt: "Domes surf context in Rincon Puerto Rico",
  },
  "72nd-place-long-beach-ca": {
    src: "/images/seo-dioramas/beginner/socal/huntington-state-beach-photo.webp",
    alt: "North Orange County sandy beachbreak context near 72nd Place",
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
    src: "/images/seo-dioramas/beginner/socal/la-jolla-shores-photo.webp",
    alt: "La Jolla Shores beach and learner surf context",
  },
  "long-beach-long-beach-ny": {
    src: "/images/seo-dioramas/beginner/long-island/long-beach-long-beach-ny-photo.webp",
    alt: "Long Beach, New York shoreline and barrier-island surf context",
  },
  "robert-moses-state-park-babylon-ny": {
    src: "/images/seo-dioramas/beginner/long-island/robert-moses-state-park-ny-photo.webp",
    alt: "Robert Moses State Park shoreline and open South Shore surf context",
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
    src: "/images/seo-dioramas/beginner/socal/huntington-state-beach-photo.webp",
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
    src: "/images/seo-dioramas/beginner/socal/san-onofre-state-beach-photo.webp",
    alt: "San Onofre State Beach sunset and gentle-wave planning context",
  },
  "rockaway-beach-90th-st-queens-ny": {
    src: "/images/seo-dioramas/beginner/long-island/gilgo-beach-ny-photo.webp",
    alt: "Bright South Shore shoreline context for Rockaway small-day planning",
  },
  "rockaway-beach-98th-st-queens-ny": {
    src: "/images/seo-dioramas/beginner/long-island/rockaway-beach-90th-st-queens-ny-photo.webp",
    alt: "Rockaway Beach shoreline and New York surf context",
  },
  "smith-point-county-park-shirley-ny": {
    src: "/images/seo-dioramas/beginner/long-island/smith-point-county-park-shirley-ny-photo.webp",
    alt: "Smith Point County Park shoreline and open South Shore surf context",
  },
  scripps: {
    src: "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
    alt: "Scripps Pier surf lineup",
  },
  windansea: {
    // Real Windansea photo, already approved for the /longboard/la-jolla spot card.
    // The Windansea diorama is on the rejected-asset list in docs/seo/SEO_AGENT_WORKFLOW.md.
    src: "/images/hero/hero-3-windansea.webp",
    alt: "Windansea reef and shoreline surf context in La Jolla",
  },
  "santa-monica-beach-santa-monica-ca": {
    src: "/images/seo-dioramas/beginner/socal/santa-monica-beach-santa-monica-ca-photo.webp",
    alt: "Santa Monica State Beach shoreline for Los Angeles beginner surf planning",
  },
  "refugio-state-beach-goleta-ca": {
    src: "/images/seo-dioramas/beginner/socal/refugio-state-beach-goleta-ca-photo.webp",
    alt: "Refugio State Beach shoreline for Santa Barbara beginner surf planning",
  },
  "tourmaline-surf-park": {
    src: "/images/seo-dioramas/beginner/socal/tourmaline-surf-park-photo.webp",
    alt: "Tourmaline Surf Park shoreline and mellow surf context",
  },
  "torrance-beach-rat-beach-torrance-ca": {
    src: "/images/seo-dioramas/beginner/socal/torrance-beach-rat-beach-torrance-ca-photo.webp",
    alt: "Torrance Beach shoreline for South Bay beginner surf planning",
  },
  "venice-beach-venice-ca": {
    src: "/images/seo-dioramas/beginner/socal/venice-beach-venice-ca-photo.webp",
    alt: "Venice Beach shoreline for Los Angeles beginner surf planning",
  },
  "will-rogers-state-beach-santa-monica-ca": {
    src: "/images/seo-dioramas/beginner/socal/will-rogers-state-beach-santa-monica-ca-photo.webp",
    alt: "Will Rogers State Beach shoreline for north Los Angeles beginner surf planning",
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
  "/surf-report/newport-beach-today": {
    src: "/images/seo-dioramas/beginner/socal/blackies-photo.webp",
    alt: "Newport Beach surf report context near Blackies",
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
      { label: "Best time to surf La Jolla", href: "/best-time-to-surf/la-jolla" },
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
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "la-jolla-longboard-tourmaline-photo",
        "/images/seo-dioramas/spot-backgrounds/tourmaline-photo.webp",
        "Tourmaline real photo for La Jolla longboard planning",
        "Tourmaline shoreline and longboard surf context near La Jolla",
        "Tourmaline photo",
      ),
      makeExistingPhotoImage(
        "la-jolla-longboard-shores-photo",
        "/images/seo-dioramas/spot-backgrounds/la-jolla-shores-photo.webp",
        "La Jolla Shores real photo for longboard backup planning",
        "La Jolla Shores shoreline and surf context for longboard backups",
        "La Jolla Shores photo",
      ),
      makeExistingPhotoImage(
        "la-jolla-longboard-scripps-photo",
        "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
        "Scripps Pier real photo for La Jolla longboard backup planning",
        "Scripps Pier surf lineup photo for nearby La Jolla planning",
        "Scripps Pier photo",
      ),
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
      {
        label: "Best time to surf Santa Barbara",
        href: "/best-time-to-surf/santa-barbara",
      },
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
      { label: "Best time to surf Honolulu", href: "/best-time-to-surf/honolulu" },
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
        href: "/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl",
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
      {
        label: "Tourmaline",
        href: "/surf-report/tourmaline-today",
        beachSlug: "tourmaline-surf-park",
      },
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
    existingImages: [
      makeExistingPhotoImage(
        "san-diego-beginner-la-jolla-shores-photo",
        "/images/seo-dioramas/beginner/socal/la-jolla-shores-photo.webp",
        "La Jolla Shores beach photo for beginner surf planning",
        "La Jolla Shores beach with gentle learner-zone surf",
        "La Jolla Shores - photo by Dirk Hansen, CC BY-SA 3.0",
      ),
      makeExistingPhotoImage(
        "san-diego-beginner-tourmaline-photo",
        "/images/seo-dioramas/beginner/socal/tourmaline-surf-park-photo.webp",
        "Tourmaline Surf Park shoreline photo for beginner and longboard planning",
        "Tourmaline Surf Park shoreline and mellow surf context",
        "Tourmaline - photo by Invertzoo, CC BY-SA 3.0",
      ),
      makeExistingPhotoImage(
        "san-diego-beginner-ocean-beach-photo",
        "/images/seo-dioramas/surf-cams/san-diego/san-diego-ocean-beach-line-photo.webp",
        "Ocean Beach wave photo for San Diego beginner context",
        "Ocean Beach wave line with surfers used for broader San Diego context",
        "Ocean Beach wave line",
      ),
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "santa-cruz",
    locationName: "Santa Cruz",
    title: "Beginner Surf Spots in Santa Cruz | Quiver",
    metaDescription:
      "Plan beginner surfing in Santa Cruz with Quiver's guide to Cowell's, Capitola, Pleasure Point, tide windows, safety notes, and live forecast links.",
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
    existingImages: [
      makeExistingPhotoImage(
        "orange-county-beginner-bolsa-chica-photo",
        "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
        "Bolsa Chica State Beach sandy shoreline for Orange County beginner surf planning",
        "Bolsa Chica State Beach shoreline and beginner surf context",
        "Bolsa Chica - photo by Jeff Turner, CC BY 2.0",
      ),
      makeExistingPhotoImage(
        "orange-county-beginner-doheny-photo",
        "/images/seo-dioramas/beginner/socal/doheny-beach-photo.webp",
        "Doheny State Beach soft learner-wave context",
        "Doheny State Beach shoreline for Orange County beginner planning",
        "Doheny - photo by Orange County Archives, CC BY 2.0",
      ),
      makeExistingPhotoImage(
        "orange-county-beginner-san-onofre-photo",
        "/images/seo-dioramas/beginner/socal/san-onofre-state-beach-photo.webp",
        "San Onofre State Beach gentle-wave context for Orange County beginner planning",
        "San Onofre State Beach sunset and gentle-wave planning context",
        "San Onofre - photo by Xylem9, CC BY-SA 4.0",
      ),
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "huntington-beach",
    locationName: "Huntington Beach",
    title: "Beginner Surf Spots in Huntington Beach | Quiver",
    metaDescription:
      "Plan beginner surfing in Huntington Beach with Quiver's guide to Bolsa Chica, small HB sandbars, Huntington State Beach, tide timing, and morning wind.",
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
        "huntington-beginner-bolsa-chica-photo",
        "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
        "Bolsa Chica State Beach shoreline for Huntington beginner surf planning",
        "Bolsa Chica State Beach sandy shoreline and beginner surf context",
        "Bolsa Chica - photo by Jeff Turner, CC BY 2.0",
      ),
      makeExistingPhotoImage(
        "huntington-beginner-state-beach-photo",
        "/images/seo-dioramas/beginner/socal/huntington-state-beach-photo.webp",
        "Huntington State Beach sandy surf zone for beginner planning",
        "Huntington State Beach sandy surf zone context",
        "Huntington State Beach - photo by FASTILY, CC BY-SA 4.0",
      ),
      makeExistingPhotoImage(
        "huntington-beginner-blackies-photo",
        "/images/seo-dioramas/beginner/socal/blackies-photo.webp",
        "Blackies and Newport Beach surf photo for Huntington beginner alternate planning",
        "Newport Beach surf context near Blackies for North Orange County backups",
        "Blackies/Newport - photo by Travis, CC BY 2.0",
      ),
    ],
  }),
  buildLocationPage({
    type: "beginner",
    slug: "los-angeles",
    locationName: "Los Angeles",
    title: "Beginner Surf Spots in Los Angeles | Quiver",
    metaDescription:
      "Plan beginner surfing in Los Angeles with Quiver's guide to Santa Monica, Will Rogers, Dockweiler, Venice, Torrance, and small-wave safety caveats.",
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
        "los-angeles-beginner-santa-monica-photo",
        "/images/seo-dioramas/beginner/socal/santa-monica-beach-santa-monica-ca-photo.webp",
        "Santa Monica State Beach shoreline for Los Angeles beginner surf planning",
        "Santa Monica State Beach shoreline and beginner surf context",
        "Santa Monica - photo by Alexander Migl, CC BY-SA 4.0",
      ),
      makeExistingPhotoImage(
        "los-angeles-beginner-will-rogers-photo",
        "/images/seo-dioramas/beginner/socal/will-rogers-state-beach-santa-monica-ca-photo.webp",
        "Will Rogers State Beach shoreline for north Los Angeles beginner surf planning",
        "Will Rogers State Beach shoreline and soft-surf planning context",
        "Will Rogers - photo by JCS, CC BY-SA 3.0",
      ),
      makeExistingPhotoImage(
        "los-angeles-beginner-dockweiler-photo",
        "/images/seo-dioramas/beginner/socal/dockweiler-state-beach-playa-del-rey-ca-photo.webp",
        "Dockweiler State Beach shoreline for wide sandy beginner planning",
        "Dockweiler State Beach shoreline and beginner logistics context",
        "Dockweiler - photo by Downtowngal, CC BY-SA 4.0",
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
      makeExistingPhotoImage(
        "santa-barbara-beginner-refugio-photo",
        "/images/seo-dioramas/beginner/socal/refugio-state-beach-goleta-ca-photo.webp",
        "Refugio State Beach shoreline for Santa Barbara beginner surf planning",
        "Refugio State Beach shoreline and conditional beginner surf context",
        "Refugio - photo by Tony Webster, CC BY-SA 2.0",
      ),
      makeExistingDioramaImage(
        "santa-barbara-beginner-bluff-wax-up-diorama",
        "/images/seo-dioramas/longboard/santa-barbara/bluff-wax-up-diorama.webp",
        "Santa Barbara bluff and board setup for cautious beginner planning",
        "Santa Barbara bluff board setup scene for cautious beginner planning",
        "Bluff board setup",
      ),
      makeExistingDioramaImage(
        "santa-barbara-beginner-palm-check-diorama",
        "/images/seo-dioramas/longboard/santa-barbara/santa-barbara-palm-check-diorama.webp",
        "Santa Barbara small-wave surf-check scene for beginner planning",
        "Santa Barbara small-wave surf-check scene",
        "Palm-lined surf check",
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
        href: "/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl",
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
    slug: "long-island",
    locationName: "Long Island",
    title: "Beginner Surf Spots on Long Island",
    metaDescription:
      "Plan beginner surf on Long Island with Quiver's guide to Long Beach, Rockaway, small-day filters, and honest Montauk caveats.",
    h1: "Beginner Surf Spots on Long Island",
    intro:
      "Long Island beginner surf works best when you treat it as a small-day planning problem, not a blanket yes for the whole coast or a famous-beach checklist.",
    bestZones:
      "Long Beach is still the clearest learner anchor because it combines the easiest lesson path, a familiar surf scene, and a straightforward sandy lineup on smaller days. Robert Moses deserves more weight than a footnote for true beginners who mostly need room to paddle, pop up, and learn ocean timing on a mellow day. Rockaway can work when the size stays tame and the crowd is manageable, while Lido and Gilgo are better supporting context than default first-session calls.",
    conditions:
      "Keep the filter conservative: roughly knee- to waist-high surf, light wind, enough shape to avoid closeouts, and a tide window that does not turn the inside into hard shorebreak. If the Atlantic side is dumping, side-shore, or sweeping sideways, it is not a beginner session even if the beach name is familiar. In summer, also check whether guarded hours compress surfing into smaller designated sections before you assume the beach will feel open and easy.",
    boardCall:
      "A soft-top is still the default. Only move into a hard longboard when the surfer can control trim, stop cleanly, and avoid drift around other learners. Body surfing and boogie boarding first are legitimate prep on Long Island because they teach shorebreak timing and where to be in the water before standing up enters the picture. Bigger exposed days can turn a beginner board into a liability fast because paddling back in and clearing the inside takes more judgment than the forecast headline suggests.",
    localNotes:
      "If you do not even own a board yet, Long Beach is the easiest place to call a school and book an adult lesson before you overthink spot hierarchy. Robert Moses is the cleaner self-practice backup when you just want reps on a big floaty board without forcing a crowded lineup. Smith Point can be the closest ocean option for some surfers, but proximity alone should not outrank crowd, shorebreak, and cleanup factor. Be explicit about Montauk: Ditch Plains can be a useful advanced-progressing reference, but it is not the core beginner recommendation and Turtle Cove should stay out of learner guidance entirely. If the obvious Long Beach or Robert Moses call looks too big, closey, or crowded, the honest move is to skip the session instead of forcing a famous-name check.",
    namedBreaks: ["Long Beach", "Robert Moses", "Smith Point", "Ditch Plains"],
    links: [
      { label: "Best time to surf", href: "/best-time-to-surf" },
      { label: "Belmar surf report today", href: "/surf-report/belmar-today" },
      { label: "Open Quiver map", href: "/map?search=Long%20Island" },
    ],
    spots: [
      {
        label: "Long Beach",
        href: "/ny/long-beach/long-beach-long-beach-ny",
        beachSlug: "long-beach-long-beach-ny",
        description:
          "Best first call for lessons, a familiar surf scene, and small-day sandy reps.",
      },
      {
        label: "Robert Moses State Park",
        href: "/ny/babylon/robert-moses-state-park-babylon-ny",
        beachSlug: "robert-moses-state-park-babylon-ny",
        description:
          "Cleaner self-practice backup when you want room to paddle and do not need a lesson scene.",
      },
      {
        label: "Smith Point County Park",
        href: "/ny/shirley/smith-point-county-park-shirley-ny",
        beachSlug: "smith-point-county-park-shirley-ny",
        description:
          "Closest-ocean option for some surfers, but only when the surf zone and shorebreak stay manageable.",
      },
      {
        label: "Ditch Plains",
        href: "/ny/montauk/ditch-plains-montauk-ny",
        beachSlug: "ditch-plains-montauk-ny",
        description:
          "Save this for later progression trips, not the first place to learn on Long Island.",
      },
    ],
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "long-island-beginner-robert-moses-photo",
        "/images/seo-dioramas/beginner/long-island/robert-moses-state-park-ny-photo.webp",
        "Robert Moses State Park shoreline for broad Long Island beginner surf planning",
        "Robert Moses State Park shoreline and broad Long Island surf context",
        "Robert Moses State Park - photo by KellyCampbell, CC BY-SA 4.0",
      ),
      makeExistingPhotoImage(
        "long-island-beginner-rockaway-photo",
        "/images/seo-dioramas/beginner/long-island/rockaway-beach-90th-st-queens-ny-photo.webp",
        "Rockaway Beach shoreline for New York beginner surf planning",
        "Rockaway Beach shoreline and New York beginner surf context",
        "Rockaway Beach - photo by joiseyshowaa, CC BY-SA 2.0",
      ),
      makeExistingPhotoImage(
        "long-island-beginner-long-beach-photo",
        "/images/seo-dioramas/beginner/long-island/long-beach-long-beach-ny-photo.webp",
        "Long Beach, New York shoreline for Long Island beginner surf planning",
        "Long Beach, New York shoreline and barrier-island beginner surf context",
        "Long Beach, NY - photo by Howard N2GOT, CC BY 2.0",
      ),
      makeExistingPhotoImage(
        "long-island-beginner-lido-photo",
        "/images/seo-dioramas/beginner/long-island/lido-beach-ny-photo.webp",
        "Lido Beach shoreline for broader Long Island beginner surf context",
        "Lido Beach shoreline and broader Long Island surf-planning context",
        "Lido Beach - photo by Michael LoCascio, CC BY-SA 3.0",
      ),
    ].slice(0, 3),
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
    existingImages: [
      makeExistingPhotoImage(
        "san-onofre-beginner-state-beach-photo",
        "/images/seo-dioramas/beginner/socal/san-onofre-state-beach-photo.webp",
        "San Onofre State Beach gentle-wave context for beginner planning",
        "San Onofre State Beach sunset and gentle-wave planning context",
        "San Onofre - photo by Xylem9, CC BY-SA 4.0",
      ),
      makeExistingDioramaImage(
        "san-onofre-trail-carry-diorama",
        "/images/seo-dioramas/beginner/san-onofre/san-onofre-trail-carry-diorama.webp",
        "San Onofre beach trail and board carry",
        "Quiver diorama of San Onofre beach trail and board carry",
        "Trail board carry",
      ),
      makeExistingDioramaImage(
        "gentle-logs-softtops-diorama",
        "/images/seo-dioramas/beginner/san-onofre/gentle-logs-softtops-diorama.webp",
        "Gentle rolling wave with classic logs and soft tops",
        "Miniature gentle rolling wave with classic logs and soft-top boards",
        "Gentle rolling wave",
      ),
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
  existingImages?: SeoImage[];
}

function buildTodayPage(seed: TodaySeed): SeoPageConfig {
  const images =
    seed.existingImages ??
    makeImages("surf-report-today", seed.slug, seed.images);
  const conditionSections = [
    {
      ...seed.sections[0],
      heading: `${seed.locationName} conditions right now`,
    },
    {
      heading: "Should you surf today?",
      body: seed.intro,
    },
    {
      ...seed.sections[1],
      heading: "When this spot is worth it",
    },
    ...seed.sections.slice(2),
  ];

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
    sections: conditionSections,
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
    title: "Scripps Pier Surf Report Today: Waves, Tide & Wind",
    metaDescription:
      "Scripps Pier surf report today with live wave height, tide, wind, best window, board call, wetsuit guidance, and La Jolla backups before you drive.",
    h1: "Scripps Pier Surf Report Today",
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
      { label: "Best time to surf La Jolla", href: "/best-time-to-surf/la-jolla" },
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
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "scripps-report-pier-photo",
        "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
        "Scripps Pier real photo for surf report planning",
        "Scripps Pier surf lineup photo for today's surf report",
        "Scripps Pier photo",
      ),
      makeExistingPhotoImage(
        "scripps-clean-set-photo",
        "/images/seo-dioramas/surf-report/scripps-pier-today/scripps-clean-set-photo.webp",
        "Clean San Diego wave photo for Scripps surf report context",
        "Clean San Diego wave with surfers used for Scripps surf report context",
        "Clean San Diego wave",
      ),
      makeExistingPhotoImage(
        "scripps-report-la-jolla-shores-photo",
        "/images/seo-dioramas/surf-cams/san-diego/san-diego-la-jolla-shores-photo.webp",
        "La Jolla Shores photo for nearby Scripps backup planning",
        "La Jolla Shores shoreline and surf context near Scripps Pier",
        "Nearby La Jolla backup",
      ),
    ],
  }),
  buildTodayPage({
    slug: "la-jolla-today",
    locationName: "La Jolla",
    title: "La Jolla Surf Report Today: Waves, Tide & Wind",
    metaDescription:
      "La Jolla surf report today with live wave height, tide, wind, and board call for La Jolla Shores, Windansea, and Scripps, plus nearby backups.",
    h1: "La Jolla Surf Report Today",
    intro:
      "La Jolla is several distinct breaks, so the right call depends on where you paddle out: Shores is the mellow beachbreak, Windansea is a heavier reef, and Scripps is a shifting beachbreak near the pier.",
    primarySpotSlug: "la-jolla-shores",
    fallbackSpotName: "La Jolla Shores",
    nearbySpotSlugs: ["windansea", "scripps", "birdrock"],
    boardCall:
      "Match the board to the break: plan for the mellow beachbreak at Shores, the heavier reef at Windansea, or the shifting beachbreak near Scripps Pier.",
    wetsuitCall:
      "Check Quiver's current water-temperature guidance for La Jolla before you leave.",
    tideRisk:
      "The same tide can suit one La Jolla break and miss another, so check the selected break before you drive.",
    windRisk:
      "Wind can change the call across Shores, Windansea, and Scripps; compare the live read for the break you plan to surf.",
    crowdParkingNote:
      "Choose the break before you drive, then use the live report and nearby links to switch if the first option is not the right call.",
    sections: [
      {
        heading: "How to read La Jolla today",
        body: "Start with La Jolla Shores for the broad city-level read, then compare Windansea and Scripps because each break responds differently.",
      },
      {
        heading: "When La Jolla is worth it",
        body: "The city-level verdict is only the first filter. Confirm that the tide, wind, and wave window fit the specific break you plan to surf.",
      },
      {
        heading: "Backup plan",
        body: "Use Shores as the mellow beachbreak option, Windansea for the heavier reef read, and Scripps for the shifting beachbreak near the pier.",
      },
    ],
    links: [
      { label: "Best time to surf La Jolla", href: "/best-time-to-surf/la-jolla" },
      { label: "Scripps Pier today", href: "/surf-report/scripps-pier-today" },
      { label: "Tourmaline today", href: "/surf-report/tourmaline-today" },
      { label: "San Diego surf cams", href: "/surf-cams/san-diego" },
      { label: "Beginner surf in San Diego", href: "/beginner/san-diego" },
    ],
    spots: [
      {
        label: "La Jolla Shores",
        href: "/ca/la-jolla/la-jolla-shores",
        beachSlug: "la-jolla-shores",
      },
      {
        label: "Windansea",
        href: "/ca/la-jolla/windansea",
        beachSlug: "windansea",
      },
      {
        label: "Scripps",
        href: "/ca/la-jolla/scripps",
        beachSlug: "scripps",
      },
    ],
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "la-jolla-report-shores-photo",
        "/images/seo-dioramas/spot-backgrounds/la-jolla-shores-photo.webp",
        "La Jolla Shores photo for city surf report planning",
        "La Jolla Shores shoreline and surf context for today's La Jolla report",
        "La Jolla Shores photo",
      ),
      makeExistingPhotoImage(
        "la-jolla-report-shores-context-photo",
        "/images/seo-dioramas/surf-cams/san-diego/san-diego-la-jolla-shores-photo.webp",
        "La Jolla Shores photo for comparing today's La Jolla breaks",
        "La Jolla Shores surf context used to compare La Jolla's breaks",
        "La Jolla Shores context",
      ),
      makeExistingPhotoImage(
        "la-jolla-report-scripps-photo",
        "/images/seo-dioramas/spot-backgrounds/scripps-pier-photo.webp",
        "Scripps clean surf image for La Jolla break comparison",
        "Scripps surf context for comparing today's La Jolla breaks",
        "Scripps surf",
      ),
    ],
  }),
  buildTodayPage({
    slug: "belmar-today",
    locationName: "Belmar",
    title: "Belmar NJ Surf Report Today: Waves, Wind & Tide",
    metaDescription:
      "Belmar NJ surf report today with live wave height, tide, wind, best window, board call, cold-water wetsuit guidance, and nearby backup spots.",
    h1: "Belmar NJ Surf Report Today",
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
      { label: "Best time to surf Belmar", href: "/best-time-to-surf/belmar" },
      {
        label: "3rd Avenue Jetty forecast",
        href: "/nj/belmar/3rd-avenue-jetty-belmar-nj",
      },
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
    title: "Tourmaline Surf Report Today: Longboard Window & Wind",
    metaDescription:
      "Tourmaline surf report today with live wave height, tide, wind, longboard window, board call, parking note, and La Jolla backups before you drive.",
    h1: "Tourmaline Surf Report Today",
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
      { label: "Best time to surf La Jolla", href: "/best-time-to-surf/la-jolla" },
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
    slug: "newport-beach-today",
    locationName: "Newport Beach",
    title: "Newport Beach Surf Report Today: Waves & Wind",
    metaDescription:
      "Newport Beach surf report today with live wave height, tide, wind, best window, board call, Blackies notes, and jetty backups before you drive.",
    h1: "Newport Beach Surf Report Today",
    intro:
      "Newport can look simple from the sand, but Blackies, the jetties, tide, and morning wind decide whether the beachbreak is worth the paddle.",
    primarySpotSlug: "blackies",
    fallbackSpotName: "Newport Beach",
    nearbySpotSlugs: ["newport-56th-st", "bolsa-chica", "goldenwest"],
    boardCall:
      "Start with a fish or shortboard when the jetties have shape. Bring a log only when Blackies is small, soft, and uncrowded enough for trim.",
    wetsuitCall:
      "Plan for Southern California water swings, especially at dawn. Check Quiver's current water-temperature context before leaving.",
    tideRisk:
      "Newport beachbreak can shift quickly with tide; too much water can soften Blackies and too little can make the inside dumpy.",
    windRisk:
      "The cleanest Newport read is usually early. Once the onshore wind fills in, compare Bolsa Chica or Goldenwest before forcing it.",
    crowdParkingNote:
      "Parking and lineup space matter at Blackies. If the close spots are stacked, use the jetties or North OC backups instead of forcing the peak.",
    sections: [
      {
        heading: "How to read Newport Beach today",
        body: "Use the live verdict as the first filter, then check tide, wind, crowd, and whether Blackies or the jetties have the cleaner bank.",
      },
      {
        heading: "When Newport Beach is worth it",
        body: "Clean knee-to-shoulder-high surf with light wind and a tide that leaves shape on the sandbars is the useful window.",
      },
      {
        heading: "Backup plan",
        body: "If Blackies is crowded or too soft, compare Newport jetties, Bolsa Chica, Goldenwest, and the broader Orange County cam read before driving south.",
      },
    ],
    links: [
      { label: "Best time to surf Newport Beach", href: "/best-time-to-surf/newport-beach" },
      { label: "Orange County surf cams", href: "/surf-cams/orange-county" },
      { label: "Beginner surf in Orange County", href: "/beginner/orange-county" },
      { label: "Blackies forecast", href: "/ca/newport-beach/blackies" },
    ],
    spots: [
      {
        label: "Blackies",
        href: "/ca/newport-beach/blackies",
        beachSlug: "blackies",
      },
      {
        label: "Newport 56th Street",
        href: "/ca/newport-beach/newport-56th-st",
        beachSlug: "newport-56th-st",
      },
      {
        label: "Bolsa Chica",
        href: "/ca/huntington-beach/bolsa-chica",
        beachSlug: "bolsa-chica",
      },
      {
        label: "Goldenwest",
        href: "/ca/huntington-beach/goldenwest",
        beachSlug: "goldenwest",
      },
    ],
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "newport-beach-report-blackies-photo",
        "/images/seo-dioramas/beginner/socal/blackies-photo.webp",
        "Newport Beach surf photo for Blackies surf report planning",
        "Newport Beach surf context near Blackies",
        "Blackies/Newport - photo by Travis, CC BY 2.0",
      ),
      makeExistingPhotoImage(
        "newport-beach-report-bolsa-chica-photo",
        "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
        "Bolsa Chica shoreline photo for North Orange County fallback planning",
        "Bolsa Chica shoreline context for North Orange County surf planning",
        "Bolsa Chica - photo by Jeff Turner, CC BY 2.0",
      ),
      makeExistingPhotoImage(
        "newport-beach-report-doheny-photo",
        "/images/seo-dioramas/beginner/socal/doheny-beach-photo.webp",
        "Doheny State Beach photo for Orange County backup planning",
        "Doheny shoreline context for Orange County surf-report backups",
        "Doheny - photo by Orange County Archives, CC BY 2.0",
      ),
    ],
  }),
  buildTodayPage({
    slug: "malibu-today",
    locationName: "Malibu",
    title: "Malibu Surf Report Today: Waves, Tide & Wind",
    metaDescription:
      "Malibu surf report today with live wave height, tide, wind, best window, board call, crowd notes, and First Point backups before you drive.",
    h1: "Malibu Surf Report Today",
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
      { label: "Best time to surf Malibu", href: "/best-time-to-surf/malibu" },
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
  existingImages?: SeoImage[];
}

function buildCamPage(seed: CamSeed): SeoPageConfig {
  const images =
    seed.existingImages ?? makePhotoImages("surf-cams", seed.slug, seed.images);

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
    title: "San Diego Live Surf Cams | Quiver",
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
    images: [],
    existingImages: [
      makeExistingPhotoImage(
        "orange-county-cams-bolsa-chica-photo",
        "/images/seo-dioramas/beginner/socal/bolsa-chica-photo.webp",
        "Bolsa Chica shoreline photo for Orange County surf-cam planning",
        "Bolsa Chica shoreline and North Orange County surf context",
        "Bolsa Chica - photo by Jeff Turner, CC BY 2.0",
      ),
      makeExistingPhotoImage(
        "orange-county-cams-huntington-state-photo",
        "/images/seo-dioramas/beginner/socal/huntington-state-beach-photo.webp",
        "Huntington State Beach photo for Orange County surf-cam planning",
        "Huntington State Beach sandy surf zone context",
        "Huntington State Beach - photo by FASTILY, CC BY-SA 4.0",
      ),
      makeExistingPhotoImage(
        "orange-county-cams-doheny-photo",
        "/images/seo-dioramas/beginner/socal/doheny-beach-photo.webp",
        "Doheny State Beach photo for Orange County backup cam planning",
        "Doheny State Beach shoreline for Orange County surf-cam planning",
        "Doheny - photo by Orange County Archives, CC BY 2.0",
      ),
    ],
  }),
  buildCamPage({
    slug: "hawaii",
    locationName: "Hawaii",
    title: "Hawaii Live Surf Cams | Quiver",
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
    title: "Florida Live Surf Cams | Quiver",
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
        href: "/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl",
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
