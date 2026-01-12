import type { Metadata } from "next";

export { dynamic } from "@/app/[intent]/[city]/[beachSlug]/page";

export default async function CaBeachDetailPage({
  params,
}: {
  params: { city: string; beachSlug: string };
}) {
  const { default: GenericBeachDetailPage } = await import(
    "@/app/[intent]/[city]/[beachSlug]/page"
  );

  return GenericBeachDetailPage({
    params: { intent: "ca", city: params.city, beachSlug: params.beachSlug },
  });
}

export async function generateMetadata({
  params,
}: {
  params: { city: string; beachSlug: string };
}): Promise<Metadata> {
  const { generateMetadata: generateGenericMetadata } = await import(
    "@/app/[intent]/[city]/[beachSlug]/page"
  );

  return generateGenericMetadata({
    params: { intent: "ca", city: params.city, beachSlug: params.beachSlug },
  });
}





