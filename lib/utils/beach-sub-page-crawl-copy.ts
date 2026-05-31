import type { SubPageType } from "@/lib/utils/beach-sub-page-utils";

type CrawlCopyBeach = {
  name: string;
  city?: string | null;
  state?: string | null;
};

export type BeachSubPageCrawlLink = {
  label: string;
  href: string;
  description: string;
};

export type BeachSubPageCrawlCopy = {
  heading: string;
  summary: string;
  links: BeachSubPageCrawlLink[];
};

type BuildBeachSubPageCrawlCopyInput = {
  beach: CrawlCopyBeach;
  pageType: SubPageType;
  beachPath: string;
};

export function buildBeachSubPageCrawlCopy({
  beach,
  pageType,
  beachPath,
}: BuildBeachSubPageCrawlCopyInput): BeachSubPageCrawlCopy {
  const location = formatBeachLocation(beach);

  if (pageType === "tides") {
    return {
      heading: `${beach.name} Tide Chart`,
      summary: `Use this ${beach.name}${location} tide page as a crawlable planning checkpoint for tide timing, surf forecast context, and nearby spot comparison before you paddle out.`,
      links: [
        {
          label: `Open the full ${beach.name} surf report`,
          href: beachPath,
          description: "Return to the full spot page for forecast, reviews, intel, and sessions.",
        },
        {
          label: "Check water temperature",
          href: `${beachPath}/water-temp`,
          description: "Pair the tide call with gear and water-temperature context.",
        },
        {
          label: "Compare nearby surf spots",
          href: "/map",
          description: "Use the map when this spot is not the right call.",
        },
      ],
    };
  }

  return {
    heading: `${beach.name} Water Temperature`,
    summary: `Use this ${beach.name}${location} water temperature page as a crawlable gear-planning checkpoint for current ocean temperature, wetsuit context, and the next tide window.`,
    links: [
      {
        label: `Open the full ${beach.name} surf report`,
        href: beachPath,
        description: "Return to the full spot page for forecast, reviews, intel, and sessions.",
      },
      {
        label: "Watch the tide window",
        href: `${beachPath}/tides`,
        description: "Pair water temperature with the next useful tide shift.",
      },
      {
        label: "Compare nearby surf spots",
        href: "/map",
        description: "Use the map when this spot is not the right call.",
      },
    ],
  };
}

function formatBeachLocation(beach: CrawlCopyBeach): string {
  const parts = [beach.city, beach.state].filter(Boolean);
  if (parts.length === 0) return "";
  return ` in ${parts.join(", ")}`;
}
