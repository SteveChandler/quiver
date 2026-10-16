import { redirect } from "next/navigation";

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  const params = await searchParams;
  const spot = Array.isArray(params.spot) ? params.spot[0] : params.spot;
  const target = spot ? `/app/spot/${encodeURIComponent(spot)}` : "/app";
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "spot" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }

  redirect(query.size ? `${target}?${query.toString()}` : target);
}
