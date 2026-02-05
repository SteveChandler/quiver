import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export default async function GaBeachDetailPage(
  props: {
    params: Promise<{ city: string; beachSlug: string }>;
  }
) {
  const params = await props.params;
  const { default: GenericBeachDetailPage } = await import(
    "@/app/[intent]/[city]/[beachSlug]/page"
  );

  return GenericBeachDetailPage({
    params: Promise.resolve({ intent: "ga", city: params.city, beachSlug: params.beachSlug }),
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
    params: Promise.resolve({ intent: "ga", city: params.city, beachSlug: params.beachSlug }),
  });
}
