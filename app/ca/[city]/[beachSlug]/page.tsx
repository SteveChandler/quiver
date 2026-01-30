import type { Metadata } from "next";

export { dynamic } from "@/app/[intent]/[city]/[beachSlug]/page";

export default async function CaBeachDetailPage(
  props: {
    params: Promise<{ city: string; beachSlug: string }>;
  }
) {
  const params = await props.params;
  const { default: GenericBeachDetailPage } = await import(
    "@/app/[intent]/[city]/[beachSlug]/page"
  );

  return GenericBeachDetailPage({
    params: { intent: "ca", city: params.city, beachSlug: params.beachSlug },
  });
}

export async function generateMetadata(
  props: {
    params: Promise<{ city: string; beachSlug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const { generateMetadata: generateGenericMetadata } = await import(
    "@/app/[intent]/[city]/[beachSlug]/page"
  );

  return generateGenericMetadata({
    params: { intent: "ca", city: params.city, beachSlug: params.beachSlug },
  });
}





