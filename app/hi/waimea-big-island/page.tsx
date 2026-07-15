import LocationPage, {
  generateMetadata as generateLocationMetadata,
} from "@/app/beaches/[country]/[state]/[city]/page";

const locationParams = {
  country: "usa",
  state: "hi",
  city: "waimea-big-island",
} as const;

export const revalidate = 3600;

export function generateMetadata() {
  return generateLocationMetadata({ params: Promise.resolve(locationParams) });
}

export default function WaimeaBigIslandPage() {
  return LocationPage({ params: Promise.resolve(locationParams) });
}
