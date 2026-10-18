import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImportBeachPage } from "@/components/garmin/import-beach-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finish surf import | Quiver", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SessionImportPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const query = await searchParams;
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => queryParams.append(key, item));
    else if (value !== undefined) queryParams.set(key, value);
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = `/sessions/imports/${encodeURIComponent(id)}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    redirect(`/auth/sign-in?redirectTo=${encodeURIComponent(next)}`);
  }

  return <main className="mx-auto min-h-screen max-w-xl px-4 py-10"><ImportBeachPage importId={id} /></main>;
}
