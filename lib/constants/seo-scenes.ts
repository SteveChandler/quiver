export interface SeoScene {
  imageSrc: string;
  alt: string;
  objectPosition?: string;
  attribution?: string;
}

const LA_JOLLA_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/la-jolla-scripps-clean.webp",
  alt: "Scripps Pier at sunset with waves rolling under the pier.",
  objectPosition: "center",
};

const LA_JOLLA_SESSION_SCENE: SeoScene = {
  imageSrc: "/images/hero/hero-1-la-jolla.webp",
  alt: "La Jolla coastal cliffs above a calm ocean horizon.",
  objectPosition: "center",
};

const SAN_ONOFRE_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/san-onofre-clean.webp",
  alt: "Diorama-style surf trail opening onto a San Onofre lineup.",
  objectPosition: "center",
};

const SANTA_CRUZ_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/santa-cruz-steamer-lane.webp",
  alt: "Steamer Lane surf breaking below the Santa Cruz lighthouse.",
  objectPosition: "center",
};

const COCOA_BEACH_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/cocoa-beach-pier.webp",
  alt: "Cocoa Beach Pier stretching over small surf with surfers on the sand.",
  objectPosition: "center",
};

const WESTPORT_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/westport-jetty.webp",
  alt: "Westport Jetty with whitewater surf beside the rock breakwater.",
  objectPosition: "center",
};

const RINCON_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/rincon-domes.webp",
  alt: "Domes in Rincón with turquoise waves wrapping onto the beach.",
  objectPosition: "center",
};

const RINCON_SESSION_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/rincon-marias.webp",
  alt: "María's Beach in Rincón with clear reef waves and surfers at the shoreline.",
  objectPosition: "center",
};

const PACIFICA_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/pacifica-linda-mar.webp",
  alt: "Linda Mar in Pacifica with small surf rolling toward the beach.",
  objectPosition: "center",
};

const SAN_ONOFRE_PLAN_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/san-onofre-plan-clean.webp",
  alt: "Longboard-friendly beach scene with clean waves and an open shoreline.",
  objectPosition: "center",
};

const PUERTO_RICO_BEGINNER_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/beginner-pr-natural.webp",
  alt: "Beginner surfers walking across wet sand beside small rolling waves.",
  objectPosition: "center",
};

const NORTH_CAROLINA_BEGINNER_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/north-carolina-carolina-beach.jpg",
  alt: "Small surf rolling into Carolina Beach under bright North Carolina sun.",
  objectPosition: "center",
  attribution: "Photo: Billy Hathorn / Wikimedia Commons (CC BY 3.0)",
};

const SAN_DIEGO_SCENE: SeoScene = {
  imageSrc: "/images/seo-scenes/la-jolla-scripps-clean.webp",
  alt: "Morning swell lines breaking past Scripps Pier in San Diego.",
  // Keep the pier and the breaking swell in frame when cropped to a tall panel.
  objectPosition: "40% 60%",
};

const CITY_SCENES: Record<string, SeoScene> = {
  "san-diego": SAN_DIEGO_SCENE,
  "la-jolla": LA_JOLLA_SCENE,
  "san-onofre": SAN_ONOFRE_SCENE,
  "santa-cruz": SANTA_CRUZ_SCENE,
  "cocoa-beach": COCOA_BEACH_SCENE,
  "westport": WESTPORT_SCENE,
  "rincon": RINCON_SCENE,
  "pacifica": PACIFICA_SCENE,
};

const CITY_INTENT_SCENES: Record<string, SeoScene> = {
  "longboard:san-onofre": SAN_ONOFRE_SCENE,
};

const BEST_TIME_SESSION_SCENES: Record<string, SeoScene> = {
  "la-jolla": LA_JOLLA_SESSION_SCENE,
  "rincon": RINCON_SESSION_SCENE,
};

const CITY_INTENT_PLAN_SCENES: Record<string, SeoScene> = {
  "longboard:san-onofre": SAN_ONOFRE_PLAN_SCENE,
};

const STATE_INTENT_SCENES: Record<string, SeoScene> = {
  "beginner:pr": PUERTO_RICO_BEGINNER_SCENE,
  "beginner:nc": NORTH_CAROLINA_BEGINNER_SCENE,
};

export function getBestTimeSeoScene(citySlug: string): SeoScene | null {
  return CITY_SCENES[citySlug] ?? null;
}

export function getCityIntentSeoScene(
  intentSlug: string,
  citySlug: string
): SeoScene | null {
  return CITY_INTENT_SCENES[`${intentSlug}:${citySlug}`] ?? CITY_SCENES[citySlug] ?? null;
}

export function getBestTimeSessionSeoScene(citySlug: string): SeoScene | null {
  return BEST_TIME_SESSION_SCENES[citySlug] ?? null;
}

export function getCityIntentPlanSeoScene(
  intentSlug: string,
  citySlug: string
): SeoScene | null {
  return CITY_INTENT_PLAN_SCENES[`${intentSlug}:${citySlug}`] ?? null;
}

export function getStateIntentSeoScene(
  intentSlug: string,
  stateSlug: string
): SeoScene | null {
  return STATE_INTENT_SCENES[`${intentSlug}:${stateSlug}`] ?? null;
}
